import { describe, expect, it } from 'vitest';
import { buildAutocompleteItems } from './autocompleteHelpers';

/** O tradutor de teste devolve a própria chave — aqui o que importa é a lista, não a frase. */
const echo = (key: string) => key;
import type { FunctionDefinition, StepOutputField, WorkflowVariable } from './autocompleteHelpers';

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
  buildAutocompleteItems(echo, 'function', query, functions, [], [], variables);

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
    expect(items.every((item) => item.category === 'expression.category.variable')).toBe(true);
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

const stepOutputs: StepOutputField[] = [
  { stepId: 'buscarProcesso', stepName: 'Buscar Registros', outputId: 'count', outputLabel: 'Quantidade' },
  { stepId: 'buscarProcesso', stepName: 'Buscar Registros', outputId: 'first', outputLabel: 'Primeiro registro' },
  { stepId: 'montarPrazo', stepName: 'Montar Objeto', outputId: 'prazo', outputLabel: 'prazo' },
  { stepId: '9f1c2b7e-3d4a-4c55-8a11-0e6f2d9b7a10', stepName: 'Gravar Registro', outputId: 'id', outputLabel: 'Id' },
];

const buildOutput = (query: string) =>
  buildAutocompleteItems(echo, 'output', query, functions, [], stepOutputs, []);

describe('buildAutocompleteItems — escopo output', () => {
  it('lista os steps anteriores, uma vez cada, ao digitar o ponto da raiz', () => {
    const items = buildOutput('');
    expect(items.map((item) => item.label)).toEqual(['buscarProcesso', 'montarPrazo']);
    expect(items.every((item) => item.category === 'expression.category.step')).toBe(true);
  });

  it('descreve o step pelo nome exibido, e insere o id seguido de ponto', () => {
    const [primeiro] = buildOutput('busc');
    expect(primeiro.value).toBe('buscarProcesso.');
    expect(primeiro.description).toBe('Buscar Registros');
  });

  it('não repete o id na descrição quando o step se chama pelo próprio identificador', () => {
    const mesmoNome: StepOutputField[] = [
      { stepId: 'montarPrazo', stepName: 'montarPrazo', outputId: 'prazo', outputLabel: 'prazo' },
    ];
    const [item] = buildAutocompleteItems(echo, 'output', '', functions, [], mesmoNome, []);
    expect(item.label).toBe('montarPrazo');
    expect(item.description).toBeUndefined();
  });

  it('omite step cujo id não é escrevível numa expressão', () => {
    expect(buildOutput('').map((item) => item.label)).not.toContain('9f1c2b7e-3d4a-4c55-8a11-0e6f2d9b7a10');
  });

  it('fixado o step, passa a listar as saídas dele com o caminho completo', () => {
    const items = buildOutput('buscarProcesso.');
    expect(items.map((item) => item.value)).toEqual(['buscarProcesso.count', 'buscarProcesso.first']);
    expect(items[0].description).toBe('Buscar Registros → Quantidade');
  });

  it('filtra as saídas conforme a digitação continua', () => {
    expect(buildOutput('buscarProcesso.co').map((item) => item.value)).toEqual(['buscarProcesso.count']);
  });

  it('não vaza as saídas de um step nas do outro', () => {
    expect(buildOutput('montarPrazo.').map((item) => item.value)).toEqual(['montarPrazo.prazo']);
  });
});
