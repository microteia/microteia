// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import { TemplateSourceEditor } from './TemplateSourceEditor.view';
import { CARD_DESIGNER_VOCABULARY } from '../../../shared/templateDesigner/cardDesignerVocabulary';

vi.mock('../../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined, params?: Record<string, string>) =>
    `${value ?? ''}${params?.error ? ` ${params.error}` : ''}`,
}));

// O Monaco não roda no jsdom; o que importa aqui é que o JSON edite o MESMO texto.
vi.mock('../CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea data-testid="json" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

const DEFAULT = JSON.stringify({ body: [{ type: 'title' }] }, null, 2);

const Harness = ({ initial, readOnly = false, onSource }: { initial: string; readOnly?: boolean; onSource?: (source: string) => void }) => {
  const [source, setSource] = useState(initial);
  return (
    <ThemeProvider theme={baseDarkTheme}>
      <TemplateSourceEditor
        vocabulary={CARD_DESIGNER_VOCABULARY}
        source={source}
        onSourceChange={(next) => { setSource(next); onSource?.(next); }}
        defaultSource={DEFAULT}
        resetLabel="reset"
        jsonHint="hint"
        issues={[]}
        fields={[]}
        readOnly={readOnly}
      />
    </ThemeProvider>
  );
};

describe('TemplateSourceEditor', () => {
  it('abre no visual, e o JSON mostra o mesmo texto que o visual editou', () => {
    render(<Harness initial={JSON.stringify({ body: [{ type: 'tags' }] })} />);
    expect(screen.getByTestId('designer-canvas')).toBeTruthy();
    fireEvent.click(screen.getByTestId('designer-palette-node:divider'));
    fireEvent.click(screen.getByRole('tab', { name: 'template-designer.mode.json' }));
    expect(JSON.parse((screen.getByTestId('json') as HTMLTextAreaElement).value)).toEqual({ body: [{ type: 'tags' }, { type: 'divider' }] });
  });

  it('JSON inválido trava o visual, com o atalho para o JSON', () => {
    render(<Harness initial="{ oops" />);
    expect(screen.queryByTestId('designer-canvas')).toBeNull();
    expect(screen.getByText(/@core.records\/template-designer.visual-locked/)).toBeTruthy();
    fireEvent.click(screen.getByText('template-designer.open-json'));
    expect((screen.getByTestId('json') as HTMLTextAreaElement).value).toBe('{ oops');
  });

  it('"começar do padrão" pode ser desfeito', () => {
    const initial = JSON.stringify({ body: [{ type: 'tags' }] });
    render(<Harness initial={initial} />);
    fireEvent.click(screen.getByText('reset'));
    expect(screen.getByTestId('designer-node-0').textContent).toContain('title');
    fireEvent.click(screen.getByTitle('template-designer.undo'));
    expect(screen.getByTestId('designer-node-0').textContent).toContain('tags');
  });

  it('só-leitura: sem desfazer nem "começar do padrão", e o JSON não grava', () => {
    const onSource = vi.fn();
    render(<Harness initial={DEFAULT} readOnly onSource={onSource} />);
    expect(screen.queryByText('reset')).toBeNull();
    expect(screen.queryByTitle('template-designer.undo')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'template-designer.mode.json' }));
    fireEvent.change(screen.getByTestId('json'), { target: { value: '{}' } });
    expect(onSource).not.toHaveBeenCalled();
  });
});
