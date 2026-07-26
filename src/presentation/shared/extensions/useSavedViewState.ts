import { useCallback, useState } from 'react';
import { useTenant } from '../../../stores/useTenant';

const storageKey = (tenantId: string | undefined, key: string): string =>
  `microteia:viewstate:${tenantId ?? 'no-tenant'}:${key}`;

/**
 * Estado de view persistido por usuário (no `localStorage` do navegador), escopado pelo tenant atual
 * para não vazar entre escritórios. É o que uma extensão usa para lembrar preferências locais — quais
 * colunas o Kanban mostra, por exemplo — sem gravar nada no Firestore. `key` deve ser estável e único
 * por view (ex.: `'kanban.cases'`).
 */
export const useSavedViewState = <T>(key: string, initial: T): [T, (value: T) => void] => {
  const { currentTenant } = useTenant();
  const fullKey = storageKey(currentTenant?.id, key);

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(fullKey, JSON.stringify(next));
      } catch {
        // localStorage indisponível (modo privado/quota) — a preferência só não persiste.
      }
    },
    [fullKey],
  );

  return [value, update];
};
