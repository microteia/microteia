import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { buildExtensionTypeDefs } from './extensionTypeDefs';

/**
 * A API curada é uma BIBLIOTECA de tipos, e o defeito que ela pode ter não é de sintaxe: é um nome que
 * não resolve. Um `React.HTMLAttributes` escrito dentro do bloco de `styled-components` — que não
 * importava namespace nenhum — não aparece como erro em lugar nenhum: o tipo vira `any`, todo
 * `styled.div` passa a aceitar qualquer coisa e o `theme` para de completar no editor do autor. O
 * `skipLibCheck` de qualquer projeto que a consuma esconde exatamente isso, e foi o que aconteceu.
 *
 * Este teste compila a declaração com `skipLibCheck: false`, que é a única forma de ver essa classe de
 * erro, e compila junto um arquivo de estilos como o autor escreve para cobrar o EFEITO: um token de
 * tema que não existe tem de ser reprovado. Se `theme` voltar a ser `any`, é essa expectativa que cai.
 *
 * O `tsconfig.extsrc.json` guarda a outra ponta, sobre as nossas próprias views; `viewSources.test.ts`
 * cobra que ele continue sem `skipLibCheck`.
 */
const ROOT = '/microteia';
const HOST_TYPES = `${ROOT}/microteia-host.d.ts`;
const SAMPLE = `${ROOT}/Sample.styles.tsx`;

const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  types: [],
  strict: true,
  // Iguais ao `tsconfig.json` do workspace de extensão: a fonte de uma view nasce como JavaScript.
  noImplicitAny: false,
  strictNullChecks: false,
  noEmit: true,
  skipLibCheck: false,
  paths: {
    '@microteia/*': [HOST_TYPES],
    react: [HOST_TYPES],
    'react/jsx-runtime': [HOST_TYPES],
    'styled-components': [HOST_TYPES],
  },
};

/** O diretório da `lib` do próprio TypeScript, que é o único arquivo que este host lê de verdade. */
const libDirectory = (): string => ts.getDefaultLibFilePath(OPTIONS).replace(/[^/\\]+$/, '');

/**
 * Reaproveitada entre as compilações: fazer o parse de `lib.dom.d.ts` é o que custa aqui — a API
 * curada em si é pequena —, e sem este cache cada caso deste arquivo paga o preço inteiro de novo.
 */
const libCache = new Map<string, ts.SourceFile | undefined>();

const diagnose = (source: string): string[] => {
  const files: Record<string, string> = {
    [HOST_TYPES]: buildExtensionTypeDefs(),
    [SAMPLE]: source,
  };
  const read = (name: string): string | undefined => files[name] ?? ts.sys.readFile(name);

  const host: ts.CompilerHost = {
    fileExists: (name) => name in files || ts.sys.fileExists(name),
    directoryExists: (name) => name === ROOT || ts.sys.directoryExists(name),
    readFile: read,
    getSourceFile: (name, languageVersion) => {
      const parse = (): ts.SourceFile | undefined => {
        const text = read(name);
        return text === undefined ? undefined : ts.createSourceFile(name, text, languageVersion, true);
      };
      if (name in files) return parse();
      if (!libCache.has(name)) libCache.set(name, parse());
      return libCache.get(name);
    },
    getDefaultLibFileName: () => ts.getDefaultLibFilePath(OPTIONS),
    getDefaultLibLocation: libDirectory,
    getCurrentDirectory: () => ROOT,
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    writeFile: () => {},
  };

  const program = ts.createProgram([SAMPLE], OPTIONS, host);
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    const where = diagnostic.file?.fileName === HOST_TYPES ? 'microteia-host.d.ts: ' : '';
    return `${where}${message}`;
  });
};

const OPEN = '${';

const styles = (declarations: string): string => `import { styled } from 'styled-components';

export const Badges = styled.div\`
  display: flex;
${declarations}
\`;
`;

describe('a API curada que o autor de extensão importa', { timeout: 60_000 }, () => {
  it('não tem um nome que deixa de resolver — o que faria o tipo virar `any` em silêncio', () => {
    expect(
      diagnose('export const nothing = 1;\n'),
      'nomes que não resolvem DENTRO de microteia-host.d.ts',
    ).toEqual([]);
  });

  it('tipa o tema num arquivo de estilos separado, que é onde o autor escreve os styled', () => {
    const source = `${styles([
      `  gap: ${OPEN}({ theme }) => theme.spacing.xs};`,
      `  color: ${OPEN}({ theme }) => theme.colors.primary};`,
      `  border-radius: ${OPEN}({ theme }) => theme.borderRadius.md};`,
      `  font-size: ${OPEN}({ theme }) => theme.fontSizes.sm};`,
      `  transition: all ${OPEN}({ theme }) => theme.transitions.fast};`,
    ].join('\n'))}
export const Tag = styled.span<{ $color: string }>\`
  background: ${OPEN}({ $color }) => $color};
\`;
`;
    expect(diagnose(source)).toEqual([]);
  });

  /** Guarda que não dispara é pior que guarda nenhuma: com `theme` como `any`, nada aqui reprovaria. */
  it('e reprova um token de tema que não existe', () => {
    const errors = diagnose(styles(`  gap: ${OPEN}({ theme }) => theme.spacing.enormous};`));
    expect(errors.join('\n')).toContain("Property 'enormous' does not exist");
  });

  it('a paleta, ao contrário, é aberta — a cor que uma extensão instalada contribui não é erro', () => {
    expect(diagnose(styles(`  color: ${OPEN}({ theme }) => theme.colors.caseStatusWon};`))).toEqual([]);
  });
});
