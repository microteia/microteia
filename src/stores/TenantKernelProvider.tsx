import React, { useMemo } from 'react';
import { KernelProvider } from './KernelContext';
import { useInstalledExtensions } from './useInstalledExtensions';
import { CORE_PLUGINS } from '../plugins';
import { installedExtensionRecords } from '../domain/usecases/plugins/installedExtensionRecords';
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
 * Host do Kernel do escritório: `CORE_PLUGINS` + as extensões INSTALADAS ativas. Separação de conceitos:
 * a área PRIVADA é de autoria (rascunho editável, não roda); para USAR uma extensão no escritório é
 * preciso INSTALÁ-LA (a partir da pública ou da própria privada) — é a cópia instalada e ativa que
 * contribui telas/menu aqui. Como o código instalado veio de fonte confiável (catálogo aprovado ou a
 * privada do próprio autor — self-trust), rodá-lo é seguro. Aninhado abaixo do host base: usa o mesmo
 * `KernelContext`, então vence para a subárvore do workspace. Instalar/ativar recompõe os `records` e o
 * host recarrega, fazendo a tela aparecer ao vivo.
 */
export const TenantKernelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { installed } = useInstalledExtensions();

  const records = useMemo(
    () => dedupeById([
      ...CORE_PLUGINS,
      ...installedExtensionRecords(installed),
    ]),
    [installed],
  );

  return <KernelProvider records={records}>{children}</KernelProvider>;
};
