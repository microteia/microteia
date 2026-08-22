// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDynamicSelectViewModel, type DynamicSelectProps } from './DynamicSelect.viewmodel';

/**
 * A cor sorteada na criação deixa de ser definitiva. O que este teste guarda é o CONTRATO da troca:
 * ela existe só quando alguém a oferece, é uma paleta por vez, e o que sai daqui é a chave da opção
 * com a cor escolhida — nunca o rótulo, que é o texto do escritório.
 */

const PALETTE = [
  { label: '@core.ui/color.blue', value: '#2563EB' },
  { label: '@core.ui/color.green', value: '#16A34A' },
];

vi.mock('styled-components', () => ({ useTheme: () => ({ tagColors: PALETTE }) }));

const AZUL = { value: 'Urgente', label: 'Urgente', color: '#2563EB' };

const mouseEvent = () => ({ stopPropagation: vi.fn(), preventDefault: vi.fn() }) as unknown as React.MouseEvent;

const render = (props: Partial<DynamicSelectProps> = {}) =>
  renderHook(() => useDynamicSelectViewModel({ dynamicOptions: [AZUL], ...props }));

describe('DynamicSelect — troca de cor da opção cadastrada', () => {
  it('não oferece a troca quando ninguém a implementa', () => {
    expect(render().result.current.hasOnRecolor).toBe(false);
  });

  it('oferece a paleta do tema a quem a implementa', () => {
    const { result } = render({ onRecolor: vi.fn() });
    expect(result.current.hasOnRecolor).toBe(true);
    expect(result.current.palette).toEqual(PALETTE);
  });

  it('abre uma paleta por vez, e o segundo clique na mesma opção a fecha', () => {
    const { result } = render({ onRecolor: vi.fn() });
    const item = result.current.filtered[0];

    act(() => result.current.handleRecolorClick(mouseEvent(), item));
    expect(result.current.recoloring).toBe('Urgente');

    act(() => result.current.handleRecolorClick(mouseEvent(), item));
    expect(result.current.recoloring).toBeNull();
  });

  it('entrega a CHAVE da opção com a cor escolhida e fecha a paleta', async () => {
    const onRecolor = vi.fn(async () => {});
    const { result } = render({ onRecolor });

    act(() => result.current.handleRecolorClick(mouseEvent(), result.current.filtered[0]));
    await act(async () => { await result.current.handlePickColor('Urgente', '#16A34A'); });

    expect(onRecolor).toHaveBeenCalledWith('Urgente', '#16A34A');
    expect(result.current.recoloring).toBeNull();
  });

  it('a exclusão fecha a paleta aberta — as duas ocupam o mesmo lugar da lista', () => {
    const { result } = render({ onRecolor: vi.fn(), onDelete: vi.fn() });
    const item = result.current.filtered[0];

    act(() => result.current.handleRecolorClick(mouseEvent(), item));
    act(() => result.current.handleDeleteClick(mouseEvent(), item));

    expect(result.current.recoloring).toBeNull();
    expect(result.current.pendingDelete).toEqual(item);
  });
});
