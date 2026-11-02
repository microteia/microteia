import { Parser } from 'expr-eval';
import { describe, expect, it } from 'vitest';
import { coreExpressionsPlugin } from '../../../plugins/core.expressions/manifest';
import { FIELD_EXPRESSION_FUNCTION_NAMES, evaluateFieldExpression } from '../../schema/fieldExpression';
import { ENGINE_PARSER_OPERATORS, buildEngineParser, expressionEngine } from './ExpressionEngine';
import type { WorkflowContext } from '../../entities/WorkflowContext';

/**
 * O ExpressionEditor valida o que o usuário escreve contra o catálogo do WORKFLOW, que vem deste
 * plugin. Mas expressão de CAMPO e de parâmetro de ação é avaliada pelo `fieldExpression.ts`, que
 * tem catálogo próprio. Função que existisse só de um lado era aprovada na tela e estourava na hora
 * de avaliar — foi o que aconteceu com `addDays`, que derrubou silenciosamente a tela de parâmetros.
 *
 * Este teste é a cobrança: acrescentou função ao Workflow, acrescente o par PURO em
 * `src/domain/schema/fieldExpression.ts` (a fonte; a cópia daqui é gerada por `npm run sync-schemas`).
 */

/** Já resolvidos pelo próprio `expr-eval` via `EXPRESSION_OPERATORS`, sem precisar de par. */
const RESOLVED_BY_EXPR_EVAL = new Set(['min', 'max']);

const UNAVAILABLE_TO_FIELDS: Record<string, string> = {
  getVar: 'lê o WorkflowContext, que não existe ao avaliar um registro',
};

/**
 * Nome que o `expr-eval` reserva com o operador LIGADO. Registrar função com um destes nomes é
 * escrever código MORTO: o parser resolve o operador antes de olhar as funções (`not`, `abs`,
 * `ceil`, `floor`) ou nem parseia a chamada (`and`, `or`). Enquanto estiveram no catálogo, o editor
 * os oferecia como função e o usuário escrevia o que só falhava ao executar.
 *
 * `round` e `length` NÃO estão aqui: para eles o operador foi deliberadamente desligado, justamente
 * para que a função registrada — melhor que o built-in — seja alcançada.
 */
const RESERVED_BY_EXPR_EVAL = ['and', 'or', 'not', 'abs', 'ceil', 'floor'];

const SENTINEL = Symbol('chamou a função registrada');

/**
 * Pergunta ao próprio `expr-eval`, e não a uma lista escrita à mão: registra uma sentinela com o
 * nome e vê se `nome(...)` chega nela. Não chegou — porque não parseou ou porque um operador
 * respondeu antes — a função é inalcançável e não pode estar no catálogo.
 */
const reachableAsFunction = (name: string): boolean => {
  for (const argCount of [0, 1, 2, 3]) {
    const parser = new Parser({ allowMemberAccess: true, operators: { ...ENGINE_PARSER_OPERATORS } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- expr-eval não tipa parser.functions
    (parser.functions as any)[name] = () => SENTINEL;
    const args = Array.from({ length: argCount }, (_, index) => String(index + 1)).join(', ');
    try {
      return parser.parse(`${name}(${args})`).evaluate({} as never) === SENTINEL;
    } catch {
      continue;
    }
  }
  return false;
};

describe('paridade entre o catálogo do Workflow e o das expressões de campo', () => {
  const workflowFunctionNames = Object.keys(coreExpressionsPlugin.implementations ?? {});

  it('toda função do Workflow tem par nas expressões de campo (ou justificativa)', () => {
    const fieldFunctions = new Set(FIELD_EXPRESSION_FUNCTION_NAMES);
    const semPar = workflowFunctionNames.filter(
      (name) =>
        !fieldFunctions.has(name) &&
        !RESOLVED_BY_EXPR_EVAL.has(name) &&
        !(name in UNAVAILABLE_TO_FIELDS),
    );

    expect(semPar).toEqual([]);
  });

  it('o catálogo de campo não inventa função que o Workflow não conheça', () => {
    const workflowFunctions = new Set(workflowFunctionNames);
    const desconhecidas = FIELD_EXPRESSION_FUNCTION_NAMES.filter((name) => !workflowFunctions.has(name));

    expect(desconhecidas).toEqual([]);
  });
});

describe('o catálogo só anuncia o que o expr-eval consegue chamar', () => {
  const workflowFunctionNames = Object.keys(coreExpressionsPlugin.implementations ?? {});

  it('toda função do Workflow é alcançável pelo parser do motor', () => {
    const inalcancaveis = workflowFunctionNames.filter((name) => !reachableAsFunction(name));

    expect(inalcancaveis).toEqual([]);
  });

  it('toda função de campo é alcançável pelo parser', () => {
    const inalcancaveis = FIELD_EXPRESSION_FUNCTION_NAMES.filter((name) => !reachableAsFunction(name));

    expect(inalcancaveis).toEqual([]);
  });

  /** A sentinela precisa saber reprovar, senão os dois testes acima passariam por acidente. */
  it('os nomes reservados pelo expr-eval são reprovados pela sonda', () => {
    for (const name of RESERVED_BY_EXPR_EVAL) {
      expect(reachableAsFunction(name), `${name} deveria ser inalcançável`).toBe(false);
    }
  });

  it('`round` é função, e não operador — é o que sustenta round(3.14159, 2)', () => {
    expect(ENGINE_PARSER_OPERATORS.round).toBe(false);
    expect(reachableAsFunction('round')).toBe(true);
    expect(workflowFunctionNames).toContain('round');
  });

  it('`length` é função, e não operador — é o que faz campo vazio contar 0', () => {
    expect(ENGINE_PARSER_OPERATORS.length).toBe(false);
    expect(reachableAsFunction('length')).toBe(true);
    expect(workflowFunctionNames).toContain('length');
  });
});

/**
 * Paridade de OPERADOR, não só de função.
 *
 * Este arquivo cobrava o catálogo e mais nada, e por baixo dele as duas pontas discordavam do
 * significado de `!`: no `expr-eval` cru ele é o fatorial, a tela tinha sido corrigida e o motor não.
 * `!(status == "draft")` valia `false` na tela e `1` — verdadeiro — no fluxo. Uma condição de passo
 * escrita com `!` passava sempre, e o único sintoma era a automação correndo quando não devia.
 *
 * O que se cobra aqui é o RESULTADO das duas pontas sobre o mesmo dado, porque é isso que a promessa
 * "é a mesma linguagem" significa para quem escreve a expressão uma vez e a usa nos dois lugares.
 */
describe('as duas pontas concordam sobre o significado dos operadores', () => {
  const DATA = { status: 'draft', total: 500, ativo: true };

  const noMotor = (expression: string): unknown =>
    buildEngineParser().parse(expression).evaluate({ ...DATA } as never);

  const naTela = (expression: string): unknown =>
    evaluateFieldExpression(expression, { value: null, data: { ...DATA } });

  const EXPRESSIONS = [
    '!ativo',
    '!(status == "draft")',
    '!(total > 0)',
    '!(status == "draft") or !(total > 0)',
    'not (status == "draft")',
    'status == "draft" and total > 0',
  ];

  it.each(EXPRESSIONS)('"%s" vale o mesmo no motor e na tela', (expression) => {
    expect(noMotor(expression)).toStrictEqual(naTela(expression));
  });

  it('`!` é negação nas duas, e não o fatorial do expr-eval', () => {
    expect(noMotor('!(status == "draft")')).toBe(false);
    expect(naTela('!(status == "draft")')).toBe(false);
  });
});

/**
 * O mesmo nome, resultados diferentes — e DECLARADOS. Unificar mudaria o que expressões já gravadas nos
 * escritórios devolvem, então a diferença fica: dita na descrição de cada função e no catálogo servido
 * ao autor (`EXPRESSION_ENGINE_DIFFERENCES`). Este teste prende o que cada motor faz HOJE; se um lado
 * mudar, a descrição tem de mudar junto.
 */
describe('as diferenças declaradas entre a tela e a automação', () => {
  const naAutomacao = (expression: string): unknown =>
    expressionEngine.evaluate(expression, { event: { payload: {} }, input: {}, outputs: {}, variables: {} } as unknown as WorkflowContext);
  const naTela = (expression: string): unknown =>
    evaluateFieldExpression(expression, { value: null, data: {} });

  it('coalesce: a tela pula texto vazio, a automação o devolve', () => {
    expect(naTela('coalesce("", "x")')).toBe('x');
    expect(naAutomacao('coalesce("", "x")')).toBe('');
  });

  it('isEmpty: objeto vazio só é vazio na automação', () => {
    expect(naTela('isEmpty(object())')).toBe(false);
    expect(naAutomacao('isEmpty(object())')).toBe(true);
  });

  it('formatMoney: a automação cai em pt-br para o idioma que não conhece', () => {
    expect(naAutomacao('formatMoney(1234.5)')).toBe('R$ 1.234,50');
    expect(naAutomacao('formatMoney(1234.5, "fr-fr")')).toBe('R$ 1.234,50');
    expect(naTela('formatMoney(1234.5, "en-US")')).toContain('1,234.50');
  });
});
