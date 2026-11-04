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
  { value: 'p1', label: 'Maria Isabel' },
  { value: 'p2', label: 'Bruno Lima' },
];

const type = (query: string) => {
  fireEvent.click(screen.getByRole('button'));
  fireEvent.change(screen.getByPlaceholderText('action.search'), { target: { value: query } });
};

describe('a busca no servidor por trás dos seletores', () => {
  it('SearchSelect avisa o texto digitado e zera ao abrir', () => {
    const onQueryChange = vi.fn();
    render(
      <ThemeProvider theme={baseDarkTheme}>
        <SearchSelect options={options} value="" onChange={() => {}} onQueryChange={onQueryChange} />
      </ThemeProvider>,
    );
    type('1234');
    expect(onQueryChange.mock.calls.map(([query]) => query)).toEqual(['', '1234']);
  });

  it('o que o servidor achou aparece mesmo sem o rótulo conter o texto', () => {
    render(
      <ThemeProvider theme={baseDarkTheme}>
        <SearchSelect options={options} value="" onChange={() => {}} searchMatches={new Set(['p2'])} />
      </ThemeProvider>,
    );
    type('123.456');
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.queryByText('Maria Isabel')).toBeNull();
  });

  it('MultiSearchSelect faz o mesmo', () => {
    const onQueryChange = vi.fn();
    render(
      <ThemeProvider theme={baseDarkTheme}>
        <MultiSearchSelect options={options} values={[]} onChange={() => {}} onQueryChange={onQueryChange} searchMatches={new Set(['p1'])} />
      </ThemeProvider>,
    );
    type('0841');
    expect(onQueryChange).toHaveBeenLastCalledWith('0841');
    expect(screen.getByText('Maria Isabel')).toBeTruthy();
    expect(screen.queryByText('Bruno Lima')).toBeNull();
  });
});
