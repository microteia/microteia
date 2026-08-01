import { describe, expect, it } from 'vitest';
import {
  isBoundScreen,
  isOwnedByParentScreen,
  screenDataCollection,
  screenLookupCollections,
  screenTagCollections,
  type ScreenCollectionDeclaration,
} from './screenDataCollection';

const screen = (partial: Partial<ScreenCollectionDeclaration> = {}): ScreenCollectionDeclaration => ({
  titleSingular: 'Processo',
  titlePlural: 'Processos',
  fields: [],
  ...partial,
});

describe('screenDataCollection', () => {
  it('a coleção é a chave da tela, salvo quando ela aponta para outra', () => {
    expect(screenDataCollection({ id: 'medico', dataCollection: null })).toBe('medico');
    expect(screenDataCollection({ id: 'processos', dataCollection: 'cases' })).toBe('cases');
    expect(isBoundScreen({ id: 'processos', dataCollection: 'cases' })).toBe(true);
    expect(isBoundScreen({ id: 'medico', dataCollection: null })).toBe(false);
  });

  it('espaço em branco não vale como vínculo', () => {
    expect(screenDataCollection({ id: 'medico', dataCollection: '  ' })).toBe('medico');
  });
});

/**
 * Posse e visão vinham juntas em `parentEntity` e agora se separam. A distinção decide QUATRO
 * coisas de uma vez — menu, ⌘K, campo de vínculo no formulário e volta ao pai ao salvar —, mais o
 * gesto destrutivo do card: no filho de verdade, excluir; no relacionado, desvincular.
 */
describe('isOwnedByParentScreen', () => {
  it('sem pai, a tela não pertence a ninguém', () => {
    expect(isOwnedByParentScreen({ parentEntity: null, parentRelation: null })).toBe(false);
  });

  it('declarar o pai sem dizer mais nada continua sendo posse', () => {
    expect(isOwnedByParentScreen({ parentEntity: 'contracts', parentRelation: null })).toBe(true);
    expect(isOwnedByParentScreen({ parentEntity: 'contracts', parentRelation: 'owned' })).toBe(true);
  });

  it('`related` é visão: a tela continua de topo', () => {
    expect(isOwnedByParentScreen({ parentEntity: 'contracts', parentRelation: 'related' })).toBe(false);
  });
});

/**
 * O bug que originou estas funções: com Processo fora do kernel, as etiquetas e as listas de opções
 * dele só seriam assinadas se existisse um documento de declaração. As etiquetas já vinculadas
 * sumiram da tela — continuavam gravadas, mas ninguém as lia. A declaração da TELA basta.
 */
describe('coleções que as telas declaram', () => {
  it('a coleção de etiquetas apontada pela tela entra, com rótulo legível', () => {
    expect(screenTagCollections([screen({ tagCollection: 'caseTags' })])).toEqual([
      { collection: 'caseTags', label: 'Etiquetas: Processos' },
    ]);
  });

  it('tela sem etiquetas não inventa coleção', () => {
    expect(screenTagCollections([screen(), screen({ tagCollection: '  ' })])).toEqual([]);
  });

  it('duas telas que compartilham as mesmas etiquetas assinam uma vez só', () => {
    const derived = screenTagCollections([
      screen({ tagCollection: 'caseTags' }),
      screen({ titleSingular: 'Processo (visão)', titlePlural: 'Visões', tagCollection: 'caseTags' }),
    ]);
    expect(derived).toHaveLength(1);
  });

  it('toda lista referenciada por um campo é assinada', () => {
    const derived = screenLookupCollections([
      screen({
        fields: [
          { label: 'Área', lookupCollection: 'caseAreas' },
          { label: 'Fase', lookupCollection: 'casePhases' },
          { label: 'Título' },
        ],
      }),
    ]);
    expect(derived).toEqual([
      { collection: 'caseAreas', label: 'Processo: Área' },
      { collection: 'casePhases', label: 'Processo: Fase' },
    ]);
  });
});
