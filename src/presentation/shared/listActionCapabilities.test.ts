import { describe, expect, it } from 'vitest';
import { resolveListActions, supportedListActions } from './listActionCapabilities';

/**
 * Nenhuma entidade do kernel tem mais tela de registro — Prazo foi a última a sair. O que este
 * módulo governa, então, é o SILÊNCIO: uma coleção que ele não descreve não pode ganhar ações do
 * card por engano, nem mesmo por configuração gravada. Quem declara as ações de uma tela de
 * extensão é a própria tela (`listActions`), que não passa por aqui.
 */
describe('supportedListActions', () => {
  it('coleção que o kernel não descreve não oferece nada', () => {
    expect(supportedListActions('deadlines')).toEqual([]);
    expect(supportedListActions('persons')).toEqual([]);
    expect(supportedListActions('vendas')).toEqual([]);
  });
});

describe('resolveListActions', () => {
  it('sem tela fixa que a suporte, nenhuma ação sobrevive à filtragem', () => {
    expect(resolveListActions('deadlines', [])).toEqual([]);
    expect(resolveListActions('deadlines', ['manageTags', 'clone', 'copyLink'])).toEqual([]);
    expect(resolveListActions('contracts', undefined)).toEqual([]);
  });
});
