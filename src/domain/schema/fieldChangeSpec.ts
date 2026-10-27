import type { FieldDefinition } from '../entities/entitySchemas';
import type { FieldLookupBinding } from './fieldRules';
import { evaluateFieldExpression } from './fieldExpression';
import { buildHydratedFieldScope } from './referenceScope';
import type { RecordResolver } from './referenceScope';
import { buildFieldUiScope } from './fieldUiScope';
import type { FieldUiState } from './fieldUiScope';

/**
 * Núcleo puro dos efeitos de `onChange`. Front-only, como o `referenceScope` de que depende — fica
 * fora do sync-schemas. O hook que o consome cuida só de timers e estado.
 */

/**
 * Avalia a expressão `onChange` do campo e devolve o objeto a mesclar no formulário.
 *
 * O escopo já reflete o valor recém-escolhido (a expressão precisa enxergar o que o usuário acabou
 * de fazer, não o estado anterior), vem hidratado, para que `produto.preco` funcione, e enxerga a
 * situação do formulário (`isNew`) como os outros dois slots front-only. A chave do próprio campo é
 * removida do resultado: reescrevê-la brigaria com a digitação.
 */
export const resolveOnChangePatch = (
  field: FieldDefinition,
  fields: FieldDefinition[],
  values: Record<string, unknown>,
  value: unknown,
  resolve: RecordResolver,
  ui: FieldUiState,
): Record<string, unknown> => {
  const expression = field.logic?.onChange?.trim();
  if (!expression) return {};

  const hydrated = buildHydratedFieldScope(fields, { ...values, [field.key]: value }, resolve);
  const scope = buildFieldUiScope(hydrated, ui);

  try {
    const result = evaluateFieldExpression(expression, { value: hydrated[field.key], data: scope });
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

/**
 * O kernel a partir do qual `onChangeLookup.map` existe. Um anterior o ignoraria e gravaria as chaves
 * cruas do provedor (`street`, `city`) no registro.
 */
export const LOOKUP_TARGET_MAP_SINCE_KERNEL = '2.80.0';

/**
 * O `map` da busca externa só com as entradas que dizem alguma coisa — chave e destino preenchidos —,
 * ou `null` quando não sobra nenhuma. `null` é o que devolve a busca ao prefixo: um `map` vazio não
 * pode virar "não preencher nada" sem ninguém ter dito isso.
 */
export const lookupTargetMap = (
  binding: FieldLookupBinding | null | undefined,
): Record<string, string> | null => {
  const map = binding?.map;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  const entries = Object.entries(map)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([output, target]) => [output.trim(), target.trim()] as const)
    .filter(([output, target]) => output !== '' && target !== '');
  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

/**
 * O que a resposta de um provedor externo escreve no formulário.
 *
 * Com `map`, cada valor vai para o campo declarado, e só para campo que a tela TEM: um destino que o
 * Form Design apagou depois não pode reaparecer como chave solta no registro. O campo que disparou a
 * busca nunca é reescrito — brigaria com a digitação, a mesma regra do `onChange`.
 *
 * Sem `map`, o comportamento é o de antes, intacto: as chaves do provedor, prefixadas ou cruas.
 */
export const resolveLookupPatch = (
  binding: FieldLookupBinding,
  values: Record<string, unknown>,
  triggerKey: string,
  fieldKeys: ReadonlySet<string>,
): Record<string, unknown> => {
  const map = lookupTargetMap(binding);
  if (!map) return prefixLookupValues(values, binding.targetPrefix);
  return Object.fromEntries(
    Object.entries(map)
      .filter(([output, target]) => target !== triggerKey && fieldKeys.has(target) && Object.hasOwn(values, output))
      .map(([output, target]) => [target, values[output]]),
  );
};
