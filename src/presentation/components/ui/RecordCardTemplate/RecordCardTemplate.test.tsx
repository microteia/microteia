// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import { RecordCardTemplate } from './RecordCardTemplate.view';
import type { CardTemplateResolvers } from '../../../shared/entityScreen/resolveCardTemplate';
import type { CardNode } from '../../../../domain/schema/ui/cardTemplate';
import type { EntityRecord } from '../../../../domain/entities';

const record = { id: 'r1', nome: 'Ana', situacao: 'nova', valor: 10, tagIds: ['t1'] } as unknown as EntityRecord;

const runAction = vi.fn();

const resolvers: CardTemplateResolvers = {
  title: () => 'Ana Souza',
  subtitle: () => 'Cliente desde 2020',
  subtitleIconKey: null,
  imageUrl: () => null,
  fieldItem: (_record, fieldKey, options) => ({
    key: fieldKey,
    value: fieldKey === 'situacao' ? 'Nova' : 'R$ 10,00',
    badges: options?.badges ? [{ label: 'Nova', color: '#00aa00' }] : undefined,
    type: 'text',
  }),
  fieldLabel: () => 'Valor',
  fields: () => [],
  metaRows: () => [],
  tags: () => [{ id: 't1', name: 'Urgente', color: '#ff0000' }],
  actions: () => [{ key: 'delete', title: 'Excluir', refs: ['delete'], iconKey: 'delete', onClick: runAction }],
  isHidden: () => false,
  label: (text) => (text === '@acme/vip' ? 'Cliente VIP' : text),
};

const draw = (body: CardNode[], onOpen = vi.fn()) => {
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <RecordCardTemplate body={body} record={record} resolvers={resolvers} screenIcon="person" onOpen={onOpen} />
    </ThemeProvider>,
  );
  return onOpen;
};

describe('RecordCardTemplate', () => {
  it('desenha os placeholders com o que a listagem responde', () => {
    draw([
      { type: 'row', children: [{ type: 'avatar' }, { type: 'stack', children: [{ type: 'title' }, { type: 'subtitle' }] }] },
      { type: 'field', field: 'valor', label: true, variant: 'strong' },
      { type: 'field', field: 'situacao', variant: 'badge' },
      { type: 'text', text: '@acme/vip', tone: 'primary' },
      { type: 'tags' },
    ]);
    expect(screen.getByText('Ana Souza')).toBeDefined();
    expect(screen.getByText('Cliente desde 2020')).toBeDefined();
    expect(screen.getByText('Valor:')).toBeDefined();
    expect(screen.getByText('R$ 10,00')).toBeDefined();
    expect(screen.getByText('Nova')).toBeDefined();
    expect(screen.getByText('Cliente VIP')).toBeDefined();
    expect(screen.getByText('Urgente')).toBeDefined();
  });

  it('clicar no cartão abre o registro', () => {
    const onOpen = draw([{ type: 'title' }]);
    fireEvent.click(screen.getByText('Ana Souza'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('clicar numa ação executa a ação e NÃO abre o registro — nas duas posições', () => {
    for (const placement of ['inline', 'hover'] as const) {
      runAction.mockClear();
      const onOpen = draw([{ type: 'title' }, { type: 'actions', placement }]);
      const buttons = screen.getAllByTitle('Excluir');
      fireEvent.click(buttons[buttons.length - 1]);
      expect(runAction).toHaveBeenCalledTimes(1);
      expect(onOpen).not.toHaveBeenCalled();
    }
  });

  it('clicar numa etiqueta não abre o registro', () => {
    const onOpen = draw([{ type: 'tags' }]);
    fireEvent.click(screen.getByText('Urgente'));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
