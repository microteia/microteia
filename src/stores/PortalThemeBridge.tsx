import React, { useEffect, useMemo } from 'react';
import {
  THEME_DEFINITION_POINT,
  THEME_TOKENS_POINT,
  themeSpecsOf,
  themeTokenBundlesOf,
} from '../domain/schema/theme';
import { sortContributions } from '../domain/schema/plugin/contribution';
import type { QualifiedContribution } from '../domain/schema/plugin/contribution';
import { useContributions } from './useKernel';
import { RESERVED_THEME_IDS } from '../plugins/themes/systemThemes';
import { usePortal } from './usePortal';
import { useThemeSource } from './useThemeSource';

/**
 * Leva os temas INSTALADOS no escritório até o provedor do topo, no portal.
 *
 * É o `TenantThemeBridge` de quem é de fora. O convidado não lê as extensões instaladas, então os
 * temas chegam pelo servidor, junto com o contexto (`getPortalContext`), e somam-se aos embutidos no
 * bundle na mesma ordem do registro que o host do escritório aplica.
 *
 * A escolha continua no navegador: o convidado não lê nem grava as configurações do escritório, e
 * por isso a fonte publicada não tem opinião (`preferred` indefinido) nem lugar de gravação.
 */
export const PortalThemeBridge: React.FC = () => {
  const { context } = usePortal();
  const bundledThemes = useContributions(THEME_DEFINITION_POINT);
  const bundledTokens = useContributions(THEME_TOKENS_POINT);
  const source = useThemeSource();

  const installed = context?.themes;

  const themes = useMemo(() => {
    if (!installed || installed.length === 0) return null;
    const ofPoint = (point: string): QualifiedContribution[] =>
      installed.filter((contribution) => contribution.point === point);
    return {
      specs: themeSpecsOf(sortContributions([...bundledThemes, ...ofPoint(THEME_DEFINITION_POINT)]), RESERVED_THEME_IDS),
      bundles: themeTokenBundlesOf(sortContributions([...bundledTokens, ...ofPoint(THEME_TOKENS_POINT)])),
    };
  }, [installed, bundledThemes, bundledTokens]);

  const publish = source?.publish;

  useEffect(() => {
    if (!publish || !themes) return;
    publish({ ...themes, preferred: undefined });
    return () => publish(null);
  }, [publish, themes]);

  return null;
};
