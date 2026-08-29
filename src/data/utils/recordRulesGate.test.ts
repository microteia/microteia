import { describe, expect, it } from 'vitest';
import { toSchemaScreens } from './recordRulesGate';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';

const fields: FieldDefinition[] = [];

/**
 * `toSchemaScreens` e `useSchemaContext` traduzem a `ScreenDefinition` para a forma que a camada de
 * schema consome. Uma propriedade esquecida aqui não quebra compilação — some em silêncio, e o
 * sintoma aparece longe: a tela resolve sem coleção de etiquetas e a gravação vai para um caminho
 * vazio. Este teste é a rede.
 */
describe('toSchemaScreens', () => {
  it('leva a coleção de etiquetas declarada na tela', () => {
    const [screen] = toSchemaScreens([
      { id: 'produtos', titleSingular: 'Produto', titleFieldKey: 'nome', fields, tagCollection: 'produtos_tags' },
    ]);
    expect(screen.tagCollection).toBe('produtos_tags');
  });

  it('tela sem etiquetas não inventa coleção', () => {
    const [screen] = toSchemaScreens([
      { id: 'produtos', titleSingular: 'Produto', titleFieldKey: 'nome', fields },
    ]);
    expect(screen.tagCollection).toBeUndefined();
  });

  it('a tela que descreve outra coleção viaja com ela — é lá que a declaração vale', () => {
    const screens = toSchemaScreens([
      { id: 'processos', titleSingular: 'Processo', titleFieldKey: 'title', fields, dataCollection: 'cases' },
      { id: 'produtos', titleSingular: 'Produto', titleFieldKey: 'nome', fields },
    ]);
    expect(screens.map((screen) => screen.collection)).toEqual(['cases', undefined]);
  });

  it('preserva o resto da tela', () => {
    const [screen] = toSchemaScreens([
      { id: 'produtos', titleSingular: 'Produto', titlePlural: 'Produtos', titleFieldKey: 'nome', fields },
    ]);
    expect(screen).toMatchObject({
      id: 'produtos',
      titleSingular: 'Produto',
      titlePlural: 'Produtos',
      titleFieldKey: 'nome',
    });
  });
});

/**
 * As chaves atravessando a tradução — o defeito que este arquivo inteiro existe para pegar.
 *
 * A `ScreenDefinition` é traduzida para a forma que o schema consome, e enquanto essa tradução
 * existia em DUAS cópias (aqui e no `useSchemaContext`), uma propriedade nova entrava numa e não na
 * outra: a gravação enxergava a chave e a tela não, sem nada quebrar. Hoje há uma tradução só, e
 * estes testes são o que impede a segunda de voltar.
 */
describe('toSchemaScreens — as chaves da coleção', () => {
  it('leva as chaves declaradas na tela', () => {
    const [screen] = toSchemaScreens([
      {
        id: 'produtos',
        titleSingular: 'Produto',
        titleFieldKey: 'nome',
        fields,
        keys: [{ name: 'sku', kind: 'unique', fields: ['sku'] }],
      },
    ]);
    expect(screen.keys).toEqual([{ name: 'sku', kind: 'unique', fields: ['sku'] }]);
  });

  it('tela sem chave não inventa nenhuma — duplicata continua sendo o padrão', () => {
    const [screen] = toSchemaScreens([
      { id: 'produtos', titleSingular: 'Produto', titleFieldKey: 'nome', fields },
    ]);
    expect(screen.keys ?? null).toBeNull();
  });

  it('a chave viaja com a COLEÇÃO que a tela descreve, que é onde ela vale', () => {
    const [screen] = toSchemaScreens([
      {
        id: 'processos',
        titleSingular: 'Processo',
        titleFieldKey: 'title',
        fields,
        dataCollection: 'cases',
        keys: [{ name: 'numero', kind: 'primary', fields: ['numero'] }],
      },
    ]);
    expect(screen.collection).toBe('cases');
    expect(screen.keys?.[0]?.name).toBe('numero');
  });
});
