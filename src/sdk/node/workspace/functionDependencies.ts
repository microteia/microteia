import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `firebase-functions` e `firebase-admin` ficam fora do workspace por padrão: são pesadas, e quem só
 * declara telas não precisa delas. Entram no instante em que existe uma function escrita aqui — e
 * `examples/` conta. O `sync` copiava `examples/backend-example/functions/` para todo workspace sem
 * declarar o que ela importa, e o `tsc` de quem nunca escreveu uma function acusava sete erros num
 * arquivo que não era dele.
 */

const FALLBACK = { 'firebase-admin': '^12.0.0', 'firebase-functions': '^6.0.0' };

/**
 * As versões que a INSTALAÇÃO usa, lidas do `package.json` das functions do pacote, e não escritas aqui:
 * a function do escritório é compilada junto com as do kernel, contra as dependências dele. Escrever à
 * mão foi o primeiro caminho, e durou um teste — `firebase-admin@^14` não satisfaz o peer de
 * `firebase-functions@6`, e o `npm install` parava com ERESOLVE. Derivar do pacote não tem como divergir.
 *
 * Recebe os candidatos a `.microteia/install` em ordem; o primeiro que responder vale.
 */
export const functionDependencies = (installs: string[]): Record<string, string> => {
  for (const install of installs) {
    try {
      const pkg = JSON.parse(readFileSync(join(install, 'functions/package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      const admin = pkg.dependencies?.['firebase-admin'];
      const functions = pkg.dependencies?.['firebase-functions'];
      if (admin !== undefined && functions !== undefined) {
        return { 'firebase-admin': admin, 'firebase-functions': functions };
      }
    } catch {
      continue;
    }
  }
  return FALLBACK;
};

const carriesSource = (directory: string): boolean => {
  try {
    return readdirSync(directory).some((name) => name.endsWith('.ts'));
  } catch {
    return false;
  }
};

/** Alguma pasta de extensão — do escritório ou de `examples/` — tem `functions/` com fonte dentro. */
export const declaresFunctions = (root: string, examplesDir: string): boolean =>
  [root, join(root, examplesDir)].some((base) => existsSync(base) && readdirSync(base, { withFileTypes: true })
    .some((entry) => entry.isDirectory()
      && entry.name !== 'node_modules'
      && carriesSource(join(base, entry.name, 'functions'))));
