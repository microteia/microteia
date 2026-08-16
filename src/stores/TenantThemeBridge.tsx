import React, { useCallback, useEffect, useMemo } from 'react';
import {
  AUTOMATIC_THEME,
  THEME_DEFINITION_POINT,
  THEME_TOKENS_POINT,
  themeSpecsOf,
  themeTokenBundlesOf,
} from '../domain/schema/theme';
import { useContributions } from './useKernel';
import { RESERVED_THEME_IDS } from '../plugins/themes/systemThemes';
import { useSettings } from './useSettings';
import { useThemeSource } from './useThemeSource';

const STORAGE_KEY = 'microteia:theme';

const THEME_SETTING_KEY = 'theme.selected';

/**
 * Leva a aparência do ESCRITÓRIO até o provedor do topo.
 *
 * Ele vive dentro do host de plugins do escritório — é o único ponto da árvore que enxerga os temas
 * INSTALADOS — e dentro do store de configurações, que é onde a escolha mora. Empurra os dois para
 * cima, no mesmo gesto do `FieldRulePresetBridge`: quem precisa da resposta está acima de quem a
 * tem, e um segundo provedor de estilo aqui embaixo deixaria o fundo da página pintado pelo tema de
 * cima.
 *
 * Ao desmontar, publica `null` e a aparência volta ao que vale sem escritório — que é o certo ao
 * sair da conta ou trocar de escritório: um tema instalado noutro lugar não pode continuar no ar.
 */
export const TenantThemeBridge: React.FC = () => {
  const themeContributions = useContributions(THEME_DEFINITION_POINT);
  const tokenContributions = useContributions(THEME_TOKENS_POINT);
  const { values, setValue } = useSettings();
  const source = useThemeSource();

  const specs = useMemo(() => themeSpecsOf(themeContributions, RESERVED_THEME_IDS), [themeContributions]);
  const bundles = useMemo(() => themeTokenBundlesOf(tokenContributions), [tokenContributions]);

  const preferred = useMemo(() => {
    const stored = values.user[THEME_SETTING_KEY] ?? values.tenant[THEME_SETTING_KEY];
    if (typeof stored !== 'string' || stored.trim() === '') return null;
    return stored.trim();
  }, [values]);

  /**
   * Escolher grava na preferência PESSOAL. O escopo do escritório continua editável em
   * Configurações, e é o padrão de quem nunca escolheu — mas um clique na barra lateral é de quem
   * clicou, e não pode mudar a tela de todo mundo.
   */
  const save = useCallback((id: string) => {
    void setValue('user', THEME_SETTING_KEY, id);
  }, [setValue]);

  const publish = source?.publish;

  useEffect(() => {
    if (!publish) return;
    publish({ specs, bundles, preferred, save });
    return () => publish(null);
  }, [publish, specs, bundles, preferred, save]);

  /**
   * O espelho no navegador é o que faz `/license` e `/login` obedecerem à escolha de quem configurou:
   * a licença abre em ABA NOVA e sequer compartilha a árvore de componentes, então o `localStorage` é
   * o único canal que as duas pontas enxergam.
   *
   * O espelho é FIEL, inclusive ao apagar: sem configuração gravada — ou com "Automático" escolhido —
   * o valor é removido, em vez de ficar para trás mandando numa tela que ninguém mais configura.
   *
   * O sentido é só um: configuração → navegador. O `localStorage` é memória, não fonte de verdade.
   */
  useEffect(() => {
    if (preferred === null || preferred === AUTOMATIC_THEME) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preferred);
  }, [preferred]);

  return null;
};
