import { describe, expect, it } from 'vitest';
import { createSchemaContext } from '../schema/screenEntity';
import type { SchemaScreen } from '../schema/pathResolver';
import {
  buildImportRows,
  coerceImportCell,
  importableFields,
  importFileKindOf,
  importMappingIssue,
  importPrimaryKeyFields,
  parseImportCsv,
  parseImportJson,
  suggestImportMapping,
} from './recordImportFile';
import type { ImportCellOptions, ImportTable } from './recordImportFile';

const iso: ImportCellOptions = { decimalSeparator: '.', dateFormat: 'iso' };
const br: ImportCellOptions = { decimalSeparator: ',', dateFormat: 'dmy' };

const table = (outcome: ReturnType<typeof parseImportCsv>): ImportTable => {
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.table;
};

describe('parseImportCsv', () => {
  it('lê cabeçalho e linhas, e numera pela linha FÍSICA do arquivo', () => {
    const parsed = table(parseImportCsv('nome,valor\r\nAna,10\r\n\r\nBia,20\r\n'));
    expect(parsed.headers).toEqual(['nome', 'valor']);
    expect(parsed.rows).toEqual([
      { line: 2, cells: ['Ana', '10'] },
      { line: 4, cells: ['Bia', '20'] },
    ]);
  });

  it('detecta ponto e vírgula, tira o BOM e respeita aspas com delimitador e quebra de linha', () => {
    const parsed = table(parseImportCsv('\uFEFFnome;obs\n"Silva; Ana";"linha 1\nlinha 2"\nBia;"diz ""oi"""\n'));
    expect(parsed.headers).toEqual(['nome', 'obs']);
    expect(parsed.rows[0]).toEqual({ line: 2, cells: ['Silva; Ana', 'linha 1\nlinha 2'] });
    expect(parsed.rows[1]).toEqual({ line: 4, cells: ['Bia', 'diz "oi"'] });
  });

  it('aceita a última linha sem quebra e o arquivo separado por tabulação', () => {
    expect(table(parseImportCsv('a\tb\n1\t2')).rows).toEqual([{ line: 2, cells: ['1', '2'] }]);
  });

  it('recusa aspas sem fechamento, dizendo onde a linha começou, e o arquivo vazio', () => {
    expect(parseImportCsv('a,b\n1,"aberto\n2,3\n')).toEqual({
      ok: false,
      error: '@core.records/import.file.unclosed-quote',
      errorParams: { line: '2' },
    });
    expect(parseImportCsv('\n\n')).toMatchObject({ ok: false, error: '@core.records/import.file.empty' });
  });
});

describe('parseImportJson', () => {
  it('uma lista de objetos: colunas na ordem em que aparecem, valores tipados como vieram', () => {
    const outcome = parseImportJson('[{"nome":"Ana","valor":10},{"valor":2.5,"ativo":true}]');
    expect(outcome).toEqual({
      ok: true,
      table: {
        kind: 'json',
        headers: ['nome', 'valor', 'ativo'],
        rows: [
          { line: 1, cells: ['Ana', 10, undefined] },
          { line: 2, cells: [undefined, 2.5, true] },
        ],
      },
    });
  });

  it('recusa o que não é lista de objetos', () => {
    expect(parseImportJson('{')).toMatchObject({ error: '@core.records/import.file.invalid-json' });
    expect(parseImportJson('{"a":1}')).toMatchObject({ error: '@core.records/import.file.not-a-list' });
    expect(parseImportJson('[{"a":1}, 2]')).toMatchObject({ error: '@core.records/import.file.not-an-object', errorParams: { line: '2' } });
    expect(parseImportJson('[]')).toMatchObject({ error: '@core.records/import.file.empty' });
  });

  it('o tipo do arquivo sai da extensão', () => {
    expect(importFileKindOf('Cadastro.JSON')).toBe('json');
    expect(importFileKindOf('cadastro.csv')).toBe('csv');
    expect(importFileKindOf('cadastro.xlsx')).toBeNull();
  });
});

describe('coerceImportCell', () => {
  it('número no separador DECLARADO — nunca adivinhado', () => {
    expect(coerceImportCell('1.234,56', 'number', br)).toEqual({ ok: true, value: 1234.56 });
    expect(coerceImportCell('1,234.56', 'number', iso)).toEqual({ ok: true, value: 1234.56 });
    expect(coerceImportCell('-3', 'number', iso)).toEqual({ ok: true, value: -3 });
    expect(coerceImportCell('12abc', 'number', iso)).toEqual({ ok: false, error: '@core.records/import.cell.not-a-number' });
  });

  it('data no formato declarado, e só dia que existe', () => {
    expect(coerceImportCell('03/04/2026', 'date', br)).toEqual({ ok: true, value: '2026-04-03' });
    expect(coerceImportCell('03/04/2026', 'date', { ...iso, dateFormat: 'mdy' })).toEqual({ ok: true, value: '2026-03-04' });
    expect(coerceImportCell('2026-4-3', 'date', iso)).toEqual({ ok: true, value: '2026-04-03' });
    expect(coerceImportCell('2026-04-03T10:00:00Z', 'date', iso)).toEqual({ ok: true, value: '2026-04-03T10:00:00Z' });
    expect(coerceImportCell('31/02/2026', 'date', br)).toEqual({ ok: false, error: '@core.records/import.cell.not-a-date' });
    expect(coerceImportCell('03/04/2026', 'date', iso)).toMatchObject({ ok: false });
  });

  it('booleano, lista e texto', () => {
    expect(coerceImportCell('Yes', 'boolean', iso)).toEqual({ ok: true, value: true });
    expect(coerceImportCell('0', 'boolean', iso)).toEqual({ ok: true, value: false });
    expect(coerceImportCell('talvez', 'boolean', iso)).toMatchObject({ ok: false });
    expect(coerceImportCell(' a | b ||c ', 'stringArray', iso)).toEqual({ ok: true, value: ['a', 'b', 'c'] });
    expect(coerceImportCell(' Ana ', 'string', iso)).toEqual({ ok: true, value: ' Ana ' });
  });

  it('a célula vazia não manda nada, e o valor TIPADO de um JSON passa como veio', () => {
    expect(coerceImportCell('  ', 'number', iso)).toEqual({ ok: true, skip: true });
    expect(coerceImportCell(undefined, 'string', iso)).toEqual({ ok: true, skip: true });
    expect(coerceImportCell(null, 'string', iso)).toEqual({ ok: true, value: null });
    expect(coerceImportCell(7, 'number', iso)).toEqual({ ok: true, value: 7 });
  });
});

const screen: SchemaScreen = {
  id: 'contribuintes',
  titleSingular: 'Contribuinte',
  titleFieldKey: 'nome',
  fields: [
    { key: 'documento', label: 'Documento', type: 'text', required: true, order: 0, origin: 'design' },
    { key: 'nome', label: 'Nome completo', type: 'text', required: true, order: 1, origin: 'design' },
    { key: 'renda', label: 'Renda', type: 'currency', required: false, order: 2, origin: 'design' },
    { key: 'anexo', label: 'Anexo', type: 'file', required: false, order: 3, origin: 'design' },
    { key: 'protocolo', label: 'Protocolo', type: 'text', required: false, order: 4, origin: 'design', autoValue: { pattern: '000', sequence: {} } },
  ],
  keys: [{ name: 'documento', kind: 'primary', fields: ['documento'] }],
};

describe('campos importáveis e mapeamento', () => {
  const ctx = createSchemaContext([screen]);

  it('oferece só o que o upsert grava e um arquivo traz: sem arquivo, sem número sequencial', () => {
    const fields = importableFields(ctx, 'contribuintes');
    expect(fields.map((field) => field.key)).toEqual(['documento', 'nome', 'renda']);
    expect(fields[0]).toMatchObject({ primary: true, required: true });
    expect(fields.find((field) => field.key === 'renda')).toMatchObject({ type: 'number', primary: false });
    expect(importPrimaryKeyFields(ctx, 'contribuintes')).toEqual(['documento']);
  });

  it('sugere pela chave ou pelo rótulo, sem caixa nem acento, e cada campo uma vez', () => {
    const fields = importableFields(ctx, 'contribuintes');
    const mapping = suggestImportMapping(['DOCUMENTO', 'Nome Completo', 'nome', 'Observação'], fields, (field) => field.label);
    expect(mapping).toEqual(['documento', 'nome', null, null]);
  });

  it('na aba do pai, o vínculo não é coluna; a referência diz por que chaves do alvo pode procurar', () => {
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
        { key: 'aluno', label: 'Aluno', type: 'reference', refEntity: 'contribuintes', required: true, order: 1, origin: 'design' },
      ],
    };
    const withChild = createSchemaContext([screen, turmas, matriculas]);

    expect(importableFields(withChild, 'matriculas').map((field) => field.key)).toEqual(['turma', 'aluno']);
    const fields = importableFields(withChild, 'matriculas', { lockedFieldKey: 'turma' });
    expect(fields.map((field) => field.key)).toEqual(['aluno']);
    expect(fields[0].lookupKeys).toEqual([{ key: 'documento', label: 'Documento' }]);
    expect(importableFields(withChild, 'contribuintes').every((field) => field.lookupKeys.length === 0)).toBe(true);
  });

  it('recusa o mapeamento vazio e o campo em duas colunas', () => {
    expect(importMappingIssue([null, null])).toBe('@core.records/import.mapping.empty');
    expect(importMappingIssue(['nome', 'nome'])).toBe('@core.records/import.mapping.duplicate');
    expect(importMappingIssue(['nome', null])).toBeNull();
  });
});

describe('buildImportRows', () => {
  const ctx = createSchemaContext([screen]);
  const fields = importableFields(ctx, 'contribuintes');
  const csv = table(parseImportCsv('doc;nome;renda;ignorar\n1;Ana;1.500,00;x\n2;Bia;muito;y\n;;;z\n3;Caio;;w\n'));

  it('monta o data pelo mapeamento, recusa a linha cuja célula não converte e a que nada traz', () => {
    const outcome = buildImportRows(csv, ['documento', 'nome', 'renda', null], fields, br);
    expect(outcome.rows).toEqual([
      { line: 2, data: { documento: '1', nome: 'Ana', renda: 1500 } },
      { line: 5, data: { documento: '3', nome: 'Caio' } },
    ]);
    expect(outcome.rejected).toEqual([
      {
        line: 3,
        status: 'failed',
        error: '@core.records/import.cell.not-a-number',
        errorParams: { column: 'renda', value: 'muito' },
      },
      { line: 4, status: 'failed', error: '@core.records/import.row.empty' },
    ]);
  });
});
