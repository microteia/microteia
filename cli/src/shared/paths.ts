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
 *
 * Semver do lado da FERRAMENTA: major quando um comando muda de contrato, minor quando ganha
 * capacidade, patch quando muda o que ele escreve sem que o pacote passe a depender disso. Em
 * `2.0.0`: o `deploy` deixou de aceitar `--kernel` (o pacote passa a chegar pelo `unpack`), e as
 * configurações de backend saíram de `.microteia/` para a raiz da instalação — um Console anterior
 * gravaria a credencial no lugar que o upgrade apaga. `unpack` e `plugin-init` são aditivos e
 * sozinhos pediriam só o minor. Em `2.0.1`: o `.gitignore` da instalação passa a descartar os
 * `examples/`, que o `unpack` reescreve e ninguém versiona. Em `2.0.2`: o `AGENTS.md` e o
 * `AUTHORING.md` que ele escreve passam a cobrar versão, entrada de histórico e teste a cada
 * alteração de extensão.
 *
 * Ela NÃO acompanha o `version` do produto, e não é obrigada a andar junto do `MINIMUM_CLI_VERSION`:
 * este último só se move quando o PACOTE passa a depender de algo que o Console faz.
 */
export const CLI_VERSION = '2.0.2';
