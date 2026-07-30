import { useMemo } from 'react';
import {
  DATA_EXTERNAL_LOOKUP_POINT,
  lookupProviderOf,
} from '../../domain/schema/dataExtensionPoints';
import type { LookupProviderSpec } from '../../domain/schema/lookupProviderSpec';
import { buildLookupProviderCatalog, lookupRequestHost } from '../../domain/schema/lookupProviderSpec';
import { makeDeclarativeLookupService } from '../../data/services/DeclarativeLookupService';
import type { IExternalLookupService } from '../../domain/services/IExternalLookupService';
import { useContributions } from '../../stores/useKernel';

export interface ExternalLookupProviderOption {
  value: string;
  label: string;
  /** Host de destino: é a quem o valor digitado será enviado. Mostrado na autoria. */
  host: string | null;
  outputKeys: string[];
}

/**
 * Os provedores de busca externa disponíveis ao tenant — o do núcleo mais os declarados pelas
 * extensões instaladas. Não vem do DIContainer de propósito: o `DIProvider` lê o host BASE
 * (`CORE_PLUGINS`), então uma declaração de extensão de tenant nunca chegaria lá.
 */
export const useExternalLookupProviders = (): IExternalLookupService[] => {
  const contributions = useContributions(DATA_EXTERNAL_LOOKUP_POINT);

  return useMemo(() => {
    const declared = contributions
      .map(lookupProviderOf)
      .filter((provider): provider is LookupProviderSpec => provider !== undefined);
    return [...buildLookupProviderCatalog(declared).values()].map(
      (spec) => makeDeclarativeLookupService(spec),
    );
  }, [contributions]);
};

/** As mesmas declarações na forma que a autoria consome, com host e chaves de saída à vista. */
export const useExternalLookupOptions = (): ExternalLookupProviderOption[] => {
  const contributions = useContributions(DATA_EXTERNAL_LOOKUP_POINT);

  return useMemo(() => {
    const declared = contributions
      .map(lookupProviderOf)
      .filter((provider): provider is LookupProviderSpec => provider !== undefined);
    return [...buildLookupProviderCatalog(declared).values()].map((spec) => ({
      value: spec.key,
      label: spec.label,
      host: lookupRequestHost(spec.request),
      outputKeys: Object.keys(spec.map),
    }));
  }, [contributions]);
};
