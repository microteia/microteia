import { describe, expect, it } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';
import { entityLabel, entityFilterOptions } from './auditLogLabels';
import type { TranslateFn } from '../../shared/i18n/useT';

/**
 * Tradutor de teste: devolve a CHAVE com os parâmetros à mostra. O assert passa a falar de chave, que
 * é o que a função escolhe; a frase é escolha do catálogo e se testa no catálogo.
 */
const t: TranslateFn = (key, params) =>
  params ? `${key}(${Object.entries(params).map(([name, value]) => `${name}=${String(value)}`).join(',')})` : key;

/** O rótulo do escritório passa intacto, como `resolveLabel` faz com texto que não é referência. */
const resolve = (value: string) => value;

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
    expect(entityLabel(t, resolve, 'contracts', [screen({})])).toBe('Contrato');
  });

  it('acompanha o título quando a tela é renomeada', () => {
    expect(entityLabel(t, resolve, 'contracts', [screen({ titleSingular: 'Acordo' })])).toBe('Acordo');
  });

  it('nota e documento herdam a identidade do registro', () => {
    expect(entityLabel(t, resolve, 'contracts#notes', [screen({})])).toBe('audit.entity.note-of(name=Contrato)');
    expect(entityLabel(t, resolve, 'contracts#documents', [screen({})])).toBe('audit.entity.document-of(name=Contrato)');
  });

  /**
   * O log guarda `Contract`, de quando Contrato era do kernel. Com a tela que herdou a coleção
   * instalada, ele passa a ser exibido com o nome de HOJE — o mesmo que o log novo mostra, para a
   * mesma coisa não aparecer com dois nomes na lista.
   */
  it('log antigo do kernel usa o nome da tela que herdou a coleção', () => {
    expect(entityLabel(t, resolve, 'Contract', [screen({})])).toBe('Contrato');
    expect(entityLabel(t, resolve, 'Contract', [screen({ titleSingular: 'Acordo' })])).toBe('Acordo');
    expect(entityLabel(t, resolve, 'ContractNote', [screen({})])).toBe('audit.entity.note-of(name=Contrato)');
  });

  it('sem a tela instalada, o log antigo cai no nome que o kernel usava', () => {
    expect(entityLabel(t, resolve, 'Contract', [])).toBe('audit.entity.contract');
    expect(entityLabel(t, resolve, 'Record', [])).toBe('audit.entity.record');
  });

  it('coleção que ninguém descreve aparece como está', () => {
    expect(entityLabel(t, resolve, 'produtos', [])).toBe('produtos');
  });
});

describe('entityFilterOptions', () => {
  it('oferece a tela declarada, e suas notas e documentos', () => {
    const values = entityFilterOptions(t, resolve, [screen({})]).map((option) => option.value);
    expect(values).toContain('contracts');
    expect(values).toContain('contracts#notes');
    expect(values).toContain('contracts#documents');
  });

  /** Oferecer "Contract" e "Contrato" seria pedir para filtrar a mesma coisa por dois nomes. */
  it('não oferece o nome antigo do kernel quando a tela que o herdou está instalada', () => {
    const values = entityFilterOptions(t, resolve, [screen({})]).map((option) => option.value);
    expect(values).not.toContain('Contract');
    expect(values).not.toContain('ContractNote');
    expect(values).toContain('contracts');
  });

  it('sem a tela instalada, o nome antigo continua na lista para achar o log de então', () => {
    const values = entityFilterOptions(t, resolve, []).map((option) => option.value);
    expect(values).toContain('Contract');
  });

  it('não oferece notas de tela que não tem notas', () => {
    const values = entityFilterOptions(t, resolve, [screen({ hasNotes: false })]).map((option) => option.value);
    expect(values).not.toContain('contracts#notes');
  });
});
