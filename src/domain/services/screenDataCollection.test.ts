import { describe, expect, it } from 'vitest';
import {
  hiddenParentFieldKey,
  isBoundScreen,
  isOwnedByParentScreen,
  parentLinkRelation,
  screenDataCollection,
  screenReadPermission,
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
  /** O rótulo é a CHAVE da composição; o nome da tela vai ao lado, para a frase interpolar. */
  it('a coleção de etiquetas apontada pela tela entra, com rótulo legível', () => {
    expect(screenTagCollections([screen({ tagCollection: 'caseTags' })])).toEqual([
      {
        collection: 'caseTags',
        label: '@core.records/tag-list.of',
        labelParams: { name: 'Processos' },
      },
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

/**
 * O menu prometia uma tela cuja lista o servidor devolvia vazia. A permissão perguntada tem de ser a
 * MESMA que `buildPermissionCatalog` derivou da tela — e para a tela vinculada isso é a coleção de
 * destino, nunca a chave da aba.
 */
describe('screenReadPermission', () => {
  it('ver a tela é ler a coleção dela', () => {
    expect(screenReadPermission({ id: 'medico', dataCollection: null })).toBe('medico.read');
  });

  it('na tela vinculada, a permissão é da coleção de destino', () => {
    expect(screenReadPermission({ id: 'processos', dataCollection: 'cases' })).toBe('cases.read');
  });

  it('espaço em branco não desloca a permissão', () => {
    expect(screenReadPermission({ id: 'medico', dataCollection: '  ' })).toBe('medico.read');
  });
});

describe('parentLinkRelation', () => {
  const semPosse = { parentEntity: null, parentRelation: null, parentFieldKey: null };
  const possuida = { parentEntity: 'cases', parentRelation: 'owned' as const, parentFieldKey: 'caseId' };

  it('vínculo obrigatório é posse, mesmo sem a tela declarar o pai', () => {
    expect(parentLinkRelation(semPosse, 'caseId', { required: true })).toBe('owned');
  });

  it('vínculo opcional sem posse declarada é relação: é o que se pode desfazer', () => {
    expect(parentLinkRelation(semPosse, 'caseId', { required: false })).toBe('related');
    expect(parentLinkRelation(semPosse, 'caseId', undefined)).toBe('related');
  });

  it('a posse declarada vale pelo campo dela, obrigatório ou não', () => {
    expect(parentLinkRelation(possuida, 'caseId', { required: false })).toBe('owned');
    expect(parentLinkRelation(possuida, 'contractId', { required: false })).toBe('related');
  });

  it('`parentRelation: related` com campo obrigatório continua sem desvincular', () => {
    expect(parentLinkRelation({ ...possuida, parentRelation: 'related' }, 'caseId', { required: true })).toBe('owned');
  });
});

describe('hiddenParentFieldKey', () => {
  const possuida = { parentEntity: 'cases', parentRelation: 'owned' as const, parentFieldKey: 'caseId' };

  it('aberto pela tela própria do filho, o campo do pai aparece', () => {
    expect(hiddenParentFieldKey(possuida, null)).toBeNull();
  });

  it('aberto de dentro do pai, o campo de posse some — ele já nasce preenchido', () => {
    expect(hiddenParentFieldKey(possuida, { fieldKey: null })).toBe('caseId');
    expect(hiddenParentFieldKey(possuida, { fieldKey: 'caseId' })).toBe('caseId');
  });

  it('preso ao pai por outro campo, o de posse fica: é ele que ainda precisa ser escolhido', () => {
    expect(hiddenParentFieldKey(possuida, { fieldKey: 'contractId' })).toBeNull();
  });

  it('tela relacionada nunca esconde o vínculo', () => {
    expect(hiddenParentFieldKey({ ...possuida, parentRelation: 'related' }, { fieldKey: null })).toBeNull();
  });
});
