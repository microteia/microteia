import type { FieldDefinition } from '../entities/entitySchemas';
import { evaluateFieldExpression } from './fieldExpression';
import { buildHydratedFieldScope } from './referenceScope';
import type { RecordResolver } from './referenceScope';

/**
 * Núcleo puro dos efeitos de `onChange`. Front-only, como o `referenceScope` de que depende — fica
 * fora do sync-schemas. O hook que o consome cuida só de timers e estado.
 */

/**
 * Avalia a expressão `onChange` do campo e devolve o objeto a mesclar no formulário.
 *
 * O escopo já reflete o valor recém-escolhido (a expressão precisa enxergar o que o usuário acabou
 * de fazer, não o estado anterior) e vem hidratado, para que `produto.preco` funcione. A chave do
 * próprio campo é removida do resultado: reescrevê-la brigaria com a digitação.
 */
export const resolveOnChangePatch = (
  field: FieldDefinition,
  fields: FieldDefinition[],
  values: Record<string, unknown>,
  value: unknown,
  resolve: RecordResolver,
): Record<string, unknown> => {
  const expression = field.logic?.onChange?.trim();
  if (!expression) return {};

  const scope = buildHydratedFieldScope(fields, { ...values, [field.key]: value }, resolve);

  try {
    const result = evaluateFieldExpression(expression, { value: scope[field.key], data: scope });
    if (result === null || typeof result !== 'object' || Array.isArray(result)) return {};

    return Object.fromEntries(
      Object.entries(result as Record<string, unknown>).filter(([key]) => key !== field.key),
    );
  } catch {
    // Expressão inválida nunca trava o formulário — mesma política dos demais slots.
    return {};
  }
};

/** Aplica o prefixo de destino às chaves devolvidas por um provedor externo. */
export const prefixLookupValues = (
  values: Record<string, unknown>,
  prefix: string | null | undefined,
): Record<string, unknown> => {
  const trimmed = prefix?.trim();
  if (!trimmed) return values;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`${trimmed}.${key}`, value]),
  );
};
