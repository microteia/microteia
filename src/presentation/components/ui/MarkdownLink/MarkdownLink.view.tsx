import React from 'react';
import { useOpenLink } from '../../../shared/useOpenLink';
import { isMicroteiaLink, parseMicroteiaTabKey } from '../../../../infrastructure/deeplink/deepLinkUtils';
import { S } from './MarkdownLink.styles';

export interface MarkdownLinkProps {
  href?: string;
  children?: React.ReactNode;
}

export const MarkdownLink: React.FC<MarkdownLinkProps> = ({ href, children }) => {
  const openLink = useOpenLink();

  if (isMicroteiaLink(href)) {
    const tabKey = parseMicroteiaTabKey(href);
    return (
      <S.Link
        href={href}
        onClick={(e) => { e.preventDefault(); openLink(tabKey); }}
      >
        {children}
      </S.Link>
    );
  }

  return (
    <S.Link href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </S.Link>
  );
};

/**
 * O link de um texto que NÃO é do escritório — o de um pacote, mostrado no portal. Sempre externo, numa
 * aba nova: o atalho `microteia://` abre uma aba do escritório, que o convidado não tem.
 */
export const ExternalMarkdownLink: React.FC<MarkdownLinkProps> = ({ href, children }) => (
  <S.Link href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </S.Link>
);
