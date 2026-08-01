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
import { contratoPlugin } from './contrato';
import { financeiroPlugin } from './financeiro';
import { pessoaPlugin } from './pessoa';
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

const CADEIA = [brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin, financeiroPlugin];

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
