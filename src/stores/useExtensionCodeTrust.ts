import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { InstalledExtension } from '../domain/entities/InstalledExtension';
import {
  hashExtensionCode,
  isExtensionCodeTrusted,
} from '../domain/usecases/plugins/extensionCodeTrust';

const EMPTY: ReadonlySet<string> = new Set();

export interface ExtensionCodeTrust {
  /** As cópias instaladas cujo CÓDIGO pode executar. */
  trustedIds: ReadonlySet<string>;
  /**
   * O conjunto já corresponde às cópias instaladas de AGORA. Antes disso ele é vazio — falha fechada
   * para EXECUTAR, que é o certo —, mas quem CONTA pendências não pode tomar esse vazio por resposta:
   * acusaria revisão em toda extensão com código durante o segundo que o hash leva.
   */
  ready: boolean;
}

interface ResolvedTrust {
  source: InstalledExtension[];
  trustedIds: ReadonlySet<string>;
}

/**
 * Calcula a confiança de código das cópias instaladas. O hash é SHA-256 (assíncrono, via
 * `crypto.subtle`), então o resultado chega num segundo render — e até lá o conjunto é vazio, ou
 * seja, **falha fechada**: nada roda enquanto não se sabe.
 *
 * Roda UMA vez, no `TenantKernelProvider`, que o repassa por `ExtensionCodeTrustContext`. Quem só
 * precisa ler usa `useInstalledCodeTrust` — o selo do menu, o atalho do topo e a tela de Extensões
 * repetiam a digestão de todos os pacotes a cada mudança para chegar à mesma resposta.
 */
export const useExtensionCodeTrust = (installed: InstalledExtension[]): ExtensionCodeTrust => {
  const [resolved, setResolved] = useState<ResolvedTrust | null>(null);

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
      setResolved({ source: installed, trustedIds: new Set(entries.filter((id): id is string => id !== null)) });
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [installed]);

  return useMemo(() => ({
    trustedIds: resolved?.trustedIds ?? EMPTY,
    ready: resolved !== null && resolved.source === installed,
  }), [resolved, installed]);
};

export const ExtensionCodeTrustContext = createContext<ExtensionCodeTrust | null>(null);

export const useInstalledCodeTrust = (): ExtensionCodeTrust => {
  const context = useContext(ExtensionCodeTrustContext);
  if (!context) throw new Error('useInstalledCodeTrust precisa estar dentro de <TenantKernelProvider>');
  return context;
};
