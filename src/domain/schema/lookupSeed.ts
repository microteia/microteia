/**
 * Como uma extensão semeia as opções de uma lista (`lookups[].options`).
 *
 * - `when-empty` (o padrão): só numa lista VAZIA. Dali em diante as opções são dado do escritório, e
 *   nem a atualização nem a reinstalação da extensão as tocam.
 * - `required`: a extensão PRECISA das opções — as telas dela as escolhem, os modelos dela as citam.
 *   Numa lista vazia, entram todas; numa lista que já tem opções, entram as que faltam, cada uma UMA
 *   vez por extensão: a chave já entregue não volta, mesmo que o escritório a tenha apagado. É o que
 *   deixa uma extensão acrescentar vocabulário a uma lista compartilhada — inclusive a do kernel, como
 *   `documentTypes` — sem desfazer o que o escritório decidiu.
 */
export const LOOKUP_SEED_MODES = ['when-empty', 'required'] as const;

export type LookupSeedMode = (typeof LOOKUP_SEED_MODES)[number];

export const isLookupSeedMode = (value: unknown): value is LookupSeedMode =>
  (LOOKUP_SEED_MODES as readonly unknown[]).includes(value);

/**
 * O kernel a partir do qual existem `seed: 'required'` e a semeadura de uma lista do KERNEL. Um
 * kernel anterior ignoraria os dois, e a extensão ficaria sem as opções de que depende.
 */
export const LOOKUP_SEED_SINCE_KERNEL = '2.71.0';

/** As chaves que cada extensão já entregou, por lista — guardadas no registro de instalação dela. */
export type SeededLookupOptions = Record<string, string[]>;

export interface SeedableOption {
  key: string;
  label: string;
}

export interface LookupSeedPlan<T extends SeedableOption> {
  /** As opções a gravar agora. */
  create: T[];
  /** As chaves que esta extensão passa a ter entregue nesta lista. */
  delivered: string[];
}

/**
 * O que semear, dado o que a lista JÁ TEM gravado e o que esta extensão já entregou antes. Uma opção
 * que o escritório já tem — pela chave ou pelo rótulo — conta como entregue e não é duplicada.
 */
export const planLookupSeed = <T extends SeedableOption>(
  options: readonly T[],
  mode: LookupSeedMode,
  existing: readonly SeedableOption[],
  alreadyDelivered: readonly string[],
): LookupSeedPlan<T> => {
  const keys = options.map((option) => option.key);
  const delivered = [...new Set([...alreadyDelivered, ...keys])];
  if (options.length === 0) return { create: [], delivered: [...alreadyDelivered] };
  if (existing.length === 0) return { create: [...options], delivered };
  if (mode !== 'required') return { create: [], delivered: [...alreadyDelivered] };

  const taken = new Set(existing.flatMap((option) => [option.key, option.label]));
  const given = new Set(alreadyDelivered);
  return {
    create: options.filter((option) => !given.has(option.key) && !taken.has(option.key) && !taken.has(option.label)),
    delivered,
  };
};
