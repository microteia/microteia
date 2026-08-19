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
import { contratoPlugin } from './contrato';
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

describe('processoPlugin', () => {
  it('carrega no host como extensão trusted, com as duas páginas de código, sem erros', () => {
    const host = createPluginHost();
    // Processos depende de Pessoas (responsável e polos apontam para `persons`) e de Contratos
    // (o campo "Contrato" aponta para `contracts`, e a aba de processos vive no registro dele).
    const records = [
      ...CORE_PLUGINS,
      ...installedPluginRecords(
        [brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin],
        [
          installation(brasilPlugin.manifest.id),
          installation(pessoaPlugin.manifest.id),
          installation(contratoPlugin.manifest.id),
          installation(processoPlugin.manifest.id),
        ],
      ),
    ];
    const result = host.load(records);

    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(host.isLoaded(processoPlugin.manifest.id)).toBe(true);

    const pageKeys = host.contributions
      .query(UI_PAGE_POINT)
      .map((c) => (c.impl as { key?: string } | undefined)?.key);
    // Só a LISTAGEM é de código. O detalhe é o genérico do kernel: o formulário que o schema monta
    // já é o que a extensão desenharia, e duplicá-lo em código só criaria duas telas para manter.
    expect(pageKeys).toContain('processos');
    expect(pageKeys).not.toContain('processo-edit');
  });

  /** A dependência é dura de propósito: sem Pessoas nem Contratos, os campos de responsável, polos
   *  e contrato não teriam a quem apontar — a extensão não carrega, em vez de carregar meio
   *  funcionando. */
  it('sem as extensões de que depende, o host recusa carregar Processos', () => {
    const host = createPluginHost();
    const result = host.load([
      ...CORE_PLUGINS,
      ...installedPluginRecords([processoPlugin], [installation(processoPlugin.manifest.id)]),
    ]);

    expect(host.isLoaded(processoPlugin.manifest.id)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('dependency.missing');
  });

  /**
   * As duas metades do objetivo, e o motivo de o teste existir:
   *
   * 1. a tela aponta para a coleção onde os processos JÁ estão — nada é copiado nem migrado;
   * 2. o pacote declara o esquema INTEIRO dessa coleção — campos, listas de opções, relações,
   *    etiquetas, linhas do card e filtros. Se ele herdasse isso do `entityRegistry`, a extensão
   *    quebraria no dia em que `cases` saísse do kernel, que é justamente o destino do projeto.
   */
  it('aponta para a coleção de Processos e declara o esquema dela por inteiro', () => {
    const [{ input }] = materializePluginScreens(processoPlugin, 'u1');

    expect(input.dataCollection).toBe('cases');
    expect(input.titleFieldKey).toBe('title');
    // O número do processo dá o subtítulo do detalhe e a linha sob o título do cartão.
    expect(input.subtitleFieldKey).toBe('caseNumber');
    expect(input.tagCollection).toBe('caseTags');
    // A relação com Contrato é de VISÃO: o contrato mostra os processos dele, e Processos continua
    // uma tela de topo — com menu, busca e o campo "Contrato" no formulário.
    expect(input.parentEntity).toBe('contracts');
    expect(input.parentFieldKey).toBe('contractId');
    expect(input.parentRelation).toBe('related');
    // Sem editor próprio: quem abre um processo de fora (auditoria, menção, card de outra tela)
    // chega ao detalhe genérico, que é o mesmo formulário.
    expect(input.recordTabPrefix ?? null).toBeNull();

    const byKey = new Map(input.fields.map((field) => [field.key, field]));
    expect([...byKey.keys()]).toEqual(expect.arrayContaining([
      'caseNumber', 'title', 'area', 'type', 'phase', 'status', 'instance', 'court',
      'courtDistrict', 'judge', 'filedAt', 'causeValue', 'responsibleLawyerId', 'contractId',
      'notes', 'activePoleIds', 'passivePoleIds',
    ]));
    // As listas de opções são as do escritório, não uma cópia estática dentro do pacote.
    expect(byKey.get('status')?.lookupCollection).toBe('caseStatuses');
    expect(byKey.get('status')?.options).toBeUndefined();
    // O card: as mesmas linhas com ícone da tela nativa, NA MESMA ORDEM (o responsável primeiro,
    // embora seja um dos últimos campos do formulário).
    expect(
      input.fields
        .filter((field) => field.listIcon)
        .sort((a, b) => (a.listOrder ?? a.order) - (b.listOrder ?? b.order))
        .map((field) => field.key),
    ).toEqual(['responsibleLawyerId', 'area', 'instance', 'court', 'causeValue']);
  });

  it('as fontes reais das views compilam pelo runtime (não caem no fallback)', () => {
    for (const view of processoPlugin.views ?? []) {
      const Component = evaluateExtensionView(`test::${view.key}`, view.source);
      expect(typeof Component, view.key).toBe('function');
    }
  });
});
