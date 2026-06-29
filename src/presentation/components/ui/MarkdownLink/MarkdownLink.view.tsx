import React from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { isCuratinoLink, parseCuratinoTabKey } from '../../../../infrastructure/deeplink/deepLinkUtils';
import { S } from './MarkdownLink.styles';

export interface MarkdownLinkProps {
  href?: string;
  children?: React.ReactNode;
}

export const MarkdownLink: React.FC<MarkdownLinkProps> = ({ href, children }) => {
  const { openTab } = useWorkspace();

  if (isCuratinoLink(href)) {
    const tabKey = parseCuratinoTabKey(href);
    return (
      <S.Link
        href={href}
        onClick={(e) => { e.preventDefault(); openTab(tabKey); }}
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
