// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { UI_PAGE_POINT } from '../../presentation/shared/uiExtensionPoints';
import type { PluginInstallation } from '../../domain/entities/PluginInstallation';
import { brasilPlugin } from './brasil';
import { calendarPlugin } from './calendar';
import { contratoPlugin } from './contrato';
import { financeiroPlugin } from './financeiro';
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

const CADEIA = [brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin, calendarPlugin, financeiroPlugin];

describe('financeiroPlugin', () => {
  it('carrega no host como extensão trusted, com a página da listagem, sem erros', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords(CADEIA, CADEIA.map((plugin) => installation(plugin.manifest.id))),
    ]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(financeiroPlugin.manifest.id)).toBe(true);

    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    expect(pageKeys).toContain('financeiro');
  });

  /** Um lançamento aponta para pessoa, processo e contrato: sem as três, os vínculos não teriam a
   *  quem apontar — a extensão não carrega, em vez de carregar meio funcionando. */
  it('sem as extensões de que depende, o host recusa carregar Financeiro', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords([financeiroPlugin], [installation(financeiroPlugin.manifest.id)]),
    ]);

    expect(host.isLoaded(financeiroPlugin.manifest.id)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('dependency.missing');
  });

  it('aponta para a coleção de lançamentos e declara o esquema dela por inteiro', () => {
    const [{ input }] = materializePluginScreens(financeiroPlugin, 'u1');

    expect(input.dataCollection).toBe('financials');
    expect(input.eventPrefix).toBe('financial');
    expect(input.titleFieldKey).toBe('category');
    expect(input.tagCollection).toBe('financialTags');
    expect(input.writeRoles).toEqual(['admin', 'lawyer']);

    const byKey = new Map(input.fields.map((field) => [field.key, field]));
    expect([...byKey.keys()]).toEqual(expect.arrayContaining([
      'type', 'category', 'amount', 'status', 'dueDate', 'paymentDate', 'cancelDate',
      'paymentMethod', 'costCenter', 'invoiceNumber', 'personId', 'caseId', 'contractId', 'notes',
    ]));
    // As listas são as do escritório, não uma cópia estática dentro do pacote.
    expect(byKey.get('status')?.lookupCollection).toBe('financialStatuses');
    expect(byKey.get('status')?.options).toBeUndefined();
    // O centro de custo é o MESMO dos contratos — de propósito, e por isso não é declarado aqui.
    expect(byKey.get('costCenter')?.lookupCollection).toBe('contractCostCenters');
    expect(financeiroPlugin.lookups?.map((lookup) => lookup.collection)).not.toContain('contractCostCenters');
    // O vencimento filtra por período (as duas pontas vêm do filtro declarado de data).
    expect(byKey.get('dueDate')?.filterable).toBe(true);
  });

  /**
   * Os três gestos do fluxo eram botões em código da tela fixa. Como Actions, quem decide se cada um
   * aparece é uma expressão sobre o registro — a mesma coisa que o Form Design oferece a qualquer
   * escritório.
   */
  it('registrar pagamento, estornar e cancelar são ações sobre workflows, com o quando declarado', () => {
    const byTemplate = new Map((financeiroPlugin.actions ?? []).map((action) => [action.templateId, action]));
    const workflowIds = new Set(financeiroPlugin.workflows.map((workflow) => workflow.templateId));

    expect(byTemplate.get('act-financeiro-pagar')?.hiddenWhen).toBe('isNew or status != "Aberto"');
    expect(byTemplate.get('act-financeiro-estornar')?.hiddenWhen).toBe('isNew or status != "Pago"');
    expect(byTemplate.get('act-financeiro-cancelar')?.hiddenWhen).toBe('isNew or status == "Cancelado"');
    for (const action of financeiroPlugin.actions ?? []) {
      expect(workflowIds.has(action.workflowId ?? ''), action.templateId).toBe(true);
    }

    const [{ input }] = materializePluginScreens(financeiroPlugin, 'u1');
    expect(input.cardActionIds).toHaveLength(3);
    expect(input.viewActionIds).toHaveLength(3);
  });

  it('as fontes reais das views compilam pelo runtime (não caem no fallback)', () => {
    for (const view of financeiroPlugin.views ?? []) {
      const Component = evaluateExtensionView(`test::${view.key}`, view.source);
      expect(typeof Component, view.key).toBe('function');
    }
  });
});

/**
 * A mesma anatomia que o Prazo estreou, agora com o segundo consumidor da agenda — e é a repetição
 * que prova que o Calendário é mesmo agnóstico: nenhuma linha dele mudou para o Financeiro caber.
 */
describe('financeiroPlugin na agenda', () => {
  const workflows = new Map(financeiroPlugin.workflows.map((workflow) => [workflow.templateId, workflow]));

  it('acrescenta ao item do calendário a situação, o valor e a pessoa', () => {
    const [patch] = financeiroPlugin.screenPatches ?? [];

    expect(patch.target).toBe('microteia:calendar');
    expect(patch.targetKind).toBe('sourceId');
    expect(patch.fields.map((field) => [field.key, field.type, field.filterable])).toEqual([
      ['financialStatus', 'select', true],
      ['financialAmount', 'currency', undefined],
      ['financialPersonId', 'reference', true],
    ]);
  });

  /**
   * As chaves são do Financeiro (`financialStatus`, e não `status`) porque o complemento SUBSTITUI
   * na tela alvo o campo de mesma chave, e a desinstalação leva embora o que é dele. Duas extensões
   * disputando a mesma chave na agenda fariam a saída de uma apagar o filtro da outra.
   */
  it('não disputa com o Prazo nenhuma chave de campo da agenda', () => {
    const doPrazo = new Set((prazoPlugin.screenPatches ?? []).flatMap((patch) => patch.fields.map((f) => f.key)));
    const doFinanceiro = (financeiroPlugin.screenPatches ?? []).flatMap((patch) => patch.fields.map((f) => f.key));

    for (const key of doFinanceiro) expect(doPrazo.has(key), key).toBe(false);
  });

  it('as duas ações da agenda gravam no lançamento, e o espelho reage', () => {
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

    expect(tabelasGravadas('wf-financeiro-calendar-pagar')).toEqual(['financials']);
    expect(tabelasGravadas('wf-financeiro-calendar-mover')).toEqual(['financials']);
    expect(tabelasGravadas('wf-financeiro-calendar-sync')).toEqual(['calendar']);
    expect(tabelasGravadas('wf-financeiro-calendar-remover')).toEqual(['calendar']);

    expect(workflows.get('wf-financeiro-calendar-sync')?.eventName).toBe('financial.saved');
    expect(workflows.get('wf-financeiro-calendar-remover')?.eventName).toBe('financial.deleted');
  });

  it('o gesto de pagar entra pela lista de ações da tela, não por contribuição', () => {
    const [patch] = financeiroPlugin.screenPatches ?? [];
    const templateIds = new Set((financeiroPlugin.actions ?? []).map((action) => action.templateId));

    expect(patch.cardActionIds).toEqual(['act-financeiro-calendar-pagar']);
    expect(templateIds.has(patch.cardActionIds![0])).toBe(true);

    const pagar = (financeiroPlugin.actions ?? [])
      .find((action) => action.templateId === 'act-financeiro-calendar-pagar')!;
    // A expressão é avaliada sobre o ITEM DA AGENDA: a origem restringe o gesto aos lançamentos (a
    // lista serve a agenda inteira), e a situação é a do complemento, não a da agenda.
    expect(pagar.hiddenWhen).toBe('origem != "financials" or financialStatus != "Aberto"');
  });

  it('a contribuição do arrasto aponta para uma Action que o próprio pacote instala', () => {
    const contribuicoes = (financeiroPlugin.manifest.contributes ?? [])
      .filter((contribution) => contribution.point.startsWith('calendar.'));
    const templateIds = new Set((financeiroPlugin.actions ?? []).map((action) => action.templateId));
    const workflowIds = new Set(financeiroPlugin.workflows.map((workflow) => workflow.templateId));

    expect(contribuicoes.map((contribution) => contribution.point)).toEqual(['calendar.moveaction']);

    const metadata = contribuicoes[0].metadata as { origem?: string; actionSourceId?: string };
    // Sem a origem, o arrasto de um prazo cairia no Financeiro.
    expect(metadata.origem).toBe('financials');
    expect(templateIds.has(metadata.actionSourceId ?? '')).toBe(true);

    for (const action of financeiroPlugin.actions ?? []) {
      expect(workflowIds.has(action.workflowId ?? ''), action.templateId).toBe(true);
    }
  });

  /**
   * O gatilho e o mutirão montam o item pelo MESMO construtor, mudando só de onde o lançamento vem.
   * Sem isso, um campo acrescentado a um dos caminhos sumiria do outro em silêncio — e a agenda
   * mostraria itens diferentes conforme a porta que os criou.
   */
  it('as duas portas montam o item com os mesmos campos', () => {
    const camposDe = (step: { configuration: Record<string, unknown> }): string[] =>
      ((step.configuration.map as { value: { fields: Array<{ name: string }> } }).value.fields)
        .map((field) => field.name);

    const espelho = workflows.get('wf-financeiro-calendar-sync')!.steps.find((step) => step.id === 'montarItem')!;
    const mutirao = (workflows.get('wf-financeiro-calendar-sincronizar')!.steps[1].loop?.body ?? [])
      .find((step) => step.id === 'montarItem')!;

    expect(camposDe(espelho)).toEqual([
      'id', 'title', 'status', 'priority', 'date', 'finishDate', 'description',
      'origem', 'origemId', 'financialStatus', 'financialAmount', 'financialPersonId',
    ]);
    expect(camposDe(mutirao)).toEqual(camposDe(espelho));
  });

  it('o mutirão pergunta pelo item antes de gravar, como o espelho faz', () => {
    const mutirao = workflows.get('wf-financeiro-calendar-sincronizar')!;

    expect(mutirao.eventName).toBe('workflow.called');
    expect(mutirao.parameters?.map((parameter) => parameter.key)).toEqual(['status']);

    const [buscarLancamentos, repeticao] = mutirao.steps;
    expect(repeticao.type).toBe('Loop');
    // Só o operador de igualdade é resolvido no servidor: é o que faz a varredura acontecer dentro
    // da fatia escolhida, e não nos primeiros lançamentos do escritório.
    const consulta = (buscarLancamentos.configuration.query as { value: { where: Array<{ op: string }> } }).value;
    expect(consulta.where.map((predicate) => predicate.op)).toEqual(['eq']);

    const corpo = repeticao.loop?.body ?? [];
    expect(corpo.map((step) => step.stepDefinitionId)).toEqual(['query', '', 'map', 'upsert']);
    const busca = (corpo[0].configuration.query as { value: { table: string; where: Array<{ path: string }> } }).value;
    expect(busca.table).toBe('calendar');
    expect(busca.where[0].path).toBe('origemId');
  });

  it('o host recusa carregar Financeiro sem a agenda instalada', () => {
    const semAgenda = CADEIA.filter((plugin) => plugin !== calendarPlugin);
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords(semAgenda, semAgenda.map((plugin) => installation(plugin.manifest.id))),
    ]);

    expect(host.isLoaded(financeiroPlugin.manifest.id)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('dependency.missing');
  });
});
