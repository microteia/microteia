import { describe, expect, it } from 'vitest';
import { createSchemaContext } from './screenEntity';
import type { SchemaScreen } from './pathResolver';
import { buildRecordKeyId } from './recordKeys';
import {
  importLookupKeyId,
  importLookupKeys,
  importParentFieldIssue,
  resolveImportReference,
} from './recordImportReference';
import { recordImportLookupsIssue, recordImportParentIssue } from './recordImport';

const pessoas: SchemaScreen = {
  id: 'pessoas',
  titleSingular: 'Pessoa',
  titleFieldKey: 'nome',
  fields: [
    { key: 'cpf', label: 'CPF', type: 'text', required: true, order: 0, origin: 'design', rules: { format: { preset: 'digits' } } },
    { key: 'email', label: 'E-mail', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'nome', label: 'Nome', type: 'text', required: true, order: 2, origin: 'design' },
    { key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 3, origin: 'design' },
  ],
  keys: [
    { name: 'cpf', kind: 'primary', fields: ['cpf'] },
    { name: 'email', kind: 'unique', fields: ['email'], normalize: { caseInsensitive: true } },
    { name: 'nome-apelido', kind: 'unique', fields: ['nome', 'apelido'] },
  ],
};

const turmas: SchemaScreen = {
  id: 'turmas',
  titleSingular: 'Turma',
  titleFieldKey: 'nome',
  fields: [{ key: 'nome', label: 'Nome', type: 'text', required: true, order: 0, origin: 'design' }],
};

const matriculas: SchemaScreen = {
  id: 'matriculas',
  titleSingular: 'Matrícula',
  titleFieldKey: 'aluno',
  parentFieldKey: 'turma',
  fields: [
    { key: 'turma', label: 'Turma', type: 'reference', refEntity: 'turmas', required: true, order: 0, origin: 'design' },
    { key: 'aluno', label: 'Aluno', type: 'reference', refEntity: 'pessoas', required: true, order: 1, origin: 'design' },
    { key: 'monitores', label: 'Monitores', type: 'reference', refEntity: 'pessoas', multi: true, required: false, order: 2, origin: 'design' },
    { key: 'sala', label: 'Sala', type: 'text', required: false, order: 3, origin: 'design' },
    { key: 'orfa', label: 'Órfã', type: 'reference', refEntity: 'nao-existe', required: false, order: 4, origin: 'design' },
  ],
};

const ctx = createSchemaContext([pessoas, turmas, matriculas]);

describe('as referências de uma importação', () => {
  it('diz para onde a referência aponta, e se guarda uma lista', () => {
    expect(resolveImportReference(ctx, 'matriculas', 'aluno')).toEqual({ collection: 'pessoas', label: 'Aluno', multi: false });
    expect(resolveImportReference(ctx, 'matriculas', 'monitores')).toMatchObject({ collection: 'pessoas', multi: true });
    expect(resolveImportReference(ctx, 'matriculas', 'sala')).toBeNull();
    expect(resolveImportReference(ctx, 'matriculas', 'orfa')).toBeNull();
    expect(resolveImportReference(ctx, 'matriculas', 'nada')).toBeNull();
  });

  it('o vínculo com o pai é uma referência de um id só', () => {
    expect(importParentFieldIssue(ctx, 'matriculas', 'turma')).toBeNull();
    expect(importParentFieldIssue(ctx, 'matriculas', 'monitores')).toBe('@core.records/import.error.parent-field');
    expect(importParentFieldIssue(ctx, 'matriculas', 'sala')).toBe('@core.records/import.error.parent-field');
  });

  it('procura pelas chaves de UM campo do alvo, primary ou unique — a composta fica de fora', () => {
    expect(importLookupKeys(ctx, 'pessoas').map((key) => key.name)).toEqual(['cpf', 'email']);
    expect(importLookupKeys(ctx, 'turmas')).toEqual([]);
  });

  it('a célula vira o id da reserva como a gravação o faria: regra do campo, depois normalização da chave', () => {
    const [cpf, email] = importLookupKeys(ctx, 'pessoas');
    expect(importLookupKeyId(ctx, 'pessoas', cpf, '123.456.789-00')).toBe(buildRecordKeyId('pessoas', 'cpf', ['12345678900']));
    expect(importLookupKeyId(ctx, 'pessoas', email, ' Ana@X.com ')).toBe(buildRecordKeyId('pessoas', 'email', ['ana@x.com']));
    expect(importLookupKeyId(ctx, 'pessoas', cpf, '   ')).toBeNull();
  });
});

describe('a forma do pai e das colunas por chave', () => {
  it('ausente é a importação de sempre; presente, precisa de campo e id', () => {
    expect(recordImportParentIssue(undefined)).toBeNull();
    expect(recordImportParentIssue({ fieldKey: 'turma', recordId: 't1' })).toBeNull();
    expect(recordImportParentIssue({ fieldKey: 'turma' })).toBe('@core.records/import.error.batch-malformed');
    expect(recordImportParentIssue({ fieldKey: 'turma', recordId: 'a/b' })).toBe('@core.records/import.error.batch-malformed');
  });

  it('uma coluna por campo, e no máximo o teto', () => {
    expect(recordImportLookupsIssue(undefined)).toBeNull();
    expect(recordImportLookupsIssue([{ fieldKey: 'aluno', key: 'cpf' }])).toBeNull();
    expect(recordImportLookupsIssue([{ fieldKey: 'aluno', key: 'cpf' }, { fieldKey: 'aluno', key: 'email' }]))
      .toBe('@core.records/import.error.batch-malformed');
    expect(recordImportLookupsIssue('aluno')).toBe('@core.records/import.error.batch-malformed');
    expect(recordImportLookupsIssue(Array.from({ length: 21 }, (_, index) => ({ fieldKey: `f${index}`, key: 'k' }))))
      .toBe('@core.records/import.error.batch-malformed');
  });
});
