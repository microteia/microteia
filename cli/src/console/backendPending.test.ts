import { describe, expect, it } from 'vitest';
import { pendingCauseOf } from './backendPending.js';
import type { PendingInputs } from './backendPending.js';

const claim = { pluginId: 'com.exemplo.push', backend: { functions: ['gmailPush', 'renewGmailWatches'] } };

const inputs = (over: Partial<PendingInputs> = {}): PendingInputs => ({
  deployable: new Set(['gmailPush', 'renewGmailWatches']),
  refusedClaims: new Map(),
  ungated: new Set(),
  satisfied: new Set(['gmailPush', 'renewGmailWatches']),
  ...over,
});

describe('pendingCauseOf', () => {
  it('nada falta: sem motivo', () => {
    expect(pendingCauseOf(claim, inputs())).toBeNull();
  });

  it('extensão sem function não tem motivo de function', () => {
    expect(pendingCauseOf({ pluginId: 'x', backend: { parameters: ['A'] } }, inputs())).toBeNull();
  });

  // O caso do microteia-dev: a fonte da extensão de e-mail estava só na outra instalação.
  it('fonte ausente é o primeiro motivo, e cita só o que falta', () => {
    const cause = pendingCauseOf(claim, inputs({
      deployable: new Set(['gmailPush']),
      satisfied: new Set(),
    }));
    expect(cause).toEqual({ reason: 'function-source-missing', functions: ['renewGmailWatches'] });
  });

  it('reivindicação recusada conta só a desta extensão', () => {
    expect(pendingCauseOf(claim, inputs({
      refusedClaims: new Map([['gmailPush', 'com.outra']]),
    }))).toBeNull();

    expect(pendingCauseOf(claim, inputs({
      refusedClaims: new Map([['gmailPush', 'com.exemplo.push']]),
      satisfied: new Set(),
    }))).toEqual({ reason: 'function-claim-refused', functions: ['gmailPush'] });
  });

  it('portão faltando vem antes da falha de deploy', () => {
    expect(pendingCauseOf(claim, inputs({
      ungated: new Set(['renewGmailWatches']),
      satisfied: new Set(['gmailPush']),
    }))).toEqual({ reason: 'gate-missing', functions: ['renewGmailWatches'] });
  });

  // A fonte empacotada ainda não aprovada não "falta": dizer que falta mandaria procurar uma pasta que o
  // autor nunca precisou criar.
  it('fonte empacotada retida vem antes de tudo, com todas as functions', () => {
    expect(pendingCauseOf(claim, inputs({
      held: new Map([['com.exemplo.push', 'awaiting-approval']]),
      deployable: new Set(),
      satisfied: new Set(),
    }))).toEqual({ reason: 'awaiting-approval', functions: ['gmailPush', 'renewGmailWatches'] });
  });

  it('o que conferiu e não ficou no ar falhou no deploy', () => {
    expect(pendingCauseOf(claim, inputs({ satisfied: new Set(['gmailPush']) })))
      .toEqual({ reason: 'deploy-failed', functions: ['renewGmailWatches'] });
  });
});
