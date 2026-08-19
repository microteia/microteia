// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '..';
import { installedPluginRecords } from '../../domain/usecases/plugins/installedPluginRecords';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import { evaluateExtensionView } from '../../presentation/shared/extensions/evaluateExtensionView';
import { UI_PAGE_POINT } from '../../domain/schema/ui/uiExtensionPoints';
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

describe('prazoPlugin', () => {
  it('carrega no host como extensão trusted, com a página da listagem, sem erros', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords(CADEIA, CADEIA.map((plugin) => installation(plugin.manifest.id))),
    ]);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(prazoPlugin.manifest.id)).toBe(true);

    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    expect(pageKeys).toContain('prazos');
  });

  /**
   * Todo prazo é de um processo, e pode ter um advogado responsável: sem as duas extensões, os
   * vínculos não teriam a quem apontar — a extensão não carrega, em vez de carregar meio funcionando.
   */
  it('sem as extensões de que depende, o host recusa carregar Prazos', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords([prazoPlugin], [installation(prazoPlugin.manifest.id)]),
    ]);

    expect(host.isLoaded(prazoPlugin.manifest.id)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('dependency.missing');
  });

  it('aponta para a coleção de prazos e declara o esquema dela por inteiro', () => {
    const [{ input }] = materializePluginScreens(prazoPlugin, 'u1');

    expect(input.dataCollection).toBe('deadlines');
    expect(input.eventPrefix).toBe('deadline');
    expect(input.titleFieldKey).toBe('type');

    const byKey = new Map(input.fields.map((field) => [field.key, field]));
    expect([...byKey.keys()]).toEqual(expect.arrayContaining([
      'type', 'priority', 'status', 'caseId', 'dueDate', 'completedAt',
      'responsibleLawyerId', 'description',
    ]));
    // Prioridade e status eram uniões FECHADAS no tipo; agora são listas do escritório, e as chaves
    // continuam sendo os rótulos que os prazos já guardam.
    expect(byKey.get('priority')?.lookupCollection).toBe('deadlinePriorities');
    expect(byKey.get('status')?.lookupCollection).toBe('deadlineStatuses');
    const prioridades = prazoPlugin.lookups?.find((lookup) => lookup.collection === 'deadlinePriorities');
    expect(prioridades?.options?.map((option) => option.key)).toEqual(['Baixa', 'Média', 'Alta', 'Crítica']);
    // O vencimento filtra por período (as duas pontas vêm do filtro declarado de data).
    expect(byKey.get('dueDate')?.filterable).toBe(true);
  });

  /**
   * As meta-linhas do cartão são as mesmas de antes, na mesma ordem e com os mesmos ícones — o que
   * era `ui.list` no registro do kernel virou `listIcon`/`listOrder` na declaração da tela.
   */
  it('o cartão mantém as meta-linhas que a tela fixa tinha, na mesma ordem', () => {
    const [{ input }] = materializePluginScreens(prazoPlugin, 'u1');
    const linhas = input.fields
      .filter((field) => field.showInList)
      .sort((a, b) => (a.listOrder ?? 0) - (b.listOrder ?? 0));

    expect(linhas.map((field) => [field.key, field.listIcon])).toEqual([
      ['caseId', 'folder'],
      ['dueDate', 'calendar'],
      ['completedAt', 'calendarCheck'],
      ['responsibleLawyerId', 'scales'],
      ['description', 'fileText'],
    ]);
  });

  /**
   * "Marcar como concluído" era um `if` na view seguido de uma chamada de store. Como Action, quem
   * decide se ele aparece é uma expressão sobre o registro — a mesma coisa que o Form Design
   * oferece a qualquer escritório.
   */
  it('concluir é uma ação sobre workflow, com o quando declarado', () => {
    const concluir = (prazoPlugin.actions ?? []).find((action) => action.templateId === 'act-prazo-concluir')!;
    const workflowIds = new Set(prazoPlugin.workflows.map((workflow) => workflow.templateId));

    expect(concluir.templateId).toBe('act-prazo-concluir');
    expect(concluir.hiddenWhen).toBe('isNew or status == "Concluído" or status == "Cancelado"');
    expect(workflowIds.has(concluir.workflowId ?? '')).toBe(true);

    const [{ input }] = materializePluginScreens(prazoPlugin, 'u1');
    expect(input.cardActionIds).toHaveLength(1);
    expect(input.viewActionIds).toHaveLength(1);
  });

  it('as fontes reais das views compilam pelo runtime (não caem no fallback)', () => {
    for (const view of prazoPlugin.views ?? []) {
      const Component = evaluateExtensionView(`test::${view.key}`, view.source);
      expect(typeof Component, view.key).toBe('function');
    }
  });
});
