import { describe, expect, it } from 'vitest';
import { extensionPendencies, type ExtensionPendencyFacts } from './extensionPendencies';

const facts = (overrides: Partial<ExtensionPendencyFacts> = {}): ExtensionPendencyFacts => ({
  active: true,
  loadFailed: false,
  backendPending: false,
  migrationPending: false,
  codeAwaitingReview: false,
  updateAvailable: false,
  ...overrides,
});

describe('extensionPendencies', () => {
  it('ativa e sem nenhum fato pendente não deve nada', () => {
    expect(extensionPendencies(facts())).toEqual([]);
  });

  it('cada fato vira o seu motivo', () => {
    expect(extensionPendencies(facts({ loadFailed: true }))).toEqual(['load-failed']);
    expect(extensionPendencies(facts({ backendPending: true }))).toEqual(['backend']);
    expect(extensionPendencies(facts({ migrationPending: true }))).toEqual(['migration']);
    expect(extensionPendencies(facts({ codeAwaitingReview: true }))).toEqual(['code-review']);
    expect(extensionPendencies(facts({ updateAvailable: true }))).toEqual(['update']);
  });

  it('vários motivos saem na ordem de leitura: o que impede de funcionar antes do que só desatualiza', () => {
    expect(extensionPendencies(facts({
      updateAvailable: true,
      codeAwaitingReview: true,
      loadFailed: true,
      backendPending: true,
      migrationPending: true,
    }))).toEqual(['load-failed', 'backend', 'migration', 'code-review', 'update']);
  });

  it('desligada não deve nada, por mais que haja a fazer nela', () => {
    expect(extensionPendencies(facts({
      active: false,
      updateAvailable: true,
      loadFailed: true,
      backendPending: true,
    }))).toEqual([]);
  });
});
