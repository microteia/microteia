import { describe, expect, it } from 'vitest';
import {
  buildChildNewTabKey,
  buildCloneTabKey,
  buildEntityViewTabKey,
  buildListTabKey,
  buildNewTabKey,
  buildViewTabKey,
  parseDynamicTabKey,
} from './dynamicScreenKeys';

describe('parseDynamicTabKey', () => {
  it('reconhece lista, novo, clone e visualização', () => {
    expect(parseDynamicTabKey(buildListTabKey('vendas'))).toEqual({ kind: 'list', screenKey: 'vendas' });
    expect(parseDynamicTabKey(buildNewTabKey('vendas'))).toEqual({ kind: 'new', screenKey: 'vendas' });
    expect(parseDynamicTabKey(buildCloneTabKey('vendas', 'r1')))
      .toEqual({ kind: 'new', screenKey: 'vendas', cloneSourceId: 'r1' });
    expect(parseDynamicTabKey(buildViewTabKey('vendas', 'r1')))
      .toEqual({ kind: 'view', screenKey: 'vendas', recordId: 'r1' });
  });

  it('carrega o campo de vínculo quando ele não é o parentFieldKey da tela', () => {
    expect(parseDynamicTabKey(buildChildNewTabKey('prazos', 'processos', 'p1', 'processo'))).toEqual({
      kind: 'new',
      screenKey: 'prazos',
      parentEntity: 'processos',
      parentId: 'p1',
      parentFieldKey: 'processo',
    });
  });

  it('devolve o contexto do pai ao criar um registro filho', () => {
    expect(parseDynamicTabKey(buildChildNewTabKey('itens', 'vendas', 'v1'))).toEqual({
      kind: 'new',
      screenKey: 'itens',
      parentEntity: 'vendas',
      parentId: 'v1',
    });
  });

  it('aceita pai de tela fixa', () => {
    expect(parseDynamicTabKey(buildChildNewTabKey('audiencias', 'cases', 'c1'))).toMatchObject({
      screenKey: 'audiencias',
      parentEntity: 'cases',
      parentId: 'c1',
    });
  });

  it('não confunde clone com contexto de pai', () => {
    const clone = parseDynamicTabKey(buildCloneTabKey('itens', 'x1'));
    expect(clone?.parentEntity).toBeUndefined();
    const child = parseDynamicTabKey(buildChildNewTabKey('itens', 'vendas', 'v1'));
    expect(child?.cloneSourceId).toBeUndefined();
  });

  it('ignora chaves de outras telas', () => {
    expect(parseDynamicTabKey('view-case:abc')).toBeNull();
    expect(parseDynamicTabKey('dashboard')).toBeNull();
  });
});

describe('buildEntityViewTabKey — volta para o pai', () => {
  it('sem prefixo fixo, toda coleção cai na aba dinâmica da tela que a descreve', () => {
    // Pessoa, Contrato, Financeiro e Prazo saíram do kernel, e com eles a última aba fixa de
    // detalhe: hoje nenhuma coleção tem prefixo próprio em código.
    expect(buildEntityViewTabKey('persons', 'p1')).toBe('view-dyn:persons:p1');
    expect(buildEntityViewTabKey('contracts', 'c1')).toBe('view-dyn:contracts:c1');
    expect(buildEntityViewTabKey('financials', 'f1')).toBe('view-dyn:financials:f1');
    expect(buildEntityViewTabKey('deadlines', 'd1')).toBe('view-dyn:deadlines:d1');
  });

  it('cai na chave dinâmica para telas customizadas', () => {
    expect(buildEntityViewTabKey('vendas', 'v1')).toBe(buildViewTabKey('vendas', 'v1'));
  });
});
