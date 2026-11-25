import { describe, expect, it } from 'vitest';
import type { AuditLog, ScreenDefinition } from '../../../domain/entities';
import { entityLabel, entityFilterOptions, presentAuditLog } from './auditLogLabels';
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

  it('entidade que o backend audita por nome próprio usa a chave do catálogo', () => {
    expect(entityLabel(t, resolve, 'TenantMember', [])).toBe('audit.entity.tenant-member');
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

  /** Quem tem tela é oferecido UMA vez, pela tela — nunca também por um nome fixo no código. */
  it('a tela é a única dona do nome da coleção que descreve', () => {
    const values = entityFilterOptions(t, resolve, [screen({})]).map((option) => option.value);
    expect(values.filter((value) => value === 'contracts')).toHaveLength(1);
    expect(values).not.toContain('Contract');
  });

  it('não oferece notas de tela que não tem notas', () => {
    const values = entityFilterOptions(t, resolve, [screen({ hasNotes: false })]).map((option) => option.value);
    expect(values).not.toContain('contracts#notes');
  });
});

describe('presentAuditLog — o autor (#30)', () => {
  const catalogo: Record<string, string> = {
    '@core.admin/audit.entity.system': 'System',
    '@core.workspace/user.unknown': 'Unknown user',
  };
  const label = (value: string | null | undefined) => catalogo[value ?? ''] ?? value ?? '';
  const log = (userName: string): AuditLog => ({
    id: 'a1',
    tenantId: 't1',
    title: 'x',
    text: 'y',
    userId: 'u1',
    userName,
    photoURL: '',
    action: 'SYSTEM',
    severity: 'LOW',
    type: 'AUDIT',
    entity: 'roles',
    entityId: 'r1',
    createdAt: new Date(),
  }) as AuditLog;

  it('o autor que é referência é resolvido — o avatar e a busca leem o nome, não a chave', () => {
    expect(presentAuditLog(t, label, log('@core.admin/audit.entity.system')).log.userName).toBe('System');
    expect(presentAuditLog(t, label, log('@core.workspace/user.unknown')).log.userName).toBe('Unknown user');
  });

  it('o nome de uma pessoa passa intacto', () => {
    expect(presentAuditLog(t, label, log('Ana Lima')).log.userName).toBe('Ana Lima');
  });
});

