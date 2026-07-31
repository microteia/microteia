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
      { id: 'processo-clone', titleSingular: 'Processo', titleFieldKey: 'title', fields, dataCollection: 'cases' },
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
