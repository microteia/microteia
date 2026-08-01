import { describe, expect, it } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';
import { entityLabel, entityFilterOptions } from './auditLogLabels';

const screen = (overrides: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'contratos',
  tenantId: 't1',
  origin: 'plugin',
  titleSingular: 'Contrato',
  titlePlural: 'Contratos',
  dataCollection: 'contracts',
  icon: 'file',
  fields: [],
  titleFieldKey: 'title',
  hasNotes: true,
  hasDocuments: true,
  hasTags: false,
  listActions: [],
  viewActionIds: [],
  cardActionIds: [],
  sidebarOrder: 0,
  enabled: true,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  ...overrides,
}) as ScreenDefinition;

/**
 * O log guarda a coleção; quem dá nome a ela é a tela instalada HOJE. Um rótulo congelado no momento
 * da gravação envelhece — foi o que aconteceu quando Contrato saiu do kernel.
 */
describe('entityLabel', () => {
  it('nomeia a coleção pela tela que a descreve', () => {
    expect(entityLabel('contracts', [screen({})])).toBe('Contrato');
  });

  it('acompanha o título quando a tela é renomeada', () => {
    expect(entityLabel('contracts', [screen({ titleSingular: 'Acordo' })])).toBe('Acordo');
  });

  it('nota e documento herdam a identidade do registro', () => {
    expect(entityLabel('contracts#notes', [screen({})])).toBe('Nota de Contrato');
    expect(entityLabel('contracts#documents', [screen({})])).toBe('Documento de Contrato');
  });

  it('log antigo, de quando a entidade era do kernel, continua legível', () => {
    expect(entityLabel('Contract', [screen({})])).toBe('Contrato');
    expect(entityLabel('Record', [])).toBe('Registro');
  });

  it('coleção que ninguém descreve aparece como está', () => {
    expect(entityLabel('produtos', [])).toBe('produtos');
  });
});

describe('entityFilterOptions', () => {
  it('oferece a tela declarada, e suas notas e documentos', () => {
    const values = entityFilterOptions([screen({})]).map((option) => option.value);
    expect(values).toContain('contracts');
    expect(values).toContain('contracts#notes');
    expect(values).toContain('contracts#documents');
  });

  it('não oferece notas de tela que não tem notas', () => {
    const values = entityFilterOptions([screen({ hasNotes: false })]).map((option) => option.value);
    expect(values).not.toContain('contracts#notes');
  });
});
