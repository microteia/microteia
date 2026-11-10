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
/**
 * O que só quem roda o `plugin-init` pode decidir, e que vale para TODA extensão do diretório. O
 * `publisher` e o `prefix` são opcionais: sem terminal e sem flag, quem os pergunta é o `create` do SDK,
 * uma vez — o mesmo que faz num diretório anterior a eles.
 */
export interface WorkspaceIdentity {
  namespace: string;
  publisher?: string;
  prefix?: string;
}

export const workspacePackageJson = (officeName: string, sdkPath: string, identity: WorkspaceIdentity): string => JSON.stringify({
  name: `${officeName}-extensions`,
  version: '0.0.0',
  private: true,
  description: 'Microteia extensions authored by this organization.',
  dependencies: {
    // Caminho SEM versão de propósito: um kernel novo não obriga ninguém a editar este arquivo. O que
    // traz o SDK novo é `npm run sdk:refresh` — ou o `microteia unpack`, que o faz sozinho.
    '@microteia/sdk': `file:${sdkPath}`,
  },
  // É o SDK que lê estas chaves (`microteia-plugin create`, o MCP); o Console só as recebe de quem roda
  // o `plugin-init`, que é a única pessoa que pode decidi-las. Chave sem valor fica de fora, e não
  // vazia: o `create` só pergunta o que não acha.
  microteia: {
    namespace: identity.namespace,
    ...(identity.publisher === undefined ? {} : { publisher: identity.publisher }),
    ...(identity.prefix === undefined ? {} : { prefix: identity.prefix }),
  },
}, null, 2) + '\n';

/**
 * O formato de id de extensão (`isValidPluginId`, no domínio) — repetido porque o Console não importa
 * o kernel, e conferir ANTES de escrever a semente é o que evita um `--force` só para corrigir um erro
 * de digitação. `pluginWorkspaceTemplates.test.ts` prende os dois um ao outro.
 */
const NAMESPACE_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

export const isValidNamespace = (value: string): boolean => NAMESPACE_PATTERN.test(value);

/**
 * O formato do prefixo de artefato (`ARTIFACT_PREFIX_PATTERN`, no domínio) — repetido pela mesma razão do
 * namespace, e preso a ele pelo mesmo teste.
 */
const PREFIX_PATTERN = /^[a-z][a-z0-9]{1,7}$/;
const PREFIX_MAX_LENGTH = 8;
const GENERATED_PREFIX_LENGTH = 4;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export const isValidPrefix = (value: string): boolean => PREFIX_PATTERN.test(value);

/**
 * A sugestão do `create` do SDK (`suggestedPrefix`), repetida aqui para que o `plugin-init` ofereça o
 * MESMO prefixo que o `create` ofereceria: o último segmento do namespace, se ele já serve
 * (`com.acme` → `acme`), senão os primeiros caracteres que servem, senão quatro letras sorteadas.
 */
export const suggestPrefix = (namespace: string, random: () => number = Math.random): string => {
  const last = (namespace.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidate = last.replace(/^[0-9]+/, '').slice(0, PREFIX_MAX_LENGTH);
  if (isValidPrefix(candidate)) return candidate;
  return Array.from({ length: GENERATED_PREFIX_LENGTH }, () => LETTERS[Math.floor(random() * LETTERS.length) % LETTERS.length]).join('');
};
