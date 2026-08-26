/**
 * A FUSÃO de uma fonte composta: várias partes entram, o módulo único que o runtime avalia sai.
 *
 * Mora aqui, e não dentro do compilador do SDK, porque os DOIS lados precisam dela pela mesma razão. O
 * compilador funde ao gravar o `.json` do autor; o catálogo EMBUTIDO deste repositório funde ao declarar
 * a view, porque ele entrega o pacote direto ao runtime do browser — sem terminal, sem `.json`, sem
 * compilador. Duas implementações da mesma fusão seriam duas formas de o mesmo pacote sair diferente.
 *
 * O que NÃO mora aqui é o que depende de quem chama: resolver um caminho relativo (só o compilador tem
 * sistema de arquivos) e conferir que o resultado compila (o transpilador é de quem chama). Os dois
 * entram como gancho, e a ausência de cada um é uma checagem a menos, nunca uma fusão diferente.
 */

export interface MergeHooks {
  /** Resolve o import relativo de uma parte que veio de ARQUIVO, devolvendo o caminho absoluto. */
  resolveRelative?: (part: SourcePart, specifier: string) => string | null;
  /** Confere que o módulo fundido compila — o único defeito que a fusão INVENTA. */
  assertCompiles?: (source: string, what: string) => void;
}

/**
 * Uma parte da fonte: o nome que a mensagem de erro cita e o texto.
 *
 * `absolute` é nulo quando a parte veio como TEXTO — o caminho `?raw`, que entrega o conteúdo e não o
 * arquivo. É a única diferença entre as duas formas, e ela muda uma checagem só: sem arquivo, a fusão
 * confere o import relativo pelos NOMES que ele traz, não pelo caminho a que ele aponta.
 */
export interface SourcePart {
  declared: string;
  absolute: string | null;
  text: string;
}

/** Uma parte que já é texto. Sem arquivo, o índice é o único nome honesto que ela tem. */
export const rawPart = (text: string, index: number): SourcePart => ({
  declared: `source[${index}]`,
  absolute: null,
  text,
});

/**
 * Um `import` inteiro — o de nomes, o de efeito colateral (`import './x';`) e o que abre a lista em
 * várias linhas. Ancorado em início e fim de LINHA: é o que impede a busca preguiçosa de varrer o
 * arquivo até um `from` distante.
 */
const IMPORT_STATEMENT = /^[ \t]*import\b(?:[\s\S]*?\bfrom)?[ \t]*(['"])([^'"]+)\1[ \t]*;?[ \t]*$/gm;

/** Declaração de valor no TOPO do arquivo — coluna zero, e sem desestruturação. */
const TOP_LEVEL_BINDING = /^(?:export[ \t]+)?(?:const|let|class)[ \t]+([A-Za-z_$][\w$]*)/gm;

const EXPORTS_DEFAULT = /^[ \t]*export[ \t]+default\b|^[ \t]*export[ \t]*\{[^}]*\bas[ \t]+default\b/m;

const blankOut = (statement: string): string => statement.replace(/[^\n]/g, '');

/**
 * O que um `import` traz para o escopo, como PAR: o nome local e a origem dele.
 *
 * A origem é o que separa repetição de colisão. Dois arquivos que importam `useMemo` de `react`
 * declaram a mesma coisa, e o `sucrase` funde os dois imports num só — não há nada a recusar. Dois
 * arquivos que dão o nome `Card` a coisas diferentes, sim: no módulo fundido só uma sobrevive.
 *
 * O local é o ÚLTIMO identificador do trecho e o importado é o PRIMEIRO, o que resolve `a as b`,
 * `* as ns` e o default de uma vez. Import de tipo fica fora: ele não cria binding em runtime, e um
 * tipo pode legitimamente ter o nome de um valor.
 */
const importedBindings = (statement: string, specifier: string): [string, string][] => {
  const from = statement.lastIndexOf('from');
  if (from < 0) return [];
  const clause = statement.slice(statement.indexOf('import') + 'import'.length, from).replace(/[{}]/g, ' ');
  if (/^\s*type\b/.test(clause)) return [];
  return clause.split(',')
    .map((piece) => piece.trim())
    .filter((piece) => !/^type\b/.test(piece))
    .map((piece) => piece.match(/[A-Za-z_$][\w$]*|\*/g) ?? [])
    .filter((tokens) => tokens.length > 0)
    .map((tokens) => [tokens[tokens.length - 1], `${specifier}#${tokens[0]}`]);
};

/**
 * Cada nome de valor que o arquivo põe no escopo do módulo, apontando para a ORIGEM dele. A origem de
 * uma declaração local carrega o arquivo: duas declarações do mesmo nome nunca são a mesma coisa.
 */
const bindingsOf = (part: SourcePart): Map<string, string> => {
  const bindings = new Map<string, string>();
  for (const [statement, , specifier] of part.text.matchAll(IMPORT_STATEMENT)) {
    if (specifier.startsWith('.')) continue;
    for (const [name, origin] of importedBindings(statement, specifier)) bindings.set(name, origin);
  }
  for (const [, name] of part.text.matchAll(TOP_LEVEL_BINDING)) {
    bindings.set(name, `local@${part.declared}`);
  }
  return bindings;
};

interface Collision {
  name: string;
  first: string;
  second: string;
}

/**
 * O preço de fundir arquivos é um escopo só. Um `const Card` em dois arquivos do mesmo conjunto é
 * erro de módulo, mas cada arquivo passa pelo `tsc` sozinho sem queixa — quem tem de recusar é a
 * fusão, e antes de gravar o pacote, não quando o escritório abrir a tela.
 */
const collisionIn = (parts: SourcePart[]): Collision | null => {
  const owner = new Map<string, { origin: string; declared: string }>();
  for (const part of parts) {
    for (const [name, origin] of bindingsOf(part)) {
      const previous = owner.get(name);
      if (previous !== undefined && previous.origin !== origin) {
        return { name, first: previous.declared, second: part.declared };
      }
      owner.set(name, { origin, declared: part.declared });
    }
  }
  return null;
};

/** Os nomes que o arquivo DECLARA no topo — o que a fusão põe no escopo comum. */
const declaredNames = (part: SourcePart): string[] =>
  [...part.text.matchAll(TOP_LEVEL_BINDING)].map(([, name]) => name);

/**
 * Apaga os imports RELATIVOS, preservando as quebras de linha para que a numeração de cada arquivo
 * sobreviva à fusão. Um import relativo que aponte para fora do conjunto é erro: o runtime não
 * resolve import nenhum, e hoje isso só aparecia ao abrir a tela.
 *
 * Como se sabe que ele aponta para fora depende da forma da parte. Vindo de ARQUIVO, pelo caminho. Vindo
 * de TEXTO (`?raw`), pelos NOMES: se o import traz `useTally` e nenhuma parte do conjunto declara
 * `useTally`, falta um `?raw` na lista — e é esse o esquecimento que o `?raw` convida a cometer.
 */
const dropMergedImports = (
  part: SourcePart,
  merged: Set<string>,
  declared: Set<string>,
  what: string,
  resolveRelative: MergeHooks['resolveRelative'],
): string =>
  part.text.replace(IMPORT_STATEMENT, (statement, _quote: string, specifier: string) => {
    if (!specifier.startsWith('.')) return statement;
    if (part.absolute === null) {
      for (const [name] of importedBindings(statement, specifier)) {
        if (!declared.has(name)) {
          throw new Error(
            `${what}: "${part.declared}" imports "${name}" from "${specifier}", which no merged source`
            + ' declares. The runtime resolves no relative import — merge the source that declares it.',
          );
        }
      }
      return blankOut(statement);
    }
    const target = resolveRelative === undefined ? null : resolveRelative(part, specifier);
    if (target === null || !merged.has(target)) {
      throw new Error(
        `${what}: "${part.declared}" imports "${specifier}", which is not one of the merged files.`
        + ' The runtime resolves no relative import — list the file, or inline what you need.',
      );
    }
    return blankOut(statement);
  });

/**
 * Funde os arquivos de uma fonte composta num módulo só, na ordem declarada.
 *
 * O pacote instalado continua carregando UM texto por view, porque o runtime avalia um módulo por view
 * e o `require` dele só resolve a API curada. A lista é comodidade de AUTORIA: cada arquivo é checado
 * pelo `tsc` como qualquer outro `.tsx`, e a view pode ser escrita em MVVM em vez de caber num arquivo.
 *
 * A marca com o nome do arquivo fica no texto de propósito: é um administrador do escritório que lê
 * essa fonte antes de confiar nela, e uma fusão sem costura visível é uma parede de código.
 */
export const mergeSources = (parts: SourcePart[], what: string, hooks: MergeHooks = {}): string => {
  const absolutes = new Set<string>();
  for (const part of parts) {
    if (part.absolute === null) continue;
    if (absolutes.has(part.absolute)) throw new Error(`${what}: "${part.declared}" is listed twice.`);
    absolutes.add(part.absolute);
  }

  const defaults = parts.filter((part) => EXPORTS_DEFAULT.test(part.text));
  if (defaults.length !== 1) {
    const which = defaults.map((part) => `"${part.declared}"`).join(', ');
    throw new Error(
      defaults.length === 0
        ? `${what}: none of the merged sources has a default export.`
        : `${what}: ${which} each have a default export — the merged module can only have one.`,
    );
  }

  const collision = collisionIn(parts);
  if (collision !== null) {
    throw new Error(
      `${what}: "${collision.name}" is declared in both "${collision.first}" and "${collision.second}".`
      + ' Merged sources share one scope, so every top-level name has to be unique across the list.',
    );
  }

  const declared = new Set(parts.flatMap(declaredNames));
  const bodies = parts.map((part) => dropMergedImports(part, absolutes, declared, what, hooks.resolveRelative));
  const merged = parts.length === 1
    ? bodies[0]
    : bodies.map((body, index) => `// --- ${parts[index].declared} ---\n${body}`).join('\n');

  hooks.assertCompiles?.(merged, what);
  return merged;
};

/**
 * A fusão como o catálogo embutido a declara: um arquivo por chave, na ordem em que estão escritos, e o
 * nome do arquivo é o que a costura mostra a quem revisa a fonte antes de confiar nela.
 *
 * `Record` e não lista porque a ordem de inserção do objeto já é a ordem da fusão, e o nome do arquivo
 * fica ao lado do texto dele em vez de num índice que ninguém confere.
 */
export const mergeViewSources = (files: Record<string, string>, what = 'View source'): string => {
  const parts = Object.entries(files).map(([declared, text]) => ({ declared, absolute: null, text }));
  if (parts.length === 0) throw new Error(`${what}: the source list is empty.`);
  return mergeSources(parts, what);
};
