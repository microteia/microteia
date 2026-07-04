import React from 'react';
import { Badge } from '../Badge';
import { S } from './CustomFieldMetaRows.styles';
import type { CustomFieldCardItem } from '../../../hooks/useCustomFieldListing';

interface CustomFieldMetaRowsProps {
  items: CustomFieldCardItem[];
}

export const CustomFieldMetaRows: React.FC<CustomFieldMetaRowsProps> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <S.Container>
      {items.map((item) => (
        <S.Row key={item.key}>
          <S.Label>{item.label}:</S.Label>
          {item.badges && item.badges.length > 0 ? (
            <S.BadgeWrap>
              {item.badges.map((badge, index) => (
                <Badge key={`${item.key}-${index}`} color={badge.color}>{badge.label}</Badge>
              ))}
            </S.BadgeWrap>
          ) : (
            <S.Value>{item.value}</S.Value>
          )}
        </S.Row>
      ))}
    </S.Container>
  );
};
