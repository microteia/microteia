import { describe, it, expect } from 'vitest';
import { evaluateFieldExpression } from '../fieldExpression';
import {
  collectTemplatePaths,
  escapeMarkdownValue,
  parseTemplate,
  renderTemplate,
  templateValueText,
} from './templateGrammar';

const evaluate = (expr: string, scope: Record<string, unknown>): unknown =>
  evaluateFieldExpression(expr, { value: null, data: scope });

const render = (text: string, scope: Record<string, unknown>): string =>
  renderTemplate(parseTemplate(text).nodes, scope, { evaluate }).text;

describe('parseTemplate', () => {
  it('lê texto, expressão e os dois blocos', () => {
    const { nodes, issues } = parseTemplate('Olá {{name}}{{#each items}}- {{item}}{{/each}}{{#if paid}}ok{{/if}}');

    expect(issues).toEqual([]);
    expect(nodes.map((node) => node.kind)).toEqual(['text', 'expr', 'each', 'if']);
  });

  it('aponta o bloco que não fecha, o fechamento trocado e o que fecha sem abrir', () => {
    expect(parseTemplate('{{#each a}}x').issues.map((one) => one.error)).toEqual(['@core.documents/grammar.unclosed']);
    expect(parseTemplate('{{#each a}}x{{/if}}').issues.map((one) => one.error))
      .toEqual(['@core.documents/grammar.mismatched-close']);
    expect(parseTemplate('x{{/each}}').issues.map((one) => one.error))
      .toEqual(['@core.documents/grammar.unexpected-close']);
  });

  it('aponta a expressão que não parseia, dizendo qual é', () => {
    const [problem] = parseTemplate('{{ name + }}').issues;

    expect(problem.error).toBe('@core.documents/grammar.expression');
    expect(problem.errorParams?.expression).toBe('name +');
  });

  it('recusa um bloco que a gramática não tem, em vez de imprimi-lo como texto', () => {
    expect(parseTemplate('{{#with a}}{{/with}}').issues.map((one) => one.error)).toContain(
      '@core.documents/grammar.unknown-block',
    );
  });
});

describe('renderTemplate', () => {
  it('navega o caminho e formata com as funções das expressões de campo', () => {
    const scope = { caseId: { clientId: { name: 'Ana' } }, fee: 1500 };

    expect(render('{{caseId.clientId.name}}: {{formatMoney(fee, "pt-br")}}', scope)).toBe('Ana: R$ 1.500,00');
  });

  it('repete o laço com o item na raiz, o de fora legível, e a posição a partir de 1', () => {
    const scope = { client: 'Ana', installments: [{ amount: 10 }, { amount: 20 }] };

    expect(render('{{#each installments}}{{index}}/{{client}}={{amount}};{{/each}}', scope)).toBe('1/Ana=10;2/Ana=20;');
  });

  it('lê uma lista de textos pelo item', () => {
    expect(render('{{#each tags}}[{{item}}]{{/each}}', { tags: ['a', 'b'] })).toBe('[a][b]');
  });

  it('inclui o trecho só quando a condição vale', () => {
    expect(render('{{#if paid}}pago{{/if}}{{#if not paid}}em aberto{{/if}}', { paid: false })).toBe('em aberto');
  });

  it('não interrompe o documento por uma expressão que falha, mas diz qual falhou', () => {
    const result = renderTemplate(parseTemplate('a{{missing.deep}}b').nodes, {}, { evaluate });

    expect(result.text).toBe('ab');
    expect(result.issues.map((one) => one.expression)).toEqual(['missing.deep']);
  });

  it('passa o valor pelo escritor do formato, e o texto do modelo não', () => {
    const result = renderTemplate(parseTemplate('**{{name}}**').nodes, { name: 'a*b' }, {
      evaluate,
      write: escapeMarkdownValue,
    });

    expect(result.text).toBe('**a\\*b**');
  });
});

describe('templateValueText', () => {
  it('não imprime um registro inteiro no documento', () => {
    expect(templateValueText({ id: 'x', name: 'Ana' })).toBe('');
    expect(templateValueText(['a', null, 'b'])).toBe('a, b');
    expect(templateValueText(null)).toBe('');
  });
});

describe('collectTemplatePaths', () => {
  it('separa o que o registro lê do que o laço lê, e pede os do laço também à raiz', () => {
    const paths = collectTemplatePaths(
      parseTemplate('{{caseId.title}}{{#each installments}}{{dueDate}}{{index}}{{item}}{{/each}}').nodes,
    );

    expect(paths.root.sort()).toEqual(['caseId.title', 'dueDate', 'installments'].sort());
    expect(paths.loops.get('installments')).toEqual(['dueDate']);
  });
});
