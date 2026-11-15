import type { MarketplacePlugin, ScriptModuleTemplate, ViewModuleTemplate } from '../domain/entities/MarketplacePlugin';
import type { PluginMigration } from '../domain/schema/plugin/migration';

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

/**
 * A fonte de um script de SANDBOX como o autor a aponta — `scripts[]` e `migrations[]` são escritos
 * igual, porque rodam no mesmo QuickJS e obedecem à mesma proibição de módulos.
 */
export interface AuthoredScriptCode {
  /** A fonte inline. Uma LISTA é fundida pelas regras de `sourceFile`. Declarar as duas é erro. */
  sourceTs?: string | string[];
  /**
   * Caminho do `.ts` do script, relativo ao módulo de entrada. Trocado por `sourceTs` no build.
   *
   * Uma LISTA é fundida, na ordem dada, num texto só — é o que permite tirar a decisão que pode estar
   * errada para um arquivo puro, com teste ao lado. O ÚLTIMO arquivo é o que roda (`main()`); os
   * anteriores só declaram, e o `export` que eles têm para o `tsc` e para o teste sai na fusão, junto
   * com o import relativo entre os arquivos. Import de qualquer outra coisa é recusado: o sandbox não
   * resolve módulo.
   */
  sourceFile?: string | string[];
}

/**
 * Um script como o autor o escreve. `compiledJs` sai do compilador, com o transpilador da plataforma —
 * escrevê-lo à mão só é aceito ao lado de um `sourceTs` de texto único, a forma que já existia.
 */
export type AuthoredScript =
  Omit<ScriptModuleTemplate, 'sourceTs' | 'compiledJs'>
  & AuthoredScriptCode
  & { compiledJs?: string };

/** Uma migração como o autor a escreve. Ela viaja só com `sourceTs`: o escritório transpila. */
export type AuthoredMigration = Omit<PluginMigration, 'sourceTs'> & AuthoredScriptCode;

export type AuthoredPlugin =
  Omit<MarketplacePlugin, 'views' | 'startup' | 'scripts' | 'migrations'>
  & {
    views?: AuthoredView[];
    scripts?: AuthoredScript[];
    migrations?: AuthoredMigration[];
    startup?: string | string[];
    /** Caminho do arquivo de `startup` — ou a lista a fundir —, pelo mesmo motivo de `sourceFile`. */
    startupFile?: string | string[];
  };
