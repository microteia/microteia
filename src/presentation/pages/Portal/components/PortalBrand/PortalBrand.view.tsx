import React from 'react';
import { S } from './PortalBrand.styles';

export interface PortalBrandProps {
  name: string;
  logoURL: string | null;
  onClick: () => void;
}

/** A marca do escritório: o logo (ou a inicial) e o nome — uma vez só, e leva à página inicial. */
export const PortalBrand: React.FC<PortalBrandProps> = ({ name, logoURL, onClick }) => (
  <S.Brand type="button" onClick={onClick}>
    <S.Mark>{logoURL ? <S.Logo src={logoURL} alt="" /> : (name.trim()[0] ?? '').toUpperCase()}</S.Mark>
    <S.Name>{name}</S.Name>
  </S.Brand>
);
