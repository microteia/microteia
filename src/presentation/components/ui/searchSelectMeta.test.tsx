// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../shared/styles/theme';
import { SearchSelect } from './SearchSelect';
import { MultiSearchSelect } from './MultiSearchSelect';

vi.mock('../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
}));

const options = [
  { value: 'u1', label: 'Ana Souza', meta: 'ana@escritorio.com' },
  { value: 'u2', label: 'Ana Souza', meta: 'ana.souza@outro.com' },
  { value: 'u3', label: 'Bruno Lima' },
];

const openAndSearch = (query?: string) => {
  fireEvent.click(screen.getByRole('button'));
  if (query !== undefined) {
    fireEvent.change(screen.getByPlaceholderText('action.search'), { target: { value: query } });
  }
};

const renderSingle = () => render(
  <ThemeProvider theme={baseDarkTheme}>
    <SearchSelect options={options} value="" onChange={() => {}} placeholder="pick" />
  </ThemeProvider>,
);

const renderMulti = (values: string[] = []) => render(
  <ThemeProvider theme={baseDarkTheme}>
    <MultiSearchSelect options={options} values={values} onChange={() => {}} placeholder="pick" />
  </ThemeProvider>,
);

describe('segunda linha das opções no MultiSearchSelect', () => {
  it('desenha o meta sob o rótulo, na lista de opções', () => {
    renderMulti();
    openAndSearch();
    expect(screen.getByText('ana@escritorio.com')).toBeTruthy();
    expect(screen.getByText('ana.souza@outro.com')).toBeTruthy();
  });

  it('não desenha o meta na pílula já escolhida', () => {
    renderMulti(['u1']);
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.queryByText('ana@escritorio.com')).toBeNull();
  });
});

describe('busca pelo meta, nos dois seletores', () => {
  it('SearchSelect acha o membro por parte do e-mail', () => {
    renderSingle();
    openAndSearch('outro.com');
    expect(screen.getByText('ana.souza@outro.com')).toBeTruthy();
    expect(screen.queryByText('ana@escritorio.com')).toBeNull();
    expect(screen.queryByText('Bruno Lima')).toBeNull();
  });

  it('MultiSearchSelect acha o membro por parte do e-mail', () => {
    renderMulti();
    openAndSearch('outro.com');
    expect(screen.getByText('ana.souza@outro.com')).toBeTruthy();
    expect(screen.queryByText('ana@escritorio.com')).toBeNull();
    expect(screen.queryByText('Bruno Lima')).toBeNull();
  });
});
