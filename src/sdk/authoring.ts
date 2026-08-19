import type { MarketplacePlugin, ViewModuleTemplate } from '../domain/entities/MarketplacePlugin';

/**
 * O pacote como o AUTOR o escreve — diferente do que a plataforma instala em um ponto só: a fonte de
 * uma view pode ser apontada por ARQUIVO, e o compilador a substitui pelo conteúdo.
 *
 * Existe porque uma view dentro de um template literal não passa pelo `tsc` nem pelo ESLint, não pode
 * conter crase e não tem autocomplete — o autor escreve às cegas justamente o código que mais precisa
 * de ajuda. Como arquivo, ela é checada como qualquer outro `.tsx`.
 */
export type AuthoredView =
  Omit<ViewModuleTemplate, 'source'>
  & {
    /** A fonte inline. Use `sourceFile` em vez dela; declarar as duas é erro, não precedência. */
    source?: string;
    /** Caminho do `.tsx` com a fonte, relativo ao módulo de entrada. Trocado por `source` no build. */
    sourceFile?: string;
  };

export type AuthoredPlugin =
  Omit<MarketplacePlugin, 'views' | 'startup'>
  & {
    views?: AuthoredView[];
    startup?: string;
    /** Caminho do arquivo de `startup`, pelo mesmo motivo de `sourceFile`. */
    startupFile?: string;
  };
