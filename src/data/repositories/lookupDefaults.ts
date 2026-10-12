import type { LookupOption } from '../../domain/entities';
import { DECLARED_LOOKUP_OPTIONS } from '../../domain/schema/lookupDefaults';

/**
 * `isStatic` é carimbado aqui, e não na declaração: opção que vem em código É fixa, por definição.
 * Deixar a marca a cargo de cada entrada faria dela algo que se esquece — e esquecê-la põe a opção do
 * kernel entre as do escritório, com botão de excluir e sem a cor do tema.
 */
export const LOOKUP_DEFAULTS: Record<string, LookupOption[]> = Object.fromEntries(
  Object.entries(DECLARED_LOOKUP_OPTIONS).map(([collection, options]) => [
    collection,
    options.map((option) => ({ ...option, isStatic: true })),
  ]),
);

export const lookupDefaultsFor = (collection: string): LookupOption[] => LOOKUP_DEFAULTS[collection] ?? [];
