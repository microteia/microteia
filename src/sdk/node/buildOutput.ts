import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { findPluginFiles } from './workspacePlugins';

export const BUILD_OUT_DIR = 'dist';

/**
 * Onde o `build` grava o `.json` quando ninguém passa `--out`: no `dist/` do diretório de extensões, e
 * não ao lado do `plugin.ts`.
 *
 * Ao lado, cada artefato ficava numa pasta diferente, misturado às fontes — importar dez extensões na
 * tela era garimpar dez pastas, e o `.gitignore` precisava de um curinga `*.json` com exceções para
 * não versionar o que é gerado. Num lugar só, a importação é escolher arquivos de uma pasta, e ignorar
 * o artefato é ignorar a pasta.
 *
 * O diretório de extensões é o do `package.json` mais próximo, subindo a partir do `plugin.ts`: é ele
 * que o `plugin-init` e o `sync` semeiam, e é o mesmo para `npx microteia-plugin build push/plugin.ts`
 * na raiz ou `build plugin.ts` de dentro da pasta. Sem `package.json` acima, o `dist/` fica ao lado da
 * fonte — um `plugin.ts` solto continua compilando.
 */
export const defaultBuildOutDir = (
  entry: string,
  exists: (path: string) => boolean = existsSync,
): string => {
  const start = dirname(entry);
  const { root } = parse(start);
  for (let dir = start; ; dir = dirname(dir)) {
    if (exists(join(dir, 'package.json'))) return join(dir, BUILD_OUT_DIR);
    if (dir === root) return join(start, BUILD_OUT_DIR);
  }
};

export interface BuildTargets {
  /** Os `plugin.ts` a compilar, os do escritório primeiro e, se pedidos, os de `examples/` depois. */
  entries: string[];
  /** Quantos de `examples/` ficaram de fora — o `build --all` diz que existem e como incluí-los. */
  skippedExamples: number;
}

/**
 * O que o `build --all` compila: todo `plugin.ts` do diretório de extensões, menos `examples/`.
 *
 * `examples/` fica de fora por padrão porque não é do escritório: o `sync` o reescreve a cada troca de
 * kernel, e compilá-lo junto encheria o `dist/` de pacotes que ninguém aqui vai importar — misturados
 * aos que vão. Quem quer o `.json` de um exemplo pede com `--examples`.
 */
export const buildTargets = (root: string, includeExamples: boolean): BuildTargets => {
  const { authored, examples } = findPluginFiles(root);
  return {
    entries: [...authored.sort(), ...(includeExamples ? examples.sort() : [])],
    skippedExamples: includeExamples ? 0 : examples.length,
  };
};
