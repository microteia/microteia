// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import { TemplateDesigner } from './TemplateDesigner.view';
import { CARD_DESIGNER_VOCABULARY } from '../../../shared/templateDesigner/cardDesignerVocabulary';
import { PORTAL_DETAIL_DESIGNER_VOCABULARY } from '../../../shared/templateDesigner/portalDesignerVocabulary';
import type { TemplateVocabulary } from '../../../shared/templateDesigner/templateVocabulary';
import type { TemplateDesignerIssue } from './TemplateDesigner.viewmodel';

vi.mock('../../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined, params?: Record<string, string>) =>
    `${value ?? ''}${params?.where ? ` @${params.where}` : ''}`,
}));

const fields = [
  { key: 'status', label: 'Status', type: 'select' },
  { key: 'due', label: 'Due date', type: 'date' },
];

const draw = (
  design: Record<string, unknown>,
  issues: TemplateDesignerIssue[] = [],
  options: { vocabulary?: TemplateVocabulary; readOnly?: boolean } = {},
) => {
  const onChange = vi.fn();
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <TemplateDesigner
        vocabulary={options.vocabulary ?? CARD_DESIGNER_VOCABULARY}
        design={design}
        onChange={onChange}
        issues={issues}
        fields={fields}
        readOnly={options.readOnly}
      />
    </ThemeProvider>,
  );
  return onChange;
};

const lastDesign = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls[onChange.mock.calls.length - 1][0] as { body: unknown[] };

describe('TemplateDesigner', () => {
  it('desenha a árvore do JSON no canvas, contêiner com os filhos dentro', () => {
    draw({ body: [{ type: 'row', children: [{ type: 'avatar' }, { type: 'field', field: 'status' }] }] });
    const row = screen.getByTestId('designer-node-0');
    expect(within(row).getByTestId('designer-node-0.0')).toBeTruthy();
    expect(within(row).getByTestId('designer-node-0.1').textContent).toContain('Status');
  });

  it('o clique na paleta acrescenta o campo da tela no fim do cartão', () => {
    const onChange = draw({ body: [{ type: 'title' }] });
    fireEvent.click(screen.getByTestId('designer-palette-field:due'));
    expect(lastDesign(onChange).body).toEqual([{ type: 'title' }, { type: 'field', field: 'due' }]);
  });

  it('com um contêiner escolhido, o clique na paleta acrescenta dentro dele', () => {
    const onChange = draw({ body: [{ type: 'stack', children: [{ type: 'title' }] }] });
    fireEvent.click(screen.getByTestId('designer-node-0'));
    fireEvent.click(screen.getByTestId('designer-palette-node:subtitle'));
    expect(lastDesign(onChange).body).toEqual([{ type: 'stack', children: [{ type: 'title' }, { type: 'subtitle' }] }]);
  });

  it('escolher o valor padrão de uma lista apaga a chave do JSON', () => {
    const onChange = draw({ body: [{ type: 'title', size: 'lg' }] });
    fireEvent.click(screen.getByTestId('designer-node-0'));
    const inspector = screen.getByTestId('designer-inspector');
    fireEvent.click(within(inspector).getByText('@core.records/template-designer.option.size.md'));
    expect(lastDesign(onChange).body).toEqual([{ type: 'title' }]);
    fireEvent.click(within(inspector).getByText('@core.records/template-designer.option.size.xl'));
    expect(lastDesign(onChange).body).toEqual([{ type: 'title', size: 'xl' }]);
  });

  it('o problema do portão aparece no nó e na propriedade que o causa', () => {
    draw(
      { body: [{ type: 'field', field: 'ghost' }] },
      [{ message: 'field-unknown', messageParams: { where: 'cardTemplate.body[0].field', field: 'ghost' } }],
    );
    expect(screen.getByTestId('designer-node-0').textContent).toContain('ghost');
    fireEvent.click(screen.getByTestId('designer-node-0'));
    expect(within(screen.getByTestId('designer-inspector')).getByText('field-unknown @@core.records/template-designer.property.field')).toBeTruthy();
  });

  it('nó desconhecido continua no canvas, em vez de sumir', () => {
    draw({ body: [{ type: 'hologram' }, { type: 'title' }] });
    expect(screen.getByTestId('designer-node-0')).toBeTruthy();
    expect(screen.getByTestId('designer-node-1')).toBeTruthy();
  });

  it('as ferramentas do nó movem, duplicam e removem', () => {
    const onChange = draw({ body: [{ type: 'title' }, { type: 'subtitle' }] });
    fireEvent.click(screen.getByTestId('designer-node-1'));
    fireEvent.click(screen.getByTitle('template-designer.tool.before'));
    expect(lastDesign(onChange).body).toEqual([{ type: 'subtitle' }, { type: 'title' }]);
  });

  it('arrastar da paleta e soltar entre dois nós insere ali', () => {
    const onChange = draw({ body: [{ type: 'title' }, { type: 'tags' }] });
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByTestId('designer-palette-node:divider'), { dataTransfer });
    const slot = screen.getByTestId('designer-slot-|1');
    fireEvent.dragOver(slot, { dataTransfer });
    fireEvent.drop(slot, { dataTransfer });
    expect(lastDesign(onChange).body).toEqual([{ type: 'title' }, { type: 'divider' }, { type: 'tags' }]);
  });

  it('arrastar um nó para dentro de um contêiner o move', () => {
    const onChange = draw({ body: [{ type: 'title' }, { type: 'row', children: [{ type: 'avatar' }] }] });
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByTestId('designer-node-0'), { dataTransfer });
    const slot = screen.getByTestId('designer-slot-1|1');
    fireEvent.dragOver(slot, { dataTransfer });
    fireEvent.drop(slot, { dataTransfer });
    expect(lastDesign(onChange).body).toEqual([{ type: 'row', children: [{ type: 'avatar' }, { type: 'title' }] }]);
  });

  it('não oferece soltar um contêiner dentro dele mesmo', () => {
    const onChange = draw({ body: [{ type: 'row', children: [{ type: 'avatar' }] }] });
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(screen.getByTestId('designer-node-0'), { dataTransfer });
    const slot = screen.getByTestId('designer-slot-0|0');
    fireEvent.dragOver(slot, { dataTransfer });
    fireEvent.drop(slot, { dataTransfer });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Delete com o foco no canvas remove o nó escolhido', () => {
    const onChange = draw({ body: [{ type: 'title' }, { type: 'tags' }] });
    fireEvent.click(screen.getByTestId('designer-node-0'));
    fireEvent.keyDown(screen.getByTestId('designer-canvas'), { key: 'Delete' });
    expect(lastDesign(onChange).body).toEqual([{ type: 'tags' }]);
  });

  it('só-leitura: sem paleta e sem ferramentas, propriedades desabilitadas, nada é emitido', () => {
    const onChange = draw({ body: [{ type: 'title' }, { type: 'tags' }] }, [], { readOnly: true });
    expect(screen.queryByTestId('designer-palette')).toBeNull();
    fireEvent.click(screen.getByTestId('designer-node-0'));
    const inspector = screen.getByTestId('designer-inspector');
    expect(screen.queryByTitle('template-designer.tool.remove')).toBeNull();
    const segment = within(inspector).getByText('@core.records/template-designer.option.size.xl');
    expect((segment as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByTestId('designer-canvas'), { key: 'Delete' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('designer-node-0').getAttribute('draggable')).toBe('false');
  });

  it('com o vocabulário do registro aberto do portal, oferece alterar, ações e seção — e o rótulo da raiz é o dele', () => {
    draw({ body: [{ type: 'fields' }] }, [], { vocabulary: PORTAL_DETAIL_DESIGNER_VOCABULARY });
    expect(screen.getByTestId('designer-palette-node:edit')).toBeTruthy();
    expect(screen.getByTestId('designer-palette-node:actions')).toBeTruthy();
    expect(screen.getByTestId('designer-palette-node:section')).toBeTruthy();
    expect(screen.queryByTestId('designer-palette-node:avatar')).toBeNull();
    expect(within(screen.getByTestId('designer-inspector')).getByText('@core.records/portal-template.designer.root.detail')).toBeTruthy();
    fireEvent.click(screen.getByTestId('designer-node-0'));
    expect(within(screen.getByTestId('designer-inspector')).getByText('@core.records/portal-template.designer.fields-exclude')).toBeTruthy();
    expect(within(screen.getByTestId('designer-inspector')).getByText('@core.records/portal-template.designer.hidden-when.hint')).toBeTruthy();
  });
});
