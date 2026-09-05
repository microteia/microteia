import { describe, it, expect } from 'vitest';
import {
  fieldAtPath,
  filterFieldOf,
  filterLiteralOf,
  filterTextOf,
  filterValueOf,
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
  it('um filtro compara com UM valor, mesmo num campo de vários', () => {
    expect(filterFieldOf(field({ type: 'select', multi: true })).multi).toBe(false);
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
