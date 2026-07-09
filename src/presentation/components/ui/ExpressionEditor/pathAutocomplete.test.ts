import { describe, it, expect } from 'vitest';
import { createSchemaContext, type PathRoot } from '../../../../domain/schema/pathResolver';
import { buildPathAutocompleteItems, extractActiveEventPath, findInvalidEventPath } from './pathAutocomplete';

const ctx = createSchemaContext();
const casesRoot: PathRoot = { kind: 'entity', entityKey: 'cases', hasOld: true };

describe('extractActiveEventPath', () => {
  it('extrai cadeia completa e segmento parcial', () => {
    expect(extractActiveEventPath('concat(event.contract.cli')).toStrictEqual({
      completedPath: 'contract',
      query: 'cli',
      queryStart: 'concat(event.contract.'.length,
    });
  });

  it('trata event. e cadeias profundas', () => {
    expect(extractActiveEventPath('event.')).toMatchObject({ completedPath: '', query: '' });
    expect(extractActiveEventPath('x + event.customValues.tarefa.')).toMatchObject({
      completedPath: 'customValues.tarefa',
      query: '',
    });
  });

  it('ignora texto sem event. ativo e identificadores colados', () => {
    expect(extractActiveEventPath('concat(foo')).toBeNull();
    expect(extractActiveEventPath('xevent.campo')).toBeNull();
    expect(extractActiveEventPath('event.contract.number + 1')).toBeNull();
  });
});

describe('buildPathAutocompleteItems', () => {
  it('sugere segmentos com ponto para nós navegáveis', () => {
    const items = buildPathAutocompleteItems(ctx, casesRoot, { completedPath: '', query: 'contr', queryStart: 0 });
    const contract = items.find((i) => i.value === 'contract.');
    expect(contract).toBeDefined();
    expect(items.find((i) => i.value === 'contractId')).toBeDefined();
  });

  it('navega FK e filtra por query', () => {
    const items = buildPathAutocompleteItems(ctx, casesRoot, { completedPath: 'contract', query: 'num', queryStart: 0 });
    expect(items[0]?.value).toBe('number');
  });
});

describe('findInvalidEventPath', () => {
  it('aceita caminhos válidos e desconhecidos permissivos', () => {
    expect(findInvalidEventPath(ctx, casesRoot, 'concat(event.contract.number, event.qualquerCoisa)')).toBeNull();
  });

  it('aponta navegação inválida em valor simples', () => {
    const issue = findInvalidEventPath(ctx, casesRoot, 'event.caseNumber.x');
    expect(issue?.path).toBe('event.caseNumber.x');
    expect(issue?.error).toContain('valor simples');
  });
});
