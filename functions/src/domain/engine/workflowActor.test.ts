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

  it('o convidado do portal atravessa como ator — sem permissão nenhuma, e com a identidade que provou', () => {
    const verified = { provider: 'gov', claim: { name: 'cpf', value: '123' }, level: 'high' };
    const published = toPublishedActor({ userId: 'g1', name: 'Bia', photoURL: '', via: 'portal', permissions: [], verified });
    expect(published).toEqual({ userId: 'g1', name: 'Bia', photoURL: '', via: 'portal', verified });
    expect(actorFromPublished(published)).toEqual({ userId: 'g1', name: 'Bia', photoURL: '', via: 'portal', permissions: [], verified });
  });

  it('identidade verificada só vale para o convidado: num ator de dentro ela é descartada', () => {
    const verified = { provider: 'gov', claim: null, level: null };
    expect(toPublishedActor({ userId: 'u1', name: 'Ana', photoURL: '', via: 'ui', permissions: [], verified })).not.toHaveProperty('verified');
    expect(actorFromPublished({ userId: 'u1', via: 'ui', verified })).not.toHaveProperty('verified');
    expect(actorFromPublished({ userId: 'g1', via: 'portal', verified: { provider: '' } })).not.toHaveProperty('verified');
  });
});
