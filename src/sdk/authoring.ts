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
    /**
     * A fonte inline. Use `sourceFile` em vez dela; declarar as duas é erro, não precedência.
     *
     * Aceita uma LISTA pelo mesmo motivo que `sourceFile`, e com as mesmas regras: é a forma que os
     * plugins deste repositório usam, onde a fonte chega por `?raw` já como texto.
     */
    source?: string | string[];
    /**
     * Caminho do `.tsx` com a fonte, relativo ao módulo de entrada. Trocado por `source` no build.
     *
     * Uma LISTA de caminhos é fundida, na ordem dada, num módulo só — é o que permite escrever a view
     * em MVVM (`.view.tsx`, `.viewmodel.tsx`, `.styles.tsx`) em vez de um arquivo único. O import
     * relativo entre arquivos da lista existe para o `tsc` e para o editor, e é apagado na fusão:
     * depois dela os nomes estão no mesmo escopo, e um nome de topo declarado em dois arquivos colide.
     */
    sourceFile?: string | string[];
  };

export type AuthoredPlugin =
  Omit<MarketplacePlugin, 'views' | 'startup'>
  & {
    views?: AuthoredView[];
    startup?: string | string[];
    /** Caminho do arquivo de `startup` — ou a lista a fundir —, pelo mesmo motivo de `sourceFile`. */
    startupFile?: string | string[];
  };
