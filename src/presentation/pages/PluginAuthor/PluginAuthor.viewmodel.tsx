import { useCallback, useMemo, useState } from 'react';
import { usePluginStore } from '../../../stores/usePluginStore';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useActions } from '../../../stores/useActions';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useScriptStore } from '../../../stores/useScriptStore';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { buildPackage } from '../../../domain/usecases/plugins/packageBuilder';
import { validatePackage } from '../../../domain/usecases/plugins/pluginReferences';
import { parsePackage, serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import { validatePluginManifest } from '../../../domain/schema/plugin/pluginManifest';
import { KERNEL_VERSION } from '../../../domain/schema/plugin/kernelVersion';
import type { PluginManifest } from '../../../domain/schema/plugin/pluginManifest';
import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';

export type ArtifactKind = 'screens' | 'actions' | 'workflows' | 'scripts';

export interface ArtifactOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface ArtifactGroup {
  kind: ArtifactKind;
  title: string;
  options: ArtifactOption[];
}

export interface PluginAuthorViewModel {
  canManage: boolean;
  canPublish: boolean;
  form: { id: string; name: string; version: string; description: string; summary: string; dependencies: string };
  updateForm: (patch: Partial<PluginAuthorViewModel['form']>) => void;
  groups: ArtifactGroup[];
  toggle: (kind: ArtifactKind, id: string) => void;
  selectedCount: number;
  issues: string[];
  canExport: boolean;
  busy: boolean;
  download: () => void;
  publish: () => Promise<void>;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

const parseDependencies = (raw: string): Record<string, string> => {
  const deps: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const [id, range] = line.trim().split(/\s+/);
    if (id && range) deps[id] = range;
  }
  return deps;
};

const useSelection = () => {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  return [ids, toggle] as const;
};

export const usePluginAuthorViewModel = (): PluginAuthorViewModel => {
  const { install, publish, canPublish } = usePluginStore();
  const { definitions } = useScreenDefinitions();
  const { actions } = useActions();
  const { workflows } = useWorkflowStore();
  const { scripts } = useScriptStore();
  const { tenantRole } = useTenant();
  const { userRole } = useAuth();
  const { notify } = useNotification();

  const canManage = userRole === 'SYSTEM' || tenantRole === 'admin';

  const [form, setForm] = useState({
    id: '', name: '', version: '1.0.0', description: '', summary: '', dependencies: '',
  });
  const updateForm = useCallback((patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch })), []);

  const [screenIds, toggleScreen] = useSelection();
  const [actionIds, toggleAction] = useSelection();
  const [workflowIds, toggleWorkflow] = useSelection();
  const [scriptIds, toggleScript] = useSelection();
  const [busy, setBusy] = useState(false);

  const ownScreens = useMemo(
    () => definitions.filter((d) => !d.builtin && !d.ownerPluginId),
    [definitions],
  );
  const ownActions = useMemo(() => actions.filter((a) => !a.ownerPluginId), [actions]);
  const ownWorkflows = useMemo(() => workflows.filter((w) => !w.ownerPluginId), [workflows]);
  const ownScripts = useMemo(() => scripts.filter((s) => !s.ownerPluginId), [scripts]);

  const groups = useMemo<ArtifactGroup[]>(() => [
    {
      kind: 'screens', title: 'Telas',
      options: ownScreens.map((d) => ({ id: d.id, label: d.titlePlural || d.id, selected: screenIds.has(d.id) })),
    },
    {
      kind: 'actions', title: 'Ações',
      options: ownActions.map((a) => ({ id: a.id, label: a.title || a.key, selected: actionIds.has(a.id) })),
    },
    {
      kind: 'workflows', title: 'Automações',
      options: ownWorkflows.map((w) => ({ id: w.id, label: w.name, selected: workflowIds.has(w.id) })),
    },
    {
      kind: 'scripts', title: 'Scripts',
      options: ownScripts.map((s) => ({ id: s.id, label: s.name, selected: scriptIds.has(s.id) })),
    },
  ], [ownScreens, ownActions, ownWorkflows, ownScripts, screenIds, actionIds, workflowIds, scriptIds]);

  const toggle = useCallback((kind: ArtifactKind, id: string) => {
    if (kind === 'screens') toggleScreen(id);
    else if (kind === 'actions') toggleAction(id);
    else if (kind === 'workflows') toggleWorkflow(id);
    else toggleScript(id);
  }, [toggleScreen, toggleAction, toggleWorkflow, toggleScript]);

  const manifest = useMemo<PluginManifest>(() => {
    const deps = parseDependencies(form.dependencies);
    return {
      id: form.id.trim(),
      version: form.version.trim(),
      kernel: '^1.0.0',
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(Object.keys(deps).length > 0 ? { dependencies: deps } : {}),
    };
  }, [form]);

  const selection = useMemo(() => ({
    screens: ownScreens.filter((d) => screenIds.has(d.id)),
    actions: ownActions.filter((a) => actionIds.has(a.id)),
    workflows: ownWorkflows.filter((w) => workflowIds.has(w.id)),
    scripts: ownScripts.filter((s) => scriptIds.has(s.id)),
  }), [ownScreens, ownActions, ownWorkflows, ownScripts, screenIds, actionIds, workflowIds, scriptIds]);

  const selectedCount = useMemo(
    () => selection.screens.length + selection.actions.length + selection.workflows.length + selection.scripts.length,
    [selection],
  );

  const pkg = useMemo<MarketplacePlugin>(
    () => buildPackage({ ...selection, manifest, summary: form.summary.trim() }),
    [selection, manifest, form.summary],
  );

  const issues = useMemo<string[]>(() => [
    ...validatePluginManifest(manifest, { kernelVersion: KERNEL_VERSION, validateContributions: false }).map((d) => d.message),
    ...(form.summary.trim() ? [] : ['A extensão precisa de uma descrição curta (resumo).']),
    ...validatePackage(pkg).map((i) => i.message),
  ], [manifest, form.summary, pkg]);

  const canExport = selectedCount > 0 && issues.length === 0;

  const download = useCallback(() => {
    const blob = new Blob([serializePackage(pkg)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${manifest.id || 'extensao'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Arquivo da extensão gerado.', 'success');
  }, [pkg, manifest.id, notify]);

  const publishPackage = useCallback(async () => {
    setBusy(true);
    try {
      const errors = await publish(pkg);
      if (errors.length > 0) notify(`Não foi possível publicar: ${errors[0].message}`, 'error');
      else notify(`${manifest.name || manifest.id} publicado no catálogo.`, 'success');
    } finally {
      setBusy(false);
    }
  }, [publish, pkg, manifest.name, manifest.id, notify]);

  const onImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parsePackage(await file.text());
      if (!parsed.ok) {
        notify(parsed.error, 'error');
        return;
      }
      const imported = parsed.package;
      const manifestErrors = validatePluginManifest(imported.manifest, {
        kernelVersion: KERNEL_VERSION,
        validateContributions: false,
      });
      const refErrors = validatePackage(imported);
      if (manifestErrors.length > 0 || refErrors.length > 0) {
        notify(`Extensão inválida: ${(manifestErrors[0]?.message ?? refErrors[0]?.message)}`, 'error');
        return;
      }
      const error = await install(imported);
      if (error) notify(error.message, 'error');
      else notify(`${imported.manifest.name || imported.manifest.id} instalado.`, 'success');
    } catch (err) {
      notify(`Não foi possível importar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [install, notify]);

  return {
    canManage,
    canPublish,
    form,
    updateForm,
    groups,
    toggle,
    selectedCount,
    issues,
    canExport,
    busy,
    download,
    publish: publishPackage,
    onImportFile,
  };
};
