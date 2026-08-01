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
    // Processos depende de Pessoas: os campos de responsável e de polos apontam para `persons`.
    const records = [
      ...CORE_PLUGINS,
      ...installedPluginRecords(
        [brasilPlugin, pessoaPlugin, processoPlugin],
        [
          installation(brasilPlugin.manifest.id),
          installation(pessoaPlugin.manifest.id),
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
    expect(pageKeys).toEqual(expect.arrayContaining(['processos', 'processo-edit']));
  });

  /** A dependência é dura de propósito: sem Pessoas, os campos de responsável e polos não teriam
   *  a quem apontar — a extensão não carrega, em vez de carregar meio funcionando. */
  it('sem a extensão de Pessoas instalada, o host recusa carregar Processos', () => {
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
    // O número do processo dá o subtítulo do detalhe e o rótulo da aba, como na tela nativa.
    expect(input.subtitleFieldKey).toBe('caseNumber');
    expect(input.tagCollection).toBe('caseTags');

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
