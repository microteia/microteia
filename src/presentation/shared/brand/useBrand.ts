import { useMemo } from 'react';
import { readStampedBrand } from '../../../infrastructure/boot/stampedBrand';
import { useLabel } from '../i18n/useT';

/**
 * A PLATAFORMA. É a única marca que o kernel conhece pelo nome, e não traduz em idioma nenhum: as
 * frases que a acompanham vêm do catálogo, como referência, para passar pelo mesmo `useLabel()` que
 * resolve a identidade de uma instalação.
 */
export const PLATFORM_NAME = 'Microteia';
export const PLATFORM_LOGO = '/logo.png';
const PLATFORM_TAGLINE = '@core.ui/app.tagline';
const PLATFORM_DESCRIPTION = '@core.workspace/login.tagline';

export interface BrandIdentity {
  name: string;
  tagline: string;
  description: string;
  logo: string;
}

export interface Brand extends BrandIdentity {
  /**
   * A instalação tem identidade PRÓPRIA. É o que liga a marca d'água da plataforma: quando a
   * instalação é a própria Microteia, repeti-la no canto só duplicaria o que o menu já mostra.
   */
  branded: boolean;
  /** A plataforma que executa a instalação, sempre a mesma. */
  platform: BrandIdentity;
}

export const useBrand = (): Brand => {
  const label = useLabel();

  return useMemo(() => {
    const platform: BrandIdentity = {
      name: PLATFORM_NAME,
      tagline: label(PLATFORM_TAGLINE),
      description: label(PLATFORM_DESCRIPTION),
      logo: PLATFORM_LOGO,
    };
    const stamped = readStampedBrand();
    if (stamped === null) return { ...platform, branded: false, platform };

    const tagline = stamped.tagline === null ? '' : label(stamped.tagline);
    return {
      name: label(stamped.name),
      tagline,
      description: stamped.description === null ? tagline : label(stamped.description),
      logo: stamped.logo ?? PLATFORM_LOGO,
      branded: true,
      platform,
    };
  }, [label]);
};
