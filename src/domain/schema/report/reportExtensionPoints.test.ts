import { describe, it, expect } from 'vitest';
import { isApiVersionCompatible, isTrustedOnlyImplKind } from '../plugin/extensionPoint';
import {
  REPORT_API_VERSION,
  REPORT_DEFINITION_POINT,
  REPORT_EXTENSION_POINTS,
  reportContribution,
  reportOf,
} from './reportExtensionPoints';
import type { ReportContributionMetadata } from './reportExtensionPoints';
import type { ReportSpec } from './reportSpec';

const spec: ReportSpec = {
  v: 1,
  dataset: {
    table: 'lancamentos',
    dimensions: [{ key: 'situacao', path: 'situacao' }],
    measures: [{ key: 'total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
};

const metadata: ReportContributionMetadata = {
  templateId: 'faturamentoPorSituacao',
  title: '@com.acme.vendas/report.faturamento',
  icon: 'fileChart',
  spec,
};

const point = REPORT_EXTENSION_POINTS[0];

describe('report.definition — o ponto', () => {
  it('é um ponto só, e é o que o kernel declara', () => {
    expect(REPORT_EXTENSION_POINTS).toHaveLength(1);
    expect(point.id).toBe(REPORT_DEFINITION_POINT);
    expect(point.ownerPluginId).toBe('core.reports');
    expect(point.multiple).toBe(true);
  });

  it('o relatório existe SEM implementação — é o que o separa de `ui.page`', () => {
    // Uma página sem implementação não seria nada; um relatório declarativo é dado puro, e é por
    // isso que qualquer pacote pode trazê-lo sem gesto de confiança nenhum.
    expect(point.implRequired).toBe(false);
  });

  it('aceita `widget` e `code`, e só `code` exige confiança', () => {
    expect(point.allowedImplKinds).toEqual(['widget', 'code']);
    expect(isTrustedOnlyImplKind('code')).toBe(true);
    expect(isTrustedOnlyImplKind('widget')).toBe(false);
  });

  it('uma contribuição escrita para a 1.0.0 roda neste ponto', () => {
    expect(isApiVersionCompatible('1.0.0', REPORT_API_VERSION)).toBe(true);
  });
});

describe('reportContribution', () => {
  it('deriva o id da contribuição do `templateId`', () => {
    expect(reportContribution(metadata)).toMatchObject({
      point: REPORT_DEFINITION_POINT,
      id: 'faturamento-por-situacao',
      apiVersion: REPORT_API_VERSION,
    });
  });

  it('não carrega `impl` quando o relatório é declarativo', () => {
    expect(reportContribution(metadata).impl).toBeUndefined();
  });

  it('carrega o `impl` de código quando a apresentação é uma view', () => {
    // O código substitui a APRESENTAÇÃO; o `dataset` continua no spec, e é ele que a callable cobra.
    // Sem isso, um relatório de código seria a porta dos fundos do RBAC.
    const contribution = reportContribution(metadata, { kind: 'code', key: 'salesReport' });

    expect(contribution.impl).toEqual({ kind: 'code', key: 'salesReport' });
    expect((contribution.metadata as unknown as ReportContributionMetadata).spec.dataset.table)
      .toBe('lancamentos');
  });
});

describe('reportOf', () => {
  it('lê de volta o relatório de uma contribuição bem formada', () => {
    expect(reportOf(reportContribution(metadata))?.templateId).toBe('faturamentoPorSituacao');
  });

  it('descarta metadata malformada de terceiro sem lançar', () => {
    const malformadas = [
      {},
      { templateId: '' },
      { templateId: 'x' },
      { templateId: 'x', title: 'T' },
      { templateId: 'x', title: 'T', spec: {} },
      { templateId: 'x', title: 'T', spec: { v: 'um' } },
    ];

    for (const bad of malformadas) {
      const contribution = { ...reportContribution(metadata), metadata: bad as Record<string, unknown> };
      expect(() => reportOf(contribution)).not.toThrow();
      expect(reportOf(contribution)).toBeUndefined();
    }
  });

  it('descarta o relatório que este kernel não pode responder por inteiro', () => {
    const juncao = { ...spec, dataset: { ...spec.dataset, kind: 'join' } } as ReportSpec;

    expect(reportOf(reportContribution({ ...metadata, spec: juncao }))).toBeUndefined();
  });

  it('MANTÉM o relatório que só traz avisos — é o que a degradação promete', () => {
    // Dobra desconhecida vira lista simples; granularidade desconhecida agrupa pelo valor cru. Nos
    // dois casos o relatório continua valendo, e descartá-lo aqui quebraria a promessa.
    const dobraNova = { ...spec, shape: { kind: 'funnel' } } as unknown as ReportSpec;

    expect(reportOf(reportContribution({ ...metadata, spec: dobraNova }))?.templateId)
      .toBe('faturamentoPorSituacao');
  });
});
