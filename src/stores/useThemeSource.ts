import { createContext, useContext } from 'react';
import type { ThemeSpec, ThemeTokenBundle } from '../domain/schema/theme';

/**
 * Tudo o que decide a aparência, vindo de UM lugar do sistema.
 *
 * Existe porque as duas metades da resposta nascem fundo na árvore — os temas instalados vêm do host
 * de plugins do escritório, a preferência vem da configuração do usuário — e a aparência tem de
 * valer no topo, onde ficam o `body`, a barra de rolagem e as telas públicas. Aninhar um segundo
 * provedor de estilo, como se faz com o idioma, deixaria o `GlobalStyles` de cima pintando o fundo
 * com o tema errado: ele lê o tema da posição dele, não da de baixo.
 */
export interface ThemeSource {
  specs: ThemeSpec[];
  bundles: ThemeTokenBundle[];
  /** `null` = nada gravado em escopo nenhum; `automatic` = escolheu seguir o aparelho. */
  preferred: string | null;
  /**
   * Onde uma escolha nova é gravada dentro do escritório: a configuração pessoal.
   *
   * Sem isto, escolher pela barra lateral gravaria só no navegador e a configuração continuaria
   * mandando no render seguinte — o clique voltaria atrás sozinho, na frente de quem clicou. Há um
   * lugar só para a resposta, e todos os gestos escrevem nele.
   */
  save: (id: string) => void;
}

export interface ThemeSourceContextValue {
  publish: (source: ThemeSource | null) => void;
}

export const ThemeSourceContext = createContext<ThemeSourceContextValue | null>(null);

export const useThemeSource = (): ThemeSourceContextValue | null => useContext(ThemeSourceContext);
