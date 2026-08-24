import { useMemo } from 'react';
import { useKernel } from '../../stores/useKernel';
import { collectPluginLicenses } from '../../domain/usecases/plugins/pluginLicenses';
import type { PluginLicense } from '../../domain/usecases/plugins/pluginLicenses';

/**
 * Os termos de licença dos plugins que ESTE host carregou.
 *
 * O host é o que dá a resposta certa em cada lugar sem que a tela precise perguntar onde está: na
 * rota pública `/license` ele é o de base (`CORE_PLUGINS`) e a lista sai vazia; dentro do workspace
 * é o `TenantKernelProvider`, e a lista é exatamente a das extensões que estão no ar naquele
 * escritório. Ler as cópias instaladas em vez disso traria também as desativadas e as que o Kernel
 * recusou — termos que não valem para ninguém.
 */
export const usePluginLicenses = (): PluginLicense[] => {
  const { host } = useKernel();
  return useMemo(
    () => collectPluginLicenses(host.loadedIds().map((id) => host.manifestOf(id))),
    [host],
  );
};
