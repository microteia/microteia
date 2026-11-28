// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * Issue #45: o título do registro novo era sempre "Novo" + o substantivo, e em pt-BR a tela "Empresa"
 * mostrava "Novo Empresa". A tela passa a poder declarar a frase inteira.
 */
const catalog: Record<string, string> = {
  'record.new.title': 'Novo {entity}',
  '@acme.crm/company.singular': 'Empresa',
  '@acme.crm/company.new': 'Nova empresa',
};
const translate = (key: string, params?: Record<string, unknown>) =>
  (catalog[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''));
const resolveLabel = (value: string | null | undefined) => (value ? catalog[value] ?? value : '');
vi.mock('../i18n/useT', () => ({ useT: () => translate, useLabel: () => resolveLabel }));

const { useNewRecordTitle } = await import('./useNewRecordTitle');

const titleOf = (screen: { titleSingular: string; titleNew?: string | null }) =>
  renderHook(() => useNewRecordTitle()).result.current(screen);

describe('o título do registro novo (#45)', () => {
  it('a frase que a tela declara é resolvida no idioma de quem lê', () => {
    expect(titleOf({ titleSingular: '@acme.crm/company.singular', titleNew: '@acme.crm/company.new' }))
      .toBe('Nova empresa');
  });

  it('o texto que o escritório digitou passa intacto', () => {
    expect(titleOf({ titleSingular: 'Consulta', titleNew: 'Nova consulta' })).toBe('Nova consulta');
  });

  it('sem a declaração, a frase é montada como antes', () => {
    expect(titleOf({ titleSingular: '@acme.crm/company.singular' })).toBe('Novo Empresa');
    expect(titleOf({ titleSingular: 'Funcionário', titleNew: null })).toBe('Novo Funcionário');
  });
});
