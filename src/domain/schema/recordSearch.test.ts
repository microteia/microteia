import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  matchesSearchTerms,
  pickServerSearchTerm,
  recordSearchTerms,
  SEARCH_MAX_TERM_LENGTH,
  SEARCH_MAX_TERMS,
  searchFieldsOf,
  searchQueryTerms,
  searchReferencesOf,
  searchReferrersOf,
  searchTermsOf,
} from './recordSearch';
import type { SearchTextSources } from './recordSearch';

const field = (key: string, type: FieldDefinition['type'], extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key,
  label: key,
  type,
  required: false,
  order: 0,
  origin: 'design',
  ...extra,
});

/** O que a pessoa digitaria acha o registro gravado com estes textos? */
const finds = (texts: string[], typed: string): boolean => {
  const query = searchQueryTerms(typed);
  return query.length > 0 && matchesSearchTerms(searchTermsOf(texts), query);
};

describe('searchTermsOf — o que o registro grava', () => {
  it('acha pelo começo da palavra, sem acento e sem caixa', () => {
    expect(finds(['Curatela – Maria Isabel Santos'], 'curat')).toBe(true);
    expect(finds(['Família'], 'FAMILIA')).toBe(true);
    expect(finds(['Família'], 'famí')).toBe(true);
  });

  it('não acha pelo MEIO da palavra — é prefixo, não substring', () => {
    expect(finds(['Curatela'], 'tela')).toBe(false);
  });

  it('acha o número de processo pelo começo, com ou sem pontuação', () => {
    const numero = ['8227479-19.2026.8.05.0001'];
    expect(finds(numero, '8227479')).toBe(true);
    expect(finds(numero, '8227479-19')).toBe(true);
    expect(finds(numero, '822747919')).toBe(true);
    expect(finds(numero, '82274791920268050001')).toBe(true);
  });

  it('acha o CPF gravado formatado pelos dígitos', () => {
    expect(finds(['123.456.789-00'], '12345678900')).toBe(true);
  });

  it('acha a palavra mais longa que o teto pelo que se digita dela', () => {
    const longa = 'anticonstitucionalissimamente';
    expect(longa.length).toBeGreaterThan(SEARCH_MAX_TERM_LENGTH);
    expect(finds([longa], longa)).toBe(true);
  });

  it('ignora letra solta, que casaria metade da coleção', () => {
    expect(searchTermsOf(['a b c'])).toEqual([]);
    expect(searchQueryTerms('a')).toEqual([]);
  });

  it('não repete termo e para no teto, guardando primeiro o que veio primeiro', () => {
    const terms = searchTermsOf(['Rex Rex', ...Array.from({ length: 200 }, (_, index) => `palavra${index}comprida`)]);
    expect(terms.length).toBe(SEARCH_MAX_TERMS);
    expect(terms.slice(0, 2)).toEqual(['re', 'rex']);
    expect(new Set(terms).size).toBe(terms.length);
  });
});

describe('a consulta', () => {
  it('vai ao servidor pelo termo mais longo, e confere o resto aqui', () => {
    const query = searchQueryTerms('maria curatela');
    expect(pickServerSearchTerm(query)).toBe('curatela');
    expect(matchesSearchTerms(searchTermsOf(['Curatela – Maria Isabel']), query)).toBe(true);
    expect(matchesSearchTerms(searchTermsOf(['Curatela – João']), query)).toBe(false);
  });

  it('sem termo, não há consulta', () => {
    expect(pickServerSearchTerm(searchQueryTerms('  ·  '))).toBeUndefined();
  });

  it('o registro sem termos gravados não casa', () => {
    expect(matchesSearchTerms(undefined, ['rex'])).toBe(false);
  });
});

describe('os campos que nomeiam um registro', () => {
  const titles: Record<string, string> = { 'persons/p1': 'Alexnaldo Carvalho', 'persons/p2': 'Maria Isabel' };
  const labels: Record<string, string> = { familia: 'Família' };
  const sources: SearchTextSources = {
    referenceTitle: (collection, id) => titles[`${collection}/${id}`],
    optionLabel: (_field, key) => labels[key],
  };
  const screen = {
    titleFieldKey: 'titulo',
    fields: [
      field('titulo', 'text'),
      field('numero', 'masked', { searchable: true }),
      field('polo', 'reference', { refEntity: 'persons', multi: true, searchable: true }),
      field('area', 'select', { lookupCollection: 'caseAreas', searchable: true }),
      field('obs', 'textarea'),
      field('distribuicao', 'date', { searchable: true }),
    ],
  };

  it('o título entra sem declarar, e só os pesquisáveis de tipo lido entram além dele', () => {
    expect(searchFieldsOf(screen).map((candidate) => candidate.key)).toEqual(['titulo', 'numero', 'polo', 'area']);
  });

  it('a referência entra pelo título do apontado, e a opção pelo rótulo', () => {
    const terms = recordSearchTerms(screen, {
      titulo: 'Curatela',
      numero: '8227479-19.2026.8.05.0001',
      polo: ['p1', 'p2', 'excluido'],
      area: 'familia',
      obs: 'anotação interna',
    }, sources);
    for (const typed of ['curatela', 'alexnaldo', 'isabel', 'familia', '8227479']) {
      expect(matchesSearchTerms(terms, searchQueryTerms(typed))).toBe(true);
    }
    expect(matchesSearchTerms(terms, searchQueryTerms('anotacao'))).toBe(false);
  });

  it('pede de uma vez os registros apontados, por coleção', () => {
    expect(searchReferencesOf(screen, { polo: ['p1', 'p2', 'p1'] })).toEqual([{ collection: 'persons', ids: ['p1', 'p2'] }]);
    expect(searchReferencesOf(screen, { polo: [] })).toEqual([]);
  });

  it('sabe quem leva o título de uma coleção para os próprios termos', () => {
    const screens = [
      { ...screen, collection: 'cases' },
      { ...screen, collection: 'cases' },
      { collection: 'tasks', titleFieldKey: 'nome', fields: [field('nome', 'text'), field('dono', 'reference', { refEntity: 'persons' })] },
    ];
    expect(searchReferrersOf(screens, 'persons')).toEqual([{ collection: 'cases', fieldKey: 'polo', multi: true }]);
  });
});
