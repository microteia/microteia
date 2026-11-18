import type { QueryOrderBy } from '../../../../../domain/schema/querySpec';
import { LIST_ORDER_MAX_KEYS } from '../../../../../domain/schema/ui/listOrder';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A declaração gravada, como a aba a mostra. Mostra o que está gravado, e não o que a lista aplica:
 * uma chave que a tela não responde mais tem de aparecer aqui para alguém poder tirá-la.
 */
export const toListOrderForm = (stored: unknown): QueryOrderBy[] =>
  Array.isArray(stored)
    ? stored
      .filter(isPlainObject)
      .map((entry) => ({
        path: typeof entry.path === 'string' ? entry.path : '',
        dir: entry.dir === 'asc' ? 'asc' as const : 'desc' as const,
      }))
    : [];

/** O que gravar: a linha sem campo escolhido não é chave, e sem chave nenhuma `null` apaga a ordem. */
export const fromListOrderForm = (keys: readonly QueryOrderBy[]): QueryOrderBy[] | null => {
  const filled = keys.filter((key) => key.path.trim() !== '').map((key) => ({ path: key.path.trim(), dir: key.dir }));
  return filled.length > 0 ? filled : null;
};

/** A linha nova já vem com o primeiro caminho ainda livre, que é quase sempre o que se quer a seguir. */
export const addListOrderKey = (keys: readonly QueryOrderBy[], paths: readonly string[]): QueryOrderBy[] => {
  if (keys.length >= LIST_ORDER_MAX_KEYS) return [...keys];
  const used = new Set(keys.map((key) => key.path));
  return [...keys, { path: paths.find((path) => !used.has(path)) ?? '', dir: 'asc' }];
};
