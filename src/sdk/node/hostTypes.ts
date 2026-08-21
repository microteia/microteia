import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * A API curada, lida do `.d.ts` que o pacote carrega — a ÚNICA fonte da lista de módulos para tudo o
 * que roda em terminal: o servidor MCP, o `AGENTS.md` e o `AUTHORING.md`.
 *
 * Ela não é importada de `hostApi.ts` porque aquele arquivo mora em `src/presentation` e arrasta React:
 * o SDK sai daqui compilado para rodar em Node. O `.d.ts` é gerado dele por `export-host-types.mjs`, e
 * `hostApiTypeDefs.test.ts` cobra símbolo por símbolo que os dois concordam — então ler o `.d.ts` é ler
 * `HOST_MODULES` com um teste no meio, e não uma segunda cópia da lista.
 *
 * A cópia à mão existia em três lugares (a descrição de `describe_host_module`, a seção "Code" do
 * `AGENTS.md` e a lista do `AUTHORING.md`), e acrescentar um `@microteia/*` deixava as três incompletas
 * sem reprovar em nada.
 */

/** O `.d.ts` da API curada, tal como o pacote o carrega. */
export const hostTypesPath = (root: string): string | null => {
  const candidates = [
    // O caso normal: o workspace do escritório, com o SDK instalado.
    join(root, 'node_modules/@microteia/sdk/types/microteia-host.d.ts'),
    join(root, '../.microteia/install/sdk/types/microteia-host.d.ts'),
    join(root, 'types/microteia-host.d.ts'),
    // Relativo a ESTE módulo. Os dois porque o caminho difere entre o compilado
    // (`sdk/lib/sdk/node/` -> três níveis chegam à raiz do pacote) e a fonte
    // (`src/sdk/node/` -> três níveis chegam à raiz do repositório, onde `sdk/` é um diretório).
    resolve(__dirname, '../../..', 'types/microteia-host.d.ts'),
    resolve(__dirname, '../../..', 'sdk/types/microteia-host.d.ts'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

export const readHostTypes = (root: string): string => {
  const path = hostTypesPath(root);
  if (path === null) throw new Error('Could not find microteia-host.d.ts in this workspace.');
  return readFileSync(path, 'utf8');
};

export const hostModuleNames = (types: string): string[] =>
  [...types.matchAll(/declare module '([^']+)'/g)].map((match) => match[1]);

/** O bloco `declare module` de um módulo, ou `null` se ele não é alcançável por extensão. */
export const hostModuleBlock = (types: string, name: string): string | null => {
  const start = types.indexOf(`declare module '${name}' {`);
  if (start < 0) return null;
  const end = types.indexOf('\n}', start);
  return types.slice(start, end < 0 ? undefined : end + 2);
};
