import React from 'react';
import { S } from './ExtensionBadge.styles';
import { useT } from '../../../shared/i18n/useT';

interface ExtensionBadgeProps {
  owner: string | null;
}

export const ExtensionBadge: React.FC<ExtensionBadgeProps> = ({ owner }) => {
  const t = useT('core.records');
  if (!owner) return null;
  return <S.Badge title={owner}>{t('badge.extension')}</S.Badge>;
};
