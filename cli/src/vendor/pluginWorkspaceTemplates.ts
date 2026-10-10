/**
 * O pouco que o CONSOLE sabe sobre `extensions/`.
 *
 * Tudo o que descreve o kernel — `AGENTS.md`, `AUTHORING.md`, `tsconfig.json`, `.mcp.json`, os scripts
 * — morava aqui, e era o lado errado. O Console é versionado (`CLI_VERSION`) e distribuído SEPARADAMENTE
 * do kernel: um Console de duas versões atrás ao lado de uma instalação nova escrevia, em silêncio, a
 * documentação de outro contrato. Passou para `src/sdk/node/workspace/`, que viaja no mesmo `.tgz` que
 * os pontos de extensão que o texto descreve, e é reescrito a cada troca de kernel.
 *
 * Sobrou o que só o Console tem como saber: onde está o tarball do SDK dentro do pacote, e o nome do
 * escritório. É a semente — mínima de propósito, porque quem a completa é o `sync`.
 */

export const SDK_TARBALL = 'microteia-sdk.tgz';

/**
 * A semente do `package.json`. Não traz scripts nem devDependencies: os nomes de comando são do SDK, e
 * duplicá-los aqui era exatamente o problema. O `sync` os acrescenta logo depois do `npm install`, e o
 * segundo `npm install` os instala.
 */
export const workspacePackageJson = (officeName: string, sdkPath: string, namespace: string): string => JSON.stringify({
  name: `${officeName}-extensions`,
  version: '0.0.0',
  private: true,
  description: 'Microteia extensions authored by this organization.',
  dependencies: {
    // Caminho SEM versão de propósito: um kernel novo não obriga ninguém a editar este arquivo. O que
    // traz o SDK novo é `npm run sdk:refresh` — ou o `microteia unpack`, que o faz sozinho.
    '@microteia/sdk': `file:${sdkPath}`,
  },
  // O prefixo de todo id escrito neste diretório. É o SDK que o lê (`microteia-plugin create`, o MCP);
  // o Console só o recebe de quem roda o `plugin-init`, que é a única pessoa que pode decidi-lo.
  microteia: { namespace },
}, null, 2) + '\n';

/**
 * O formato de id de extensão (`isValidPluginId`, no domínio) — repetido porque o Console não importa
 * o kernel, e conferir ANTES de escrever a semente é o que evita um `--force` só para corrigir um erro
 * de digitação. `pluginWorkspaceTemplates.test.ts` prende os dois um ao outro.
 */
const NAMESPACE_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

export const isValidNamespace = (value: string): boolean => NAMESPACE_PATTERN.test(value);
