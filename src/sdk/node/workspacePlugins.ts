import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * OS `plugin.ts` DESTE DIRETÓRIO, separados por DE QUEM eles são.
 *
 * `examples/` carrega as extensões de primeira parte em fonte, uma pasta cada, e o `sync` reescreve
 * aquele diretório inteiro a cada troca de kernel. Elas moram dentro do diretório de autoria por uma
 * razão boa — é onde se lê o que se vai escrever — e por isso caíam na varredura de quem procurava os
 * pacotes do ESCRITÓRIO. Havia duas varreduras, uma aqui e uma no catálogo, e o mesmo defeito nas duas.
 *
 * O que ele produzia não era ausência: era ATRIBUIÇÃO ERRADA, que é pior. `list_workspace_plugins`
 * anunciava como "authored here" seis pacotes que ninguém no escritório escreveu; `list_referenceable`
 * apresentava a superfície do exemplo como a da extensão irmã; e, pela precedência "o workspace ganha",
 * a coleção declarada por um exemplo DESCARTAVA a tela real do escritório vinda do retrato da
 * instalação. Quem lê isso conclui que o escritório é dono de `calendar` e passa a modelar contra
 * campos que ninguém lá tem — e o catálogo existe exatamente para que isso não aconteça.
 *
 * A distinção é por CAMINHO, e mora aqui porque o nome do diretório é decidido uma vez: quem o escreve
 * é o `sync`, e quem o descarta é este módulo. Um exemplo NÃO entra no catálogo de entidades e NÃO é
 * dono referenciável, pelo mesmo motivo nos dois casos: nada neste diretório o instalou. Se o
 * escritório instalou a extensão de verdade, quem responde por ela é o retrato — que sabe a versão
 * instalada e se ela está ligada; se não instalou, ela não existe lá, e um exemplo lido como instalação
 * fabricaria uma resposta no lugar de "não sei".
 */

/** Onde o `sync` põe as extensões de primeira parte em fonte. Reescrito a cada troca de kernel. */
export const EXAMPLES_DIR = 'examples';

const PLUGIN_FILE = 'plugin.ts';

export interface WorkspacePluginFiles {
  /** Os pacotes do ESCRITÓRIO — os únicos que alguém aqui escreveu, e os únicos que o catálogo lê. */
  authored: string[];
  /** Os de `examples/`: material de leitura nosso, que nada neste diretório instalou. */
  examples: string[];
}

/** Se o caminho está sob `examples/`, olhando o PRIMEIRO segmento: um `examples/` mais fundo é do autor. */
export const isExamplePlugin = (root: string, path: string): boolean =>
  relative(root, path).split(sep)[0] === EXAMPLES_DIR;

const walk = (dir: string, depth: number): string[] => {
  if (depth < 0 || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, depth - 1);
    return entry.name === PLUGIN_FILE ? [path] : [];
  });
};

export const findPluginFiles = (root: string, depth = 3): WorkspacePluginFiles => {
  const found = walk(root, depth);
  return {
    authored: found.filter((path) => !isExamplePlugin(root, path)),
    examples: found.filter((path) => isExamplePlugin(root, path)),
  };
};
