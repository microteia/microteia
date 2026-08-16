import { createContext, useContext, useCallback } from 'react';
import type { LookupDefinition, LookupOption } from '../domain/entities';
import type { SchemaLookup } from '../domain/schema/screenEntity';
import { useLabel, useLocaleFormat } from '../presentation/shared/i18n/useT';

export interface LookupStoreState {
  /** Opções por nome de coleção — do kernel e do tenant, no mesmo mapa. */
  optionsByCollection: Record<string, LookupOption[]>;
  /** Só as listas declaradas por ESTE tenant. As do kernel vivem no `LOOKUP_REGISTRY`. */
  definitions: LookupDefinition[];
  /** Todas as listas disponíveis, para o seletor do Form Design e para o `SchemaContext`. */
  availableLookups: SchemaLookup[];
  loading: boolean;
  getOptions: (collection: string) => LookupOption[];
  addOption: (collection: string, label: string, color?: string) => Promise<void>;
  removeOption: (collection: string, key: string) => Promise<void>;
  declareLookup: (collection: string, label: string) => Promise<void>;
}

export const LookupContext = createContext<LookupStoreState | null>(null);

/**
 * A resolução dos rótulos acontece AQUI, no hook, e não no provedor.
 *
 * O provedor está montado acima do `TenantLocaleProvider` — que é onde os pacotes de idioma
 * instalados no escritório entram — porque ele carrega um catálogo global, uma vez só. Resolver lá
 * dentro pegava o catálogo de fora, só com o núcleo, e o escritório com português instalado via
 * tudo em inglês. O hook, ao contrário, executa no ponto de CHAMADA, já dentro do idioma do tenant.
 */
export const useLookups = (): LookupStoreState => {
  const ctx = useContext(LookupContext);
  const label = useLabel();
  const { compareText } = useLocaleFormat();
  if (!ctx) throw new Error('useLookups must be used within LookupStoreProvider');

  const getOptions = useCallback(
    (collection: string) => ctx.getOptions(collection)
      .map((option) => ({ ...option, label: label(option.label) }))
      // A ordem alfabética é a do IDIOMA corrente, e por isso vem depois de resolver.
      .sort((a, b) => compareText(a.label, b.label)),
    [ctx, label, compareText],
  );

  return { ...ctx, getOptions };
};
