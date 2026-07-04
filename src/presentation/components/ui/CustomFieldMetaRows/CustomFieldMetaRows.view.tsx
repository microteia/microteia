import React from 'react';
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
          <S.Value>{item.value}</S.Value>
        </S.Row>
      ))}
    </S.Container>
  );
};
