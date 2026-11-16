import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useInstalledExtensions, type InstallExtensionInput } from '../../../../stores/useInstalledExtensions';
import { usePublicExtensions } from '../../../../stores/usePublicExtensions';
import { useDI } from '../../../../infrastructure/di/useDI';
import { PERMISSION_EXTENSIONS_MANAGE } from '../../../../domain/schema/access';
import { KERNEL_PLUGIN_PREFIX } from '../../../../domain/schema/plugin/publicationProof';
import type { DefaultExtensionsOnboarding } from '../../../../domain/schema/plugin/defaultExtensions';
import {
  makeSettleDefaultExtensionUseCase,
  makeSubscribeDefaultExtensionsOnboardingUseCase,
} from '../../../../domain/usecases/plugins/DefaultExtensionsOnboardingUseCases';
import type { MarketplacePlugin } from '../../../../domain/entities/MarketplacePlugin';
import type { PublicExtension } from '../../../../domain/entities/PublicExtension';
import { resolveLabel } from '../../../../domain/schema/i18n/messageRef';
import { wrappedErrorParams } from '../../../../domain/errors/LocalizedError';
import { usePackageCatalog } from '../../../shared/i18n/usePackageCatalog';
import { MARKETPLACE_CATALOG } from '../../../../plugins/marketplace/catalog';

export interface DefaultExtensionsGateViewModel {
  /** O escritório ainda tem extensões padrão a receber, e quem entrou pode instalá-las. */
  active: boolean;
  /** Quantas já entraram nesta passada, e o total da passada — para "2 de 5". */
  done: number;
  total: number;
  /** O nome da extensão sendo instalada agora. */
  currentName: string;
  /** A falha da extensão atual, esperando "tentar de novo" ou "continuar sem ela". */
  failure: { name: string; params: Record<string, string> } | null;
  retry: () => void;
  skip: () => Promise<void>;
}

const BUILTIN_BY_ID = new Map<string, MarketplacePlugin>(
  MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.id, plugin]),
);

const publicInput = (entry: PublicExtension): InstallExtensionInput => ({
  package: entry.package,
  source: 'public',
  version: entry.version,
  authorId: entry.publishedBy,
  authorName: entry.ownerName,
  authorPhotoURL: entry.ownerPhotoURL,
});

const builtinInput = (plugin: MarketplacePlugin): InstallExtensionInput => ({
  package: plugin,
  source: 'builtin',
  version: plugin.manifest.version,
  authorId: '',
  authorName: plugin.manifest.publisher?.name ?? 'Microteia',
  authorPhotoURL: null,
});

/**
 * Instala, na primeira entrada de um escritório novo, as extensões PADRÃO que o servidor fixou para ele
 * (`extension_onboarding/defaults`). Pela MESMA porta da tela de Extensões (`install`), que é onde moram
 * as recusas de dependência, de prefixo e de colisão — uma segunda porta divergiria delas.
 *
 * Uma instalação por rodada, e não um laço: `install` decide com as extensões que o store conhece NA
 * renderização em que foi criada, então a segunda instalação de um mesmo laço não enxergaria a primeira
 * e recusaria a dependência que acabou de entrar. A rodada seguinte nasce quando o store e a lista mudam.
 *
 * A dependência EMBUTIDA (que viaja no bundle, e por isso nunca está na lista do servidor) entra numa
 * rodada própria, antes de quem depende dela.
 */
export const useDefaultExtensionsGateViewModel = (): DefaultExtensionsGateViewModel => {
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();
  const { installed, isLoading: installedLoading, install } = useInstalledExtensions();
  const { publicExtensions, isLoading: catalogLoading } = usePublicExtensions();
  const { extensionOnboardingRepository } = useDI();

  const tenantId = currentTenant?.id ?? null;
  const canManage = can(PERMISSION_EXTENSIONS_MANAGE);

  const [onboarding, setOnboarding] = useState<{ tenantId: string; state: DefaultExtensionsOnboarding | null } | null>(null);
  // Um CONJUNTO, e não um contador: a mesma extensão concluída duas vezes (a resposta do servidor
  // chegando entre duas rodadas) não pode fazer o "2 de 5" pular.
  const [settled, setSettled] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<{ id: string; params: Record<string, string> } | null>(null);
  const running = useRef<string | null>(null);
  /**
   * Avança a cada rodada concluída. `install` atualiza o store ANTES de devolver, e a renderização que
   * isso provoca encontra a rodada ainda em curso — sem um estado que mude depois de ela acabar, a
   * rodada que só instalou a dependência embutida não teria quem chamasse a seguinte.
   */
  const [round, setRound] = useState(0);

  const subscribe = useMemo(
    () => makeSubscribeDefaultExtensionsOnboardingUseCase(extensionOnboardingRepository),
    [extensionOnboardingRepository],
  );
  const settleUseCase = useMemo(
    () => makeSettleDefaultExtensionUseCase(extensionOnboardingRepository),
    [extensionOnboardingRepository],
  );

  useEffect(() => {
    if (!tenantId) return undefined;
    return subscribe.execute(
      tenantId,
      (state) => setOnboarding({ tenantId, state }),
      (error) => console.error('[defaultExtensions] onboarding:', error.message),
    );
  }, [tenantId, subscribe]);

  // Só vale a lista do escritório CORRENTE: na troca de escritório, a do anterior não pode decidir nada.
  const pending = useMemo(
    () => (onboarding !== null && onboarding.tenantId === tenantId ? onboarding.state?.pending ?? [] : []),
    [onboarding, tenantId],
  );
  const current = pending[0] ?? null;
  const active = canManage && current !== null;

  const catalogPackages = useMemo(() => publicExtensions.map((entry) => entry.package), [publicExtensions]);
  const catalog = usePackageCatalog(catalogPackages);
  const nameOf = useCallback((id: string) => {
    const pkg = publicExtensions.find((entry) => entry.domain === id)?.package ?? BUILTIN_BY_ID.get(id);
    return (pkg ? resolveLabel(catalog, pkg.manifest.name) : '') || id;
  }, [publicExtensions, catalog]);

  const settle = useCallback(async (id: string, outcome: 'installed' | 'deferred') => {
    if (!tenantId) return;
    await settleUseCase.execute(tenantId, id, outcome);
    setSettled((previous) => new Set(previous).add(id));
  }, [tenantId, settleUseCase]);

  useEffect(() => {
    if (!active || current === null || installedLoading || catalogLoading || failure !== null) return;
    if (running.current === current) return;
    running.current = current;

    const step = async (): Promise<void> => {
      if (installed.some((extension) => extension.id === current)) {
        await settle(current, 'installed');
        return;
      }
      const entry = publicExtensions.find((candidate) => candidate.domain === current);
      // Saiu do catálogo depois de o escritório nascer: não há o que instalar, nem decisão a pedir.
      if (!entry || entry.status !== 'approved') {
        await settle(current, 'deferred');
        return;
      }
      const builtinDependency = Object.keys(entry.package.manifest.dependencies ?? {})
        .find((id) => !id.startsWith(KERNEL_PLUGIN_PREFIX)
          && BUILTIN_BY_ID.has(id)
          && !installed.some((extension) => extension.id === id));
      const builtin = builtinDependency ? BUILTIN_BY_ID.get(builtinDependency) : undefined;
      if (builtin) {
        await install(builtinInput(builtin), { acceptDependencyRanges: true });
        return;
      }
      await install(publicInput(entry), { acceptDependencyRanges: true });
      await settle(current, 'installed');
    };

    void step()
      .catch((err: unknown) => {
        console.error('[defaultExtensions] install failed:', err);
        setFailure({ id: current, params: wrappedErrorParams(err) });
      })
      .finally(() => {
        running.current = null;
        setRound((value) => value + 1);
      });
  }, [active, current, installedLoading, catalogLoading, failure, installed, publicExtensions, install, settle, round]);

  const retry = useCallback(() => setFailure(null), []);

  const skip = useCallback(async () => {
    if (!failure) return;
    await settle(failure.id, 'deferred');
    setFailure(null);
  }, [failure, settle]);

  const remaining = pending.filter((id) => !settled.has(id)).length;

  return {
    active,
    done: settled.size,
    total: settled.size + remaining,
    currentName: current ? nameOf(current) : '',
    failure: failure ? { name: nameOf(failure.id), params: failure.params } : null,
    retry,
    skip,
  };
};
