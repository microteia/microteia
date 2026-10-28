import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { QUERY_MAX_RESULTS, QUERY_MAX_SCAN } from '../../domain/schema/querySpec';
import { queryCeilingReport } from './queryCeilings';

const comConsulta = (limit: number): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.batch', version: '1.0.0', kernel: '^2.83.0', name: 'Batch', description: 'x' },
  workflows: [{
    templateId: 'gerar-lote',
    name: 'Generate batch',
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [{
      id: 'destinatarios',
      stepDefinitionId: 'query',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: { query: { kind: 'Literal', value: { table: 'recipients', where: [], limit, projections: [] } } },
    }],
  }],
}) as unknown as MarketplacePlugin;

describe('queryCeilingReport', () => {
  it('avisa o limit acima do que uma consulta devolve, dizendo o teto e a saída', () => {
    const [finding, ...rest] = queryCeilingReport(comConsulta(300));
    expect(rest).toEqual([]);
    expect(finding).toMatchObject({ workflow: 'Generate batch', step: 'destinatarios' });
    expect(finding.detail).toContain(`at most ${QUERY_MAX_RESULTS} records`);
    expect(finding.detail).toContain(`limit of 300 still returns ${QUERY_MAX_RESULTS}`);
    expect(finding.detail).toContain(`${QUERY_MAX_SCAN} records it reads`);
    expect(finding.detail).toMatch(/read in pages/);
  });

  it('o limit dentro do teto não avisa nada', () => {
    expect(queryCeilingReport(comConsulta(QUERY_MAX_RESULTS))).toEqual([]);
  });
});
