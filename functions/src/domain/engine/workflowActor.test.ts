import { describe, expect, it } from 'vitest';
import { actorFromPublished, toPublishedActor } from './workflowActor';

describe('o ator que atravessa o barramento de eventos', () => {
  it('vai só a identidade, e volta com as permissões VAZIAS — o acesso não se grava no evento', () => {
    const published = toPublishedActor({ userId: 'u1', name: 'Ana', photoURL: 'p', via: 'agent', permissions: ['*'] });
    expect(published).toEqual({ userId: 'u1', name: 'Ana', photoURL: 'p', via: 'agent' });
    expect(actorFromPublished(published)).toEqual({ userId: 'u1', name: 'Ana', photoURL: 'p', via: 'agent', permissions: [] });
  });

  it('forma inesperada é AUSÊNCIA de ator, nunca um ator parcial', () => {
    expect(actorFromPublished(undefined)).toBeUndefined();
    expect(actorFromPublished({ userId: '', via: 'ui' })).toBeUndefined();
    expect(actorFromPublished({ userId: 'u1' })).toBeUndefined();
    expect(actorFromPublished({ userId: 'u1', via: 'automation' })).toBeUndefined();
  });
});
