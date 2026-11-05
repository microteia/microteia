/**
 * A FONTE das Cloud Functions de uma extensão, viajando dentro do pacote.
 *
 * Por que existe: `manifest.backend.functions` só leva NOMES. A extensão instalava pela tela em qualquer
 * escritório, mas só ficava no ar no projeto em que alguém tivesse posto a fonte em
 * `extensions/<pasta>/functions/` à mão — e ela ficava pendente para sempre em todos os outros.
 *
 * Por que FONTE e não JavaScript compilado: o Console já compila a function do escritório junto com as
 * do kernel, contra `microteia-functions/office`, e já mescla as dependências de cada diretório. Entregar
 * o mesmo diretório reaproveita esse caminho inteiro — e deixa legível o código que alguém vai aprovar.
 *
 * Mora no PACOTE e não no manifest pelo mesmo motivo de `views`: é código, e o manifest é o que o
 * kernel interpreta.
 *
 * Nada aqui decide se a fonte é CONFIÁVEL. Quem decide é quem opera o projeto, pelo hash, no Console —
 * a function roda com o Admin SDK e alcança todo escritório do projeto, então nenhuma procedência
 * (catálogo, publicador verificado) dispensa essa aprovação.
 */
export interface PackagedBackendSource {
  /** Caminho relativo ao diretório `functions/` da extensão -> conteúdo. */
  files: Record<string, string>;
  /** sha256, em hex, de `backendSourceCanonical(files)`. Conferido pelo Console antes de tudo. */
  hash: string;
}

// NUL não aparece em caminho nem em fonte, então a serialização é inambígua — mesma escolha do
// `extensionCodeOf` das views.
const SEPARATOR = '\u0000';

/**
 * A serialização que o hash cobre. Caminhos ORDENADOS: a mesma árvore produz sempre o mesmo hash,
 * independentemente da ordem em que o disco a listou.
 *
 * O hash em si não é calculado aqui: o navegador só teria `crypto.subtle`, que é assíncrono, e a
 * validação do pacote é síncrona. Quem calcula é quem tem `node:crypto` — o build do SDK, que o grava,
 * e o Console, que o confere. O Console redeclara esta função (é publicado sem o `src/`), e
 * `backendSource.test.ts` do lado dele confere que as duas produzem o mesmo texto.
 */
export const backendSourceCanonical = (files: Record<string, string>): string =>
  Object.keys(files)
    .sort()
    .map((path) => `${path}${SEPARATOR}${files[path]}`)
    .join(SEPARATOR);

export const BACKEND_SOURCE_INDEX = 'index.ts';

const TEST_FILE = /\.(test|spec)\.ts$/;

/**
 * O que pode viajar: `.ts` e `.json`, sem teste, sem `node_modules`, sem arquivo oculto, sem sair do
 * diretório.
 *
 * Teste fica fora pela mesma razão do `deploy`: um `import ... from 'vitest'` quebra a compilação de
 * TODAS as functions da instalação. Sair do diretório (`..`, caminho absoluto) é a recusa que importa
 * de verdade: o Console grava estes arquivos em disco, e um caminho que escapa escreveria fora da pasta
 * da extensão.
 */
export const isBackendSourcePath = (path: string): boolean => {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false;
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false;
  if (segments.some((segment) => segment.startsWith('.') || segment === 'node_modules' || segment === '__tests__')) {
    return false;
  }
  const name = segments.at(-1) ?? '';
  if (TEST_FILE.test(name)) return false;
  return name.endsWith('.ts') || name.endsWith('.json');
};

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export type BackendSourceIssueCode = 'shape' | 'path' | 'no-index' | 'undeclared';

export interface BackendSourceIssue {
  code: BackendSourceIssueCode;
  path?: string;
}

/**
 * A FORMA da fonte empacotada. O hash é conferido contra o conteúdo pelo Console, e não aqui (ver
 * `backendSourceCanonical`); um hash que não confere é recusa lá, antes de qualquer arquivo ir ao disco.
 */
export const backendSourceIssues = (
  source: unknown,
  declaredFunctions: readonly string[],
): BackendSourceIssue[] => {
  if (source === undefined) return [];
  if (typeof source !== 'object' || source === null || Array.isArray(source)) return [{ code: 'shape' }];

  const { files, hash } = source as { files?: unknown; hash?: unknown };
  if (typeof hash !== 'string' || !HASH_PATTERN.test(hash)) return [{ code: 'shape' }];
  if (typeof files !== 'object' || files === null || Array.isArray(files)) return [{ code: 'shape' }];
  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.some(([, content]) => typeof content !== 'string')) return [{ code: 'shape' }];

  const issues: BackendSourceIssue[] = entries
    .filter(([path]) => !isBackendSourcePath(path))
    .map(([path]) => ({ code: 'path', path }));
  if (!entries.some(([path]) => path === BACKEND_SOURCE_INDEX)) issues.push({ code: 'no-index' });
  // A fonte sem declaração seria código que nenhuma exigência pede: o Console nunca a subiria, e o autor
  // acharia que a extensão tem backend.
  if (declaredFunctions.length === 0) issues.push({ code: 'undeclared' });
  return issues;
};
