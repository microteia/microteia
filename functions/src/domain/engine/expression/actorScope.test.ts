import { describe, expect, it } from 'vitest';
import { expressionEngine } from './ExpressionEngine';
import { resolveMapping } from '../InputMapping';
import type { WorkflowActor, WorkflowContext } from '../../entities/WorkflowContext';

const silent = { info: () => undefined, warn: () => undefined, error: () => undefined };

const contextWith = (actor?: WorkflowActor, variables: Record<string, unknown> = {}): WorkflowContext => ({
  event: { id: 'e1', tenantId: 't1', name: 'workflow.called', payload: { recordId: 'r1' }, timestamp: new Date() },
  outputs: {},
  variables,
  services: { logger: silent, now: () => new Date() },
  logger: silent,
  execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
  ...(actor ? { actor } : {}),
});

const ana: WorkflowActor = { userId: 'u-ana', name: 'Ana Souza', photoURL: 'p', via: 'ui', permissions: ['x.read'] };

describe('`actor` no escopo das expressões do fluxo', () => {
  it('um mapping Expression devolve o nome de quem clicou, e `via` diz por onde', () => {
    const context = contextWith(ana);
    expect(resolveMapping({ kind: 'Expression', expression: 'actor.name' }, context)).toBe('Ana Souza');
    expect(expressionEngine.evaluate('actor.via == "ui"', context)).toBe(true);
    expect(expressionEngine.evaluate('actor.id', context)).toBe('u-ana');
  });

  it('pelo agente, o id é o dono do token e `via` é agent', () => {
    const context = contextWith({ ...ana, via: 'agent' });
    expect(expressionEngine.evaluate('actor.via == "agent"', context)).toBe(true);
    expect(expressionEngine.evaluate('actor.id', context)).toBe('u-ana');
  });

  it('não expõe as permissões nem a foto: `actor` é identidade, e o acesso se pergunta por hasPermission', () => {
    expect(expressionEngine.evaluate('actor', contextWith(ana))).toEqual({ id: 'u-ana', name: 'Ana Souza', via: 'ui' });
  });

  it('sem pessoa, `actor` é null, isEmpty(actor) é verdadeiro, e `actor.id` lê null em vez de estourar', () => {
    const context = contextWith();
    expect(expressionEngine.evaluate('actor', context)).toBeNull();
    expect(expressionEngine.evaluate('isEmpty(actor)', context)).toBe(true);
    expect(expressionEngine.evaluate('actor.id', context)).toBeNull();
    expect(expressionEngine.evaluate('isEmpty(actor.name)', context)).toBe(true);
    expect(expressionEngine.evaluate('actor.via == "agent"', context)).toBe(false);
    expect(expressionEngine.evaluate('isEmpty(actor) ? "motor" : actor.name', context)).toBe('motor');
  });

  it('uma variável do fluxo chamada `actor` não passa a dizer quem disparou', () => {
    const forged = { id: 'outro', name: 'Forjado', via: 'ui' };
    expect(expressionEngine.evaluate('actor.name', contextWith(ana, { actor: forged }))).toBe('Ana Souza');
    expect(expressionEngine.evaluate('actor', contextWith(undefined, { actor: forged }))).toBeNull();
  });
});
