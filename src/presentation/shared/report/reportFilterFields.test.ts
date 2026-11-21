import { describe, it, expect } from 'vitest';
import {
  fieldAtPath,
  filterFieldOf,
  filterLiteralOf,
  filterTextOf,
  filterValueOf,
  promptFieldOf,
} from './reportFilterFields';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';

const field = (patch: Partial<FieldDefinition>): FieldDefinition => ({
  key: 'campo',
  label: 'Campo',
  type: 'text',
  required: false,
  order: 1,
  origin: 'design',
  ...patch,
});

/**
 * O CAMPO como valor de filtro.
 *
 * O controle é o mesmo do formulário do registro — é o que faz a data ser pedida no controle de data
 * e a referência no registro apontado —, mas a pergunta é outra: filtrar não é criar dado.
 */
describe('filterFieldOf', () => {
  it('cadastro apontado e lista de opções filtram por VÁRIOS, guardem eles um ou muitos', () => {
    // Preso em `false`, o controle deixava escolher uma pessoa só no polo ativo de um processo,
    // num campo que o escritório declarou como de várias. E filtrar por um só, num campo que
    // guarda um, é outra pergunta da que a listagem faz: ali a escolha é sempre múltipla.
    expect(filterFieldOf(field({ type: 'reference', refEntity: 'pessoas', multi: true })).multi).toBe(true);
    expect(filterFieldOf(field({ type: 'reference', refEntity: 'pessoas' })).multi).toBe(true);
    expect(filterFieldOf(field({ type: 'select' })).multi).toBe(true);
  });

  it('o que não se filtra por pertinência continua pedindo um valor', () => {
    expect(filterFieldOf(field({ type: 'date' })).multi).toBeUndefined();
    expect(filterFieldOf(field({ type: 'checkbox' })).multi).toBeUndefined();
    expect(filterFieldOf(field({ type: 'text' })).multi).toBeUndefined();
  });

  it('não cobra preenchimento: um filtro em branco simplesmente não restringe', () => {
    expect(filterFieldOf(field({ required: true })).required).toBe(false);
  });

  it('não cadastra opção nova na lista do escritório a partir de um filtro', () => {
    const filtro = filterFieldOf(field({ type: 'select', optionsAllowUserAdd: true }));

    expect(filtro.optionsAllowUserAdd).toBe(false);
  });

  it('não semeia valor nem sorteia código — o valor é a pergunta, não um registro novo', () => {
    const filtro = filterFieldOf(field({ defaultValue: 'ativo', autoValue: { pattern: 'AA-0000' } }));

    expect(filtro.defaultValue).toBeUndefined();
    expect(filtro.autoValue).toBeNull();
  });

  it('texto longo vira uma linha: um editor de markdown não cabe numa barra de filtro', () => {
    expect(filterFieldOf(field({ type: 'markdown' })).type).toBe('text');
    expect(filterFieldOf(field({ type: 'textarea' })).type).toBe('text');
  });

  it('preserva o tipo que decide o controle', () => {
    expect(filterFieldOf(field({ type: 'date' })).type).toBe('date');
    expect(filterFieldOf(field({ type: 'reference', refEntity: 'clientes' })).refEntity).toBe('clientes');
  });
});

/**
 * A tela carrega TEXTO — é o que permite guardar a resposta antes de saber em que ela vai virar. As
 * travessias para o controle e para o spec são o que impede esse texto de vazar para os dois lados.
 */
describe('o valor entre o texto, o controle e o spec', () => {
  it('o booleano tem TRÊS estados no controle, e o terceiro é não filtrar', () => {
    expect(filterValueOf(field({ type: 'checkbox' }), 'true')).toBe(true);
    expect(filterValueOf(field({ type: 'checkbox' }), 'false')).toBe(false);
    // Sem isto, "não perguntei" e "respondi não" eram o mesmo estado — e o filtro em branco
    // passava a cobrar que o campo fosse falso.
    expect(filterValueOf(field({ type: 'checkbox' }), '')).toBeNull();
  });

  it('a moeda chega ao controle como número, e o vazio como ausência', () => {
    expect(filterValueOf(field({ type: 'currency' }), '1500.5')).toBe(1500.5);
    expect(filterValueOf(field({ type: 'currency' }), '')).toBeNull();
    expect(filterValueOf(field({ type: 'currency' }), 'abc')).toBeNull();
  });

  it('o campo de vários vai e volta como LISTA, pelo texto que a tela carrega', () => {
    const varios = filterFieldOf(field({ type: 'reference', refEntity: 'pessoas', multi: true }));

    expect(filterTextOf(['p1', 'p2'])).toBe('p1,p2');
    expect(filterValueOf(varios, 'p1,p2')).toEqual(['p1', 'p2']);
    // Nenhum escolhido é lista vazia, e não uma escolha em branco: quem decide que isso não vira
    // predicado é quem monta a consulta.
    expect(filterValueOf(varios, '')).toEqual([]);
  });

  it('sem campo conhecido o valor é o texto — é o que sobra, e não um palpite', () => {
    expect(filterValueOf(undefined, 'pending')).toBe('pending');
  });

  it('a ausência não vira a palavra "null"', () => {
    expect(filterTextOf(null)).toBe('');
    expect(filterTextOf(false)).toBe('false');
  });
});

/**
 * O que o SPEC grava vai no tipo do campo.
 *
 * Um `eq` raso é resolvido pelo Firestore com o valor tal como está gravado no spec: a string
 * `"true"` não encontra o booleano `true` do documento, e o filtro não falha — ele simplesmente não
 * acha nada, sem uma palavra na tela.
 */
describe('filterLiteralOf', () => {
  it('o booleano é gravado como booleano', () => {
    expect(filterLiteralOf(field({ type: 'checkbox' }), 'true')).toBe(true);
    expect(filterLiteralOf(field({ type: 'checkbox' }), 'false')).toBe(false);
  });

  it('o número é gravado como número', () => {
    expect(filterLiteralOf(field({ type: 'number' }), '10')).toBe(10);
    expect(filterLiteralOf(field({ type: 'currency' }), '1500.5')).toBe(1500.5);
  });

  it('o que não é número passa intacto — quem recusa é o validador, não a conversão', () => {
    expect(filterLiteralOf(field({ type: 'number' }), 'dez')).toBe('dez');
  });

  it('o campo de vários é gravado como LISTA — o texto "p1,p2" não é o id de ninguém', () => {
    const varios = filterFieldOf(field({ type: 'reference', refEntity: 'pessoas', multi: true }));

    expect(filterLiteralOf(varios, 'p1,p2')).toEqual(['p1', 'p2']);
    expect(filterLiteralOf(varios, 'p1')).toEqual(['p1']);
  });

  it('a data continua texto ISO: é o formato que o produto inteiro fala', () => {
    expect(filterLiteralOf(field({ type: 'date' }), '2026-09-04')).toBe('2026-09-04');
  });
});

/**
 * O campo que o CAMINHO lê — o salto pela referência é o que faz `cliente.cidade` saber que
 * `pending` se escreve "Pendente".
 */
describe('fieldAtPath', () => {
  const cidade = field({ key: 'cidade', label: 'Cidade' });
  const cliente = field({ key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'clientes', refDenormKey: 'cliente' });
  const ctx = {
    screens: new Map([
      ['vendas', { fields: [cliente, field({ key: 'situacao' })] }],
      ['clientes', { fields: [cidade] }],
    ]),
  } as never;

  it('acha o campo da própria coleção', () => {
    expect(fieldAtPath(ctx, 'vendas', 'situacao')?.key).toBe('situacao');
  });

  it('salta a referência pelo nome por que ela é navegada', () => {
    expect(fieldAtPath(ctx, 'vendas', 'cliente.cidade')?.key).toBe('cidade');
  });

  it('não inventa campo onde o caminho não leva a lugar nenhum', () => {
    expect(fieldAtPath(ctx, 'vendas', 'situacao.cidade')).toBeUndefined();
  });
});

/**
 * O filtro do leitor cujo caminho atravessa uma referência (#2).
 *
 * Itens de pedido → pedido → cliente: o relatório sobre os itens pergunta pelo cliente do pedido. A
 * tela procurava o campo na lista que a autoria oferece — um salto, sem a referência do outro lado — e
 * pedia o cliente num texto livre, onde nem o nome nem o id achavam nada.
 */
describe('promptFieldOf', () => {
  const cliente = field({ key: 'customer', label: 'Cliente', type: 'reference', refEntity: 'customers' });
  const pedido = field({ key: 'order', label: 'Pedido', type: 'reference', refEntity: 'orders' });
  const pedidos = field({ key: 'orders', label: 'Pedidos', type: 'reference', refEntity: 'orders', multi: true });
  const regiao = field({ key: 'region', label: 'Região', type: 'select', lookupCollection: 'regions' });
  const ctx = {
    screens: new Map([
      ['orderItems', { fields: [pedido, pedidos, field({ key: 'amount', type: 'currency' })] }],
      ['orders', { fields: [cliente, field({ key: 'placedOn', type: 'date' })] }],
      ['customers', { fields: [regiao, field({ key: 'vip', type: 'checkbox' })] }],
    ]),
  } as never;

  it('pergunta a referência do outro lado do salto com o seletor de registros dela, escolhendo vários', () => {
    const asked = promptFieldOf(ctx, 'orderItems', 'order.customer');

    expect(asked?.type).toBe('reference');
    expect(asked?.refEntity).toBe('customers');
    expect(asked?.multi).toBe(true);
  });

  it('caminha mais de um salto até a lista de opções, a data e a caixa de marcação', () => {
    expect(promptFieldOf(ctx, 'orderItems', 'order.customer.region')?.lookupCollection).toBe('regions');
    expect(promptFieldOf(ctx, 'orderItems', 'order.placedOn')?.type).toBe('date');
    expect(promptFieldOf(ctx, 'orderItems', 'order.customer.vip')?.type).toBe('checkbox');
  });

  it('atravessa a referência de VÁRIOS: o servidor responde por pertinência, e o texto voltaria ao defeito', () => {
    expect(promptFieldOf(ctx, 'orderItems', 'orders.customer')?.refEntity).toBe('customers');
  });

  it('manda a LISTA dos escolhidos — `in` com um texto solto não acha nada', () => {
    const asked = promptFieldOf(ctx, 'orderItems', 'order.customer');

    expect(filterLiteralOf(asked, 'c1')).toEqual(['c1']);
  });

  it('`id` do próprio registro pergunta com o seletor da coleção do relatório, escolhendo vários (#13)', () => {
    const asked = promptFieldOf(ctx, 'customers', 'id');

    expect(asked?.type).toBe('reference');
    expect(asked?.refEntity).toBe('customers');
    expect(asked?.multi).toBe(true);
    expect(filterLiteralOf(asked, 'c1,c2')).toEqual(['c1', 'c2']);
  });

  it('`id` depois de atravessar referências pergunta com o seletor da coleção apontada (#13)', () => {
    expect(promptFieldOf(ctx, 'orderItems', 'order.id')?.refEntity).toBe('orders');
    expect(promptFieldOf(ctx, 'orderItems', 'order.customer.id')?.refEntity).toBe('customers');
  });

  it('um campo declarado com a chave `id` continua vencendo', () => {
    const comCampoId = {
      screens: new Map([['codes', { fields: [field({ key: 'id', type: 'text' })] }]]),
    } as never;
    expect(promptFieldOf(comCampoId, 'codes', 'id')?.type).toBe('text');
  });

  it('`id` de coleção sem tela, ou depois de um salto que não é referência, fica sem campo', () => {
    expect(promptFieldOf(ctx, 'semTela', 'id')).toBeUndefined();
    expect(promptFieldOf(ctx, 'orderItems', 'amount.id')).toBeUndefined();
  });

  it('caminho que o esquema não descreve fica sem campo, e a tela pede texto', () => {
    expect(promptFieldOf(ctx, 'orderItems', 'order.nada')).toBeUndefined();
    expect(promptFieldOf(ctx, 'orderItems', 'amount.customer')).toBeUndefined();
  });
});
