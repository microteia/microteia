import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  isRecordSearchJobStalled,
  matchesSearchTerms,
  planRecordSearchBackfill,
  readRecordSearchJobState,
  RECORD_SEARCH_STALL_MS,
  recordSearchSignature,
  recordSearchTitle,
  searchLookupReferrersOf,
  startRecordSearchJob,
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

describe('a passada sobre os registros que já existem', () => {
  const screen = {
    titleFieldKey: 'titulo',
    fields: [field('titulo', 'text'), field('polo', 'reference', { refEntity: 'persons', searchable: true }), field('obs', 'textarea')],
  };

  it('a assinatura muda com o que muda os termos, e não com rótulo nem ordem', () => {
    const base = recordSearchSignature(screen);
    const relabeled = { ...screen, fields: screen.fields.map((candidate) => ({ ...candidate, label: `${candidate.label}!`, order: 9 })) };
    expect(recordSearchSignature(relabeled)).toBe(base);
    const more = { ...screen, fields: screen.fields.map((candidate) => (candidate.key === 'obs' ? { ...candidate, searchable: true } : candidate)) };
    expect(recordSearchSignature(more)).not.toBe(base);
    expect(recordSearchSignature({ ...screen, titleFieldKey: 'obs' })).not.toBe(base);
  });

  it('começa quando não há job ou a assinatura é outra; acorda o que parou', () => {
    const signature = recordSearchSignature(screen);
    expect(planRecordSearchBackfill(signature, null, 0)).toEqual({ kind: 'start' });
    const job = startRecordSearchJob('backfill', [], signature, null, 1000);
    expect(planRecordSearchBackfill(signature, job, 1000)).toEqual({ kind: 'none' });
    expect(planRecordSearchBackfill('outra', job, 1000)).toEqual({ kind: 'start' });
    expect(isRecordSearchJobStalled(job, 1000 + RECORD_SEARCH_STALL_MS + 1)).toBe(true);
    expect(planRecordSearchBackfill(signature, job, 1000 + RECORD_SEARCH_STALL_MS + 1)).toEqual({ kind: 'nudge' });
    expect(planRecordSearchBackfill(signature, { ...job, status: 'done' }, 1000 + RECORD_SEARCH_STALL_MS + 1)).toEqual({ kind: 'none' });
  });

  it('o recomeço sobe a geração e zera o avanço', () => {
    const first = { ...startRecordSearchJob('backfill', [], 'a', null, 1), round: 7, cursor: 'x', processed: 9 };
    expect(startRecordSearchJob('backfill', [], 'b', first, 2)).toMatchObject({ generation: 2, round: 0, cursor: null, processed: 0 });
  });

  it('lê o documento do job sem confiar na forma', () => {
    expect(readRecordSearchJobState({ scans: [{ collection: 'cases', fieldKey: 'polo', multi: true, value: 'p1' }, { nada: 1 }], round: -3 }))
      .toMatchObject({ kind: 'backfill', status: 'done', scans: [{ collection: 'cases', fieldKey: 'polo', multi: true, value: 'p1' }], round: 0 });
  });
});

describe('o título que vai para quem aponta', () => {
  it('é o texto do título; a opção pelo rótulo; e um título que é referência não é seguido', () => {
    expect(recordSearchTitle({ titleFieldKey: 'nome', fields: [field('nome', 'text')] }, { nome: ' Maria ' })).toBe('Maria');
    expect(recordSearchTitle(
      { titleFieldKey: 'area', fields: [field('area', 'select', { options: [{ key: 'f', label: 'Família' }] })] },
      { area: 'f' },
      (candidate, key) => candidate.options?.find((option) => option.key === key)?.label,
    )).toBe('Família');
    expect(recordSearchTitle({ titleFieldKey: 'dono', fields: [field('dono', 'reference', { refEntity: 'persons' })] }, { dono: 'p1' })).toBe('');
    expect(recordSearchTitle({ titleFieldKey: 'nome', fields: [field('nome', 'text')] }, null)).toBe('');
  });

  it('sabe quem guarda a opção de uma lista em campo pesquisável', () => {
    const screens = [{
      collection: 'cases',
      titleFieldKey: 'titulo',
      fields: [field('titulo', 'text'), field('area', 'select', { lookupCollection: 'caseAreas', searchable: true }), field('fase', 'select', { lookupCollection: 'caseAreas' })],
    }];
    expect(searchLookupReferrersOf(screens, 'caseAreas')).toEqual([{ collection: 'cases', fieldKey: 'area', multi: false }]);
  });
});
