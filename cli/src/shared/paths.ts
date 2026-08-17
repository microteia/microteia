import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A raiz do repositório, a partir da localização deste módulo. A profundidade é a mesma compilado
 * (`cli/lib/shared/`) e em teste (`cli/src/shared/`), então um único cálculo serve aos dois.
 */
const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, '..', '..', '..');

/**
 * A versão do CONSOLE, deliberadamente independente do `version` do produto: ela diz o que a
 * ferramenta sabe fazer, e é contra ela que o `minimumCliVersion` do manifesto é conferido. Um
 * pacote novo pode exigir um Console mais novo sem que o número do produto signifique nada aqui.
 */
export const CLI_VERSION = '1.0.0';
