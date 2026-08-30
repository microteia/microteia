// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/expressionSyntax.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O VOCABULÁRIO de operadores da linguagem de expressão — para quem precisa MONTAR uma expressão em
 * vez de apenas avaliá-la.
 *
 * Existe porque montar uma condição com `join(' || ')` parece certo e não é. A linguagem é a do
 * `expr-eval`, que herdou a convenção do SQL: ali `||` é CONCATENAÇÃO DE TEXTO, não "ou". O plano de
 * telas emitia `!(a) || !(b)`, que avaliava para a string `"falsefalse"` — e toda string não-vazia é
 * verdadeira, nas quatro combinações possíveis. O `disabledWhen` gerado nunca devolvia falso: o botão
 * nascia cinza e nenhum dado o acendia.
 *
 * O defeito não tem sintoma no lugar onde se erra — a expressão passa no validador, lê-se em voz alta
 * como português correto e só falha na tela do escritório. Por isso o token do OU deixou de ser
 * digitado por quem gera texto: ele é declarado aqui, ao lado de `fieldExpression.ts`, onde o parser é
 * configurado, e é este arquivo que as duas pontas importam.
 */

/**
 * A negação lógica.
 *
 * No `expr-eval` cru o `!` é o FATORIAL — `!false` vale `1`, que é verdadeiro. `buildParser` o
 * sobrescreve por esta constante, e é o que faz `!` significar aqui o que qualquer pessoa escreve por
 * reflexo.
 */
export const NOT_OPERATOR = '!';

export const AND_OPERATOR = 'and';

export const OR_OPERATOR = 'or';

/**
 * A concatenação de texto — declarada para que ninguém a confunda com o "ou" de novo. Ela é parte do
 * vocabulário publicado no catálogo de operadores, e por isso não pode mudar de sentido: uma
 * expressão de escritório que monta `nome || " " || sobrenome` depende dela como está.
 */
export const CONCATENATE_OPERATOR = '||';

/** A negação de uma expressão QUALQUER: os parênteses são o que faz a negação valer sobre tudo. */
export const notExpression = (expression: string): string => `${NOT_OPERATOR}(${expression})`;

/** A negação de um termo que já é atômico — uma chamada de função, uma variável. */
export const notTerm = (term: string): string => `${NOT_OPERATOR}${term}`;

/** Verdadeiro quando QUALQUER termo for. Um termo só sai sem operador nenhum. */
export const anyOf = (terms: readonly string[]): string => terms.join(` ${OR_OPERATOR} `);

/** Verdadeiro quando TODOS os termos forem. Um termo só sai sem operador nenhum. */
export const allOf = (terms: readonly string[]): string => terms.join(` ${AND_OPERATOR} `);
