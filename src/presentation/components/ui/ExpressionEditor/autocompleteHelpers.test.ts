import { describe, expect, it } from 'vitest';
import { buildAutocompleteItems } from './autocompleteHelpers';
import type { FunctionDefinition, WorkflowVariable } from './autocompleteHelpers';

const functions: FunctionDefinition[] = [
  { name: 'concat', category: 'Texto', description: 'Junta textos', signature: 'concat(...)', example: "concat('a','b')", minArgs: 1 },
  { name: 'upper', category: 'Texto', description: 'Maiúsculas', signature: 'upper(v)', example: "upper('a')", minArgs: 1 },
];

const variables: WorkflowVariable[] = [
  { name: 'produto', definedBy: 'Produto' },
  { name: 'produto.id', definedBy: 'Produto — identificador' },
  { name: 'produto.preco', definedBy: 'Produto — Preço' },
  { name: 'quantidade', definedBy: 'Quantidade' },
];

const build = (query: string) =>
  buildAutocompleteItems('function', query, functions, [], [], variables);

describe('buildAutocompleteItems — navegação em campo de referência', () => {
  it('sugere os subcampos ao digitar o ponto', () => {
    const values = build('produto.').map((item) => item.value);
    expect(values).toContain('produto.preco');
    expect(values).toContain('produto.id');
  });

  it('filtra os subcampos conforme a digitação continua', () => {
    const values = build('produto.pre').map((item) => item.value);
    expect(values).toEqual(['produto.preco']);
  });

  it('não oferece funções nem atalhos numa consulta com ponto', () => {
    const items = build('produto.');
    expect(items.every((item) => item.category === 'Variável')).toBe(true);
  });

  it('sem ponto, segue oferecendo funções normalmente', () => {
    const values = build('conc').map((item) => item.value);
    expect(values).toContain('concat');
  });

  it('o campo de referência em si continua sugerido pelo prefixo', () => {
    const values = build('produt').map((item) => item.value);
    expect(values).toContain('produto');
  });
});
