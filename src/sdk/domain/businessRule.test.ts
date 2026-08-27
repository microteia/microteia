import { describe, expect, it } from 'vitest';
import { checkBusinessRule, parseBusinessRule } from './businessRule';
import type { DomainModel } from './domainModel';
import { parseRuleLedger, ruleDelta, ruleFingerprint, ruleLedgerEntry, withRuleEntry } from './traceability';

/**
 * A regra como ARTEFATO, e a rastreabilidade dela.
 *
 * Nenhuma checagem aqui bloqueia, e o motivo é duro: a regra é prosa, e comparar prosa com declaração
 * dá falso positivo por construção. O que se cobra é que a DISTÂNCIA entre as duas seja dita — uma
 * distância apontada é o que se revisa, e uma distância silenciosa é o que se descobre quando o
 * escritório usa o sistema.
 */

const model = (): DomainModel => ({
  version: 1,
  target: 'screenDefinitions',
  entities: [{
    name: 'Order',
    kind: 'entity',
    collection: 'orders',
    titleField: 'number',
    fields: [
      { key: 'number', label: 'Number', semanticType: 'scalar', type: 'text' },
      { key: 'status', label: 'Status', semanticType: 'scalar', type: 'select', lookup: 'orderStatuses' },
    ],
  }],
  relationships: [],
  behavior: {
    states: [{
      entity: 'Order',
      field: 'status',
      lookup: 'orderStatuses',
      initial: 'draft',
      terminal: ['approved'],
      options: [{ key: 'draft', label: 'Draft' }, { key: 'approved', label: 'Approved' }],
    }],
    transitions: [{
      name: 'approve',
      description: 'approves a draft order',
      entity: 'Order',
      from: 'draft',
      to: 'approved',
      trigger: { kind: 'user-action', action: 'approve-order' },
      actor: 'the buying manager',
      permission: 'orders.update',
      effects: [],
    }],
    invariants: [{
      scope: 'field',
      entity: 'Order',
      field: 'number',
      expression: 'number != ""',
      message: 'An order needs a number.',
    }],
  },
});

const RULE = {
  id: 'approval',
  statement: 'Only the buying manager approves a draft order, and an order needs a number.',
  actors: ['the buying manager'],
  concepts: ['Order'],
  invariants: ['an order needs a number'],
  processes: ['an order is approved'],
  acceptance: ['an order with no number cannot be saved'],
};

describe('a leitura da regra', () => {
  it('sem enunciado não sobra artefato nenhum, e o erro diz por quê', () => {
    const read = parseBusinessRule({ id: 'x', actors: ['someone'] });
    expect(read.rule).toBeNull();
    expect(read.issues[0].code).toBe('rule.statement-missing');
    expect(read.issues[0].suggestion).toContain('not traceable');
  });

  it('JSON torto não estoura: ele vira o enunciado', () => {
    const read = parseBusinessRule('{ isto não é json', 'pasted');
    expect(read.rule?.statement).toBe('{ isto não é json');
  });

  it('lista com lixo dentro é limpa em vez de recusada', () => {
    const read = parseBusinessRule({ statement: 's', actors: ['a', '', 42, null, ' b '] });
    expect(read.rule?.actors).toEqual(['a', 'b']);
  });
});

describe('a regra contra o modelo', () => {
  it('a regra que fecha com o modelo não produz problema nenhum', () => {
    expect(checkBusinessRule(RULE, model())).toEqual([]);
  });

  it('um conceito que nenhuma entidade carrega é APONTADO, não bloqueado', () => {
    const issue = checkBusinessRule({ ...RULE, concepts: ['Order', 'Supplier'] }, model())
      .find((one) => one.code === 'rule.concept-without-entity');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('Supplier');
  });

  /** "o gerente" casa com "gerente de compras": a comparação é por contenção, nos dois sentidos. */
  it('o ator é casado por contenção, e não por igualdade exata', () => {
    expect(checkBusinessRule({ ...RULE, actors: ['manager'] }, model())
      .filter((one) => one.code === 'rule.actor-without-transition')).toEqual([]);
  });

  it('um ator que nenhuma transição pergunta nada é apontado', () => {
    const issue = checkBusinessRule({ ...RULE, actors: ['the auditor'] }, model())
      .find((one) => one.code === 'rule.actor-without-transition');
    expect(issue?.message).toContain('the auditor');
    expect(issue?.suggestion).toContain('naming an actor and asking nothing');
  });

  it('mais invariantes na regra que no comportamento é a distância que interessa', () => {
    const issue = checkBusinessRule({ ...RULE, invariants: ['a', 'b', 'c'] }, model())
      .find((one) => one.code === 'rule.invariant-not-modelled');
    expect(issue?.message).toContain('states 3 invariant(s) and the behavior declares 1');
  });

  it('mais processos que transições, idem', () => {
    const issue = checkBusinessRule({ ...RULE, processes: ['a', 'b'] }, model())
      .find((one) => one.code === 'rule.process-not-modelled');
    expect(issue?.message).toContain('2 process(es) and the behavior declares 1');
  });

  it('sem critério de aceitação, "pronto" é opinião — e o problema diz isso', () => {
    const issue = checkBusinessRule({ ...RULE, acceptance: [] }, model())
      .find((one) => one.code === 'rule.acceptance-missing');
    expect(issue?.suggestion).toContain('an opinion');
  });
});

describe('o livro de rastreabilidade', () => {
  const produced = {
    screens: ['orders', 'orders'],
    lists: ['orderStatuses'],
    actions: ['approve-order'],
    transitions: ['approve'],
    permissions: ['orders.update'],
  };

  it('a entrada é ordenada e sem repetição: aplicar duas vezes não multiplica nada', () => {
    const entry = ruleLedgerEntry(RULE, produced);
    expect(entry.screens).toEqual(['orders']);
    expect(entry.fingerprint).toBe(ruleFingerprint(RULE));
  });

  /** Nada aqui olha relógio: o módulo é puro, e `producedAt` é carimbado por quem grava o arquivo. */
  it('a entrada não carimba data por conta própria', () => {
    expect(ruleLedgerEntry(RULE, produced).producedAt).toBeUndefined();
  });

  it('a mesma regra substitui a entrada dela, nunca acrescenta uma segunda', () => {
    const first = withRuleEntry(undefined, ruleLedgerEntry(RULE, produced));
    const second = withRuleEntry(first, ruleLedgerEntry(RULE, produced));
    expect(second.rules.length).toBe(1);
  });

  it('e outra regra entra ao lado, em ordem estável', () => {
    const ledger = withRuleEntry(
      withRuleEntry(undefined, ruleLedgerEntry(RULE, produced)),
      ruleLedgerEntry({ ...RULE, id: 'aaa' }, produced),
    );
    expect(ledger.rules.map((one) => one.ruleId)).toEqual(['aaa', 'approval']);
  });

  it('arquivo ilegível volta VAZIO, e não derruba o planejamento de hoje', () => {
    expect(parseRuleLedger('não é json').rules).toEqual([]);
    expect(parseRuleLedger({ rules: 'nem lista' }).rules).toEqual([]);
    expect(parseRuleLedger({ rules: [{ statement: 'sem id' }] }).rules).toEqual([]);
  });

  it('o delta de uma regra que nunca rodou é tudo que ela produz', () => {
    const delta = ruleDelta(undefined, ruleLedgerEntry(RULE, produced));
    expect(delta.unchanged).toBe(false);
    expect(delta.added.screens).toEqual(['orders']);
    expect(delta.dropped.screens).toEqual([]);
  });

  it('o delta da MESMA regra é vazio nos dois sentidos', () => {
    const entry = ruleLedgerEntry(RULE, produced);
    const delta = ruleDelta(entry, entry);
    expect(delta.unchanged).toBe(true);
    expect(delta.added.screens).toEqual([]);
    expect(delta.dropped.screens).toEqual([]);
  });

  it('e o que a regra deixou de produzir aparece como DROPPED, nunca como remoção', () => {
    const before = ruleLedgerEntry(RULE, produced);
    const after = ruleLedgerEntry(RULE, { ...produced, screens: [], actions: [] });
    const delta = ruleDelta(before, after);
    expect(delta.dropped.screens).toEqual(['orders']);
    expect(delta.dropped.actions).toEqual(['approve-order']);
    expect(delta.unchanged).toBe(false);
  });
});
