import { DOMAIN_MODEL_FILE, RULE_LEDGER_FILE } from '../../domain';
import { INSTALLED_CATALOG_FILE } from '../installedCatalog';
import { BUILD_OUT_DIR } from '../buildOutput';

/**
 * A configuração de `extensions/` — e a regra que a governa, que NÃO é a dos documentos.
 *
 * `AGENTS.md` e `AUTHORING.md` são prosa nossa inteira: sobrepor é o certo, e o lugar do autor é o
 * `CLAUDE.md`. `tsconfig.json`, `.mcp.json`, `.gitignore` e `package.json` são diferentes — o autor
 * escreve dentro deles. Sobrepor um `tsconfig.json` apagaria o `path` que ele acrescentou para uma
 * biblioteca dele; sobrepor um `.mcp.json` apagaria os outros servidores MCP que ele registrou; e
 * sobrepor um `.gitignore` apagaria as linhas dele.
 *
 * Daí uma regra única, sem exceção, para os quatro:
 *
 * | Estado | O que o `sync` faz |
 * |---|---|
 * | o requisito não está lá | **acrescenta** — não há o que atrapalhar, não havia nada |
 * | está lá e é o que precisa | nada |
 * | está lá e é OUTRA coisa | **não toca, e avisa** — quem decide é quem escreveu |
 *
 * O aviso nomeia o arquivo, a chave, o que se espera e o que se achou, porque um aviso que não diz o
 * que ajustar transfere o trabalho sem transferir a informação. Ele é preferível a acertar sozinho:
 * a alternativa que existia — sobrepor — desfazia trabalho em silêncio, que é o pior dos dois erros.
 *
 * A ordenação é a única coisa que este módulo posiciona sem ser pedido, e só quando ACRESCENTA: o
 * curinga `@microteia/*` engole `@microteia/sdk` se vier antes dele, então uma chave nova entra no
 * lugar certo. Uma ordem errada que já estava no arquivo é avisada, não corrigida.
 */

export type ReconcileAction = 'created' | 'updated' | 'unchanged';

export interface Reconciliation {
  action: ReconcileAction;
  /** O conteúdo a gravar, ou `null` quando não há nada a mudar. */
  contents: string | null;
  warnings: string[];
}

const HOST_TYPES = './node_modules/@microteia/sdk/types/microteia-host.d.ts';

/**
 * Os `paths` sem os quais uma view `.tsx` não é checada: os módulos `@microteia/*` NÃO existem em
 * `node_modules` — são resolvidos pelo runtime do browser contra a API curada —, então sem este
 * mapeamento o `tsc` diz "cannot find module" no import mais importante do arquivo.
 *
 * A ORDEM desta lista é significativa: `@microteia/sdk` e `@microteia/sdk/node` vêm antes do curinga,
 * senão ele os engole e o `tsc` acusa "não é um módulo" no import do compilador.
 */
export const REQUIRED_PATHS: [string, string][] = [
  ['@microteia/sdk', './node_modules/@microteia/sdk/lib/sdk/index.d.ts'],
  ['@microteia/sdk/node', './node_modules/@microteia/sdk/lib/sdk/node/compile.d.ts'],
  /**
   * O que uma Cloud Function DESTA extensão importa da plataforma. O nome do módulo é o do pacote de
   * functions da instalação, e é o `exports` dele que o resolve em execução — aqui ele resolve só o
   * TIPO, para o editor do autor não sublinhar de vermelho a linha que a plataforma manda escrever.
   */
  ['microteia-functions/office', './node_modules/@microteia/sdk/types/microteia-office.d.ts'],
  ['@microteia/*', HOST_TYPES],
  ['react', HOST_TYPES],
  ['react/jsx-runtime', HOST_TYPES],
  ['styled-components', HOST_TYPES],
];

/**
 * As declarações ambientes, e elas entram por `files` e não por `include`: moram em `node_modules`,
 * que o `exclude` descarta, e `files` não passa pelo `exclude`.
 *
 * - **`?raw`**: sem ela, `import X from './views/Y.tsx?raw'` — o import mais importante de um
 *   `plugin.ts` — é um erro.
 * - **sandbox**: os globais de um `.script.ts` ou `.migration.ts` (`query`, `upsert`, `input`, `fn`…).
 *   Sem ela, todo script — o do escritório e os de `examples/` — acusava cada nome que usa.
 */
export const REQUIRED_FILES = [
  'node_modules/@microteia/sdk/types/microteia-raw.d.ts',
  'node_modules/@microteia/sdk/types/microteia-sandbox.d.ts',
];

/**
 * Um script não importa nada, e um arquivo sem import é, para o TypeScript, um SCRIPT GLOBAL: todos
 * dividem o mesmo escopo. Dois scripts com a sua `async function main()` viravam "Duplicate function
 * implementation" — que é a forma que a plataforma ensina a escrevê-los. `force` faz de cada arquivo um
 * módulo; as declarações `.d.ts` continuam globais, que é o que os globais do sandbox precisam.
 */
export const REQUIRED_MODULE_DETECTION = 'force';

export const MCP_SERVER_NAME = 'microteia';

/**
 * Aponta para o ARQUIVO, não para `npx microteia-plugin`: com `npx`, um `node_modules` ainda não
 * instalado faz a chamada ir ao registry público e voltar com "404 Not Found" — como se a ferramenta
 * nunca tivesse existido, em vez de dizer que falta um `npm install`.
 */
export const MCP_SERVER = {
  command: 'node',
  args: ['node_modules/@microteia/sdk/lib/sdk/node/cli.js', 'mcp'],
};

/**
 * O `.json` de uma extensão é ARTEFATO — sai do `build` e não se versiona. A configuração e o lock,
 * sim: sem o lock, dois computadores do mesmo escritório instalam versões diferentes do SDK.
 *
 * O curinga `*.json` engolia mais do que devia, e a conta era alta: o modelo de domínio, o livro de
 * rastreabilidade e o enunciado de onde os dois saíram são FONTE — o autor os escreve, o `npm test`
 * do diretório os lê, e o guia manda salvá-los ao lado do `plugin.ts`. Não versioná-los faz a próxima
 * sessão levantar de novo a exceção já decidida, e faz a regra ALTERADA propor uma segunda leva de
 * telas parecida com a primeira, sem nada com que compará-la. Os dois primeiros nomes vêm dos módulos
 * que os declaram; o do enunciado é do autor, e nenhum código nosso o lê.
 *
 * O retrato da instalação é descartado por uma razão diferente das outras, e por isso está escrito
 * mesmo já caindo no `*.json`: ele carrega nome de tela e de campo que o ESCRITÓRIO digitou. Isso é
 * dado do tenant, não artefato do produto, e um repositório de extensão não é lugar para ele. A linha
 * explícita é o que mantém a decisão de pé se alguém afrouxar o curinga.
 *
 * O `dist/` é onde o `build` grava hoje. O curinga continua porque o `build` gravava ao lado do
 * `plugin.ts` até a 9.203.0, e o artefato velho que ficou numa pasta não pode aparecer como arquivo novo
 * no primeiro `git status` depois do `sync`.
 */
export const REQUIRED_IGNORES = [
  'node_modules/',
  `${BUILD_OUT_DIR}/`,
  '*.json',
  '!package.json',
  '!package-lock.json',
  '!tsconfig.json',
  '!.mcp.json',
  '!business-rules-input.json',
  `!${RULE_LEDGER_FILE}`,
  `!${DOMAIN_MODEL_FILE}`,
  INSTALLED_CATALOG_FILE,
];

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/**
 * A semente, escrita só quando o arquivo não existe. O que está aqui e não está em `REQUIRED_PATHS`
 * é ESCOLHA nossa, e o autor pode mudá-la: `strict`, `target`, `lib`, `exclude`. Duas delas vêm de
 * defeito observado e vale saber por que estão assim:
 *
 * - **Nada é excluído além de `node_modules`.** `examples/` e os diretórios de function já foram
 *   excluídos, e o efeito foi pior que o problema: um arquivo fora de todo projeto não tem projeto
 *   NENHUM no editor, e aí nem `@microteia/data` resolve. Um erro honesto num import é melhor que tudo
 *   sublinhado — e é por isso que o `sync` AVISA quando encontra outra coisa ali.
 * - **`noImplicitAny` e `strictNullChecks` desligados.** A fonte de uma view nasce como JavaScript — é
 *   avaliada pelo browser, não compilada — e exigir anotação nela reprovaria os exemplos. O que se
 *   ganha aqui é resolução e forma: módulo que não existe, componente que não aceita aquela prop, hook
 *   com aridade errada.
 */
export const workspaceTsconfig = (): string => json({
  compilerOptions: {
    target: 'es2022',
    lib: ['ES2022', 'DOM'],
    module: 'esnext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    types: ['node'],
    strict: true,
    noImplicitAny: false,
    strictNullChecks: false,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true,
    noEmit: true,
    skipLibCheck: true,
    moduleDetection: REQUIRED_MODULE_DETECTION,
    paths: Object.fromEntries(REQUIRED_PATHS.map(([key, target]) => [key, [target]])),
  },
  files: REQUIRED_FILES,
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['node_modules'],
});

export const workspaceGitignore = (): string => `${REQUIRED_IGNORES.join('\n')}\n`;

export const workspaceMcpJson = (): string => json({ mcpServers: { [MCP_SERVER_NAME]: MCP_SERVER } });

const unchanged = (): Reconciliation => ({ action: 'unchanged', contents: null, warnings: [] });

const created = (contents: string): Reconciliation => ({ action: 'created', contents, warnings: [] });

/** Um arquivo que não é o que dizemos que é não pode ser mexido às cegas — só descrito. */
const unreadable = (name: string): Reconciliation => ({
  action: 'unchanged',
  contents: null,
  warnings: [
    `${name} could not be read as JSON, so it was left alone. `
    + 'Fix it, or delete it and run "npm run sync" to get a fresh one.',
  ],
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const firstTarget = (value: unknown): string | null =>
  Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;

const describe = (name: string, key: string, want: string, found: string): string =>
  `${name}: "${key}" is ${found}, and the platform needs ${want}. Left as it is — adjust it by hand if that was not deliberate.`;

/**
 * `tsconfig.json`. Os requisitos são os `paths`, as entradas de `files`, ter algum `jsx` e o
 * `moduleDetection` — é o conjunto mínimo que faz uma view `.tsx` e um script serem checados de
 * verdade. Todo o resto é do autor.
 */
export const reconcileTsconfig = (existing: string | null): Reconciliation => {
  if (existing === null) return created(workspaceTsconfig());

  let parsed: unknown;
  try {
    parsed = JSON.parse(existing);
  } catch {
    return unreadable('tsconfig.json');
  }

  const config = asRecord(parsed);
  if (config === null) return unreadable('tsconfig.json');

  const warnings: string[] = [];
  let changed = false;

  const options = asRecord(config.compilerOptions) ?? {};
  const paths = asRecord(options.paths) ?? {};

  const missing = REQUIRED_PATHS.filter(([key]) => !(key in paths));
  for (const [key, target] of REQUIRED_PATHS) {
    const found = firstTarget(paths[key]);
    if (found !== null && found !== target) {
      warnings.push(describe('tsconfig.json', `compilerOptions.paths["${key}"]`, `"${target}"`, `"${found}"`));
    }
  }

  if (missing.length > 0) {
    /**
     * Reconstruído com os requisitos NA ORDEM e os do autor depois — a única reordenação que este
     * módulo faz, e ela existe porque acrescentar `@microteia/sdk` no fim de um objeto que já tem o
     * curinga o deixaria engolido, ou seja: acrescentar sem posicionar não acrescentaria nada.
     * O valor de quem já estava lá é PRESERVADO, mesmo divergente — só o aviso acima o reporta.
     */
    const extras = Object.entries(paths).filter(([key]) => !REQUIRED_PATHS.some(([name]) => name === key));
    options.paths = Object.fromEntries([
      ...REQUIRED_PATHS.map(([key, target]) => [key, paths[key] ?? [target]]),
      ...extras,
    ]);
    config.compilerOptions = options;
    changed = true;
  } else {
    const keys = Object.keys(paths);
    const wildcard = keys.indexOf('@microteia/*');
    const swallowed = ['@microteia/sdk', '@microteia/sdk/node']
      .filter((key) => keys.indexOf(key) > wildcard && wildcard >= 0);
    if (swallowed.length > 0) {
      warnings.push(
        `tsconfig.json: ${swallowed.join(' and ')} come AFTER "@microteia/*" in compilerOptions.paths, `
        + 'so the wildcard swallows them and importing the compiler fails. Move them above it.',
      );
    }
  }

  if (options.jsx === undefined) {
    options.jsx = 'react-jsx';
    config.compilerOptions = options;
    changed = true;
  }

  if (options.moduleDetection === undefined) {
    options.moduleDetection = REQUIRED_MODULE_DETECTION;
    config.compilerOptions = options;
    changed = true;
  } else if (options.moduleDetection !== REQUIRED_MODULE_DETECTION) {
    warnings.push(describe(
      'tsconfig.json',
      'compilerOptions.moduleDetection',
      `"${REQUIRED_MODULE_DETECTION}" (or two scripts that both declare "main" collide)`,
      JSON.stringify(options.moduleDetection),
    ));
  }

  const files = Array.isArray(config.files) ? config.files as unknown[] : [];
  const missingFiles = REQUIRED_FILES.filter((file) => !files.includes(file));
  if (missingFiles.length > 0) {
    config.files = [...files, ...missingFiles];
    changed = true;
  }

  const exclude = Array.isArray(config.exclude) ? config.exclude as unknown[] : [];
  const extraExcludes = exclude.filter((entry) => entry !== 'node_modules');
  if (extraExcludes.length > 0) {
    warnings.push(
      `tsconfig.json: "exclude" also drops ${extraExcludes.map((entry) => JSON.stringify(entry)).join(', ')}. `
      + 'A file outside every project resolves nothing in the editor — not even @microteia/data — so '
      + 'everything in it is underlined. Excluding only "node_modules" is the setting that works.',
    );
  }

  return changed
    ? { action: 'updated', contents: json(config), warnings }
    : { ...unchanged(), warnings };
};

/**
 * `.mcp.json`. O requisito é UMA entrada — a nossa. Os outros servidores que o autor registrou são
 * dele, e sobrepor o arquivo os apagaria: era o defeito mais provável desta lista, porque registrar
 * outro servidor MCP é a primeira coisa que se faz num diretório com `.mcp.json`.
 */
export const reconcileMcpJson = (existing: string | null): Reconciliation => {
  if (existing === null) return created(workspaceMcpJson());

  let parsed: unknown;
  try {
    parsed = JSON.parse(existing);
  } catch {
    return unreadable('.mcp.json');
  }

  const config = asRecord(parsed);
  if (config === null) return unreadable('.mcp.json');

  const servers = asRecord(config.mcpServers) ?? {};
  const ours = asRecord(servers[MCP_SERVER_NAME]);

  if (ours === null) {
    config.mcpServers = { ...servers, [MCP_SERVER_NAME]: MCP_SERVER };
    return { action: 'updated', contents: json(config), warnings: [] };
  }

  const args = Array.isArray(ours.args) ? ours.args : [];
  const matches = ours.command === MCP_SERVER.command
    && args.length === MCP_SERVER.args.length
    && MCP_SERVER.args.every((arg, index) => args[index] === arg);

  return matches ? unchanged() : {
    ...unchanged(),
    warnings: [describe(
      '.mcp.json',
      `mcpServers.${MCP_SERVER_NAME}`,
      `${MCP_SERVER.command} ${MCP_SERVER.args.join(' ')}`,
      `${String(ours.command)} ${args.join(' ')}`,
    )],
  };
};

/** `.gitignore` é uma lista de linhas, e conciliá-la é acrescentar as que faltam. Nada sai. */
export const reconcileGitignore = (existing: string | null): Reconciliation => {
  if (existing === null) return created(workspaceGitignore());

  const lines = existing.split('\n').map((line) => line.trim());
  const missing = REQUIRED_IGNORES.filter((entry) => !lines.includes(entry));
  if (missing.length === 0) return unchanged();

  const body = existing.endsWith('\n') || existing === '' ? existing : `${existing}\n`;
  return {
    action: 'updated',
    contents: `${body}${missing.join('\n')}\n`,
    warnings: [],
  };
};
