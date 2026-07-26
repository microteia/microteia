import { useCallback, useMemo, useState } from 'react';
import { useTenantExtensions } from '../../../stores/useTenantExtensions';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useActions } from '../../../stores/useActions';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useScriptStore } from '../../../stores/useScriptStore';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { buildPackage, type CarriedTemplates } from '../../../domain/usecases/plugins/packageBuilder';
import { packageOutRefs, validatePackage } from '../../../domain/usecases/plugins/pluginReferences';
import { serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import { isValidPluginId, validatePluginManifest } from '../../../domain/schema/plugin/pluginManifest';
import { KERNEL_VERSION } from '../../../domain/schema/plugin/kernelVersion';
import { nav, page } from '../../../plugins/contributionBuilders';
import { compileExtensionView, compileExtensionStartup } from '../../shared/extensions/evaluateExtensionView';
import { buildExtensionTypeDefs } from '../../shared/extensions/extensionTypeDefs';
import { getScreenIconOptions } from '../../shared/screenIcons';
import type { PluginManifest } from '../../../domain/schema/plugin/pluginManifest';
import type { Contribution } from '../../../domain/schema/plugin/contribution';
import type { RefKind } from '../../../domain/usecases/plugins/pluginReferences';
import type { MarketplacePlugin, ViewModuleTemplate } from '../../../domain/entities/MarketplacePlugin';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

const VIEW_STARTER = `import { useCasePhases } from '@microteia/data';

export default function View() {
  const phases = useCasePhases();
  return (
    <div style={{ padding: 16 }}>
      Minha extensão — {phases.length} fase(s) cadastrada(s).
    </div>
  );
}
`;

const STARTUP_TEMPLATE = `// import { Icon } from '@microteia/ui';

export default function startup(host) {
  /*
  // Exemplo: registrar comandos no Command Palette (⌘K)
  host.commands.register({
    group: 'Minha Extensão',
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      
      // const icon = <Icon name="star" size={16} />;
      const items = [];
      
      // Comando fixo (ex: "novo item")
      if ('novo item da extensão'.indexOf(q) !== -1) {
        items.push({
          id: 'minha-ext:novo',
          title: 'Novo item da extensão',
          group: 'Minha Extensão',
          // icon,
          onSelect: () => {
            ctx.openTab('minha-tela:new');
            ctx.close();
          }
        });
      }
      
      // Busca em registros (exemplo: entidades customizadas)
      // for (const r of ctx.customRecords) {
      //   if (r.screenKey === 'minha-tela' && r.title?.toLowerCase().indexOf(q) !== -1) {
      //     items.push({
      //       id: 'minha-ext:' + r.id,
      //       title: r.title,
      //       subtitle: 'Minha Extensão',
      //       group: 'Minha Extensão',
      //       icon,
      //       onSelect: () => { ctx.openTab('minha-tela:' + r.id); ctx.close(); }
      //     });
      //   }
      // }
      
      return items.slice(0, 9);
    },
  });
  */

  /*
  // Exemplo: registrar menção @ no chat
  host.mentions.register({
    key: 'minha-mencao',
    label: 'Minha Menção',
    description: 'Inserir link para um item da extensão',
    icon: 'star',
    search(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      
      // Retornar lista de opções para o usuário escolher
      // return ctx.customRecords
      //   .filter((r) => r.screenKey === 'minha-tela' && r.title && (!q || r.title.toLowerCase().indexOf(q) !== -1))
      //   .slice(0, 20)
      //   .map((r) => ({
      //     id: r.id,
      //     title: r.title,
      //     subtitle: 'Minha Extensão',
      //     tabKey: 'minha-tela:' + r.id
      //   }));
      
      return [];
    },
  });
  */

  // Opcional: retornar função de cleanup para desregistrar ao descarregar a extensão
  // return () => {
  //   // Cleanup se necessário
  // };
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
  /** Artefato JÁ embarcado nesta extensão (importada/instalada) — vai no pacote; clicar remove. */
  carried?: boolean;
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
  editing: boolean;
  form: { id: string; name: string; version: string; description: string; summary: string };
  updateForm: (patch: Partial<PluginAuthorViewModel['form']>) => void;
  groups: ArtifactGroup[];
  toggle: (kind: ArtifactKind, id: string) => void;
  expandedGroups: Set<ArtifactKind | 'codeViews'>;
  toggleGroup: (kind: ArtifactKind | 'codeViews') => void;
  iconOptions: SearchSelectOption[];
  codeViews: CodeViewItem[];
  selectedViewId: string | null;
  selectedView: CodeViewEditing | null;
  addView: () => void;
  removeView: (id: string) => void;
  openView: (id: string) => void;
  updateSelectedView: (patch: Partial<Omit<CodeViewEditing, 'error'>>) => void;
  editorOpen: boolean;
  closeEditor: () => void;
  startupEditorOpen: boolean;
  openStartupEditor: () => void;
  closeStartupEditor: () => void;
  startupMaximized: boolean;
  toggleStartupMaximized: () => void;
  startup: string;
  setStartup: (source: string) => void;
  startupError: string | null;
  selectedCount: number;
  issues: string[];
  canExport: boolean;
  canSave: boolean;
  busy: boolean;
  download: () => void;
  save: () => Promise<void>;
  extensionTypeDefs: string;
}

const useSelection = (initial?: Set<string>) => {
  const [ids, setIds] = useState<Set<string>>(() => initial ?? new Set());
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

const EDIT_PREFIX = 'plugin-author:';

export const usePluginAuthorViewModel = (tabKey?: string): PluginAuthorViewModel => {
  const { saveExtension, extensionOf } = useTenantExtensions();
  const { openTab } = useWorkspace();
  const { definitions } = useScreenDefinitions();
  const { actions } = useActions();
  const { workflows } = useWorkflowStore();
  const { scripts } = useScriptStore();
  const { tenantRole } = useTenant();
  const { userRole } = useAuth();
  const { notify } = useNotification();

  const canManage = userRole === 'SYSTEM' || tenantRole === 'admin';
  const editingId = tabKey && tabKey.startsWith(EDIT_PREFIX) ? tabKey.slice(EDIT_PREFIX.length) : null;
  // Editar = pré-carrega o formulário da extensão já em memória (a aba abre a partir de Minhas
  // Extensões, então ela está carregada). Inicialização preguiçosa, uma vez — sem efeito que copia
  // dados para o estado (que dispararia renders em cascata / bailout do React Compiler).
  const editingPackage = editingId ? extensionOf(editingId)?.package : undefined;

  const [form, setForm] = useState(() => (editingPackage
    ? {
      id: editingPackage.manifest.id,
      name: editingPackage.manifest.name,
      version: editingPackage.manifest.version,
      description: editingPackage.manifest.description ?? '',
      summary: editingPackage.summary,
    }
    : { id: '', name: '', version: '1.0.0', description: '', summary: '' }));
  const updateForm = useCallback((patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch })), []);

  const [screenIds, toggleScreen] = useSelection(new Set((editingPackage?.screens ?? []).map((s) => s.key)));
  const [actionIds, toggleAction] = useSelection(new Set((editingPackage?.actions ?? []).map((a) => a.templateId)));
  const [workflowIds, toggleWorkflow] = useSelection(new Set((editingPackage?.workflows ?? []).map((w) => w.templateId)));
  const [scriptIds, toggleScript] = useSelection(new Set((editingPackage?.scripts ?? []).map((s) => s.templateId)));
  const [busy, setBusy] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<ArtifactKind | 'codeViews'>>(() => new Set(['screens', 'actions', 'workflows', 'scripts', 'codeViews']));

  const [views, setViews] = useState<CodeViewForm[]>(() =>
    (editingPackage?.views ?? []).map((v) => ({ uid: crypto.randomUUID(), key: v.key, title: v.title, icon: v.icon, source: v.source })));
  const [startup, setStartup] = useState<string>(() => editingPackage?.startup ?? STARTUP_TEMPLATE);

  const startupError = useMemo<string | null>(() => {
    if (!startup.trim()) return null;
    const result = compileExtensionStartup(startup);
    return result.ok ? null : result.error;
  }, [startup]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [startupEditorOpen, setStartupEditorOpen] = useState(false);
  const [startupMaximized, setStartupMaximized] = useState(false);

  // Artefatos JÁ embarcados no pacote em edição (extensão importada/instalada). Não vêm dos artefatos
  // "próprios" do escritório — são templates que viajam no pacote —, então precisam ser preservados e
  // exibidos aqui, senão salvar/exportar os perderia. Inicialização preguiçosa, uma vez.
  const [carried, setCarried] = useState<Required<CarriedTemplates>>(() => ({
    screens: editingPackage?.screens ?? [],
    actions: editingPackage?.actions ?? [],
    workflows: editingPackage?.workflows ?? [],
    scripts: editingPackage?.scripts ?? [],
  }));
  const removeCarried = useCallback((kind: ArtifactKind, id: string) => {
    setCarried((prev) => ({
      ...prev,
      screens: kind === 'screens' ? prev.screens.filter((s) => s.key !== id) : prev.screens,
      actions: kind === 'actions' ? prev.actions.filter((a) => a.templateId !== id) : prev.actions,
      workflows: kind === 'workflows' ? prev.workflows.filter((w) => w.templateId !== id) : prev.workflows,
      scripts: kind === 'scripts' ? prev.scripts.filter((s) => s.templateId !== id) : prev.scripts,
    }));
  }, []);

  const iconOptions = useMemo<SearchSelectOption[]>(
    () => getScreenIconOptions().map((option) => ({ value: option.key, label: option.label, icon: option.Icon })),
    [],
  );

  const addView = useCallback(() => {
    const uid = crypto.randomUUID();
    setViews((prev) => {
      const n = prev.length + 1;
      return [...prev, { uid, key: `tela-${n}`, title: `Tela ${n}`, icon: 'layoutGrid', source: VIEW_STARTER }];
    });
    setSelectedViewId(uid);
    setEditorOpen(true);
  }, []);

  const removeView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.uid !== id));
    setSelectedViewId((current) => {
      if (current !== id) return current;
      setEditorOpen(false);
      return null;
    });
  }, []);

  const openView = useCallback((id: string) => {
    setSelectedViewId(id);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => setEditorOpen(false), []);

  const openStartupEditor = useCallback(() => setStartupEditorOpen(true), []);
  const closeStartupEditor = useCallback(() => {
    setStartupEditorOpen(false);
    setStartupMaximized(false);
  }, []);
  const toggleStartupMaximized = useCallback(() => setStartupMaximized((prev) => !prev), []);

  const toggleGroup = useCallback((kind: ArtifactKind | 'codeViews') => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const updateSelectedView = useCallback((patch: Partial<Omit<CodeViewEditing, 'error'>>) => {
    setViews((prev) => prev.map((v) => (v.uid === selectedViewId ? { ...v, ...patch } : v)));
  }, [selectedViewId]);

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

  // Templates embarcados que NÃO correspondem a um artefato próprio do escritório. Ao autorar a partir
  // de um artefato próprio, `key`/`templateId` do template = o id do artefato — então ele já aparece
  // (pré-marcado) como linha própria, e mostrá-lo também como "Incluída" duplicaria a entrada. Só os
  // realmente estrangeiros (extensão importada de outro escritório) seguem como carregados.
  const foreignCarried = useMemo<Required<CarriedTemplates>>(() => ({
    screens: carried.screens.filter((s) => !availById.screen.has(s.key)),
    actions: carried.actions.filter((a) => !availById.action.has(a.templateId)),
    workflows: carried.workflows.filter((w) => !availById.workflow.has(w.templateId)),
    scripts: carried.scripts.filter((s) => !availById.script.has(s.templateId)),
  }), [carried, availById]);

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

  const carriedOptions = useMemo<Record<ArtifactKind, ArtifactOption[]>>(() => ({
    screens: foreignCarried.screens.map((s) => ({ id: s.key, label: s.titlePlural || s.titleSingular || s.key, icon: s.icon, selected: true, locked: false, carried: true })),
    actions: foreignCarried.actions.map((a) => ({ id: a.templateId, label: a.title || a.key, icon: a.icon, selected: true, locked: false, carried: true })),
    workflows: foreignCarried.workflows.map((w) => ({ id: w.templateId, label: w.name, selected: true, locked: false, carried: true })),
    scripts: foreignCarried.scripts.map((s) => ({ id: s.templateId, label: s.name, selected: true, locked: false, carried: true })),
  }), [foreignCarried]);

  const groups = useMemo<ArtifactGroup[]>(() => [
    {
      kind: 'screens', title: 'Telas',
      options: [...carriedOptions.screens, ...ownScreens.map((d) => ({ id: d.id, label: d.titlePlural || d.id, icon: d.icon, selected: effective.screens.has(d.id), locked: required.screens.has(d.id) }))],
    },
    {
      kind: 'actions', title: 'Ações',
      options: [...carriedOptions.actions, ...ownActions.map((a) => ({ id: a.id, label: a.title || a.key, icon: a.icon, selected: effective.actions.has(a.id), locked: required.actions.has(a.id) }))],
    },
    {
      kind: 'workflows', title: 'Automações',
      options: [...carriedOptions.workflows, ...ownWorkflows.map((w) => ({ id: w.id, label: w.name, selected: effective.workflows.has(w.id), locked: required.workflows.has(w.id) }))],
    },
    {
      kind: 'scripts', title: 'Scripts',
      options: [...carriedOptions.scripts, ...ownScripts.map((s) => ({ id: s.id, label: s.name, selected: effective.scripts.has(s.id), locked: required.scripts.has(s.id) }))],
    },
  ], [carriedOptions, ownScreens, ownActions, ownWorkflows, ownScripts, effective, required]);

  const toggle = useCallback((kind: ArtifactKind, id: string) => {
    if (carriedOptions[kind].some((o) => o.id === id)) { removeCarried(kind, id); return; } // remove o embarcado
    if (required[kind].has(id)) return; // dependência obrigatória — não desmarca
    if (kind === 'screens') toggleScreen(id);
    else if (kind === 'actions') toggleAction(id);
    else if (kind === 'workflows') toggleWorkflow(id);
    else toggleScript(id);
  }, [carriedOptions, removeCarried, required, toggleScreen, toggleAction, toggleWorkflow, toggleScript]);

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
    () => selection.screens.length + selection.actions.length + selection.workflows.length + selection.scripts.length + views.length
      + foreignCarried.screens.length + foreignCarried.actions.length + foreignCarried.workflows.length + foreignCarried.scripts.length,
    [selection, views.length, foreignCarried],
  );

  const pkg = useMemo<MarketplacePlugin>(
    () => buildPackage({ ...selection, manifest, summary: form.summary.trim(), views: viewTemplates, startup, carried: foreignCarried }),
    [selection, manifest, form.summary, viewTemplates, startup, foreignCarried],
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
    ...(startupError ? [`O código de inicialização não compila: ${startupError}.`] : []),
  ], [manifest, form.summary, pkg, nameOf, viewIssues, startupError]);

  const canExport = selectedCount > 0 && issues.length === 0;
  // Salvar um rascunho editável exige só um domínio (id) válido — pendências não bloqueiam salvar,
  // só exportar/publicar. É o que permite "criar e voltar depois para editar".
  const canSave = canManage && isValidPluginId(form.id.trim()) && Boolean(form.name.trim());

  const extensionTypeDefs = useMemo(() => buildExtensionTypeDefs(), []);

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

  const save = useCallback(async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await saveExtension(pkg);
      notify(`${manifest.name || manifest.id} salvo em Minhas Extensões.`, 'success');
      openTab('marketplace');
    } catch (err) {
      console.error('[plugin-author] falha ao salvar extensão:', err);
      notify(`Não foi possível salvar: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [canSave, saveExtension, pkg, manifest.name, manifest.id, notify, openTab]);

  return {
    canManage,
    editing: Boolean(editingId),
    form,
    updateForm,
    groups,
    toggle,
    expandedGroups,
    toggleGroup,
    iconOptions,
    codeViews,
    selectedViewId,
    selectedView,
    addView,
    removeView,
    openView,
    updateSelectedView,
    editorOpen,
    closeEditor,
    startupEditorOpen,
    openStartupEditor,
    closeStartupEditor,
    startupMaximized,
    toggleStartupMaximized,
    startup,
    setStartup,
    startupError,
    selectedCount,
    issues,
    canExport,
    canSave,
    busy,
    download,
    save,
    extensionTypeDefs,
  };
};
