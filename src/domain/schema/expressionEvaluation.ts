import type { Expression, Parser } from 'expr-eval';

/**
 * As duas garantias de avaliação que a linguagem promete e o `expr-eval` cru não dá — num lugar só,
 * porque o Workflow e a tela avaliam a MESMA linguagem e `fieldExpressionParity.test.ts` confronta as
 * duas pontas.
 *
 * 1. **Membro de `null` é `null`, nunca um erro.** O `expr-eval` lê membro sem guarda (`n1[item.value]`):
 *    `output.q.first.x` com a consulta vazia lançava "Cannot read properties of null" — e
 *    `isEmpty(...)` e `coalesce(...)` em volta não ajudavam, porque o argumento estoura antes de a
 *    função ser chamada. Cada `IMEMBER` vira um operador binário que devolve `null` quando o alvo é
 *    `null`, e lê o membro como antes nos demais casos.
 *
 *    `undefined` continua ESTOURANDO, de propósito: `null` é "o valor existe e está vazio" (a consulta
 *    que não achou nada, o ator ausente, a referência em branco), `undefined` é "esse caminho não
 *    existe" — quase sempre um erro de digitação como `event.payload.x`, onde `event` já é o payload.
 *    Ler vazio ali faria o fluxo gravar um campo em branco sem que nada acusasse.
 *
 * 2. **`if(c, x, y)` avalia só o ramo escolhido**, como `?:`. Função recebe os argumentos já
 *    avaliados, então o ramo descartado rodava — e podia lançar. A chamada de três argumentos é
 *    reescrita para o ternário nativo, cujos ramos o `expr-eval` já avalia sob demanda (`and`/`or`
 *    também já curto-circuitam: não precisam de nada daqui).
 */

export const SAFE_MEMBER_OPERATOR = '?.';

const IF_FUNCTION = 'if';
const TERNARY_OPERATOR = '?';

interface ExprToken {
  type: string;
  value: unknown;
}

const readMember = (target: unknown, key: unknown): unknown =>
  target === null ? null : (target as Record<string, unknown>)[key as string];

export const installSafeMemberOperator = (parser: Parser): void => {
  const operators = (parser as unknown as { binaryOps: Record<string, typeof readMember> }).binaryOps;
  operators[SAFE_MEMBER_OPERATOR] = readMember;
};

const PUSHES_ONE = new Set(['INUMBER', 'IVAR', 'IVARNAME', 'IEXPR', 'IEXPREVAL']);

const popOperandStarts = (starts: number[], count: number): number[] => starts.splice(starts.length - count, count);

/**
 * Percorre a notação polonesa reversa guardando ONDE começa cada operando da pilha — é o que permite
 * recortar os três argumentos de um `if` sem reparsear a expressão.
 */
const rewriteTokens = (tokens: readonly ExprToken[]): ExprToken[] => {
  const out: ExprToken[] = [];
  const starts: number[] = [];
  for (const token of tokens) {
    if (token.type === 'IEXPR' && Array.isArray(token.value)) {
      starts.push(out.length);
      out.push({ type: 'IEXPR', value: rewriteTokens(token.value as ExprToken[]) });
    } else if (PUSHES_ONE.has(token.type)) {
      starts.push(out.length);
      out.push(token);
    } else if (token.type === 'IMEMBER') {
      out.push({ type: 'INUMBER', value: token.value }, { type: 'IOP2', value: SAFE_MEMBER_OPERATOR });
    } else if (token.type === 'IOP1') {
      out.push(token);
    } else if (token.type === 'IOP2') {
      starts.push(popOperandStarts(starts, 2)[0]);
      out.push(token);
    } else if (token.type === 'IOP3') {
      starts.push(popOperandStarts(starts, 3)[0]);
      out.push(token);
    } else if (token.type === 'IFUNCALL') {
      const argCount = token.value as number;
      const [calleeStart, ...argStarts] = popOperandStarts(starts, argCount + 1);
      const callee = out[calleeStart];
      starts.push(calleeStart);
      if (argCount === 3 && callee.type === 'IVAR' && callee.value === IF_FUNCTION) {
        const [conditionStart, whenTrueStart, whenFalseStart] = argStarts;
        const condition = out.slice(conditionStart, whenTrueStart);
        const whenTrue = out.slice(whenTrueStart, whenFalseStart);
        const whenFalse = out.slice(whenFalseStart);
        out.splice(
          calleeStart,
          out.length - calleeStart,
          ...condition,
          { type: 'IEXPR', value: whenTrue },
          { type: 'IEXPR', value: whenFalse },
          { type: 'IOP3', value: TERNARY_OPERATOR },
        );
      } else {
        out.push(token);
      }
    } else if (token.type === 'IARRAY') {
      const itemCount = token.value as number;
      starts.push(itemCount > 0 ? popOperandStarts(starts, itemCount)[0] : out.length);
      out.push(token);
    } else {
      if (token.type === 'IENDSTATEMENT') starts.pop();
      out.push(token);
    }
  }
  return out;
};

/** Aplica as duas garantias a uma expressão já parseada, e a devolve. Exige `installSafeMemberOperator`. */
export const withSafeEvaluation = (expression: Expression): Expression => {
  const holder = expression as unknown as { tokens: ExprToken[] };
  holder.tokens = rewriteTokens(holder.tokens);
  return expression;
};
