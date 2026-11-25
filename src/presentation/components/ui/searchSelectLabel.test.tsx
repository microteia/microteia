// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../shared/styles/theme';
import { SearchSelect } from './SearchSelect';
import { MultiSearchSelect } from './MultiSearchSelect';

vi.mock('../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
}));

const options = [{ value: 'a', label: 'Alpha' }];

const themed = (node: React.ReactNode) => render(<ThemeProvider theme={baseDarkTheme}>{node}</ThemeProvider>);

describe('o título e o placeholder dos seletores (#31)', () => {
  it('o `label` aparece como título do campo e dá nome ao controle', () => {
    themed(<SearchSelect label="Table" options={options} value="" onChange={() => {}} />);
    expect(screen.getByText('Table')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' })).toBeTruthy();
  });

  it('sem `label`, nenhum título é desenhado', () => {
    const { container } = themed(<SearchSelect options={options} value="" onChange={() => {}} placeholder="pick" />);
    expect(container.textContent).toBe('pick');
  });

  it('sem placeholder, os dois mostram o texto do catálogo — e não uma frase em português', () => {
    themed(
      <>
        <SearchSelect options={options} value="" onChange={() => {}} />
        <MultiSearchSelect options={options} values={[]} onChange={() => {}} />
      </>,
    );
    expect(screen.getAllByText('select.placeholder')).toHaveLength(2);
  });
});
