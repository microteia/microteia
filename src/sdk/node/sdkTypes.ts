import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * As declarações de AUTORIA, lidas do `.d.ts` que o pacote `@microteia/sdk` carrega — o equivalente de
 * `hostTypes.ts` para o outro lado do contrato.
 *
 * `hostTypes.ts` serve o que uma VIEW pode importar; isto serve a forma do PACOTE. E era o lado sem
 * nenhuma porta: o `tsconfig.sdk.json` emite com `removeComments`, então quem escreve extensão recebe
 * `TemplateField`, `WorkflowStep` e `WidgetSpec` sem uma linha de explicação — e, sem uma ferramenta
 * que as leia, sem sequer saber quais propriedades existem a não ser abrindo `node_modules` à mão.
 *
 * A lista de símbolos sai do BARRIL (`lib/sdk/index.d.ts`), e não de uma varredura do diretório: o
 * barril é a superfície declarada, e o que ele não reexporta é interno mesmo morando no mesmo pacote.
 */

/** A raiz do pacote instalado — o diretório que contém `lib/sdk/index.d.ts`. */
export const sdkTypesRoot = (root: string): string | null => {
  const candidates = [
    join(root, 'node_modules/@microteia/sdk'),
    join(root, '../.microteia/install/sdk'),
    // Relativo a ESTE módulo, nos dois formatos: compilado (`sdk/lib/sdk/node/`) e fonte
    // (`src/sdk/node/`, cuja raiz do repositório tem `sdk/` gerado ao lado).
    resolve(__dirname, '../../..'),
    resolve(__dirname, '../../..', 'sdk'),
  ];
  return candidates.find((candidate) => existsSync(join(candidate, 'lib/sdk/index.d.ts'))) ?? null;
};

const BARREL_EXPORT = /export\s+(?:type\s+)?\{([^}]*)\}/gs;

/** Os símbolos que o barril publica, tipos e runtime na mesma lista — é como o autor os escreve. */
export const sdkSurfaceNames = (sdkRoot: string): string[] => {
  const barrel = readFileSync(join(sdkRoot, 'lib/sdk/index.d.ts'), 'utf8');
  const names = [...barrel.matchAll(BARREL_EXPORT)]
    .flatMap((match) => match[1].split(','))
    .map((entry) => entry.trim().split(/\s+as\s+/).pop()?.trim() ?? '')
    .filter((name) => name !== '');
  return [...new Set(names)].sort();
};

const declarationFiles = (dir: string, depth = 6): string[] => {
  if (depth < 0 || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return declarationFiles(path, depth - 1);
    return entry.name.endsWith('.d.ts') ? [path] : [];
  });
};

/**
 * Recorta a declaração inteira a partir do ponto em que ela começa.
 *
 * `interface`/`class`/`enum` fecham na chave equilibrada; `type`/`const`/`function` fecham no primeiro
 * `;` em profundidade zero — o que é o que faz uma união de objetos de várias linhas (a forma de
 * `WidgetSpec` e de `InputMapping`) sair completa em vez de cortada na primeira chave.
 */
const sliceDeclaration = (source: string, start: number): string => {
  let depth = 0;
  let seenBrace = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{' || char === '(' || char === '[') {
      depth += 1;
      seenBrace = seenBrace || char === '{';
    } else if (char === '}' || char === ')' || char === ']') {
      depth -= 1;
      if (depth === 0 && char === '}' && /\b(interface|class|enum|namespace)\b/.test(source.slice(start, index))) {
        return source.slice(start, index + 1);
      }
    } else if (char === ';' && depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
};

export interface SdkDeclaration {
  file: string;
  declaration: string;
}

/**
 * A declaração de um símbolo publicado, com o arquivo em que ela mora — o caminho vai junto porque é a
 * prova de que a resposta saiu do pacote instalado, e não da memória de quem responde.
 */
export const sdkDeclaration = (sdkRoot: string, name: string): SdkDeclaration | null => {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
  const pattern = new RegExp(`^export (?:declare )?(?:abstract )?(type|interface|class|enum|const|function|namespace) ${name}\\b`, 'm');
  for (const file of declarationFiles(join(sdkRoot, 'lib'))) {
    const source = readFileSync(file, 'utf8');
    const match = pattern.exec(source);
    if (match === null) continue;
    return {
      file: file.slice(sdkRoot.length + 1),
      declaration: sliceDeclaration(source, match.index),
    };
  }
  return null;
};

/**
 * Os símbolos PUBLICADOS que uma declaração menciona — o que faz a resposta ser útil em vez de correta.
 *
 * `TemplateField` é `Omit<FieldDefinition, 'origin'>`, e é o tipo mais usado de todos: devolvê-lo
 * sozinho responde à pergunta com outra pergunta. Uma volta de expansão põe `FieldDefinition` ao lado,
 * e em `WorkflowStep` põe `StepType`, `InputMapping` e `Condition` — que é exatamente o que quem está
 * montando um passo precisa ler junto.
 *
 * Uma volta só, e com teto: o fechamento completo de `PluginManifest` é o pacote inteiro.
 */
export const referencedSymbols = (declaration: string, published: readonly string[]): string[] => {
  const body = declaration.slice(declaration.indexOf('=') + 1);
  const mentioned = new Set([...body.matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)].map((match) => match[0]));
  const own = /^export (?:declare )?(?:abstract )?(?:type|interface|class|enum|const|function|namespace) ([A-Za-z0-9_$]+)/.exec(declaration)?.[1];
  return published.filter((name) => name !== own && mentioned.has(name));
};
