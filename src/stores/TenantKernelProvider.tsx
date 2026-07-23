import React, { useMemo } from 'react';
import { KernelProvider } from './KernelContext';
import { usePluginStore } from './usePluginStore';
import { CORE_PLUGINS } from '../plugins';
import { installedPluginRecords } from '../domain/usecases/plugins/installedPluginRecords';

/**
 * Host do Kernel do escritório: `CORE_PLUGINS` + os plugins instalados e habilitados no tenant.
 * Aninhado abaixo do host base (que serve o DI e as rotas públicas) — como usa o mesmo
 * `KernelContext`, esta instância vence para a subárvore do workspace, e é dela que a barra lateral,
 * as páginas e o ⌘K leem as contribuições. Instalar/ativar um plugin recompõe os `records` e o host
 * recarrega, fazendo o menu e as telas do plugin aparecerem ao vivo.
 */
export const TenantKernelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { catalog, installations } = usePluginStore();

  const records = useMemo(
    () => [...CORE_PLUGINS, ...installedPluginRecords(catalog, installations)],
    [catalog, installations],
  );

  return <KernelProvider records={records}>{children}</KernelProvider>;
};
