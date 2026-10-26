import { describe, expect, it } from 'vitest';
import {
  MEMBER_VISIBILITY_MAX_FIELDS,
  derivesReadAllPermission,
  memberVisibilityClauses,
  memberVisibilityFilter,
  memberVisibilityIssues,
  readMemberVisibility,
  readerRestriction,
  readerSeesAll,
  readerSeesRecord,
  recordNamesMember,
  resolveMemberVisibility,
} from './memberVisibility';
import { createSchemaContext } from './screenEntity';

const SPEC = { userFields: ['emissor', 'equipe'] };
const ana = { uid: 'ana', permissions: ['respostas.read'] };

describe('readMemberVisibility — a declaração como a regra a lê', () => {
  it('ausente não restringe', () => {
    expect(readMemberVisibility(undefined)).toBeNull();
    expect(readMemberVisibility(null)).toBeNull();
  });

  it('malformada fecha: o que não é mapa, ou `userFields` que não é lista, não nomeia ninguém', () => {
    expect(readMemberVisibility('emissor')).toEqual({ userFields: [] });
    expect(readMemberVisibility({ userFields: 'emissor' })).toEqual({ userFields: [] });
  });

  it('só as quatro primeiras posições contam, e cada uma só se for texto', () => {
    expect(readMemberVisibility({ userFields: ['a', 2, 'b', 'c', 'd', 'e'] })).toEqual({ userFields: ['a', 'b', 'c'] });
    expect(MEMBER_VISIBILITY_MAX_FIELDS).toBe(4);
  });

  it('`bypassPermission` só vale como texto; fora disso, a supervisão é a derivada', () => {
    expect(readMemberVisibility({ userFields: ['a'], bypassPermission: 'x.supervise' }))
      .toEqual({ userFields: ['a'], bypassPermission: 'x.supervise' });
    expect(readMemberVisibility({ userFields: ['a'], bypassPermission: 7 })).toEqual({ userFields: ['a'] });
    expect(derivesReadAllPermission({ userFields: ['a'] })).toBe(true);
    expect(derivesReadAllPermission({ userFields: ['a'], bypassPermission: 'x.supervise' })).toBe(false);
    expect(derivesReadAllPermission(null)).toBe(false);
  });
});

describe('quem lê o registro', () => {
  it('o campo simples nomeia pelo valor; o `multi`, por conter', () => {
    expect(recordNamesMember({ emissor: 'ana' }, SPEC, 'ana')).toBe(true);
    expect(recordNamesMember({ emissor: 'bia', equipe: ['ana', 'caio'] }, SPEC, 'ana')).toBe(true);
    expect(recordNamesMember({ emissor: 'bia', equipe: [] }, SPEC, 'ana')).toBe(false);
  });

  it('um mapa com o uid como chave não nomeia ninguém — como `hasAny` na regra', () => {
    expect(recordNamesMember({ emissor: { ana: true } }, SPEC, 'ana')).toBe(false);
  });

  it('uid vazio nunca é nomeado, ainda que o campo esteja vazio', () => {
    expect(recordNamesMember({ emissor: '' }, SPEC, '')).toBe(false);
  });

  it('sem declaração, ou sem leitor (a automação), lê tudo', () => {
    expect(readerSeesRecord(null, 'respostas', ana, { emissor: 'bia' })).toBe(true);
    expect(readerSeesRecord(SPEC, 'respostas', undefined, { emissor: 'bia' })).toBe(true);
  });

  it('a supervisão é a declarada, ou `<coleção>.read-all`; o curinga do dono passa sempre', () => {
    expect(readerSeesAll(SPEC, 'respostas', ['respostas.read-all'])).toBe(true);
    expect(readerSeesAll({ ...SPEC, bypassPermission: 'x.supervise' }, 'respostas', ['respostas.read-all'])).toBe(false);
    expect(readerSeesAll({ ...SPEC, bypassPermission: 'x.supervise' }, 'respostas', ['x.supervise'])).toBe(true);
    expect(readerSeesAll(SPEC, 'respostas', ['*'])).toBe(true);
    expect(readerSeesRecord(SPEC, 'respostas', ana, { emissor: 'bia' })).toBe(false);
  });

  it('a restrição e o filtro do cliente só existem para quem não supervisiona', () => {
    expect(readerRestriction(SPEC, 'respostas', ana)).toBe(SPEC);
    expect(readerRestriction(SPEC, 'respostas', { uid: 'chefe', permissions: ['respostas.read-all'] })).toBeNull();
    expect(memberVisibilityFilter(SPEC, 'respostas', ana)).toEqual({ uid: 'ana', spec: SPEC });
    expect(memberVisibilityFilter(null, 'respostas', ana)).toBeNull();
  });
});

describe('memberVisibilityClauses', () => {
  it('um `==` e um `array-contains` por campo — o campo que virou `multi` guarda as duas formas', () => {
    expect(memberVisibilityClauses(SPEC)).toEqual([
      { field: 'emissor', op: '==' },
      { field: 'emissor', op: 'array-contains' },
      { field: 'equipe', op: '==' },
      { field: 'equipe', op: 'array-contains' },
    ]);
  });

  it('sem campo, sem termo — e o repositório não consulta', () => {
    expect(memberVisibilityClauses({ userFields: [] })).toEqual([]);
  });
});

describe('memberVisibilityIssues — o que o `check` e o Form Design cobram', () => {
  const fields = [
    { key: 'emissor', type: 'reference', refEntity: 'members' },
    { key: 'equipe', type: 'reference', refEntity: 'members', multi: true },
    { key: 'cliente', type: 'reference', refEntity: 'clientes' },
    { key: 'nome', type: 'text' },
  ];

  it('a declaração certa passa', () => {
    expect(memberVisibilityIssues({ userFields: ['emissor', 'equipe'], bypassPermission: 'x.supervise' }, fields)).toEqual([]);
  });

  it('cada defeito tem nome', () => {
    expect(memberVisibilityIssues('emissor', fields)).toEqual([{ code: 'shape' }]);
    expect(memberVisibilityIssues({ userFields: [] }, fields)).toEqual([{ code: 'fields-empty' }]);
    expect(memberVisibilityIssues({ userFields: ['emissor', 'emissor'] }, fields))
      .toEqual([{ code: 'field-duplicate', subject: 'emissor' }]);
    expect(memberVisibilityIssues({ userFields: ['dono'] }, fields)).toEqual([{ code: 'field-unknown', subject: 'dono' }]);
    expect(memberVisibilityIssues({ userFields: ['cliente', 'nome'] }, fields)).toEqual([
      { code: 'field-not-member', subject: 'cliente' },
      { code: 'field-not-member', subject: 'nome' },
    ]);
    expect(memberVisibilityIssues({ userFields: ['emissor'], bypassPermission: 'supervisiona' }, fields))
      .toEqual([{ code: 'bypass-invalid', subject: 'supervisiona' }]);
  });

  it('mais de quatro campos é recusa: a regra nunca leria o quinto', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((key) => ({ key, type: 'reference', refEntity: 'members' }));
    expect(memberVisibilityIssues({ userFields: many.map((one) => one.key) }, many)).toEqual([{ code: 'fields-too-many' }]);
  });
});

describe('resolveMemberVisibility', () => {
  it('é a do documento da COLEÇÃO, e não a da tela que a apresenta', () => {
    const ctx = createSchemaContext([
      { id: 'respostas', titleSingular: 'R', titleFieldKey: 'x', fields: [], memberVisibility: SPEC },
      { id: 'caixa', collection: 'respostas', titleSingular: 'Caixa', titleFieldKey: 'x', fields: [], memberVisibility: null },
    ]);
    expect(resolveMemberVisibility(ctx, 'respostas')).toEqual(SPEC);
    expect(resolveMemberVisibility(ctx, 'outra')).toBeNull();
  });
});
