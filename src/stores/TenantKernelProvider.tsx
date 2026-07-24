import React, { useMemo } from 'react';
import { KernelProvider } from './KernelContext';
import { usePluginStore } from './usePluginStore';
import { useTenantExtensions } from './useTenantExtensions';
import { CORE_PLUGINS } from '../plugins';
import { installedPluginRecords } from '../domain/usecases/plugins/installedPluginRecords';
import { tenantExtensionRecords } from '../domain/usecases/plugins/tenantExtensionRecords';
import type { PluginRecord } from '../kernel';

/** Mantém o primeiro registro de cada id (o Kernel recusaria ids duplicados). */
const dedupeById = (records: PluginRecord[]): PluginRecord[] => {
  const seen = new Set<string>();
  return records.filter((record) => {
    const id = record.manifest.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/**
 * Host do Kernel do escritório: `CORE_PLUGINS` + os plugins instalados e habilitados + as extensões
 * AUTORAIS ativas do próprio tenant (self-trust; ver `tenantExtensionRecords`). Aninhado abaixo do
 * host base — como usa o mesmo `KernelContext`, esta instância vence para a subárvore do workspace, e
 * é dela que a barra lateral, as páginas e o ⌘K leem as contribuições. Salvar/ativar uma extensão
 * autoral recompõe os `records` e o host recarrega, fazendo a tela aparecer ao vivo. Extensão autoral
 * tem prioridade sobre a mesma id vinda do catálogo (a autoral é a fonte editável).
 */
export const TenantKernelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { catalog, installations } = usePluginStore();
  const { extensions } = useTenantExtensions();

  const records = useMemo(
    // Ordem = prioridade no dedup: core nunca é sombreado; extensão autoral vence a mesma id vinda
    // do catálogo (a autoral é a fonte editável do dono).
    () => dedupeById([
      ...CORE_PLUGINS,
      ...tenantExtensionRecords(extensions),
      ...installedPluginRecords(catalog, installations),
    ]),
    [catalog, installations, extensions],
  );

  return <KernelProvider records={records}>{children}</KernelProvider>;
};
