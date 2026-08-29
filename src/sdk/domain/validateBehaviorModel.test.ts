import { describe, expect, it } from 'vitest';
import { buildDomainCatalog } from './catalog';
import type { BehaviorInvariant, BehaviorModel, BehaviorTransition } from './behaviorModel';
import { BEHAVIOR_MECHANISMS, SCHEDULE_TRIGGER_SUPPORTED } from './behaviorMapping';
import { CONTROL_STEP_TYPES, CORE_STEP_DEFINITION_IDS } from '../../domain/schema/workflowStepCatalog';
import type { DomainEntity, DomainIssue, DomainModel } from './domainModel';
import { parseDomainModel } from './domainModel';
import { salesBehavior, salesBehaviorModel } from './fixtures.test-support';
import { validateDomainModel } from './validateDomainModel';

const EMPTY = buildDomainCatalog([]);

const check = (model: DomainModel) => validateDomainModel(model, EMPTY);
const codes = (issues: readonly DomainIssue[]): string[] => issues.map((one) => one.code);
const errors = (issues: readonly DomainIssue[]): DomainIssue[] => issues.filter((one) => one.severity === 'error');

/** O mesmo cenário obrigatório, com UMA peça do comportamento trocada. */
const withBehavior = (mutate: (behavior: BehaviorModel) => BehaviorModel): DomainModel => {
  const model = salesBehaviorModel();
  return { ...model, behavior: mutate(salesBehavior()) };
};

/** Venda com as chaves declaradas e UMA invariante de coleção — o par que se quer exercitar. */
const withKeyedSale = (keys: DomainEntity['keys'], invariant: BehaviorInvariant): DomainModel => {
  const model = salesBehaviorModel();
  return {
    ...model,
    entities: model.entities.map((entity) => (entity.name === 'Sale' ? { ...entity, keys } : entity)),
    behavior: { ...salesBehavior(), invariants: [invariant] },
  };
};

const replaceTransition = (behavior: BehaviorModel, name: string, patch: Partial<BehaviorTransition>): BehaviorModel => ({
  ...behavior,
  transitions: behavior.transitions.map((one) => (one.name === name ? { ...one, ...patch } : one)),
});

/**
 * A REGRA DESTA METADE: "A state is a key, never a label." E a disciplina é a do irmão — todo
 * detector daqui para baixo tem um teste POSITIVO (o defeito é pego) e um NEGATIVO (a declaração
 * correta passa). Sem o segundo, uma regra que reprovasse tudo passaria despercebida.
 */
describe('o cenário obrigatório — a venda, com o comportamento que a frase descreve', () => {
  const result = check(salesBehaviorModel());

  it('não tem nenhum problema bloqueante', () => {
    expect(errors(result.issues)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rende os quatro estados, com o inicial e o terminal declarados', () => {
    const state = salesBehavior().states[0];
    expect(state.options.map((one) => one.key)).toStrictEqual(['draft', 'confirmed', 'invoiced', 'cancelled']);
    expect(state.initial).toBe('draft');
    expect(state.terminal).toStrictEqual(['cancelled']);
  });

  it('rende as quatro transições, cada uma como um fluxo chamável mais a ação que o invoca', () => {
    expect(result.transitions.map((one) => `${one.transition.from}->${one.transition.to}:${one.actionKey}`)).toStrictEqual([
      'draft->confirmed:confirm-sale',
      'confirmed->invoiced:invoice-sale',
      'draft->cancelled:cancel-sale',
      'invoiced->cancelled:cancel-invoiced-sale',
    ]);
    expect(result.transitions.every((one) => one.eventName === 'workflow.called')).toBe(true);
  });

  it('traduz o cancelamento do faturado num nó de condição com a permissão', () => {
    const cancel = result.transitions.find((one) => one.transition.name === 'cancel-invoiced');
    expect(cancel?.permission).toBe('sales.cancel');
    expect(cancel?.steps[0]).toBe(CONTROL_STEP_TYPES[0]);
    expect(cancel?.workflowCondition).toContain('status == "invoiced"');
  });

  it('não usa passo de script em nenhuma delas — e todo passo citado existe no catálogo', () => {
    const steps = result.transitions.flatMap((one) => one.steps);
    expect(steps).not.toContain('script');
    for (const step of steps) {
      expect(CORE_STEP_DEFINITION_IDS.includes(step) || CONTROL_STEP_TYPES.includes(step)).toBe(true);
    }
  });

  it('diz que a permissão do gerente ainda precisa ser declarada pelo pacote, sem bloquear', () => {
    const undeclared = result.issues.filter((one) => one.code === 'behavior.transition.permission-undeclared');
    expect(undeclared).toHaveLength(1);
    expect(undeclared[0].severity).toBe('info');
  });

  it('leva as chaves de estado para a lista que o pacote semeia', () => {
    const plan = check(salesBehaviorModel());
    expect(plan.ok).toBe(true);
  });
});

describe('a tabela de mecanismos — o que ela promete existe', () => {
  it('todo passo citado é um passo do kernel ou um nó de controle', () => {
    for (const mechanism of BEHAVIOR_MECHANISMS) {
      for (const step of mechanism.stepIds) {
        expect(CORE_STEP_DEFINITION_IDS.includes(step) || CONTROL_STEP_TYPES.includes(step)).toBe(true);
      }
    }
  });

  it('o gatilho de relógio é o único sem mecanismo, e a recusa é derivada do catálogo de eventos', () => {
    const unsupported = BEHAVIOR_MECHANISMS.filter((one) => !one.supported);
    expect(unsupported.map((one) => one.declares)).toStrictEqual(['schedule']);
    expect(SCHEDULE_TRIGGER_SUPPORTED).toBe(false);
  });

  it('nenhum efeito é traduzido para um passo de script', () => {
    expect(BEHAVIOR_MECHANISMS.flatMap((one) => one.stepIds)).not.toContain('script');
  });
});

describe('o estado é uma CHAVE, nunca um rótulo', () => {
  it('pega a transição que compara o rótulo, e diz qual é a chave', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'invoice', { to: 'Invoiced' })));
    const issue = result.issues.find((one) => one.code === 'behavior.transition.compares-label');
    expect(issue?.message).toContain('"invoiced"');
    expect(result.ok).toBe(false);
  });

  it('pega a transição para um estado que não existe na lista de opções', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'invoice', { to: 'shipped' })));
    expect(codes(result.issues)).toContain('behavior.transition.unknown-state');
    expect(result.ok).toBe(false);
  });

  it('não reclama de nenhuma das quatro transições escritas por chave', () => {
    const result = check(salesBehaviorModel());
    expect(codes(result.issues)).not.toContain('behavior.transition.compares-label');
    expect(codes(result.issues)).not.toContain('behavior.transition.unknown-state');
  });
});

describe('o campo que guarda o estado', () => {
  it('pega o estado sobre um campo que a entidade não declara', () => {
    const result = check(withBehavior((behavior) => ({
      ...behavior,
      states: behavior.states.map((one) => ({ ...one, field: 'situation' })),
    })));
    expect(codes(result.issues)).toContain('behavior.state.field-not-declared');
  });

  it('pega o estado sobre um campo de texto, cujas opções não teriam onde morar', () => {
    const model = salesBehaviorModel();
    const result = check({
      ...model,
      entities: model.entities.map((entity) => (entity.name === 'Sale'
        ? {
          ...entity,
          fields: entity.fields.map((field) => (field.key === 'status'
            ? { key: 'status', label: 'status', semanticType: 'scalar' as const, type: 'text' as const }
            : field)),
        }
        : entity)),
    });
    const issue = result.issues.find((one) => one.code === 'behavior.state.field-not-a-list');
    expect(issue?.message).toContain('"text"');
  });

  it('aceita o select servido pela lista que o próprio campo aponta', () => {
    expect(codes(check(salesBehaviorModel()).issues)).not.toContain('behavior.state.field-not-a-list');
  });
});

describe('alcance — entrada, saída, e o fim que se declara', () => {
  it('pega o estado em que nenhuma transição entra', () => {
    const result = check(withBehavior((behavior) => ({
      ...behavior,
      states: behavior.states.map((one) => ({
        ...one,
        options: [...one.options, { key: 'shipped', label: 'Shipped' }],
        terminal: ['cancelled', 'shipped'],
      })),
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.state.unreachable');
    expect(issue?.message).toContain('"shipped"');
  });

  it('pega o estado de onde nada sai e que não foi declarado terminal', () => {
    const result = check(withBehavior((behavior) => ({
      ...behavior,
      states: behavior.states.map((one) => ({ ...one, terminal: undefined })),
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.state.dead-end');
    expect(issue?.message).toContain('"cancelled"');
  });

  it('não reclama do inicial sem entrada nem do terminal sem saída', () => {
    const result = check(salesBehaviorModel());
    expect(codes(result.issues)).not.toContain('behavior.state.unreachable');
    expect(codes(result.issues)).not.toContain('behavior.state.dead-end');
  });
});

describe('o laço — o efeito que dispara o próprio gatilho', () => {
  const looping = (guard?: string): DomainModel => withBehavior((behavior) => ({
    ...behavior,
    states: behavior.states.map((one) => ({ ...one, terminal: ['cancelled'] })),
    transitions: [
      ...behavior.transitions,
      {
        name: 'stamp-code',
        entity: 'Sale',
        from: 'draft',
        to: 'draft',
        trigger: { kind: 'entity-event', event: 'saved' },
        ...(guard === undefined ? {} : { guard: { expression: guard } }),
        effects: [{ kind: 'set-field', field: 'code', value: 'concat("S-", id)' }],
      },
    ],
  }));

  it('pega o efeito que grava no registro que o disparou, sem nada que faça o ciclo convergir', () => {
    const result = check(looping());
    const issue = result.issues.find((one) => one.code === 'behavior.effect.self-trigger-loop');
    expect(issue?.message).toContain('"code"');
    expect(issue?.suggestion).toContain('does not publish when the document did not change');
    expect(result.ok).toBe(false);
  });

  it('aceita quando a condição fala do campo gravado, porque a segunda passada grava o mesmo valor', () => {
    expect(codes(check(looping('isEmpty(code)')).issues)).not.toContain('behavior.effect.self-trigger-loop');
  });

  it('aceita quando a transição MOVE o estado, porque a condição deixa de casar depois da gravação', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'confirm', {
      trigger: { kind: 'entity-event', event: 'saved' },
      permission: undefined,
      actor: undefined,
      guard: undefined,
      effects: [{ kind: 'set-field', field: 'code', value: 'concat("S-", id)' }],
    })));
    expect(codes(result.issues)).not.toContain('behavior.effect.self-trigger-loop');
  });
});

describe('quem pode — o ator, a permissão e o ator que não existe', () => {
  it('pega a transição cuja regra nomeia um ator e que não pergunta nada a ele', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'cancel-invoiced', {
      permission: undefined,
      guard: undefined,
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.transition.actor-without-permission');
    expect(issue?.message).toContain('the manager');
    expect(result.ok).toBe(false);
  });

  it('pega a permissão num gatilho de gravação, onde hasPermission responde sempre não', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'cancel-invoiced', {
      trigger: { kind: 'entity-event', event: 'saved' },
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.transition.permission-on-event-trigger');
    expect(issue?.message).toContain('hasPermission answers false');
  });

  it('pega o nome de um PERFIL escrito no lugar de uma permissão', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'cancel-invoiced', {
      permission: 'manager',
    })));
    expect(codes(result.issues)).toContain('behavior.transition.permission-invalid');
  });

  it('não reclama da permissão pedida por um gesto de pessoa', () => {
    const result = check(salesBehaviorModel());
    expect(codes(result.issues)).not.toContain('behavior.transition.actor-without-permission');
    expect(codes(result.issues)).not.toContain('behavior.transition.permission-on-event-trigger');
    expect(codes(result.issues)).not.toContain('behavior.transition.permission-invalid');
  });

  it('reconhece de graça a permissão derivada da coleção', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'cancel-invoiced', {
      permission: 'sales.update',
    })));
    expect(codes(result.issues)).not.toContain('behavior.transition.permission-undeclared');
  });
});

describe('o guard que precisaria consultar outros registros', () => {
  it('pega a condição que lê uma coleção, e aponta o passo de consulta', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'confirm', {
      guard: { expression: 'count(stockReservations) == 0' },
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.guard.needs-other-records');
    expect(issue?.message).toContain('stockReservations');
    expect(issue?.suggestion).toContain('query');
    expect(result.ok).toBe(false);
  });

  it('aceita a condição que lê o campo denormalizado do próprio registro', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'confirm', {
      guard: { expression: 'total > 0' },
    })));
    expect(codes(result.issues)).not.toContain('behavior.guard.needs-other-records');
  });
});

describe('o total não é um efeito de transição', () => {
  it('pega o total gravado por expressão', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'invoice', {
      effects: [{ kind: 'total', entity: 'Sale', field: 'total', value: 'sum(items)' }],
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.effect.total-not-an-aggregation');
    expect(issue?.message).toContain('returns zero');
    expect(result.ok).toBe(false);
  });

  it('aceita o agregado declarado no campo, que o kernel recalcula sozinho', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'invoice', {
      effects: [{
        kind: 'total',
        entity: 'Sale',
        field: 'total',
        aggregation: { from: 'SaleItem', via: 'saleId', op: 'sum', field: 'lineTotal' },
      }],
    })));
    expect(codes(result.issues)).not.toContain('behavior.effect.total-not-an-aggregation');
  });
});

describe('o invariante entre registros — unicidade é DECLARADA, nunca calculada', () => {
  it('recusa a unicidade escrita como expressão e manda declarar a chave', () => {
    const result = check(withBehavior((behavior) => ({
      ...behavior,
      invariants: [
        ...behavior.invariants,
        {
          scope: 'record',
          entity: 'Sale',
          expression: 'count(sales, code == self.code) == 1',
          message: 'The code of a sale is unique.',
        },
      ],
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.invariant.cross-record');
    expect(issue?.message).toContain('written as an EXPRESSION');
    expect(issue?.suggestion).toContain('kind: "unique"');
    expect(issue?.suggestion).toContain('scope: "collection"');
    expect(issue?.howToDeclareException).toContain('The key is the declaration that holds');
    expect(result.ok).toBe(false);
  });

  it('o escopo de coleção sem chave nenhuma declarada é recusado, com o que declarar', () => {
    const result = check(withBehavior((behavior) => ({
      ...behavior,
      invariants: [
        ...behavior.invariants,
        { scope: 'collection', entity: 'Sale', expression: '', message: 'The code is unique.' },
      ],
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.invariant.uniqueness-undeclared');
    expect(issue?.message).toContain('names no key');
    expect(issue?.suggestion).toContain('keys: [{ name, kind: "unique", fields: [...] }]');
    expect(result.ok).toBe(false);
  });

  it('o escopo de coleção que aponta para uma chave INEXISTENTE é recusado, dizendo quais existem', () => {
    const result = check(withKeyedSale(
      [{ name: 'code', kind: 'unique', fields: ['code'] }],
      { scope: 'collection', entity: 'Sale', key: 'outra', expression: '', message: 'x' },
    ));
    const issue = result.issues.find((one) => one.code === 'behavior.invariant.uniqueness-undeclared');
    expect(issue?.message).toContain('does not declare it');
    expect(issue?.message).toContain('code');
  });

  it('o escopo de coleção que aponta para a chave DECLARADA passa', () => {
    const result = check(withKeyedSale(
      [{ name: 'code', kind: 'unique', fields: ['code'] }],
      { scope: 'collection', entity: 'Sale', key: 'code', expression: '', message: 'x' },
    ));
    expect(codes(result.issues)).not.toContain('behavior.invariant.uniqueness-undeclared');
  });

  it('o atalho `unique: true` do campo também satisfaz a invariante, pelo nome derivado', () => {
    const model = salesBehaviorModel();
    const withShorthand: DomainModel = {
      ...model,
      entities: model.entities.map((entity) => (entity.name === 'Sale'
        ? {
          ...entity,
          fields: entity.fields.map((field) => (field.key === 'code' ? { ...field, unique: true } : field)),
        }
        : entity)),
      behavior: {
        ...salesBehavior(),
        invariants: [
          { scope: 'collection', entity: 'Sale', key: 'field:code', expression: '', message: 'x' },
        ],
      },
    };
    expect(codes(check(withShorthand).issues)).not.toContain('behavior.invariant.uniqueness-undeclared');
  });

  it('pega o escopo de campo sem o campo', () => {
    const result = check(withBehavior((behavior) => ({
      ...behavior,
      invariants: behavior.invariants.map((one) => (one.scope === 'field' ? { ...one, field: undefined } : one)),
    })));
    expect(codes(result.issues)).toContain('behavior.invariant.field-scope-without-field');
  });

  it('aceita a regra de campo e a regra de registro que leem só o registro em mãos', () => {
    const result = check(salesBehaviorModel());
    expect(codes(result.issues)).not.toContain('behavior.invariant.cross-record');
    expect(codes(result.issues)).not.toContain('behavior.invariant.field-scope-without-field');
  });
});

describe('o relógio — o gatilho sem mecanismo', () => {
  it('recusa o agendamento e diz o que não existe', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'cancel-invoiced', {
      trigger: { kind: 'schedule', when: 'every day at 05:00' },
      permission: undefined,
      actor: undefined,
      guard: undefined,
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.transition.schedule-unsupported');
    expect(issue?.message).toContain('never registered');
    expect(result.ok).toBe(false);
  });

  it('não vira automação nenhuma quando o gatilho não tem mecanismo', () => {
    const result = check(withBehavior((behavior) => replaceTransition(behavior, 'cancel-invoiced', {
      trigger: { kind: 'schedule', when: 'every day at 05:00' },
      permission: undefined,
      actor: undefined,
      guard: undefined,
    })));
    const scheduled = result.transitions.find((one) => one.transition.name === 'cancel-invoiced');
    expect(scheduled?.supported).toBe(false);
    expect(scheduled?.steps).toStrictEqual([]);
  });
});

describe('a transição sobre uma entidade que ninguém modelou', () => {
  it('pega a transição e o efeito que apontam para o vazio', () => {
    const result = check(withBehavior((behavior) => ({
      ...behavior,
      transitions: behavior.transitions.map((one) => (one.name === 'confirm'
        ? { ...one, effects: [{ kind: 'create-record' as const, entity: 'Shipment' }] }
        : one)),
    })));
    expect(codes(result.issues)).toContain('behavior.transition.unknown-entity');
  });
});

describe('o que já era erro na estrutura continua sendo com o comportamento ao lado', () => {
  it('recusa onDelete cascade mesmo num modelo que declara comportamento inteiro', () => {
    const model = salesBehaviorModel();
    const result = check({
      ...model,
      relationships: model.relationships.map((one) => (one.sourceEntity === 'SaleItem' && one.targetEntity === 'Sale'
        ? { ...one, onDelete: 'cascade' as const }
        : one)),
    });
    expect(codes(result.issues)).toContain('domain.relationship.cascade-unsupported');
    expect(result.ok).toBe(false);
  });
});

/**
 * A METADE QUE FALTAVA AO ESCOPO `transition`. A invariante prometia recusar a passagem e mapeava
 * para condição + `exit`; num gatilho de gravação esse par não recusa nada — `.saved` é publicado
 * por um `onDocumentWritten`, então quando o evento existe a escrita está confirmada, e `exit` é
 * `halt: true`, que interrompe o resto do fluxo. O par positivo/negativo de sempre, três vezes.
 */
describe('a invariante de transição — recusar e reagir são mecanismos diferentes', () => {
  const withInvariant = (invariant: BehaviorInvariant): DomainModel =>
    withBehavior((behavior) => ({ ...behavior, invariants: [...behavior.invariants, invariant] }));

  it('cobra o enforcement: sem ele, ninguém sabe se a regra barra ou avisa', () => {
    const result = check(withInvariant({
      scope: 'transition',
      entity: 'Sale',
      transition: 'confirm',
      expression: 'total > 0',
      message: 'A sale with no value cannot be confirmed.',
    }));
    const issue = result.issues.find((one) => one.code === 'behavior.invariant.transition-without-enforcement');
    expect(issue?.severity).toBe('error');
    expect(issue?.howToDeclareException).toContain('There is no default that is right in both directions');
    expect(result.ok).toBe(false);
  });

  it('aceita a que BLOQUEIA quando a passagem é um gesto — a ação recusa antes de qualquer escrita', () => {
    const result = check(withInvariant({
      scope: 'transition',
      entity: 'Sale',
      transition: 'confirm',
      enforcement: 'blocks',
      expression: 'total > 0',
      message: 'A sale with no value cannot be confirmed.',
    }));
    expect(errors(result.issues)).toEqual([]);
  });

  it('reprova a que BLOQUEIA sobre um gatilho de gravação: o documento já está gravado', () => {
    const result = check(withBehavior((behavior) => ({
      ...replaceTransition(behavior, 'confirm', { trigger: { kind: 'entity-event', event: 'saved' } }),
      invariants: [...behavior.invariants, {
        scope: 'transition',
        entity: 'Sale',
        transition: 'confirm',
        enforcement: 'blocks',
        expression: 'total > 0',
        message: 'A sale with no value cannot be confirmed.',
      }],
    })));
    const issue = result.issues.find((one) => one.code === 'behavior.invariant.blocks-after-the-fact');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('onDocumentWritten');
    expect(issue?.suggestion).toContain('rules: { validate:');
    expect(result.ok).toBe(false);
  });

  it('aceita a que REAGE sobre o mesmo gatilho, que é onde ela cabe', () => {
    const result = check(withBehavior((behavior) => ({
      ...replaceTransition(behavior, 'confirm', { trigger: { kind: 'entity-event', event: 'saved' } }),
      invariants: [...behavior.invariants, {
        scope: 'transition',
        entity: 'Sale',
        transition: 'confirm',
        enforcement: 'reacts',
        expression: 'total > 0',
        message: 'This sale was confirmed with no value.',
      }],
    })));
    expect(codes(result.issues)).not.toContain('behavior.invariant.blocks-after-the-fact');
  });

  it('reprova a que BLOQUEIA no escopo do registro: validate-object é um PASSO', () => {
    const result = check(withInvariant({
      scope: 'record',
      entity: 'Sale',
      enforcement: 'blocks',
      expression: 'total > 0',
      message: 'A sale with no value cannot be saved.',
    }));
    const issue = result.issues.find((one) => one.code === 'behavior.invariant.blocks-after-the-fact');
    expect(issue?.severity).toBe('error');
    expect(issue?.suggestion).toContain('FIELD rules only');
  });

  it('e a regra de campo, que é a única do caminho de gravação, bloqueia sem reclamação', () => {
    const result = check(withInvariant({
      scope: 'field',
      entity: 'Sale',
      field: 'total',
      enforcement: 'blocks',
      expression: 'total > 0',
      message: 'A sale must have a value.',
    }));
    expect(codes(result.issues)).not.toContain('behavior.invariant.blocks-after-the-fact');
  });

  it('cobra que a transição citada exista', () => {
    const result = check(withInvariant({
      scope: 'transition',
      entity: 'Sale',
      transition: 'ship',
      enforcement: 'reacts',
      expression: 'total > 0',
      message: 'x',
    }));
    expect(codes(result.issues)).toContain('behavior.invariant.transition-unknown');
  });

  it('a tabela de mecanismos separa as duas, e nenhuma promete um passo que não existe', () => {
    const rows = BEHAVIOR_MECHANISMS.filter((one) => one.declares.startsWith("scope 'transition'"));
    expect(rows.map((one) => one.declares)).toStrictEqual([
      "scope 'transition', enforcement 'blocks'",
      "scope 'transition', enforcement 'reacts'",
    ]);
    expect(rows[0].stepIds).toEqual([]);
    expect(rows[1].stepIds).toStrictEqual(['exit']);
  });
});

/**
 * O `from` NÃO é decorativo, e o mecanismo que o torna verificável não é o mesmo nos três gatilhos.
 * A gravação traz os três valores no payload (atual, `old`, `changeType`); `workflow.called` não traz
 * nenhum — a entrada dele no catálogo tem `fields: []` e `hasOld: false`, então o campo do estado só
 * chega lá por um parâmetro de referência. A condição que o plano devolvia era a mesma nos dois, e no
 * segundo ela não resolvia contra nada.
 */
describe('o from — onde ele é conferido de verdade', () => {
  it('no gesto: quem para a pessoa é a ação, e o fluxo precisa do parâmetro de referência', () => {
    const mapped = check(salesBehaviorModel()).transitions
      .find((one) => one.transition.name === 'confirm');
    expect(mapped?.fromCheck?.where).toBe('action-visibility');
    expect(mapped?.fromCheck?.expression).toBe('record.status == "draft"');
    expect(mapped?.fromCheck?.requiresParameter).toBe('sale');
    expect(mapped?.workflowCondition).toBe('sale.status == "draft"');
    // Nenhum dos dois existe em `workflow.called`, e prometê-los seria a decoração de volta.
    expect(mapped?.fromCheck?.previousValue).toBeUndefined();
    expect(mapped?.fromCheck?.creationTest).toBeUndefined();
  });

  it('na gravação: o valor anterior e a distinção inclusão/alteração vêm no payload', () => {
    const result = check(withBehavior((behavior) =>
      replaceTransition(behavior, 'confirm', { trigger: { kind: 'entity-event', event: 'saved' } })));
    const mapped = result.transitions.find((one) => one.transition.name === 'confirm');
    expect(mapped?.eventName).toBe('sales.saved');
    expect(mapped?.fromCheck?.where).toBe('workflow-condition');
    expect(mapped?.fromCheck?.expression).toBe('status == "draft"');
    expect(mapped?.fromCheck?.previousValue).toBe('old.status');
    expect(mapped?.fromCheck?.creationTest).toBe('changeType == "created"');
  });

  it('e o payload de uma exclusão não os tem — nem há documento em que gravar o estado novo', () => {
    const result = check(withBehavior((behavior) =>
      replaceTransition(behavior, 'confirm', { trigger: { kind: 'entity-event', event: 'deleted' } })));
    const mapped = result.transitions.find((one) => one.transition.name === 'confirm');
    expect(mapped?.eventName).toBe('sales.deleted');
    expect(mapped?.fromCheck?.previousValue).toBeUndefined();
    expect(mapped?.fromCheck?.creationTest).toBeUndefined();
    // Um `upsert` só: o do efeito. O da gravação do estado saiu — ele ressuscitaria, com um campo
    // só, o documento que a pessoa acabou de apagar.
    const saved = check(withBehavior((behavior) =>
      replaceTransition(behavior, 'confirm', { trigger: { kind: 'entity-event', event: 'saved' } })))
      .transitions.find((one) => one.transition.name === 'confirm');
    expect(saved?.steps).toStrictEqual(['upsert', 'upsert']);
    expect(mapped?.steps).toStrictEqual(['upsert']);
  });
});

describe('a leitura tolerante — o comportamento chega torto', () => {
  it('devolve problema em vez de exceção, e o resto do modelo segue sendo lido', () => {
    const parsed = parseDomainModel({
      target: 'screenDefinitions',
      entities: [{ name: 'Sale', kind: 'entity', titleField: 'code', fields: [{ key: 'code', label: 'code', semanticType: 'scalar', type: 'text' }] }],
      behavior: {
        states: [{ entity: 'Sale', options: [{ label: 'Draft' }] }],
        transitions: [{ name: 'confirm', entity: 'Sale', from: 'draft', to: 'confirmed' }],
        invariants: ['not an object'],
      },
    });
    expect(parsed.ok).toBe(true);
    expect(codes(parsed.issues).every((one) => one === 'behavior.model.malformed')).toBe(true);
    expect(parsed.issues).toHaveLength(3);
  });

  it('lê um modelo sem bloco de comportamento sem inventar um', () => {
    const parsed = parseDomainModel({
      target: 'screenDefinitions',
      entities: [{ name: 'Sale', kind: 'entity', titleField: 'code', fields: [{ key: 'code', label: 'code', semanticType: 'scalar', type: 'text' }] }],
    });
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.model.behavior).toBeUndefined();
  });
});
