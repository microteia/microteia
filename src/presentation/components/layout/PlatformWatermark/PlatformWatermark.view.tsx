import React from 'react';
import { usePlatformWatermarkViewModel, type PlatformWatermarkPlacement } from './PlatformWatermark.viewmodel';
import { S } from './PlatformWatermark.styles';
import { useT } from '../../../shared/i18n/useT';

interface PlatformWatermarkProps {
  /** `corner`: fixa no canto do workspace. `footer`: no fluxo, sob o cartão da tela de entrada. */
  placement: PlatformWatermarkPlacement;
}

/**
 * A plataforma que executa a instalação. Não recebe clique de propósito: é assinatura, e no canto do
 * workspace ela fica SOBRE o conteúdo — capturar o ponteiro ali tomaria o clique do botão de baixo.
 */
export const PlatformWatermark: React.FC<PlatformWatermarkProps> = ({ placement }) => {
  const vm = usePlatformWatermarkViewModel(placement);
  const t = useT('core.ui');

  if (!vm.visible) return null;

  return (
    <S.Container $placement={placement} aria-hidden="true">
      {vm.showCaption && <S.Caption>{t('platform.powered-by')}</S.Caption>}
      <S.Identity>
        <S.Logo src={vm.platform.logo} alt="" />
        <S.Text>
          <S.Name>{vm.platform.name}</S.Name>
          <S.Tagline>{vm.platform.tagline}</S.Tagline>
        </S.Text>
      </S.Identity>
    </S.Container>
  );
};
