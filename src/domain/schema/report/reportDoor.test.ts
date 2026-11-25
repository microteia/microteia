import { describe, expect, it } from 'vitest';
import { createSchemaContext } from '../pathResolver';
import type { SchemaScreen } from '../screenEntity';
import type { ReportSpec } from './reportSpec';
import { isReportDoor, reportOpenPermissions, reportVouchPermissions, restrictedReportSources } from './reportDoor';

const field = (key: string, type: string, order: number) => ({ key, label: key, type, required: false, order, origin: 'design' });

const funcionarios = {
  id: 'funcionarios', titleSingular: 'Employee', titleFieldKey: 'depto',
  fields: [field('depto', 'text', 0), field('salario', 'number', 1)],
} as unknown as SchemaScreen;
const vendas = {
  id: 'vendas', titleSingular: 'Sale', titleFieldKey: 'vendedor', memberVisibility: { userFields: ['vendedor'] },
  fields: [field('vendedor', 'text', 0), field('valor', 'number', 1)],
} as unknown as SchemaScreen;

const ctx = createSchemaContext([funcionarios, vendas], []);

const payroll = (restricted: boolean): ReportSpec => ({
  version: 1,
  dataset: {
    table: 'funcionarios',
    dimensions: [{ key: 'depto', path: 'depto' }],
    measures: [{ key: 'total', op: 'sum', path: 'salario' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'depto' }] },
  ...(restricted ? { access: { restricted: true } } : {}),
} as unknown as ReportSpec);

describe('reportDoor — o relatório como porta (#33)', () => {
  it('restrito e avalizado: abrir exige só a permissão dele', () => {
    const spec = payroll(true);
    const report = { id: 'r1', spec, vouch: { by: 'rh', spec: JSON.parse(JSON.stringify(spec)) as ReportSpec } };
    expect(isReportDoor(report)).toBe(true);
    expect(reportOpenPermissions(report, ctx, null)).toEqual(['report-r1.view']);
  });

  it('o aval vale para o spec atual: editado sem novo aval, volta a cobrar a leitura de quem abre', () => {
    const vouched = payroll(true);
    const edited = { ...payroll(true), dataset: { ...vouched.dataset, table: 'vendas' } } as ReportSpec;
    const report = { id: 'r1', spec: edited, vouch: { by: 'rh', spec: vouched } };
    expect(isReportDoor(report)).toBe(false);
    expect(reportOpenPermissions(report, ctx, null)).toEqual(['report-r1.view', 'vendas.read']);
  });

  it('restrito sem aval exige a permissão dele E a leitura; sem restrição, como sempre', () => {
    expect(reportOpenPermissions({ id: 'r1', spec: payroll(true) }, ctx, null)).toEqual(['report-r1.view', 'funcionarios.read']);
    expect(reportOpenPermissions({ id: 'r1', spec: payroll(false) }, ctx, null)).toEqual(['funcionarios.read']);
  });

  it('o relatório pessoal nunca é porta', () => {
    const spec = payroll(true);
    const report = { id: 'r1', ownerId: 'u1', spec, vouch: { by: 'u1', spec } };
    expect(isReportDoor(report)).toBe(false);
    expect(restrictedReportSources([{ ...report, title: 'Mine' }])).toEqual([]);
  });

  it('avalizar sobre tela restrita por registro exige ver todos os registros dela', () => {
    const sales = { ...payroll(true), dataset: { table: 'vendas', dimensions: [{ key: 'v', path: 'vendedor' }], measures: [{ key: 't', op: 'sum', path: 'valor' }] }, shape: { kind: 'summary', groupBy: [{ dimension: 'v' }] } } as unknown as ReportSpec;
    expect(reportVouchPermissions(sales, ctx, null)).toEqual(['vendas.read', 'vendas.read-all']);
    expect(reportVouchPermissions(payroll(true), ctx, null)).toEqual(['funcionarios.read']);
  });
});
