import { createContext, useContext } from 'react';
import type { LookupDefinition, LookupOption } from '../domain/entities';
import type { SchemaLookup } from '../domain/schema/screenEntity';

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

export const useLookups = (): LookupStoreState => {
  const ctx = useContext(LookupContext);
  if (!ctx) throw new Error('useLookups must be used within LookupStoreProvider');
  return ctx;
};
