import { describe, expect, it } from 'vitest';
import { addListOrderKey, fromListOrderForm, toListOrderForm } from './screenListOrderForm';
import { LIST_ORDER_MAX_KEYS } from '../../../../../domain/schema/ui/listOrder';

describe('a seção "Ordem dos registros" e a declaração gravada', () => {
  it('sem declaração não há linha, e sem linha grava null — o cadastro mais recente primeiro', () => {
    expect(toListOrderForm(undefined)).toEqual([]);
    expect(fromListOrderForm([])).toBeNull();
  });

  it('ida e volta: o que foi gravado é o que a seção mostra e o que ela grava de novo', () => {
    const stored = [{ path: 'vencimento', dir: 'asc' }, { path: 'parcela', dir: 'desc' }];
    expect(fromListOrderForm(toListOrderForm(stored))).toEqual(stored);
  });

  it('mostra a chave que a tela não responde mais, para que alguém possa tirá-la', () => {
    expect(toListOrderForm([{ path: 'apagado', dir: 'asc' }])).toEqual([{ path: 'apagado', dir: 'asc' }]);
  });

  it('a linha ainda sem campo não é gravada', () => {
    expect(fromListOrderForm([{ path: ' ', dir: 'asc' }, { path: 'parcela', dir: 'desc' }]))
      .toEqual([{ path: 'parcela', dir: 'desc' }]);
  });

  it('a linha nova vem com o primeiro campo ainda livre, e não passa do teto', () => {
    const paths = ['vencimento', 'parcela', 'createdAt', 'updatedAt'];
    const one = addListOrderKey([], paths);
    expect(one).toEqual([{ path: 'vencimento', dir: 'asc' }]);
    expect(addListOrderKey(one, paths)[1].path).toBe('parcela');
    let keys = one;
    for (let index = 0; index < LIST_ORDER_MAX_KEYS + 2; index += 1) keys = addListOrderKey(keys, paths);
    expect(keys).toHaveLength(LIST_ORDER_MAX_KEYS);
  });
});
