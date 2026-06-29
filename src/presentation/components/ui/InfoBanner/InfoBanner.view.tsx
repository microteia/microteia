import React from 'react';
import { S, type InfoBannerVariant } from './InfoBanner.styles';

interface InfoBannerProps {
  message: string;
  variant?: InfoBannerVariant;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({ message, variant = 'warning' }) => (
  <S.Banner $variant={variant}>{message}</S.Banner>
);
