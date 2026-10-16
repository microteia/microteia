import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import type { ActionExprContext } from './actionExpression';
import { actionActiveState, evaluateActionExpression, isActionDisabled, isActionHidden } from './actionExpression';
import { createSchemaContext } from './pathResolver';
import type { SchemaScreen } from './pathResolver';
import { loadNavigatedReferences, planReferenceNavigation } from './referenceScope';
import type { ReferenceNavigator } from './referenceScope';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key'>): FieldDefinition => ({
  label: overrides.key,
  origin: 'design',
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const screen = (id: string, fields: FieldDefinition[]): SchemaScreen => ({
  id,
  collection: id,
  titleSingular: id,
  titleFieldKey: fields[0]?.key ?? 'title',
  fields,
});

const schema = createSchemaContext([
  screen('pushes', [
    field({ key: 'subject' }),
    field({ key: 'caseId', type: 'reference', refEntity: 'cases' }),
    field({ key: 'partyIds', type: 'reference', refEntity: 'clients', multi: true }),
  ]),
  screen('cases', [
    field({ key: 'title' }),
    field({ key: 'responsibleLawyerId' }),
    field({ key: 'contractId', type: 'reference', refEntity: 'contracts' }),
  ]),
  screen('contracts', [
    field({ key: 'number' }),
    field({ key: 'clientId', type: 'reference', refEntity: 'clients' }),
  ]),
  screen('clients', [field({ key: 'name' })]),
]);

const database: Record<string, Record<string, Record<string, unknown>>> = {
  cases: { c1: { title: 'Ação de cobrança', responsibleLawyerId: 'lawyer-ana', contractId: 'k1' } },
  contracts: { k1: { number: 'K-7', clientId: 'cl1' } },
  clients: { cl1: { name: 'ACME' } },
};

const inMemory = (collection: string, id: string) => database[collection]?.[id] ?? null;

const navigator = (overrides: Partial<ReferenceNavigator> = {}): ReferenceNavigator => ({
  schema,
  lookup: inMemory,
  ...overrides,
});

const ctx = (
  values: Record<string, unknown>,
  overrides: Partial<ActionExprContext> = {},
): ActionExprContext => ({
  values,
  record: values,
  isNew: false,
  isDirty: false,
  permissions: [],
  entity: 'pushes',
  references: navigator(),
  ...overrides,
});

describe('expressão de ação navega a referência', () => {
  it('lê o campo do registro apontado', () => {
    expect(evaluateActionExpression('caseId.responsibleLawyerId', ctx({ caseId: 'c1' }))).toBe('lawyer-ana');
  });

  it('desce mais de um salto', () => {
    expect(evaluateActionExpression('caseId.contractId.clientId', ctx({ caseId: 'c1' }))).toBe('cl1');
    expect(evaluateActionExpression('caseId.contractId.clientId.name', ctx({ caseId: 'c1' }))).toBe('ACME');
  });

  it('o id do apontado continua legível dentro da navegação', () => {
    expect(evaluateActionExpression('caseId.id', ctx({ caseId: 'c1' }))).toBe('c1');
  });

  it('esconde no cartão quando o apontado está em memória', () => {
    const context = ctx({ caseId: 'c1' }, { surface: 'list' });
    expect(isActionHidden('caseId.title == "Ação de cobrança"', context)).toBe(true);
    expect(isActionDisabled('caseId.title == "Outro"', context)).toBe(false);
    expect(actionActiveState('caseId.contractId.number == "K-7"', context)).toBe(true);
  });
});

/**
 * A garantia de compatibilidade: o nome LIDO SOZINHO é o id, como sempre foi. Trocá-lo pelo registro
 * em toda expressão faria `parameterDefaults: { clientId: 'clientId' }` pré-preencher um objeto.
 */
describe('o nome sozinho continua sendo o id', () => {
  it('copiar a referência devolve o id, não o registro', () => {
    expect(evaluateActionExpression('caseId', ctx({ caseId: 'c1' }))).toBe('c1');
  });

  it('isEmpty e a igualdade seguem tratando o id', () => {
    expect(isActionHidden('isEmpty(caseId)', ctx({ caseId: 'c1' }))).toBe(false);
    expect(isActionHidden('isEmpty(caseId)', ctx({ caseId: null }))).toBe(true);
    expect(isActionHidden('caseId == "c1"', ctx({ caseId: 'c1' }))).toBe(true);
  });

  it('o salto intermediário lido sozinho é o id dele', () => {
    expect(evaluateActionExpression('caseId.contractId', ctx({ caseId: 'c1' }))).toBe('k1');
  });

  it('na expressão que também navega, o nome sozinho segue sendo o id', () => {
    expect(evaluateActionExpression('concat(caseId, "|", caseId.title)', ctx({ caseId: 'c1' }))).toBe('c1|Ação de cobrança');
    expect(isActionHidden('caseId == "c1" and caseId.title == "Ação de cobrança"', ctx({ caseId: 'c1' }))).toBe(true);
  });

  it('sem navegador no contexto, nada muda', () => {
    expect(evaluateActionExpression('caseId', ctx({ caseId: 'c1' }, { references: undefined }))).toBe('c1');
  });

  it('a referência múltipla não é navegada', () => {
    expect(evaluateActionExpression('partyIds', ctx({ partyIds: ['cl1'] }))).toEqual(['cl1']);
  });
});

describe('referência sem registro responde vazio, nunca estoura', () => {
  it('referência vazia', () => {
    expect(evaluateActionExpression('caseId.responsibleLawyerId', ctx({ caseId: null }))).toBeNull();
    expect(evaluateActionExpression('caseId.contractId.clientId', ctx({}))).toBeNull();
  });

  it('registro apagado', () => {
    expect(evaluateActionExpression('caseId.responsibleLawyerId', ctx({ caseId: 'gone' }))).toBeNull();
    expect(evaluateActionExpression('caseId.contractId.clientId', ctx({ caseId: 'gone' }))).toBeNull();
  });

  it('coleção que quem olha não pode ler', () => {
    const blind = navigator({ lookup: (collection, id) => (collection === 'cases' ? null : inMemory(collection, id)) });
    expect(evaluateActionExpression('caseId.title', ctx({ caseId: 'c1' }, { references: blind }))).toBeNull();
    expect(isActionHidden('caseId.title == "Ação de cobrança"', ctx({ caseId: 'c1' }, { references: blind }))).toBe(false);
  });

  /** Quem também lê o nome sozinho recebe `null` — e o curto-circuito do `or` protege a navegação. */
  it('a expressão que testa a presença antes de navegar segue funcionando', () => {
    const expression = 'isEmpty(caseId) or caseId.title == "X"';
    expect(isActionHidden(expression, ctx({ caseId: null }))).toBe(true);
    expect(isActionHidden(expression, ctx({ caseId: 'c1' }))).toBe(false);
  });
});

describe('carga sob demanda', () => {
  it('busca, salto a salto, só o que a memória não tem', async () => {
    const fetched: string[] = [];
    const cold = navigator({
      lookup: () => null,
      fetch: async (collection, id) => {
        fetched.push(`${collection}:${id}`);
        return inMemory(collection, id);
      },
    });
    const plan = planReferenceNavigation(schema, 'pushes', ['caseId.contractId.clientId'])!;
    const lookup = await loadNavigatedReferences({ caseId: 'c1' }, plan, cold);
    expect(fetched).toEqual(['cases:c1', 'contracts:k1']);
    expect(evaluateActionExpression(
      'caseId.contractId.clientId',
      ctx({ caseId: 'c1' }, { references: { ...cold, lookup } }),
    )).toBe('cl1');
  });

  it('a busca que falha vira referência sem registro', async () => {
    const failing = navigator({ lookup: () => null, fetch: () => Promise.reject(new Error('permission-denied')) });
    const plan = planReferenceNavigation(schema, 'pushes', ['caseId.title'])!;
    const lookup = await loadNavigatedReferences({ caseId: 'c1' }, plan, failing);
    expect(lookup('cases', 'c1')).toBeNull();
  });

  it('expressão que não navega não tem plano — o formulário abre na hora', () => {
    expect(planReferenceNavigation(schema, 'pushes', ['caseId', 'concat(subject, "!")'])).toBeNull();
    expect(planReferenceNavigation(schema, 'pushes', ['record.caseId', 'user.id'], new Set(['record', 'user']))).toBeNull();
  });
});
