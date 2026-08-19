import React, { useMemo } from 'react';
import { KernelProvider } from './KernelContext';
import { useInstalledExtensions } from './useInstalledExtensions';
import { CORE_PLUGINS } from '../plugins';
import { installedExtensionRecords } from '../domain/usecases/plugins/installedExtensionRecords';
import { useExtensionCodeTrust } from './useExtensionCodeTrust';
import { isExtensionMigrationPending } from '../domain/usecases/plugins/extensionMigrationState';
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
 * privada do próprio autor), a extensão contribui aqui. Aninhado abaixo do host base: usa o mesmo
 * `KernelContext`, então vence para a subárvore do workspace. Instalar/ativar recompõe os `records` e o
 * host recarrega, fazendo a tela aparecer ao vivo.
 *
 * Extensão com MIGRAÇÃO DE DADOS obrigatória em dívida também não entra: `migrationStates` diz o que
 * cada cópia já aplicou, e o que falta a mantém fora do boot até que um admin rode a fila (ver
 * `extensionMigrationState`).
 *
 * Instalar e EXECUTAR CÓDIGO são decisões separadas: `useExtensionCodeTrust` diz quais cópias podem
 * rodar JavaScript (catálogo público aprovado, ou revisão explícita de um admin). O resto do pacote
 * entra igual — o que não roda é só o código.
 */
export const TenantKernelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { installed, migrationStates } = useInstalledExtensions();
  const trustedIds = useExtensionCodeTrust(installed);

  const migrationPendingIds = useMemo(
    () => new Set(
      installed
        .filter((extension) => isExtensionMigrationPending(extension, migrationStates))
        .map((extension) => extension.id),
    ),
    [installed, migrationStates],
  );

  const records = useMemo(
    () => dedupeById([
      ...CORE_PLUGINS,
      ...installedExtensionRecords(installed, trustedIds, migrationPendingIds),
    ]),
    [installed, trustedIds, migrationPendingIds],
  );

  return <KernelProvider records={records}>{children}</KernelProvider>;
};
