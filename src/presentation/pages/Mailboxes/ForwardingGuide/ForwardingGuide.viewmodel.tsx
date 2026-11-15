import { useCallback, useMemo, useState } from 'react';
import type { ForwardingRule } from '../../../../domain/schema/mailbox';
import { useT } from '../../../shared/i18n/useT';

export const FORWARDING_PROVIDERS = ['gmail', 'outlook', 'other'] as const;
export type ForwardingProvider = typeof FORWARDING_PROVIDERS[number];

export interface ForwardingGuideViewModel {
  tabs: Array<{ provider: ForwardingProvider; label: string }>;
  provider: ForwardingProvider;
  setProvider: (provider: ForwardingProvider) => void;
  /** A busca do Gmail; null quando as automações aceitam qualquer e-mail. */
  gmailQuery: string | null;
  /** Os termos, prontos para colar numa regra que pede um por vez — vazio: a dimensão não restringe. */
  senders: string;
  subjects: string;
  acceptsAnything: boolean;
}

/**
 * O passo a passo é por serviço porque a regra de encaminhamento é do serviço da pessoa, não nossa. O que
 * entra nele — a busca e os termos — vem pronto do servidor (`MailboxView.forwardingRule`).
 */
export const useForwardingGuideViewModel = (rule: ForwardingRule | null): ForwardingGuideViewModel => {
  const t = useT('core.automation');
  const [provider, setProviderState] = useState<ForwardingProvider>('gmail');
  const setProvider = useCallback((next: ForwardingProvider) => setProviderState(next), []);

  return useMemo(() => {
    const senders = rule?.senders ?? [];
    const subjects = rule?.subjects ?? [];
    const labels: Record<ForwardingProvider, string> = {
      gmail: t('mailbox.guide.provider.gmail'),
      outlook: t('mailbox.guide.provider.outlook'),
      other: t('mailbox.guide.provider.other'),
    };
    return {
      tabs: FORWARDING_PROVIDERS.map((one) => ({ provider: one, label: labels[one] })),
      provider,
      setProvider,
      gmailQuery: rule?.gmailQuery ?? null,
      senders: senders.join(', '),
      subjects: subjects.join(', '),
      acceptsAnything: !rule?.gmailQuery,
    };
  }, [provider, setProvider, rule, t]);
};
