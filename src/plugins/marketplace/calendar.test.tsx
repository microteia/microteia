// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { UI_PAGE_POINT, UI_SETTINGS_POINT } from '../../presentation/shared/uiExtensionPoints';
import { validateSettingValue, type SettingsSection } from '../../domain/schema/settings';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';
import { brasilPlugin } from './brasil';
import { calendarPlugin } from './calendar';
import { contratoPlugin } from './contrato';
import { pessoaPlugin } from './pessoa';
import { prazoPlugin } from './prazo';
import { processoPlugin } from './processo';

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

const CADEIA = [brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin, calendarPlugin, prazoPlugin];

const loadHost = (plugins = CADEIA) => {
  const host = createPluginHost();
  const result = host.load([
    ...CORE_PLUGINS,
    ...installedPluginRecords(plugins, plugins.map((plugin) => installation(plugin.manifest.id))),
  ]);
  return { host, result };
};

describe('calendarPlugin', () => {
  it('carrega no host como extensão trusted, com a página da agenda, sem erros', () => {
    const { host, result } = loadHost([calendarPlugin]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(calendarPlugin.manifest.id)).toBe(true);

    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    expect(pageKeys).toContain('calendar');
  });

  /**
   * A agenda não conhece prazo, audiência nem parcela. Este é o teste que a mantém assim: a
   * declaração inteira não pode citar nenhuma coleção de negócio — quem endereça o registro de
   * origem é o par `origem`/`origemId`, preenchido por quem o criou.
   */
  it('a declaração não menciona nenhuma entidade de negócio', () => {
    const declaracao = JSON.stringify({
      screens: calendarPlugin.screens,
      lookups: calendarPlugin.lookups,
      workflows: calendarPlugin.workflows,
      manifest: calendarPlugin.manifest,
    });

    for (const colecao of ['deadlines', 'cases', 'persons', 'financials', 'contracts', 'pushes']) {
      expect(declaracao, `a agenda não pode conhecer "${colecao}"`).not.toContain(colecao);
    }
  });

  it('a tela do item é um espelho: fora do menu, sem ação de cartão e com o par de origem', () => {
    const [{ input }] = materializePluginScreens(calendarPlugin, 'u1');

    expect(input.hideFromSidebar).toBe(true);
    expect(input.listActions).toEqual([]);
    expect(input.eventPrefix).toBe('calendar');

    const byKey = new Map(input.fields.map((field) => [field.key, field]));
    expect([...byKey.keys()]).toEqual([
      'title', 'status', 'priority', 'description',
      'date', 'hour', 'finishDate', 'finishHour',
      'origem', 'origemId',
    ]);
    // A hora é o tipo de campo novo do kernel — string 'HH:mm', não instante.
    expect(byKey.get('hour')?.type).toBe('time');
    expect(byKey.get('finishHour')?.type).toBe('time');
    // Situação, prioridade e as duas datas filtram; é sobre eles que o CompositeTFilter da agenda
    // se monta, e é aí que os campos de outras extensões se somam.
    expect(byKey.get('status')?.filterable).toBe(true);
    expect(byKey.get('priority')?.filterable).toBe(true);
    expect(byKey.get('date')?.filterable).toBe(true);
  });

  /**
   * As chaves das duas listas são estáveis e em inglês porque quem grava um item é uma automação de
   * OUTRA extensão: um rótulo renomeado no escritório não pode quebrar o espelho.
   */
  it('as listas de situação e prioridade têm chaves estáveis', () => {
    const status = calendarPlugin.lookups?.find((lookup) => lookup.collection === 'calendarStatuses');
    const prioridade = calendarPlugin.lookups?.find((lookup) => lookup.collection === 'calendarPriorities');

    expect(status?.options?.map((option) => option.key)).toEqual(['pending', 'closed']);
    expect(prioridade?.options?.map((option) => option.key)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(prioridade?.options?.map((option) => option.color)).toEqual(['success', 'warning', 'secondary', 'danger']);
  });

  it('publica os dois pontos de extensão que fazem dela uma porta', () => {
    const pontos = (calendarPlugin.manifest.extensionPoints ?? []).map((point) => point.id);
    expect(pontos).toEqual(['calendar.action', 'calendar.moveaction']);

    // Metadata pura: nenhum dos dois carrega implementação, então uma extensão de TERCEIRO (que não
    // pode entregar código) participa da agenda pelo mesmo caminho que uma de primeira parte.
    for (const point of calendarPlugin.manifest.extensionPoints ?? []) {
      expect(point.allowedImplKinds).toEqual([]);
      expect(point.implRequired).toBe(false);
      expect(point.multiple).toBe(true);
    }
  });

  it('a lista de ações do arrasto é configurável, e sobre o ponto certo', () => {
    const { host } = loadHost([calendarPlugin]);
    const [contribution] = host.contributions.query(UI_SETTINGS_POINT)
      .filter((item) => (item.metadata as unknown as SettingsSection).key === 'calendar');
    const secao = contribution.metadata as unknown as SettingsSection;
    const [propriedade] = secao.properties;

    expect(propriedade.key).toBe('calendar.moveActions');
    expect(propriedade.type).toBe('contributions');
    expect(propriedade.point).toBe('calendar.moveaction');
    expect(validateSettingValue(propriedade, [{ key: 'prazo.mover', enabled: true }])).toBeNull();
    expect(validateSettingValue(propriedade, 'ligado')).not.toBeNull();
  });

  it('a view compila e avalia contra a API curada', () => {
    const source = calendarPlugin.views?.find((view) => view.key === 'calendar')?.source ?? '';
    expect(evaluateExtensionView('com.microteia.calendar::calendar', source)).toBeTypeOf('function');
  });
});

describe('prazoPlugin na agenda', () => {
  it('acrescenta ao item do calendário o processo e o advogado, como filtros', () => {
    const [patch] = prazoPlugin.screenPatches ?? [];

    expect(patch.target).toBe('microteia:calendar');
    expect(patch.targetKind).toBe('sourceId');
    expect(patch.fields.map((field) => [field.key, field.refEntity, field.filterable])).toEqual([
      ['caseId', 'cases', true],
      ['personId', 'persons', true],
    ]);
  });

  /**
   * O espelho grava no PRAZO, nunca no item: quem atualiza a agenda é o workflow de `deadline.saved`
   * na sequência. Escrever direto no item deixaria a agenda dizendo "concluído" sobre um prazo que
   * continua pendente.
   */
  it('as duas ações da agenda gravam no prazo, e o espelho reage', () => {
    const workflows = new Map(prazoPlugin.workflows.map((workflow) => [workflow.templateId, workflow]));
    const tabelasGravadas = (templateId: string): string[] => {
      const found: string[] = [];
      const walk = (steps: unknown[]): void => {
        for (const step of steps as Array<Record<string, unknown>>) {
          const config = (step.configuration ?? {}) as Record<string, { value?: { table?: string } }>;
          if (config.upsert?.value?.table) found.push(config.upsert.value.table);
          if (config.remove?.value?.table) found.push(config.remove.value.table);
          const branches = step.branches as Record<string, unknown[]> | undefined;
          if (branches) walk([...(branches.whenTrue ?? []), ...(branches.whenFalse ?? [])]);
        }
      };
      walk(workflows.get(templateId)?.steps ?? []);
      return found;
    };

    expect(tabelasGravadas('wf-prazo-calendar-concluir')).toEqual(['deadlines']);
    expect(tabelasGravadas('wf-prazo-calendar-mover')).toEqual(['deadlines']);
    expect(tabelasGravadas('wf-prazo-calendar-sync')).toEqual(['calendar']);
    expect(tabelasGravadas('wf-prazo-calendar-remover')).toEqual(['calendar']);

    expect(workflows.get('wf-prazo-calendar-sync')?.eventName).toBe('deadline.saved');
    expect(workflows.get('wf-prazo-calendar-remover')?.eventName).toBe('deadline.deleted');
  });

  /**
   * A contribuição endereça a Action pelo `templateId` do pacote (`sourceId` depois de instalada) —
   * o id real só nasce na instalação, e um manifest não tem como conhecê-lo.
   */
  it('as contribuições apontam para Actions que o próprio pacote instala', () => {
    const contribuicoes = (prazoPlugin.manifest.contributes ?? [])
      .filter((contribution) => contribution.point.startsWith('calendar.'));
    const templateIds = new Set((prazoPlugin.actions ?? []).map((action) => action.templateId));
    const workflowIds = new Set(prazoPlugin.workflows.map((workflow) => workflow.templateId));

    expect(contribuicoes.map((contribution) => contribution.point)).toEqual([
      'calendar.action', 'calendar.moveaction',
    ]);

    for (const contribution of contribuicoes) {
      const metadata = contribution.metadata as { origem?: string; actionSourceId?: string };
      // Sem a origem, o gesto do prazo apareceria no item de qualquer outra extensão.
      expect(metadata.origem).toBe('deadlines');
      expect(templateIds.has(metadata.actionSourceId ?? '')).toBe(true);
    }

    for (const action of prazoPlugin.actions ?? []) {
      expect(workflowIds.has(action.workflowId ?? '')).toBe(true);
    }
  });

  /**
   * O mutirão é o espelho aplicado a quem já existia — e a garantia de "rodar de novo não duplica"
   * é ESTRUTURAL: cada volta da repetição faz a mesma pergunta do gatilho (existe item com este
   * `origemId`?) antes de gravar, e o Gravar Registro inclui quando `input.itemId` é nulo e
   * atualiza quando não é.
   */
  it('o mutirão pergunta pelo item antes de gravar, como o espelho faz', () => {
    const workflows = new Map(prazoPlugin.workflows.map((workflow) => [workflow.templateId, workflow]));
    const mutirao = workflows.get('wf-prazo-calendar-sincronizar')!;

    expect(mutirao.eventName).toBe('workflow.called');
    expect(mutirao.parameters?.map((parameter) => parameter.key)).toEqual(['status']);

    const [buscarPrazos, repeticao] = mutirao.steps;
    expect(repeticao.type).toBe('Loop');
    // A consulta filtra por IGUALDADE, o único operador que o motor resolve no servidor: é o que
    // faz a varredura acontecer dentro da fatia escolhida, e não nos primeiros prazos do escritório.
    const consulta = (buscarPrazos.configuration.query as { value: { where: Array<{ op: string }> } }).value;
    expect(consulta.where.map((predicate) => predicate.op)).toEqual(['eq']);

    const corpo = repeticao.loop?.body ?? [];
    expect(corpo.map((step) => step.stepDefinitionId)).toEqual(['query', '', 'map', 'upsert']);
    // A pergunta que garante a idempotência: item com este `origemId` já existe?
    const busca = (corpo[0].configuration.query as { value: { table: string; where: Array<{ path: string }> } }).value;
    expect(busca.table).toBe('calendar');
    expect(busca.where[0].path).toBe('origemId');
  });

  /**
   * O gatilho e o mutirão montam o item pelo MESMO construtor, mudando só de onde o prazo vem
   * (`event` ou o item da repetição). Sem isso, um campo acrescentado a um dos caminhos sumiria do
   * outro em silêncio — e a agenda mostraria itens diferentes conforme a porta que os criou.
   */
  it('as duas portas montam o item com os mesmos campos', () => {
    const workflows = new Map(prazoPlugin.workflows.map((workflow) => [workflow.templateId, workflow]));
    const camposDe = (step: (typeof workflows extends Map<string, infer W> ? W : never)['steps'][number]): string[] =>
      ((step.configuration.map as { value: { fields: Array<{ name: string }> } }).value.fields).map((field) => field.name);

    const espelho = workflows.get('wf-prazo-calendar-sync')!.steps.find((step) => step.id === 'montarItem')!;
    const mutirao = (workflows.get('wf-prazo-calendar-sincronizar')!.steps[1].loop?.body ?? [])
      .find((step) => step.id === 'montarItem')!;

    expect(camposDe(espelho)).toEqual([
      'id', 'title', 'status', 'priority', 'date', 'finishDate',
      'description', 'origem', 'origemId', 'caseId', 'personId',
    ]);
    expect(camposDe(mutirao)).toEqual(camposDe(espelho));
  });

  it('o host recusa carregar Prazos sem a agenda instalada', () => {
    const semAgenda = CADEIA.filter((plugin) => plugin !== calendarPlugin);
    const { host, result } = loadHost(semAgenda);

    expect(host.isLoaded(prazoPlugin.manifest.id)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('dependency.missing');
  });
});
