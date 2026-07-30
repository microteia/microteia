import { useEffect, useState } from 'react';
import type { InstalledExtension } from '../domain/entities/InstalledExtension';
import {
  hashExtensionCode,
  isExtensionCodeTrusted,
} from '../domain/usecases/plugins/extensionCodeTrust';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * O conjunto de extensões instaladas cujo CÓDIGO pode executar. O hash é SHA-256 (assíncrono, via
 * `crypto.subtle`), então o resultado chega num segundo render — e até lá o conjunto é vazio, ou
 * seja, **falha fechada**: nada roda enquanto não se sabe.
 */
export const useExtensionCodeTrust = (installed: InstalledExtension[]): ReadonlySet<string> => {
  const [trustedIds, setTrustedIds] = useState<ReadonlySet<string>>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const resolve = async (): Promise<void> => {
      const entries = await Promise.all(
        installed.map(async (extension) => {
          const hash = await hashExtensionCode(extension.package).catch(() => null);
          return isExtensionCodeTrusted(extension, hash) ? extension.id : null;
        }),
      );
      if (cancelled) return;
      setTrustedIds(new Set(entries.filter((id): id is string => id !== null)));
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [installed]);

  return trustedIds;
};
