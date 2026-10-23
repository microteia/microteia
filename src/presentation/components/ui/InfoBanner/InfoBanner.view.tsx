import React from 'react';
import { S, type InfoBannerVariant } from './InfoBanner.styles';

interface InfoBannerProps {
  message: string;
  variant?: InfoBannerVariant;
  /** De 0 a 1: desenha uma barra de andamento sob a mensagem. */
  progress?: number | null;
}

export const InfoBanner: React.FC<InfoBannerProps> = ({ message, variant = 'warning', progress = null }) => (
  <S.Banner $variant={variant}>
    {message}
    {progress !== null && (
      <S.Track>
        <S.Fill $ratio={progress} />
      </S.Track>
    )}
  </S.Banner>
);
