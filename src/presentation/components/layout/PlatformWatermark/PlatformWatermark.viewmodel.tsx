import { useBrand, type BrandIdentity } from '../../../shared/brand/useBrand';

export type PlatformWatermarkPlacement = 'corner' | 'footer';

export interface PlatformWatermarkViewModel {
  /**
   * Só quando a instalação tem identidade própria. Na própria Microteia a marca já está no menu e na
   * tela de entrada, e repeti-la no canto seria ruído.
   */
  visible: boolean;
  /** "Powered by" só sob o cartão de entrada: no canto do workspace a assinatura fala sozinha. */
  showCaption: boolean;
  platform: BrandIdentity;
}

export const usePlatformWatermarkViewModel = (
  placement: PlatformWatermarkPlacement,
): PlatformWatermarkViewModel => {
  const brand = useBrand();
  return { visible: brand.branded, showCaption: placement === 'footer', platform: brand.platform };
};
