// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { navMetadataOf } from '../../presentation/shared/resolveUiContributions';
import { UI_NAV_POINT, UI_PAGE_POINT, UI_SETTINGS_POINT } from '../../domain/schema/ui/uiExtensionPoints';
import type { SettingsSection } from '../../domain/schema/settings';
import { RESERVED_COLLECTIONS } from '../../domain/schema/screenEntity';
import { resolveWritableTable } from '../../domain/schema/mutationSpec';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';
import type { InstalledExtension } from '../../domain/entities/InstalledExtension';
import { installedExtensionRecords } from '../../domain/usecases/plugins/installedExtensionRecords';
import { backendFingerprint } from '../../domain/schema/plugin/backendRequirement';
import { brasilPlugin } from './brasil';
import { calendarPlugin } from './calendar';
import { contratoPlugin } from './contrato';
import { pessoaPlugin } from './pessoa';
import { prazoPlugin } from './prazo';
import { processoPlugin } from './processo';
import { pushPlugin } from './push';

const installation = (pluginId: string): PluginInstallation => ({
  pluginId,
  tenantId: 't1',
  version: '1.0.0',
  enabled: true,
  config: {},
  grantedPermissions: [],
  installedAt: new Date(),
  installedBy: 'u1',
  updatedAt: new Date(),
});

const CADEIA = [brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin, calendarPlugin, prazoPlugin, pushPlugin];

const screen = () => materializePluginScreens(pushPlugin, 'u1')[0].input;

describe('pushPlugin', () => {
  it('carrega no host como extensão trusted, com a página da listagem, sem erros', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords(CADEIA, CADEIA.map((plugin) => installation(plugin.manifest.id))),
    ]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(pushPlugin.manifest.id)).toBe(true);

    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    expect(pageKeys).toContain('pushes');
    expect(pageKeys).toContain('push-settings');
  });

  /**
   * A aba "Push" das Configurações do Escritório só servia a esta extensão, e por isso saiu do
   * kernel junto com a tela. O que a substitui são duas declarações: a tela de recebimento (o gesto
   * de autorizar uma conta, que não é dado) e a seção de Configurações (as duas listas de filtro,
   * que são).
   */
  it('traz o recebimento como tela própria, sem item de menu', () => {
    const contributions = pushPlugin.manifest.contributes ?? [];
    const navKeys = contributions
      .filter((contribution) => contribution.point === UI_NAV_POINT)
      .map((contribution) => contribution.metadata.key);

    expect(navKeys).toEqual(['pushes']);
    expect((pushPlugin.views ?? []).map((view) => view.key)).toContain('push-settings');
  });

  /**
   * As chaves são CONTRATO com a ingestão: é por elas que o `gmailPush` lê os filtros no servidor.
   * O escopo é só o do escritório — não existe ingestão "por usuário" que honrasse a preferência
   * pessoal.
   */
  it('declara os filtros da ingestão como configuração do escritório', () => {
    const section = (pushPlugin.manifest.contributes ?? [])
      .find((contribution) => contribution.point === UI_SETTINGS_POINT)
      ?.metadata as unknown as SettingsSection | undefined;

    expect(section?.key).toBe('push');

    const byKey = new Map((section?.properties ?? []).map((property) => [property.key, property]));
    expect([...byKey.keys()]).toEqual(['push.allowedSenders', 'push.allowedSubjects']);
    for (const property of byKey.values()) {
      expect(property.type).toBe('stringList');
      expect(property.scopes).toEqual(['tenant']);
      expect(property.default).toEqual([]);
    }
  });

  /**
   * O push resolve um processo pelo número e gera um prazo: sem as duas coleções, as duas coisas que
   * ele faz não teriam onde acontecer.
   */
  it('sem Processos e Prazos, o host recusa carregar Pushes', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords([pushPlugin], [installation(pushPlugin.manifest.id)]),
    ]);

    expect(host.isLoaded(pushPlugin.manifest.id)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('dependency.missing');
  });

  it('aponta para a coleção de pushes e mantém o nome dos eventos', () => {
    const input = screen();

    expect(input.dataCollection).toBe('pushes');
    expect(input.eventPrefix).toBe('push');
    expect(input.titleFieldKey).toBe('subject');
    expect(input.writeRoles).toEqual(['admin', 'lawyer']);

    const byKey = new Map(input.fields.map((field) => [field.key, field]));
    expect([...byKey.keys()]).toEqual(expect.arrayContaining([
      'subject', 'from', 'to', 'receivedAt',
      'processNumber', 'court', 'activeParty', 'passiveParty', 'legalClass', 'filingDate',
      'status', 'parsedByAI', 'parsingError',
    ]));
  });

  /**
   * O corpo do e-mail é grande e não serve a formulário nem a filtro: a listagem o lê direto do
   * registro. Declará-lo como campo o colocaria nos dois lugares onde ele atrapalha.
   */
  it('o corpo do e-mail NÃO é campo declarado', () => {
    const keys = screen().fields.map((field) => field.key);
    expect(keys).not.toContain('emailBodyHtml');
    expect(keys).not.toContain('emailBodyText');
  });

  /**
   * As chaves das situações são os valores em INGLÊS que os documentos já guardam desde a primeira
   * ingestão. Traduzi-las aqui deixaria todo push existente sem situação reconhecível.
   */
  it('as situações descrevem o que está gravado, não um esquema novo', () => {
    const situacoes = pushPlugin.lookups?.find((lookup) => lookup.collection === 'pushStatuses');
    expect(situacoes?.options?.map((option) => option.key)).toEqual(['pending', 'reviewed', 'archived', 'fault']);
    expect(situacoes?.options?.map((option) => option.label)).toEqual(['Pendente', 'Revisado', 'Arquivado', 'Falha']);
  });

  it('o item de menu declara o contador de intimações pendentes', () => {
    const nav = (pushPlugin.manifest.contributes ?? [])
      .filter((contribution) => contribution.point === UI_NAV_POINT)
      .map((contribution) => navMetadataOf({ ...contribution, pluginId: pushPlugin.manifest.id }))[0];

    expect(nav.badge).toEqual({ collection: 'pushes', when: 'status == "pending"' });
  });

  /**
   * "Gerar prazo" era um formulário escrito à mão dentro da tela. Como Action, ela PERGUNTA — e o
   * mapa existe porque os nomes divergem: o push guarda `processNumber`, o fluxo pede `caseNumber`.
   */
  it('gerar prazo pergunta os parâmetros, com o processo já preenchido', () => {
    const gerar = (pushPlugin.actions ?? []).find((action) => action.templateId === 'act-push-gerar-prazo');
    const workflowIds = new Set(pushPlugin.workflows.map((workflow) => workflow.templateId));

    expect(gerar?.promptParameters).toBe(true);
    expect(gerar?.parameterDefaults?.caseNumber).toBe('processNumber');
    expect(workflowIds.has(gerar?.workflowId ?? '')).toBe(true);
    // Sem número de processo não há o que resolver: a ação some do cartão.
    expect(gerar?.hiddenWhen).toBe('isEmpty(processNumber)');
  });

  /**
   * Duas ações, um fluxo: é para isso que a `key` existe e é para isso que ela PODE repetir — a
   * diferença entre revisar e arquivar cabe num ramo dentro do fluxo.
   */
  it('revisar e arquivar compartilham o mesmo fluxo, separados pela chave', () => {
    const acoes = pushPlugin.actions ?? [];
    const revisar = acoes.find((action) => action.templateId === 'act-push-revisado');
    const arquivar = acoes.find((action) => action.templateId === 'act-push-arquivar');

    expect(revisar?.workflowId).toBe('wf-push-triagem');
    expect(arquivar?.workflowId).toBe('wf-push-triagem');
    expect(revisar?.key).not.toBe(arquivar?.key);
    expect(arquivar?.key).toBe('push_arquivar');

    // O ramo do fluxo decide pela MESMA chave que a ação entrega.
    const triagem = pushPlugin.workflows.find((workflow) => workflow.templateId === 'wf-push-triagem');
    const condicao = triagem?.steps[0].condition;
    expect(condicao).toMatchObject({ kind: 'Expression', expression: `event.action == "${arquivar?.key}"` });
  });

  it('as três ações do menu estão habilitadas no cartão', () => {
    const declaradas = (pushPlugin.actions ?? []).map((action) => action.templateId);
    expect(screen().cardActionIds).toEqual(declaradas);
  });

  /**
   * Sair do kernel é também sair das duas listas que protegiam a coleção: sem isso, a tela não
   * poderia ser declarada e a triagem por workflow seria recusada na gravação.
   */
  it('pushes deixou de ser coleção reservada e voltou a ser gravável por automação', () => {
    expect(RESERVED_COLLECTIONS.has('pushes')).toBe(false);

    const { titleSingular, titleFieldKey, fields } = screen();
    const ctx = createSchemaContext([{ id: 'pushes', collection: 'pushes', titleSingular, titleFieldKey, fields }]);
    expect(resolveWritableTable('pushes', ctx).ok).toBe(true);
  });

  it('as fontes reais das views compilam pelo runtime (não caem no fallback)', () => {
    for (const view of pushPlugin.views ?? []) {
      const Component = evaluateExtensionView(`test::${view.key}`, view.source);
      expect(typeof Component, view.key).toBe('function');
    }
  });
});

describe('pushPlugin — o backend que ele exige', () => {
  const asInstalled = (
    plugin: typeof pushPlugin,
    backendState: InstalledExtension['backendState'],
  ): InstalledExtension => ({
    id: plugin.manifest.id,
    tenantId: 't1',
    active: true,
    package: plugin,
    source: 'builtin',
    installedVersion: plugin.manifest.version,
    authorId: '',
    authorName: '',
    authorPhotoURL: null,
    installedBy: 'u1',
    backendState,
    installedAt: new Date(),
    updatedAt: new Date(),
  });

  /** Carimbo que BATE com o que o plugin exige — o estado em que o Console já aplicou tudo. */
  const applied = (plugin: typeof pushPlugin): InstalledExtension['backendState'] => ({
    fingerprint: backendFingerprint(plugin.manifest.backend),
    appliedAt: new Date(),
  });

  /** A cadeia de dependências do Push, provisionada; só o estado DELE varia em cada caso. */
  const chain = (pushState: InstalledExtension['backendState']): InstalledExtension[] =>
    CADEIA.map((plugin) => asInstalled(
      plugin,
      plugin === pushPlugin ? pushState : applied(plugin),
    ));

  const trustAll = new Set(CADEIA.map((plugin) => plugin.manifest.id));

  it('declara as cinco functions do Gmail e o índice da deduplicação como DELE', () => {
    const backend = pushPlugin.manifest.backend;
    expect([...(backend?.functions ?? [])].sort()).toEqual([
      'exchangeGmailCode', 'gmailPush', 'listGmailConnections', 'renewGmailWatches', 'revokeGmailConnection',
    ]);
    expect(backend?.indexes).toEqual([{
      collectionGroup: 'pushes',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'emailId', order: 'ASCENDING' },
        { fieldPath: 'processNumber', order: 'ASCENDING' },
      ],
    }]);
    expect(backend?.parameters).toEqual(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_GMAIL_TOPIC']);
  });

  /**
   * O caminho VIVO do boot é `installedExtensionRecords`. Instalada mas sem o Console ter criado as
   * functions, a extensão não pode contribuir nada: um item de menu que abre uma tela cujo servidor não
   * existe falha como se fosse CORS, e manda procurar no frontend, que está correto.
   */
  it('instalado e não provisionado: nem menu, nem página, nem aba de configuração', () => {
    const host = createPluginHost();
    host.load([...CORE_PLUGINS, ...installedExtensionRecords(chain(null), trustAll)]);

    expect(host.isLoaded(pushPlugin.manifest.id)).toBe(false);
    for (const point of [UI_NAV_POINT, UI_PAGE_POINT, UI_SETTINGS_POINT]) {
      expect(host.contributions.query(point).map((c) => c.pluginId))
        .not.toContain(pushPlugin.manifest.id);
    }
    // E o resto da cadeia continua no ar: uma extensão pendente não derruba as outras.
    expect(host.isLoaded(prazoPlugin.manifest.id)).toBe(true);
  });

  it('depois do carimbo do Console, contribui como qualquer extensão', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedExtensionRecords(chain(applied(pushPlugin)), trustAll),
    ]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(pushPlugin.manifest.id)).toBe(true);
    expect(host.contributions.query(UI_NAV_POINT).map((c) => c.pluginId))
      .toContain(pushPlugin.manifest.id);
  });

  it('um carimbo de exigência ANTIGA não serve — o vínculo é por conteúdo', () => {
    const stale = { fingerprint: backendFingerprint({ functions: ['gmailPush'] }), appliedAt: new Date() };
    const host = createPluginHost();
    host.load([...CORE_PLUGINS, ...installedExtensionRecords(chain(stale), trustAll)]);
    expect(host.isLoaded(pushPlugin.manifest.id)).toBe(false);
  });
});
