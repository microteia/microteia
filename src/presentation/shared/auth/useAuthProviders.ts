import { useMemo } from 'react';
import { useContributions } from '../../../stores/useKernel';
import {
  AUTH_PROVIDER_POINT,
  asAuthProviderMetadata,
  type AuthProviderMetadata,
} from '../../../domain/schema/auth';
import { useLabel, useLocaleFormat } from '../i18n/useT';

export interface AuthProviderDescriptor extends AuthProviderMetadata {
  pluginId: string;
}

/**
 * Os meios de entrada que a tela de entrada oferece, na ordem declarada e com o rótulo resolvido.
 *
 * Não há conciliação com configuração aqui, e a ausência é a decisão: `/login` roda ACIMA do
 * escritório — não há tenant, não há documento de configuração e não há permissão a consultar. O que
 * decide quem aparece é o que foi DECLARADO, e é por isso que `defaultEnabled: false` é o único
 * desligamento possível: quem instala escolhe pelo que declara, não por uma caixa que só existiria
 * depois de alguém já ter entrado.
 */
export const useAuthProviders = (): AuthProviderDescriptor[] => {
  const contributions = useContributions(AUTH_PROVIDER_POINT);
  const label = useLabel();
  const { compareText } = useLocaleFormat();

  return useMemo(() => {
    const byKey = new Map<string, AuthProviderDescriptor>();
    for (const contribution of contributions) {
      const metadata = asAuthProviderMetadata(contribution.metadata);
      if (!metadata || metadata.defaultEnabled === false) continue;
      byKey.set(metadata.key, { ...metadata, pluginId: contribution.pluginId });
    }
    return Array.from(byKey.values())
      .map((provider) => ({ ...provider, label: label(provider.label) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || compareText(a.label, b.label));
  }, [contributions, label, compareText]);
};
