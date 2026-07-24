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
import { packageOutRefs, validatePackage } from '../../../domain/usecases/plugins/pluginReferences';
import { serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import { validatePluginManifest } from '../../../domain/schema/plugin/pluginManifest';
import { KERNEL_VERSION } from '../../../domain/schema/plugin/kernelVersion';
import { nav, page } from '../../../plugins/contributionBuilders';
import { compileExtensionView } from '../../shared/extensions/evaluateExtensionView';
import { getScreenIconOptions } from '../../shared/screenIcons';
import type { PluginManifest } from '../../../domain/schema/plugin/pluginManifest';
import type { Contribution } from '../../../domain/schema/plugin/contribution';
import type { RefKind } from '../../../domain/usecases/plugins/pluginReferences';
import type { MarketplacePlugin, ViewModuleTemplate } from '../../../domain/entities/MarketplacePlugin';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

const VIEW_STARTER = `import { useCasePhases } from '@curatino/data';

export default function View() {
  const phases = useCasePhases();
  return (
    <div style={{ padding: 16 }}>
      Minha extensão — {phases.length} fase(s) cadastrada(s).
    </div>
  );
}
`;

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const KIND_LABEL: Record<RefKind, string> = {
  screen: 'a tela',
  action: 'a ação',
  workflow: 'a automação',
  script: 'o script',
};

const STUB_MANIFEST: PluginManifest = { id: 'seu.plugin', version: '1.0.0', kernel: '^1.0.0', name: 'x' };

export type ArtifactKind = 'screens' | 'actions' | 'workflows' | 'scripts';

export interface ArtifactOption {
  id: string;
  label: string;
  /** Chave de ícone (telas/ações têm; automações/scripts caem no ícone padrão do grupo na view). */
  icon?: string;
  selected: boolean;
  /** Dependência de um item marcado: entra obrigatoriamente e não pode ser desmarcada. */
  locked: boolean;
}

export interface ArtifactGroup {
  kind: ArtifactKind;
  title: string;
  options: ArtifactOption[];
}

interface CodeViewForm {
  uid: string;
  key: string;
  title: string;
  icon: string;
  source: string;
}

export interface CodeViewItem {
  id: string;
  title: string;
  icon: string;
  hasError: boolean;
}

export interface CodeViewEditing {
  key: string;
  title: string;
  icon: string;
  source: string;
  error: string | null;
}

export interface PluginAuthorViewModel {
  canManage: boolean;
  canPublish: boolean;
  form: { id: string; name: string; version: string; description: string; summary: string };
  updateForm: (patch: Partial<PluginAuthorViewModel['form']>) => void;
  groups: ArtifactGroup[];
  toggle: (kind: ArtifactKind, id: string) => void;
  iconOptions: SearchSelectOption[];
  codeViews: CodeViewItem[];
  selectedViewId: string | null;
  selectedView: CodeViewEditing | null;
  addView: () => void;
  removeView: (id: string) => void;
  selectView: (id: string) => void;
  updateSelectedView: (patch: Partial<Omit<CodeViewEditing, 'error'>>) => void;
  previewOpen: boolean;
  togglePreview: () => void;
  previewSource: string | null;
  selectedCount: number;
  issues: string[];
  canExport: boolean;
  busy: boolean;
  download: () => void;
  publish: () => Promise<void>;
}

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

const union = (a: Set<string>, b: Set<string>): Set<string> => new Set([...a, ...b]);

export const usePluginAuthorViewModel = (): PluginAuthorViewModel => {
  const { publish, canPublish } = usePluginStore();
  const { definitions } = useScreenDefinitions();
  const { actions } = useActions();
  const { workflows } = useWorkflowStore();
  const { scripts } = useScriptStore();
  const { tenantRole } = useTenant();
  const { userRole } = useAuth();
  const { notify } = useNotification();

  const canManage = userRole === 'SYSTEM' || tenantRole === 'admin';

  const [form, setForm] = useState({ id: '', name: '', version: '1.0.0', description: '', summary: '' });
  const updateForm = useCallback((patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch })), []);

  const [screenIds, toggleScreen] = useSelection();
  const [actionIds, toggleAction] = useSelection();
  const [workflowIds, toggleWorkflow] = useSelection();
  const [scriptIds, toggleScript] = useSelection();
  const [busy, setBusy] = useState(false);

  const [views, setViews] = useState<CodeViewForm[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const iconOptions = useMemo<SearchSelectOption[]>(
    () => getScreenIconOptions().map((option) => ({ value: option.key, label: option.label })),
    [],
  );

  const addView = useCallback(() => {
    const uid = crypto.randomUUID();
    setViews((prev) => {
      const n = prev.length + 1;
      return [...prev, { uid, key: `tela-${n}`, title: `Tela ${n}`, icon: 'layoutGrid', source: VIEW_STARTER }];
    });
    setSelectedViewId(uid);
    setPreviewOpen(false);
  }, []);

  const removeView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.uid !== id));
    setSelectedViewId((current) => (current === id ? null : current));
  }, []);

  const selectView = useCallback((id: string) => {
    setSelectedViewId(id);
    setPreviewOpen(false);
  }, []);

  const updateSelectedView = useCallback((patch: Partial<Omit<CodeViewEditing, 'error'>>) => {
    setViews((prev) => prev.map((v) => (v.uid === selectedViewId ? { ...v, ...patch } : v)));
  }, [selectedViewId]);

  const togglePreview = useCallback(() => setPreviewOpen((open) => !open), []);

  const viewErrors = useMemo<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    for (const v of views) {
      if (!v.source.trim()) { map[v.uid] = 'sem código'; continue; }
      const result = compileExtensionView(v.source);
      map[v.uid] = result.ok ? null : result.error;
    }
    return map;
  }, [views]);

  const codeViews = useMemo<CodeViewItem[]>(
    () => views.map((v) => ({ id: v.uid, title: v.title.trim() || v.key.trim() || 'Sem título', icon: v.icon, hasError: Boolean(viewErrors[v.uid]) })),
    [views, viewErrors],
  );

  const selectedView = useMemo<CodeViewEditing | null>(() => {
    const found = views.find((v) => v.uid === selectedViewId);
    return found ? { key: found.key, title: found.title, icon: found.icon, source: found.source, error: viewErrors[found.uid] ?? null } : null;
  }, [views, selectedViewId, viewErrors]);

  const previewSource = previewOpen && selectedView ? selectedView.source : null;

  const codeContributions = useMemo<Contribution[]>(
    () => views.flatMap((v, index) => {
      const key = v.key.trim();
      if (!KEY_PATTERN.test(key)) return [];
      const label = v.title.trim() || key;
      return [nav({ key, label, icon: v.icon, order: 100 + index }), page({ key, title: label, icon: v.icon }, key)];
    }),
    [views],
  );

  const viewTemplates = useMemo<ViewModuleTemplate[]>(
    () => views.map((v) => ({ key: v.key.trim(), title: v.title.trim() || v.key.trim(), icon: v.icon, source: v.source })),
    [views],
  );

  const ownScreens = useMemo(() => definitions.filter((d) => !d.builtin && !d.ownerPluginId), [definitions]);
  const ownActions = useMemo(() => actions.filter((a) => !a.ownerPluginId), [actions]);
  const ownWorkflows = useMemo(() => workflows.filter((w) => !w.ownerPluginId), [workflows]);
  const ownScripts = useMemo(() => scripts.filter((s) => !s.ownerPluginId), [scripts]);

  const availById = useMemo(() => ({
    screen: new Set(ownScreens.map((s) => s.id)),
    action: new Set(ownActions.map((a) => a.id)),
    workflow: new Set(ownWorkflows.map((w) => w.id)),
    script: new Set(ownScripts.map((s) => s.id)),
  }), [ownScreens, ownActions, ownWorkflows, ownScripts]);

  // Fecho de dependências: a partir do que o usuário marcou, puxa (obrigatoriamente) todo artefato
  // referenciado que existe no escritório — telas→ações/telas, ação→automação, automação→scripts/etc.
  const required = useMemo<Record<ArtifactKind, Set<string>>>(() => {
    const req: Record<ArtifactKind, Set<string>> = {
      screens: new Set(), actions: new Set(), workflows: new Set(), scripts: new Set(),
    };
    const explicitOf = (k: ArtifactKind): Set<string> =>
      k === 'screens' ? screenIds : k === 'actions' ? actionIds : k === 'workflows' ? workflowIds : scriptIds;
    const has = (k: ArtifactKind, id: string): boolean => explicitOf(k).has(id) || req[k].has(id);

    let changed = true;
    let guard = 0;
    while (changed && guard < 100) {
      changed = false;
      guard += 1;
      const pkg = buildPackage({
        manifest: STUB_MANIFEST, summary: 's',
        screens: ownScreens.filter((s) => has('screens', s.id)),
        actions: ownActions.filter((a) => has('actions', a.id)),
        workflows: ownWorkflows.filter((w) => has('workflows', w.id)),
        scripts: ownScripts.filter((s) => has('scripts', s.id)),
      });
      for (const ref of packageOutRefs(pkg)) {
        const plural = `${ref.kind}s` as ArtifactKind;
        if (availById[ref.kind].has(ref.id) && !has(plural, ref.id)) {
          req[plural].add(ref.id);
          changed = true;
        }
      }
    }
    return req;
  }, [availById, ownScreens, ownActions, ownWorkflows, ownScripts, screenIds, actionIds, workflowIds, scriptIds]);

  const effective = useMemo(() => ({
    screens: union(screenIds, required.screens),
    actions: union(actionIds, required.actions),
    workflows: union(workflowIds, required.workflows),
    scripts: union(scriptIds, required.scripts),
  }), [screenIds, actionIds, workflowIds, scriptIds, required]);

  const groups = useMemo<ArtifactGroup[]>(() => [
    {
      kind: 'screens', title: 'Telas',
      options: ownScreens.map((d) => ({ id: d.id, label: d.titlePlural || d.id, icon: d.icon, selected: effective.screens.has(d.id), locked: required.screens.has(d.id) })),
    },
    {
      kind: 'actions', title: 'Ações',
      options: ownActions.map((a) => ({ id: a.id, label: a.title || a.key, icon: a.icon, selected: effective.actions.has(a.id), locked: required.actions.has(a.id) })),
    },
    {
      kind: 'workflows', title: 'Automações',
      options: ownWorkflows.map((w) => ({ id: w.id, label: w.name, selected: effective.workflows.has(w.id), locked: required.workflows.has(w.id) })),
    },
    {
      kind: 'scripts', title: 'Scripts',
      options: ownScripts.map((s) => ({ id: s.id, label: s.name, selected: effective.scripts.has(s.id), locked: required.scripts.has(s.id) })),
    },
  ], [ownScreens, ownActions, ownWorkflows, ownScripts, effective, required]);

  const toggle = useCallback((kind: ArtifactKind, id: string) => {
    if (required[kind].has(id)) return; // dependência obrigatória — não desmarca
    if (kind === 'screens') toggleScreen(id);
    else if (kind === 'actions') toggleAction(id);
    else if (kind === 'workflows') toggleWorkflow(id);
    else toggleScript(id);
  }, [required, toggleScreen, toggleAction, toggleWorkflow, toggleScript]);

  const manifest = useMemo<PluginManifest>(() => ({
    id: form.id.trim(),
    version: form.version.trim(),
    kernel: '^1.0.0',
    name: form.name.trim(),
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    ...(codeContributions.length > 0
      ? { dependencies: { 'core.ui': '^1.0.0' }, contributes: codeContributions }
      : {}),
  }), [form, codeContributions]);

  const selection = useMemo(() => ({
    screens: ownScreens.filter((d) => effective.screens.has(d.id)),
    actions: ownActions.filter((a) => effective.actions.has(a.id)),
    workflows: ownWorkflows.filter((w) => effective.workflows.has(w.id)),
    scripts: ownScripts.filter((s) => effective.scripts.has(s.id)),
  }), [ownScreens, ownActions, ownWorkflows, ownScripts, effective]);

  const selectedCount = useMemo(
    () => selection.screens.length + selection.actions.length + selection.workflows.length + selection.scripts.length + views.length,
    [selection, views.length],
  );

  const pkg = useMemo<MarketplacePlugin>(
    () => buildPackage({ ...selection, manifest, summary: form.summary.trim(), views: viewTemplates }),
    [selection, manifest, form.summary, viewTemplates],
  );

  const nameOf = useCallback((kind: RefKind, id: string): string => {
    switch (kind) {
      case 'screen': return definitions.find((d) => d.id === id)?.titlePlural || id;
      case 'action': return actions.find((a) => a.id === id)?.title || id;
      case 'workflow': return workflows.find((w) => w.id === id)?.name || id;
      case 'script': return scripts.find((s) => s.id === id)?.name || id;
    }
  }, [definitions, actions, workflows, scripts]);

  const viewIssues = useMemo<string[]>(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const v of views) {
      const key = v.key.trim();
      const label = v.title.trim() || key || 'tela de código';
      if (!key) out.push(`A tela de código "${label}" precisa de uma chave.`);
      else if (!KEY_PATTERN.test(key)) out.push(`A chave "${key}" é inválida: use minúsculas, números e "-".`);
      else if (seen.has(key)) out.push(`A chave "${key}" está repetida entre as telas de código.`);
      seen.add(key);
      if (!v.title.trim()) out.push('Uma tela de código precisa de um título.');
      const error = viewErrors[v.uid];
      if (error) out.push(`A tela de código "${label}" não compila: ${error}.`);
    }
    return out;
  }, [views, viewErrors]);

  const issues = useMemo<string[]>(() => [
    ...validatePluginManifest(manifest, { kernelVersion: KERNEL_VERSION, validateContributions: false }).map((d) => d.message),
    ...(form.summary.trim() ? [] : ['A extensão precisa de uma descrição curta (resumo).']),
    ...validatePackage(pkg).map((issue) =>
      `${issue.ref.from} referencia ${KIND_LABEL[issue.ref.kind]} "${nameOf(issue.ref.kind, issue.ref.id)}", que pertence a outra extensão. Ela será exigida na instalação.`,
    ),
    ...viewIssues,
  ], [manifest, form.summary, pkg, nameOf, viewIssues]);

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

  return {
    canManage,
    canPublish,
    form,
    updateForm,
    groups,
    toggle,
    iconOptions,
    codeViews,
    selectedViewId,
    selectedView,
    addView,
    removeView,
    selectView,
    updateSelectedView,
    previewOpen,
    togglePreview,
    previewSource,
    selectedCount,
    issues,
    canExport,
    busy,
    download,
    publish: publishPackage,
  };
};
