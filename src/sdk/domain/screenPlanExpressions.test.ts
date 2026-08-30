import { describe, expect, it } from 'vitest';
import { buildArtifactPlan } from './artifactPlan';
import { buildDomainCatalog } from './catalog';
import { CORPUS } from './corpus.test-support';
import type { DomainModel } from './domainModel';
import { validateDomainModel } from './validateDomainModel';
import {
  evaluateFieldExpression,
  extractFieldExpressionDependencies,
} from '../../domain/schema/fieldExpression';
import { anyOf, notExpression } from '../../domain/schema/expressionSyntax';

/**
 * A FRONTEIRA entre quem GERA a expressão e quem a AVALIA.
 *
 * O plano de telas monta `disabledWhen` e `hiddenWhen` como texto, e esse texto é copiado verbatim
 * para dentro de um manifesto — onde quem o lê é o `expr-eval`, não quem o escreveu. Nada confrontava
 * as duas pontas, e foi por aí que `' || '` entrou: em SQL, de onde a linguagem vem, `||` é
 * concatenação de texto. `!(a) || !(b)` devolvia a string `"falsefalse"`, e toda string não-vazia é
 * verdadeira — a ação nascia cinza e nenhum dado a acendia.
 *
 * O que este arquivo cobra não é o token: é o TIPO do resultado. Uma condição que devolve string é,
 * por definição, uma condição que a gramática está lendo de outro jeito — e isso vale para o operador
 * que ainda não foi errado.
 *
 * E cobra de TODA condição que o plano emite, não só do `disabledWhen`. O `workflowCondition` carregava
 * a explicação de por que ele converge em prosa inglesa entre parênteses, dentro da própria expressão —
 * um campo com nome de condição, copiado verbatim para o `plugin.ts`, que não parseava. Um campo fica de
 * fora desta cobrança quando não é condição, e não quando ninguém se lembrou dele.
 */
const CATALOG = buildDomainCatalog([]);

/**
 * Todo nome livre da expressão vira um objeto vazio. Não interessa o valor: interessa que a avaliação
 * ocorra sem variável faltando, porque uma expressão que ESTOURA cai no `fallback` do slot e some do
 * radar exatamente como a que devolve string.
 */
const scopeFor = (expression: string): Record<string, unknown> =>
  Object.fromEntries(extractFieldExpressionDependencies(expression).map((name) => [name, {}]));

const evaluate = (expression: string, data?: Record<string, unknown>): unknown =>
  evaluateFieldExpression(expression, {
    value: null,
    data: data ?? scopeFor(expression),
    permissions: [],
  });

/**
 * COMO a expressão é lida — `"boolean"` quando é condição, o tipo errado quando um operador diz outra
 * coisa, e a frase do erro quando nem parseia. As três respostas cabem no mesmo lugar porque, para
 * quem copia o plano para dentro do `plugin.ts`, as três dão no mesmo: a condição não vale.
 */
const readAs = (condition: string): string => {
  try {
    return typeof evaluate(condition);
  } catch (error) {
    return `não parseia: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * TODA condição que sai do plano de um modelo: as da ação na tela, e as do gatilho que a automação
 * recebe. `fromCheck.previousValue` fica fora porque é um caminho (`old.status`), não uma condição.
 */
const emittedConditions = (model: DomainModel): string[] => {
  const screens = buildArtifactPlan(model, CATALOG).screenPlan.screens.flatMap((one) => one.actions);
  const transitions = validateDomainModel(model, CATALOG).transitions;

  return [
    ...screens.flatMap((action) => [
      action.disabledWhen,
      action.workflowCondition,
      ...(action.hiddenWhen === undefined ? [] : [action.hiddenWhen]),
    ]),
    ...transitions.flatMap((one) => [
      one.workflowCondition,
      ...(one.fromCheck?.expression === undefined ? [] : [one.fromCheck.expression]),
      ...(one.fromCheck?.creationTest === undefined ? [] : [one.fromCheck.creationTest]),
    ]),
  ];
};

describe('a condição que o plano emite é lida como condição por quem a avalia', () => {
  it.each(CORPUS.map((one) => [one.name, one.model] as const))(
    'em "%s", toda condição emitida avalia para BOOLEANO',
    (_name, model) => {
      const conditions = emittedConditions(model());
      expect(conditions.length).toBeGreaterThan(0);
      for (const condition of conditions) {
        expect(readAs(condition), `"${condition}" não é lida como condição`).toBe('boolean');
      }
    },
  );

  /** Guarda que não dispara é pior que guarda nenhuma: o defeito que existiu tem de reprovar aqui. */
  it('o detector reconhece a forma que quebrou — `||` entre dois booleanos', () => {
    const terms = [notExpression('status == "draft"'), notExpression('total > 0')];
    // Um pedido em rascunho, com total: os dois termos são falsos, e a ação DEVE estar liberada.
    const satisfied = { status: 'draft', total: 500 };

    const broken = terms.join(' || ');
    expect(evaluate(broken, satisfied)).toBe('falsefalse');
    expect(typeof evaluate(broken, satisfied)).not.toBe('boolean');

    expect(evaluate(anyOf(terms), satisfied)).toBe(false);
  });
});
