import { describe, it, expect } from 'vitest';
import { buildPackage } from './packageBuilder';
import { validatePackage } from './pluginReferences';
import { serializePackage, parsePackage } from './packageSerialization';
import type { ScreenDefinition, ActionDefinition } from '../../entities';
import type { Script } from '../../entities/Script';
import type { WorkflowDefinition } from '../../entities/Workflow';
import type { PluginManifest } from '../../schema/plugin/pluginManifest';

const manifest: PluginManifest = {
  id: 'com.acme.vendas',
  version: '1.0.0',
  kernel: '^1.0.0',
  name: 'Vendas',
};

const now = new Date('2026-07-23T00:00:00Z');

const screen = (over: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'produto', tenantId: 't1', origin: 'design',
  titleSingular: 'Produto', titlePlural: 'Produtos', icon: 'priceTag',
  fields: [], titleFieldKey: 'nome', hasNotes: false, hasDocuments: false, hasTags: false,
  listActions: [], viewActionIds: [], cardActionIds: [],
  ownerPluginId: null, managed: null, sidebarOrder: 0, enabled: true,
  createdAt: now, createdBy: 'u1', updatedAt: now,
  ...over,
});

const action = (over: Partial<ActionDefinition>): ActionDefinition => ({
  id: 'act-1', tenantId: 't1', key: 'venda_resumo', title: 'Resumo', icon: 'shoppingBag',
  workflowId: 'wf-1', danger: false, enabled: true, order: 0,
  ownerPluginId: null, createdAt: now, createdBy: 'u1', updatedAt: now,
  ...over,
});

const workflow = (over: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: 'wf-1', tenantId: 't1', name: 'Resumo', eventName: 'workflow.called', version: 1,
  condition: { kind: 'AlwaysTrue' }, steps: [], enabled: true, createdAt: now, updatedAt: now,
  ...over,
});

const script = (over: Partial<Script>): Script => ({
  id: 'scr-1', tenantId: 't1', name: 'Calc', sourceTs: 'a', compiledJs: 'b',
  inputParams: [], outputParams: [], createdAt: now, updatedAt: now,
  ...over,
});

const empty = { screens: [], actions: [], workflows: [], scripts: [] };

describe('buildPackage', () => {
  it('usa o id real como templateId e a key real da tela como key de template', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'produto', viewActionIds: ['act-1'] })],
      actions: [action({ id: 'act-1', workflowId: 'wf-1' })],
      workflows: [workflow({ id: 'wf-1' })],
    });
    expect(pkg.screens?.[0].key).toBe('produto');
    expect(pkg.screens?.[0].viewActionIds).toEqual(['act-1']);
    expect(pkg.actions?.[0].templateId).toBe('act-1');
    expect(pkg.actions?.[0].workflowId).toBe('wf-1');
    expect(pkg.workflows[0].templateId).toBe('wf-1');
  });

  /**
   * Reexportar não pode trocar a identidade do artefato pela do escritório que reexportou: quem
   * aponta para ele de outro pacote aponta pelo identificador de ORIGEM.
   */
  it('o artefato que veio de um pacote é exportado com o identificador de origem', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      actions: [action({ id: 'ativar-inativar', sourceId: 'act-pessoa-status', workflowId: 'wf-1' })],
      workflows: [workflow({ id: 'ativar-inativar-pessoa', sourceId: 'wf-pessoa-status' })],
    });

    expect(pkg.actions?.[0].templateId).toBe('act-pessoa-status');
    expect(pkg.workflows[0].templateId).toBe('wf-pessoa-status');
  });

  it('inclui views de código e sobrevive ao round-trip serialize→parse', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      views: [{ key: 'kanban', title: 'Kanban', icon: 'layoutGrid', source: 'export default () => null;' }],
    });
    expect(pkg.views).toHaveLength(1);
    expect(pkg.views?.[0]).toMatchObject({ key: 'kanban', source: 'export default () => null;' });

    const parsed = parsePackage(serializePackage(pkg));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.package.views?.[0].source).toBe('export default () => null;');
  });

  it('sem views, a chave "views" é omitida do pacote', () => {
    expect(buildPackage({ ...empty, manifest, summary: 's' }).views).toBeUndefined();
  });

  it('remove campos de sistema e ownerPluginId (inclusive dos campos da tela)', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({
        ownerPluginId: 'com.acme.vendas',
        fields: [{ key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, ownerPluginId: 'com.acme.vendas' } as ScreenDefinition['fields'][number]],
      })],
      actions: [action({ ownerPluginId: 'com.acme.vendas', createdBy: 'u1' })],
      scripts: [script({ ownerPluginId: 'com.acme.vendas' })],
    });
    const screenT = pkg.screens![0] as unknown as Record<string, unknown>;
    expect('id' in screenT).toBe(false);
    expect('tenantId' in screenT).toBe(false);
    expect('ownerPluginId' in screenT).toBe(false);
    expect('managed' in screenT).toBe(false);
    expect('ownerPluginId' in (pkg.screens![0].fields[0] as unknown as Record<string, unknown>)).toBe(false);
    const actionT = pkg.actions![0] as unknown as Record<string, unknown>;
    expect('id' in actionT).toBe(false);
    expect('ownerPluginId' in actionT).toBe(false);
    expect('createdBy' in actionT).toBe(false);
    expect('ownerPluginId' in (pkg.scripts![0] as unknown as Record<string, unknown>)).toBe(false);
  });

  it('carimba sourceRev = updatedAt.getTime() em cada template próprio', () => {
    const later = new Date('2026-07-24T10:00:00Z');
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'produto', updatedAt: later })],
      actions: [action({ id: 'act-1', updatedAt: later })],
      workflows: [workflow({ id: 'wf-1', updatedAt: now })],
      scripts: [script({ id: 'scr-1', updatedAt: now })],
    });
    expect(pkg.screens?.[0].sourceRev).toBe(later.getTime());
    expect(pkg.actions?.[0].sourceRev).toBe(later.getTime());
    expect(pkg.workflows[0].sourceRev).toBe(now.getTime());
    expect(pkg.scripts?.[0].sourceRev).toBe(now.getTime());
  });

  it('preserva o sourceRev que já vem nos templates carried', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      carried: {
        workflows: [{ templateId: 'wf-a', sourceRev: 4242, name: 'A', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
      },
    });
    expect(pkg.workflows[0].sourceRev).toBe(4242);
  });

  it('omite arrays opcionais vazias', () => {
    const pkg = buildPackage({ ...empty, manifest, summary: 's', workflows: [workflow({})] });
    expect(pkg.screens).toBeUndefined();
    expect(pkg.actions).toBeUndefined();
    expect(pkg.scripts).toBeUndefined();
    expect(pkg.workflows).toHaveLength(1);
  });

  it('round-trip: pacote com todas as referências incluídas passa em validatePackage', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'produto', viewActionIds: ['act-1'], cardActionIds: ['act-1'] })],
      actions: [action({ id: 'act-1', workflowId: 'wf-1' })],
      workflows: [workflow({ id: 'wf-1' })],
    });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('referência a artefato não selecionado vira pendência em validatePackage', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'produto', viewActionIds: ['act-ausente'] })],
    });
    const issues = validatePackage(pkg);
    expect(issues).toHaveLength(1);
    expect(issues[0].ref.kind).toBe('action');
    expect(issues[0].ref.id).toBe('act-ausente');
  });

  it('preserva os templates embarcados (carried) de uma extensão importada em edição', () => {
    // Sem seleção de artefatos próprios: só os templates que já viajam no pacote. Antes, buildPackage
    // reconstruía a partir da seleção e PERDIA esses artefatos ao salvar/exportar.
    const pkg = buildPackage({
      ...empty, manifest, summary: 's', views: [{ key: 'v', title: 'V', icon: 'layoutGrid', source: 'export default () => null;' }],
      carried: {
        screens: [{ key: 'medicos', sourceId: 'medicos', titleSingular: 'Médico', titlePlural: 'Médicos', icon: 'apps', titleFieldKey: 'nome', fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0 }] }],
        actions: [{ templateId: 'act-a', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-a', danger: false, enabled: true, order: 0 }],
        workflows: [{ templateId: 'wf-a', name: 'A', eventName: 'workflow.called', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [] }],
        scripts: [{ templateId: 'scr-a', name: 'A', sourceTs: 'x', compiledJs: 'y', inputParams: [], outputParams: [] }],
      },
    });
    expect(pkg.screens?.map((s) => s.key)).toEqual(['medicos']);
    expect(pkg.actions?.map((a) => a.templateId)).toEqual(['act-a']);
    expect(pkg.workflows.map((w) => w.templateId)).toEqual(['wf-a']);
    expect(pkg.scripts?.map((s) => s.templateId)).toEqual(['scr-a']);
    expect(pkg.views?.map((v) => v.key)).toEqual(['v']);
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('não duplica quando um artefato próprio selecionado coincide com um carried de mesma chave', () => {
    const pkg = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'medicos' })],
      carried: { screens: [{ key: 'medicos', sourceId: 'medicos', titleSingular: 'M', titlePlural: 'M', icon: 'apps', titleFieldKey: 'nome', fields: [] }] },
    });
    expect(pkg.screens?.filter((s) => s.key === 'medicos')).toHaveLength(1);
  });

  it('referência a outro plugin é coberta ao declarar a dependência', () => {
    const withDep = buildPackage({
      ...empty,
      manifest: { ...manifest, dependencies: { 'com.microteia.vendas': '^1.0.0' } },
      summary: 's',
      screens: [screen({ id: 'meu_item', fields: [
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-microteia-vendas__produto', required: false, order: 0 } as ScreenDefinition['fields'][number],
      ] })],
    });
    expect(validatePackage(withDep)).toEqual([]);

    const withoutDep = buildPackage({
      ...empty, manifest, summary: 's',
      screens: [screen({ id: 'meu_item', fields: [
        { key: 'produto', label: 'Produto', type: 'reference', refEntity: 'com-microteia-vendas__produto', required: false, order: 0 } as ScreenDefinition['fields'][number],
      ] })],
    });
    expect(validatePackage(withoutDep)).toHaveLength(1);
  });
});

describe('buildPackage — complementos de tela', () => {
  const withOwnField = (over: Partial<ScreenDefinition>): ScreenDefinition => screen({
    fields: [
      { key: 'nome', label: 'Nome', type: 'text', required: true, order: 0, origin: 'builtin', ownerPluginId: null },
      { key: 'crm', label: 'CRM', type: 'text', required: false, order: 1, origin: 'design', ownerPluginId: null },
      { key: 'deOutra', label: 'De outra', type: 'text', required: false, order: 2, origin: 'plugin', ownerPluginId: 'com.b' },
    ],
    ...over,
  });

  it('empacota só os campos do autor, com alvo pelo nome quando a tela é do kernel', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      patchedScreens: [withOwnField({ id: 'pushes', origin: 'builtin' })],
    });
    expect(pkg.screenPatches).toHaveLength(1);
    expect(pkg.screenPatches?.[0].target).toBe('pushes');
    expect(pkg.screenPatches?.[0].targetKind).toBe('collection');
    expect(pkg.screenPatches?.[0].fields.map((f) => f.key)).toEqual(['crm']);
    expect(pkg.screens).toBeUndefined();
  });

  it('tela de outra extensão viaja pelo sourceId, não pela chave instalada', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      patchedScreens: [withOwnField({ id: 'produtos_2', origin: 'plugin', sourceId: 'src-produtos' })],
    });
    expect(pkg.screenPatches?.[0].target).toBe('src-produtos');
    expect(pkg.screenPatches?.[0].targetKind).toBe('sourceId');
  });

  it('tela sem campo do autor não vira complemento', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      patchedScreens: [screen({ id: 'pushes', origin: 'builtin', fields: [] })],
    });
    expect(pkg.screenPatches).toBeUndefined();
  });

  it('a lista de opções que um campo do complemento usa é declarada no pacote', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      patchedScreens: [screen({
        id: 'pushes', origin: 'builtin',
        fields: [{ key: 'porte', label: 'Porte', type: 'select', lookupCollection: 'pushesPorte', required: false, order: 0, origin: 'design', ownerPluginId: null }],
      })],
      availableLookups: [{ collection: 'pushesPorte', label: 'Porte' }],
    });
    expect(pkg.lookups).toEqual([{ collection: 'pushesPorte', label: 'Porte' }]);
  });

  it('o pacote resultante passa na mesma validação do import', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      patchedScreens: [withOwnField({ id: 'pushes', origin: 'builtin' })],
    });
    const roundTrip = parsePackage(serializePackage(pkg));
    expect(roundTrip.ok).toBe(true);
    expect(validatePackage(roundTrip.ok ? roundTrip.package : pkg)).toEqual([]);
  });
});

describe('buildPackage — reexportar uma extensão em edição', () => {
  const carriedTemplate = {
    key: 'produtos', sourceId: 'src-produtos', sourceRev: 1,
    titleSingular: 'Produto', titlePlural: 'Produtos', icon: 'priceTag', titleFieldKey: 'nome',
    fields: [{ key: 'nome', label: 'Nome', type: 'text' as const, required: true, order: 0 }],
    tagCollection: 'produtos_tags',
  };

  /** A tela como ela existe DEPOIS de instalada e de o autor acrescentar um campo no Form Design. */
  const installedProdutos = (over: Partial<ScreenDefinition> = {}): ScreenDefinition => screen({
    id: 'produtos', origin: 'plugin', sourceId: 'src-produtos',
    ownerPluginId: 'com.acme.vendas', ownerPluginIds: ['com.acme.vendas'],
    tagCollection: 'produtos_tags',
    fields: [
      { key: 'nome', label: 'Nome', type: 'text', required: true, order: 0, origin: 'plugin', ownerPluginId: 'com.acme.vendas' },
      { key: 'novo', label: 'Novo', type: 'text', required: false, order: 1, origin: 'design', ownerPluginId: null },
    ],
    ...over,
  });

  it('o campo que o autor acrescentou à tela da extensão entra no TEMPLATE DA TELA', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      carried: { screens: [carriedTemplate] },
      installedScreens: [installedProdutos()],
    });
    expect(pkg.screens).toHaveLength(1);
    expect(pkg.screens?.[0].key).toBe('produtos');
    expect(pkg.screens?.[0].fields.map((f) => f.key)).toEqual(['nome', 'novo']);
    expect(pkg.screenPatches).toBeUndefined();
  });

  it('a chave e o sourceId continuam sendo os do template, mesmo se a instalação desambiguou', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      carried: { screens: [carriedTemplate] },
      installedScreens: [installedProdutos({ id: 'produtos_2' })],
    });
    expect(pkg.screens?.[0].key).toBe('produtos');
    expect(pkg.screens?.[0].sourceId).toBe('src-produtos');
  });

  it('campo de OUTRA extensão na mesma tela não é reexportado como se fosse do autor', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      carried: { screens: [carriedTemplate] },
      installedScreens: [installedProdutos({
        fields: [
          { key: 'nome', label: 'Nome', type: 'text', required: true, order: 0, origin: 'plugin', ownerPluginId: 'com.acme.vendas' },
          { key: 'deOutra', label: 'De outra', type: 'text', required: false, order: 1, origin: 'plugin', ownerPluginId: 'com.b' },
        ],
      })],
    });
    expect(pkg.screens?.[0].fields.map((f) => f.key)).toEqual(['nome']);
  });

  it('as listas e etiquetas da extensão carregada sobrevivem ao reexport', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      carried: {
        screens: [{
          ...carriedTemplate,
          fields: [{ key: 'tipo', label: 'Tipo', type: 'select', lookupCollection: 'produtosTipos', required: false, order: 0 }],
        }],
      },
      installedScreens: [],
    });
    expect(pkg.lookups).toEqual([{ collection: 'produtosTipos', label: 'produtosTipos' }]);
    expect(pkg.tagLists).toEqual([{ collection: 'produtos_tags', label: 'produtos_tags' }]);
  });

  it('sem tela instalada correspondente, o template carregado é preservado como veio', () => {
    const pkg = buildPackage({
      manifest, summary: 's', screens: [], actions: [], workflows: [], scripts: [],
      carried: { screens: [carriedTemplate] },
      installedScreens: [],
    });
    expect(pkg.screens?.[0]).toEqual(carriedTemplate);
  });
});
