// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { FieldDefinition } from '../../../domain/entities';
import type { RuleIssue } from '../../../domain/schema/fieldRules';

const state: { issues: RuleIssue[] } = { issues: [] };

const CATALOG: Record<string, string> = {
  'core.automation/parameter.required': 'Obrigatório',
  'core.records/field.invalid-value': 'Valor inválido',
  'core.records/field.invalid-format': 'O campo "{label}" está em um formato inválido',
};

const resolve = (key: string, params?: Record<string, unknown>) =>
  (CATALOG[key] ?? key).replace(/\{(\w+)\}/g, (match, token: string) => String(params?.[token] ?? match));

vi.mock('../i18n/useT', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) =>
    resolve(key.includes('/') ? key : `core.records/${key}`, params),
  useLabel: () => (value: string | null | undefined, params?: Record<string, unknown>) =>
    ((value ?? '').startsWith('@') ? resolve((value ?? '').slice(1), params) : (value ?? '')),
}));
vi.mock('../../../data/utils/recordRulesGate', () => ({
  validateRecordRules: () => state.issues,
}));

const { useRecordFormValidation } = await import('./useRecordFormValidation');

const field = (overrides: Partial<FieldDefinition>): FieldDefinition => ({
  key: 'protocol',
  label: 'Protocolo',
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...overrides,
});

const validar = (fields: FieldDefinition[], values: Record<string, unknown>) =>
  renderHook(() => useRecordFormValidation('claims', fields)).result.current(values as never);

/**
 * O erro de um campo é a última coisa que o usuário lê antes de desistir de salvar. Ele nasce no
 * domínio como referência de mensagem, e este é o ponto em que ele encontra o catálogo — nas duas
 * telas de registro, que antes mantinham a rotina copiada e divergiam sem sintoma.
 */
describe('useRecordFormValidation', () => {
  it('o campo obrigatório vazio recebe a frase traduzida, não a chave', () => {
    state.issues = [];
    const result = validar([field({ required: true })], { protocol: '' });

    expect(result?.fieldErrors.protocol).toBe('Obrigatório');
  });

  it('o erro de regra chega resolvido, com os parâmetros que a frase interpola', () => {
    state.issues = [{
      path: 'document',
      label: 'Documento',
      error: '@core.records/field.invalid-format',
      errorParams: { label: 'Documento' },
    }];
    const result = validar([field({ key: 'document', label: 'Documento' })], { document: 'x' });

    expect(result?.fieldErrors.document).toBe('O campo "Documento" está em um formato inválido');
  });

  it('o resumo do aviso também é resolvido — era o formato de LOG que ia para a tela', () => {
    state.issues = [{ path: 'noticedAt', label: 'Data do aviso', error: '@core.records/field.invalid-value' }];
    const result = validar([field({ key: 'noticedAt', label: 'Data do aviso' })], { noticedAt: 'x' });

    expect(result?.message).toBe('Data do aviso: Valor inválido');
  });

  it('a mensagem que o escritório escreveu na própria regra passa intacta', () => {
    state.issues = [{ path: 'plate', label: 'Placa', error: 'Informe a placa no padrão Mercosul' }];
    const result = validar([field({ key: 'plate', label: 'Placa' })], { plate: 'x' });

    expect(result?.fieldErrors.plate).toBe('Informe a placa no padrão Mercosul');
  });

  it('sem campo vazio e sem regra recusada, não há o que dizer', () => {
    state.issues = [];
    expect(validar([field({})], { protocol: 'SIN-1' })).toBeNull();
  });
});
