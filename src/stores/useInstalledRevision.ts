import { useEffect, useState } from 'react';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import { packageRevision } from '../domain/usecases/plugins/extensionHistory';

/**
 * A revisão do pacote que está instalado agora — a chave que diz QUAL entrada do histórico é a que
 * está no ar. O cálculo é SHA-256 sobre o pacote inteiro (assíncrono, via `crypto.subtle`), então
 * chega num segundo render, e até lá nenhuma entrada aparece como atual.
 *
 * O argumento é um pacote só, e não a lista das instaladas, porque a pergunta só existe com o
 * histórico de UMA extensão aberto: hashear todas as instaladas a cada mudança custaria megabytes de
 * digestão para uma tela que ninguém abriu.
 */
export const useInstalledRevision = (pkg: MarketplacePlugin | null): string | null => {
  const [revision, setRevision] = useState<string | null>(null);

  useEffect(() => {
    if (!pkg) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sem pacote não há revisão a mostrar
      setRevision(null);
      return;
    }
    let cancelled = false;
    void packageRevision(pkg)
      .then((value) => { if (!cancelled) setRevision(value); })
      .catch(() => { if (!cancelled) setRevision(null); });
    return () => { cancelled = true; };
  }, [pkg]);

  return revision;
};
