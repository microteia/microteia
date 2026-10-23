#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { buildPlugin } from './compile';
import { describeMessage, packageText } from './messages';
import { installationRegion, scaffoldFunction, scaffoldPlugin } from './scaffold';
import { askerFor } from './prompt';
import type { Asker } from './prompt';
import { serveMcp } from './mcp';
import { crossRefReport } from './referenceable';
import { eventRefReport } from './eventRefs';
import { documentStepReport } from './documentSteps';
import { recordSurfaceReport } from './recordSurfaces';
import { navTargetReport } from './navTargetReport';
import { undeclaredPathReport } from './undeclaredPaths';
import { navGroupReport } from './navGroups';
import { syncWorkspace } from './workspace/sync';
import {
  belongsToNamespace,
  invalidNamespaceMessage,
  isValidNamespace,
  outsideNamespaceMessage,
  invalidPrefixMessage,
  qualifyPluginId,
  recordNamespace,
  recordPrefix,
  recordPublisher,
  storedKeepIds,
  storedNamespace,
  storedPrefix,
  storedPublisher,
  suggestedPrefix,
  workspaceNamespace,
} from './workspace/namespace';
import { isArtifactPrefix } from '../../domain/schema/plugin/artifactPrefix';
import { lacksPackagePrefix } from '../../domain/usecases/plugins/pluginPrefix';

/**
 * `microteia-plugin` — a ferramenta de quem escreve extensão fora deste repositório.
 *
 * Ela existe para que o `.json` que a plataforma instala continue sendo o artefato, e não a fonte: o
 * autor escreve TypeScript, com tipos e autocomplete, e o `check` recusa aqui exatamente o que a
 * instalação recusaria lá — a MESMA porta de validação, não uma segunda aproximação dela.
 *
 * Sem dependência de framework de CLI, pelo mesmo motivo do Console: uma ferramenta que se instala na
 * máquina de um escritório é mais confiável quanto menos ela arrasta.
 */

interface Args {
  positional: string[];
  flags: Set<string>;
  values: Map<string, string>;
}

const parseArgs = (argv: string[]): Args => {
  const positional: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const name = token.slice(2);
    if (name.includes('=')) {
      const [key, ...rest] = name.split('=');
      values.set(key, rest.join('='));
      continue;
    }
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values.set(name, next);
      index += 1;
    } else {
      flags.add(name);
    }
  }

  return { positional, flags, values };
};

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const say = (line = ''): void => { process.stdout.write(`${line}\n`); };
const problem = (line: string): void => { process.stderr.write(`${RED}x${RESET} ${line}\n`); };
const done = (line: string): void => { say(`${GREEN}ok${RESET} ${line}`); };
const warn = (line: string): void => { say(`${YELLOW}!${RESET} ${line}`); };

/** O `plugin.ts` a compilar: o que foi passado, ou o do diretório atual. */
const entryFrom = (args: Args): string => {
  const given = args.positional[1] ?? args.values.get('entry');
  return resolve(given ?? 'plugin.ts');
};

interface RenderableIssue {
  source: string;
  message: string;
  messageParams?: Record<string, string>;
}

const describeIssues = (
  issues: RenderableIssue[],
  describe: (message: string, params?: Record<string, string>) => string = describeMessage,
): void => {
  for (const issue of issues) {
    say(`  ${DIM}${issue.source.padEnd(9)}${RESET} ${describe(issue.message, issue.messageParams)}`);
  }
};

/**
 * A referência a OUTRA extensão, conferida contra o que este diretório enxerga.
 *
 * `validatePackage` alcança a forma da referência e a dependência declarada; as outras duas — o
 * `sourceId` estar no `exports` da dona e a versão satisfazer a faixa — pedem o outro lado. O outro
 * lado passou a estar aqui: os `plugin.ts` deste diretório e o retrato da instalação. Enquanto não
 * eram cobradas neste comando, o `check` dizia "no problems found" e a recusa acontecia no escritório
 * de quem instala, que é o único lugar onde ninguém pode consertá-la.
 *
 * O que MUDA em relação à instalação é só o significado da ausência: um diretório de autoria não é o
 * escritório, e "não achei a dona" é resposta sobre o que não se sabe, nunca recusa fabricada. Por
 * isso apenas `refused` conta como problema — `absent-there` é dito com destaque e não reprova, porque
 * o pacote pode ser destinado a outro escritório.
 */
const sayCrossRefs = (pkg: MarketplacePlugin, root: string): number => {
  const findings = crossRefReport(pkg, root);
  if (findings.length === 0) return 0;

  const refused = findings.filter((one) => one.status === 'refused');
  say();
  say(`  ${DIM}${findings.length} reference(s) to another extension${RESET}`);
  for (const one of findings) {
    const mark = one.status === 'ok' ? `${GREEN}ok${RESET}` : one.status === 'refused' ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
    say(`  ${mark} ${one.ref} ${DIM}(${one.kind}, from ${one.writtenBy})${RESET}`);
    say(`     ${DIM}${one.detail}${RESET}`);
  }
  return refused.length;
};

/**
 * Os gatilhos que escutam OUTRA extensão (`case.saved`). Conta como problema só o `refused` — o
 * prefixo emitido por uma extensão que o pacote não declara, que a instalação recusaria em qualquer
 * escritório. O que este diretório não enxerga é dito, não recusado.
 */
const sayEventRefs = (pkg: MarketplacePlugin, root: string): number => {
  const findings = eventRefReport(pkg, root);
  if (findings.length === 0) return 0;

  say();
  say(`  ${DIM}${findings.length} trigger(s) on an event another extension emits${RESET}`);
  for (const one of findings) {
    const mark = one.status === 'ok' ? `${GREEN}ok${RESET}` : one.status === 'refused' ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
    say(`  ${mark} ${one.prefix}.* ${DIM}(from ${one.writtenBy})${RESET}`);
    say(`     ${DIM}${one.detail}${RESET}`);
  }
  return findings.filter((one) => one.status === 'refused').length;
};

/**
 * O passo `render-document` que cita o modelo de OUTRO pacote. Conta como problema só o `refused` — o
 * modelo foi lido aqui e o passo não cumpre o contrato dele. O modelo que não se enxerga é dito: pode
 * ser o do escritório, na mesma chave.
 */
const sayDocumentSteps = (pkg: MarketplacePlugin, root: string): number => {
  const findings = documentStepReport(pkg, root);
  if (findings.length === 0) return 0;

  say();
  say(`  ${DIM}${findings.length} step(s) generating a document template of another package${RESET}`);
  for (const one of findings) {
    const mark = one.status === 'ok' ? `${GREEN}ok${RESET}` : one.status === 'refused' ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
    say(`  ${mark} ${one.templateKey} ${DIM}(step "${one.step}" of ${one.writtenBy})${RESET}`);
    say(`     ${DIM}${one.detail}${RESET}`);
  }
  return findings.filter((one) => one.status === 'refused').length;
};

/**
 * Os caminhos de relatório e de consulta que nenhum campo das telas visíveis declara. Só avisa, nunca
 * reprova: a plataforma os aceita porque o escritório pode ter criado o campo no Form Design.
 */
const sayUndeclaredPaths = (pkg: MarketplacePlugin, root: string): void => {
  const findings = undeclaredPathReport(pkg, root);
  if (findings.length === 0) return;

  say();
  say(`  ${DIM}${findings.length} report or query path(s) no visible field declares${RESET}`);
  for (const one of findings) {
    say(`  ${YELLOW}!${RESET} ${one.path} ${DIM}(from ${one.writtenBy})${RESET}`);
    say(`     ${DIM}${one.detail}${RESET}`);
  }
};

/**
 * Os grupos da barra lateral que o pacote declara ou em que põe item. Só avisa, nunca reprova: o
 * escritório pode ter uma extensão que este diretório não enxerga.
 */
const sayNavGroups = (pkg: MarketplacePlugin, root: string): void => {
  const findings = navGroupReport(pkg, root);
  if (findings.length === 0) return;

  say();
  say(`  ${DIM}${findings.length} sidebar group(s) to look at${RESET}`);
  for (const one of findings) {
    say(`  ${YELLOW}!${RESET} ${one.key} ${DIM}(${one.status})${RESET}`);
    say(`     ${DIM}${one.detail}${RESET}`);
  }
};

/**
 * As telas a que o pacote pendura abas (`record:<sourceId>`). Só avisa, nunca reprova: a tela pode ser
 * de outra extensão, num escritório que este diretório não enxerga.
 */
const sayRecordSurfaces = (pkg: MarketplacePlugin, root: string): void => {
  const findings = recordSurfaceReport(pkg, root);
  if (findings.length === 0) return;

  say();
  say(`  ${DIM}${findings.length} record detail(s) this package adds tabs to${RESET}`);
  for (const one of findings) {
    const mark = one.status === 'ok' ? `${GREEN}ok${RESET}` : `${YELLOW}!${RESET}`;
    say(`  ${mark} record:${one.sourceId} ${DIM}(${one.contributions.join(', ')})${RESET}`);
    say(`     ${DIM}${one.detail}${RESET}`);
  }
};

/**
 * Os itens de menu que podem levar a uma página de dependência. Conta como problema só o `refused`: a
 * dependência foi lida neste diretório e não desenha aquela aba. O que ele não enxerga é dito.
 */
const sayNavTargets = (pkg: MarketplacePlugin, root: string): number => {
  const findings = navTargetReport(pkg, root);
  if (findings.length === 0) return 0;

  say();
  say(`  ${DIM}${findings.length} menu item(s) that may open a page of a dependency${RESET}`);
  for (const one of findings) {
    const mark = one.status === 'ok' ? `${GREEN}ok${RESET}` : one.status === 'refused' ? `${RED}x${RESET}` : `${YELLOW}!${RESET}`;
    say(`  ${mark} ${one.contributionId} ${DIM}(${one.target})${RESET}`);
    say(`     ${DIM}${one.detail}${RESET}`);
  }
  return findings.filter((one) => one.status === 'refused').length;
};

/**
 * O id fora do namespace do diretório é RECUSA — é o que pega a cópia distraída de uma extensão de outro
 * autor, que compilaria com o id do original. A exceção é declarada: o id é permanente, e uma extensão
 * publicada antes de o diretório ter namespace não pode ser renomeada para caber nele. Ela entra em
 * `microteia.keepIds`, e aí o build só avisa. Não impede quem quer burlar — basta editar o package.json
 * —; impede o engano.
 */
const sayNamespace = (id: string, root: string): number => {
  const namespace = workspaceNamespace(root);
  if (namespace === null || belongsToNamespace(id, namespace)) return 0;
  say();
  if (storedKeepIds(root).includes(id)) {
    warn(outsideNamespaceMessage(id, namespace));
    say(`  ${DIM}Kept: it is listed in package.json, under microteia.keepIds.${RESET}`);
    return 0;
  }
  problem(outsideNamespaceMessage(id, namespace));
  say(`  ${DIM}If this extension is already installed somewhere, its id cannot change: add it to${RESET}`);
  say(`  ${DIM}package.json, under microteia.keepIds. If it is a copy, give it an id of your own.${RESET}`);
  return 1;
};

/** Aviso, nunca recusa: as extensões anteriores ao prefixo continuam válidas. */
const sayPrefix = (pkg: Parameters<typeof lacksPackagePrefix>[0]): void => {
  if (!lacksPackagePrefix(pkg)) return;
  say();
  warn('this extension declares no manifest.prefix.');
  say(`  ${DIM}Every name it creates may collide with another extension's in the organization that${RESET}`);
  say(`  ${DIM}installs both — and there the installation is refused. See AUTHORING.md, "Prefix".${RESET}`);
};

const build = (args: Args, write: boolean): number => {
  const entry = entryFrom(args);
  const result = buildPlugin({ entry, exportName: args.values.get('export') });
  const { manifest } = result.package;
  // O pacote traz os próprios textos; usá-los aqui é o que faz o terminal mostrar o nome da extensão
  // em vez da chave dele.
  const describe = packageText(result.package);

  say(`${BOLD}${describe(manifest.name)}${RESET} ${manifest.id} ${DIM}v${manifest.version}${RESET}`);

  const counts: string[] = [];
  const push = (label: string, value: number): void => { if (value > 0) counts.push(`${value} ${label}`); };
  push('screen(s)', result.package.screens?.length ?? 0);
  push('workflow(s)', result.package.workflows.length);
  push('action(s)', result.package.actions?.length ?? 0);
  push('script(s)', result.package.scripts?.length ?? 0);
  push('view(s)', result.package.views?.length ?? 0);
  push('migration(s)', result.package.migrations?.length ?? 0);
  if (counts.length > 0) say(`  ${DIM}${counts.join(', ')}${RESET}`);

  if (result.issues.length > 0) {
    say();
    problem(`${result.issues.length} problem(s) - this package would be refused on install:`);
    describeIssues(result.issues, describe);
  }

  const root = resolve(args.values.get('root') ?? process.cwd());
  const refusedRefs = sayCrossRefs(result.package, root) + sayEventRefs(result.package, root)
    + sayNavTargets(result.package, root) + sayDocumentSteps(result.package, root);
  sayUndeclaredPaths(result.package, root);
  sayRecordSurfaces(result.package, root);
  sayNavGroups(result.package, root);
  const outsideNamespace = sayNamespace(manifest.id, root);
  sayPrefix(result.package);
  const problems = result.issues.length + refusedRefs + outsideNamespace;

  if (problems > 0) {
    if (!write) return 1;
    if (!args.flags.has('force')) {
      say();
      say(`${DIM}Nothing written. Pass --force to write the .json anyway and inspect it.${RESET}`);
      return 1;
    }
  }

  if (!write) {
    say();
    done('no problems found.');
    return 0;
  }

  const outDir = args.values.get('out') ?? dirname(entry);
  const file = join(outDir, `${manifest.id}.json`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, result.json);

  const kb = Math.round(Buffer.byteLength(result.json) / 1024);
  say();
  done(`${file} ${DIM}(${kb} KB)${RESET}`);
  if (problems > 0) warn('written with problems, because --force was given.');
  if ((result.package.views?.length ?? 0) > 0 || result.package.startup !== undefined) {
    say();
    say(`${DIM}This package carries code. After importing it, an administrator has to open the${RESET}`);
    say(`${DIM}source and trust it before the views run - see AUTHORING.md, "Code trust".${RESET}`);
  }
  return 0;
};

/**
 * O namespace de onde o id sai. Gravado no `package.json` pelo `plugin-init`; num diretório anterior a
 * ele, é perguntado UMA vez e gravado, para que a extensão seguinte já nasça no mesmo. Sem terminal e
 * sem `--namespace`, não há padrão que sirva — inventar um é exatamente o defeito que isto conserta.
 */
const namespaceFor = async (args: Args, workspace: string, asker: Asker): Promise<string> => {
  const stored = storedNamespace(workspace);
  const given = args.values.get('namespace');

  if (stored !== null && !isValidNamespace(stored)) {
    throw new Error(`package.json, microteia.namespace: ${invalidNamespaceMessage(stored)}`);
  }
  if (stored !== null) {
    if (given !== undefined && given !== stored) {
      throw new Error(
        `This directory's namespace is ${stored}, not ${given}. Every extension here is ${stored}.<name>;`
        + ' change it in package.json, under microteia.namespace, if that was the mistake.',
      );
    }
    return stored;
  }

  const answer = given ?? await asker.text({
    key: 'namespace',
    text: 'namespace',
    hint: 'Reverse-DNS of a domain your organization controls, like com.acme. Every extension here is named below it.',
  });
  if (answer.trim() === '') {
    throw new Error(
      'This directory has no namespace yet. Pass it once — npx microteia-plugin create --namespace com.acme —'
      + ' and it is recorded in package.json for every extension after this one.',
    );
  }
  recordNamespace(workspace, answer.trim());
  done(`namespace ${answer.trim()} recorded in package.json ${DIM}(microteia.namespace)${RESET}`);
  say();
  return answer.trim();
};

/**
 * `create` — o guia que produz uma extensão.
 *
 * Pergunta o que a extensão VAI SER, porque disso depende o que faz sentido gerar: uma extensão que só
 * traz uma automação não deveria nascer com uma tela e uma página em código para apagar. Toda pergunta
 * aceita ser respondida por flag, e sem terminal ele não pergunta nada — é o que o mantém usável em CI,
 * num script, ou por uma IA.
 */
const createPlugin = async (args: Args): Promise<number> => {
  const workspace = args.values.get('dir') ?? process.cwd();
  const asker = askerFor(args.values, args.flags.has('yes'));

  try {
    say(`${BOLD}A new Microteia extension${RESET} ${DIM}(kernel contract ${KERNEL_VERSION})${RESET}`);
    say();

    const namespace = await namespaceFor(args, workspace, asker);
    const answer = args.positional[1] ?? await asker.text({
      key: 'id',
      text: 'id',
      hint: `Below ${namespace} — "billing" becomes ${namespace}.billing. Permanent: it is how an update finds what to update.`,
    }, `${namespace}.hello`);
    const id = qualifyPluginId(answer, namespace);
    if (!belongsToNamespace(id, namespace)) throw new Error(outsideNamespaceMessage(id, namespace));
    const name = await asker.text(
      { key: 'name', text: 'name', hint: 'What a person sees in the Extensions list.' },
      'Hello',
    );
    const summary = await asker.text(
      { key: 'summary', text: 'summary', hint: 'One line, shown next to the name.' },
      'What this extension does, in one line.',
    );
    const publisher = storedPublisher(workspace) ?? await (async () => {
      const answer = await asker.text(
        { key: 'publisher', text: 'publisher', hint: 'Who answers for the extensions of this directory. Asked once.' },
        'Your organization',
      );
      recordPublisher(workspace, answer);
      return answer.trim();
    })();
    const prefix = storedPrefix(workspace) ?? await (async () => {
      const answer = (await asker.text({
        key: 'prefix',
        text: 'prefix',
        hint: 'Starts every name your extensions create — acme_client, acme-notify. Asked once; it never changes.',
      }, suggestedPrefix(namespace))).trim();
      if (!isArtifactPrefix(answer)) throw new Error(invalidPrefixMessage(answer));
      recordPrefix(workspace, answer);
      return answer;
    })();

    say();
    asker.note('What should it carry? Each answer adds only what it needs — nothing to delete afterwards.');
    const screen = await asker.confirm({
      key: 'entity',
      text: 'an entity of its own?',
      hint: 'A collection and its fields. The platform draws the list, the detail, the form and the filters.',
    }, true);
    const view = await asker.confirm({
      key: 'view',
      text: 'a page written in code?',
      hint: 'A real .tsx file, type-checked. It installs inert until an administrator trusts the source.',
    }, false);
    const functions = await asker.confirm({
      key: 'functions',
      text: 'Cloud Functions of its own?',
      hint: 'Written in <plugin>/functions/ and gathered by "microteia deploy".',
    }, false);

    await asker.close();

    const result = scaffoldPlugin(
      { id, name, summary, publisher, prefix, screen, view, functions },
      workspace,
      args.flags.has('force'),
    );

    const folder = basename(result.directory);
    say();
    done(`created ${folder}/ ${DIM}(${result.files.length} files)${RESET}`);
    for (const file of result.files) say(`    ${DIM}${folder}/${file}${RESET}`);

    say();
    say('Next:');
    say(`  ${DIM}npx tsc --noEmit${RESET}`);
    say(`  ${DIM}npx microteia-plugin check ${folder}/plugin.ts${RESET}`);
    say(`  ${DIM}npm test${RESET}`);
    say(`  ${DIM}npx microteia-plugin build ${folder}/plugin.ts${RESET}`);
    say();
    say(`  ${DIM}Every change from here raises manifest.version and adds an entry on top of${RESET}`);
    say(`  ${DIM}${folder}/VERSIONS.md — that is how an installed extension recognises an update.${RESET}`);

    if (functions) {
      say();
      warn('this extension declares Cloud Functions.');
      say(`  ${DIM}They are written in ${folder}/functions/ and gathered by "microteia deploy".${RESET}`);
      say(`  ${DIM}Add another with: npx microteia-plugin create function --plugin ${folder}${RESET}`);

      // As dependências entram no `package.json` AGORA, e não como instrução para lembrar depois: sem
      // elas o `import { onCall } from 'firebase-functions/v2/https'` fica sublinhado, e a primeira
      // impressão de quem acabou de gerar o arquivo é a de que o molde está quebrado.
      if (ensureFunctionTypes(workspace)) {
        say();
        warn('added firebase-functions and firebase-admin to package.json.');
        say(`  ${DIM}Run "npm install" to get their types — until then the import is underlined.${RESET}`);
      }
    }
    if (view) {
      say();
      say(`  ${DIM}A package that carries code installs inert: an administrator reviews the source and${RESET}`);
      say(`  ${DIM}trusts it before the view runs. See AUTHORING.md, "Code trust".${RESET}`);
    }
    return 0;
  } finally {
    await asker.close();
  }
};

/** `create function` — acrescenta uma Cloud Function a uma extensão que já existe. */
const createFunction = async (args: Args): Promise<number> => {
  const workspace = args.values.get('dir') ?? process.cwd();
  const asker = askerFor(args.values, args.flags.has('yes'));

  try {
    const plugins = readdirSync(workspace, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(workspace, entry.name, 'plugin.ts')))
      .map((entry) => entry.name);

    if (plugins.length === 0) {
      problem('No extension found here. Create one first: npx microteia-plugin create');
      return 1;
    }

    const folder = args.values.get('plugin') ?? await asker.choose(
      { key: 'plugin', text: 'which extension does this function belong to?' },
      plugins.map((value) => ({ value, label: value })),
      plugins[0],
    );

    if (!plugins.includes(folder)) {
      problem(`"${folder}" is not an extension here. Found: ${plugins.join(', ')}`);
      return 1;
    }

    const action = await asker.text({
      key: 'action',
      text: 'what does it do?',
      hint: 'A short verb phrase; it becomes the function name.',
    }, 'sync');

    /**
     * A forma decide o que é gerado, e a diferença entre as duas é a razão de a pergunta existir: a
     * callable só é alcançada por uma tela desta extensão, logo some com ela; o gatilho continua
     * disparando para todo escritório do projeto, e por isso nasce com o portão de instalação.
     */
    const kind = args.values.get('trigger') !== undefined ? 'trigger'
      : args.values.get('schedule') !== undefined ? 'schedule'
        : await asker.choose(
          { key: 'kind', text: 'what sets it off?' },
          [
            { value: 'callable', label: 'a screen of this extension calls it' },
            { value: 'trigger', label: 'a record is saved or deleted' },
            { value: 'schedule', label: 'a clock — it runs on a schedule' },
          ],
          'callable',
        );

    const collection = kind !== 'trigger' ? undefined : (args.values.get('trigger') ?? await asker.text({
      key: 'collection',
      text: 'which collection does it watch?',
      hint: 'The name your screen stores its records in.',
    }, 'records'));

    const schedule = kind !== 'schedule' ? undefined : (args.values.get('schedule') ?? await asker.text({
      key: 'schedule',
      text: 'how often does it run?',
      hint: 'App Engine cron syntax, or unix-cron: "every day 03:00".',
    }, 'every day 03:00'));

    const directory = join(workspace, folder);
    const id = pluginIdOf(directory) ?? `${workspaceNamespace(workspace) ?? 'com.example'}.${folder}`;
    const region = installationRegion(workspace);
    await asker.close();

    const name = scaffoldFunction(
      directory,
      id,
      action,
      region,
      collection !== undefined ? { kind: 'trigger', collection }
        : schedule !== undefined ? { kind: 'schedule', schedule }
          : { kind: 'callable' },
    );

    done(`created ${folder}/functions/${name}.ts ${DIM}(region ${region})${RESET}`);
    if (collection !== undefined) {
      say(`  ${DIM}it watches tenants/{tenantId}/${collection}/{id}, and runs only where this${RESET}`);
      say(`  ${DIM}extension is installed — that guard is what a Cloud Function cannot do by itself.${RESET}`);
    }
    if (schedule !== undefined) {
      say(`  ${DIM}it runs "${schedule}", once per office that installed this extension. A scheduled${RESET}`);
      say(`  ${DIM}event carries no office, so that loop is the only thing that scopes it.${RESET}`);
    }
    say();
    warn(`declare it in ${folder}/plugin.ts, under manifest.backend.functions:`);
    say(`  ${DIM}backend: { functions: ['${name}'] }${RESET}`);
    say(`  ${DIM}Without that, the installation deploys it everywhere instead of only where this${RESET}`);
    say(`  ${DIM}extension is installed — and "microteia pack" refuses a package whose counts disagree.${RESET}`);
    return 0;
  } finally {
    await asker.close();
  }
};

/**
 * As versões de `firebase-functions` e `firebase-admin` que a INSTALAÇÃO usa.
 *
 * Lidas do `package.json` das functions do pacote, e não escritas aqui: a function do escritório é
 * compilada junto com as do kernel, contra as dependências dele. Escrever à mão foi o primeiro caminho, e
 * durou um teste — `firebase-admin@^14` não satisfaz o peer de `firebase-functions@6`, e o `npm install`
 * parava com ERESOLVE. Derivar do pacote não tem como divergir.
 */
const functionDependencies = (workspace: string): Record<string, string> => {
  const fallback = { 'firebase-admin': '^12.0.0', 'firebase-functions': '^6.0.0' };
  for (const candidate of [
    join(workspace, '../.microteia/install/functions/package.json'),
    join(workspace, '.microteia/install/functions/package.json'),
  ]) {
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as {
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
  return fallback;
};

/**
 * Declara `firebase-functions` e `firebase-admin` no `package.json` do workspace, se ainda não estiverem.
 * Ficam fora por padrão porque são pesadas e quem só declara telas não precisa delas — mas no instante em
 * que existe uma function escrita, não declará-las é deixar o molde sublinhado sem motivo aparente.
 */
const ensureFunctionTypes = (workspace: string): boolean => {
  const path = join(workspace, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as {
      devDependencies?: Record<string, string>;
    };
    const devDependencies = pkg.devDependencies ?? {};
    const wanted = functionDependencies(workspace);
    const missing = Object.keys(wanted).filter((name) => devDependencies[name] === undefined);
    if (missing.length === 0) return false;

    for (const name of missing) devDependencies[name] = wanted[name];
    pkg.devDependencies = Object.fromEntries(
      Object.entries(devDependencies).sort(([left], [right]) => left.localeCompare(right)),
    );
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
};

/** O id declarado no `plugin.ts`, para o nome da function sair do id e não do nome da pasta. */
const pluginIdOf = (directory: string): string | null => {
  try {
    const source = readFileSync(join(directory, 'plugin.ts'), 'utf8');
    return /NAMESPACE = '([^']+)'/.exec(source)?.[1] ?? null;
  } catch {
    return null;
  }
};

const create = async (args: Args): Promise<number> =>
  args.positional[1] === 'function' ? createFunction(args) : createPlugin(args);

/**
 * Reescreve o que é gerado neste diretório a partir do SDK instalado. O que o escritório escreveu —
 * `CLAUDE.md`, `README.md` e toda pasta de extensão — não é tocado; as duas sementes nascem se
 * faltarem. Idempotente: rodar duas vezes produz os mesmos bytes.
 */
const sync = (args: Args): number => {
  const root = resolve(args.values.get('root') ?? process.cwd());
  const install = args.values.get('install');
  const report = syncWorkspace({
    root,
    install: install === undefined ? undefined : resolve(install),
    officeName: args.values.get('office'),
  });

  say(`${BOLD}Microteia extensions${RESET} ${DIM}(kernel contract ${report.kernelVersion})${RESET}`);
  say();
  say(`  rewrote    ${report.rewritten.join(', ')}`);
  if (report.reconciled.length > 0) {
    say(`  completed  ${report.reconciled.join(', ')} ${DIM}— added what was missing, changed nothing else${RESET}`);
  }
  if (report.seeded.length > 0) {
    say(`  created    ${report.seeded.join(', ')} ${DIM}— yours, nothing rewrites them${RESET}`);
  }
  if (report.examples > 0) say(`  examples   ${report.examples} first-party extension(s), as source`);

  /**
   * As divergências saem por último e uma por linha, porque cada uma é uma decisão de quem escreveu o
   * arquivo. O `sync` não as resolve de propósito: acertar sozinho seria desfazer trabalho em silêncio.
   */
  if (report.warnings.length > 0) {
    say();
    say(`${YELLOW}Left alone, because the file says something else:${RESET}`);
    for (const warning of report.warnings) say(`  ${YELLOW}!${RESET} ${warning}`);
  }

  if (report.packageJson === 'missing') {
    say();
    problem('No package.json here. Run "microteia plugin-init" to create this directory.');
    return 1;
  }
  say();
  return 0;
};

interface Command {
  name: string;
  usage: string;
  summary: string;
  run: (args: Args) => number | Promise<number>;
}

const COMMANDS: Command[] = [
  {
    name: 'create',
    usage:
      'microteia-plugin create [<name>|<namespace.name>] [--namespace <com.acme>] [--dir <path>] [--force] [--yes]\n'
      + '  microteia-plugin create function [--plugin <folder>] [--trigger <collection>]\n'
      + '                                   [--schedule "<cron>"] [--yes]',
    summary: 'Create an extension, guided by a few questions. "create function" adds a Cloud Function.',
    run: create,
  },
  {
    name: 'check',
    usage: 'microteia-plugin check [plugin.ts] [--export <name>] [--root <path>]',
    summary: 'Compile and validate without writing. This is the gate - run it before publishing.',
    run: (args) => build(args, false),
  },
  {
    name: 'build',
    usage: 'microteia-plugin build [plugin.ts] [--out <dir>] [--export <name>] [--force] [--root <path>]',
    summary: 'Compile to the .json the platform installs.',
    run: (args) => build(args, true),
  },
  {
    name: 'sync',
    usage: 'microteia-plugin sync [--root <path>] [--install <path>] [--office <name>]',
    summary: 'Rewrite the generated files here from the installed SDK. Your own files are never touched.',
    run: (args) => sync(args),
  },
  {
    name: 'mcp',
    usage: 'microteia-plugin mcp [--root <path>]',
    summary: 'Serve this workspace to an AI assistant over MCP (stdio).',
    run: (args) => serveMcp(args.values.get('root') ?? process.cwd()),
  },
];

const version = (): string => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const help = (): void => {
  say(`${BOLD}Microteia plugin SDK${RESET} ${version()} ${DIM}(kernel contract ${KERNEL_VERSION})${RESET}`);
  say();
  say('Author Microteia extensions in TypeScript. The .json is the artifact, not the source.');
  say();
  for (const command of COMMANDS) say(`  ${command.name.padEnd(7)}${command.summary}`);
  say();
  say('Run "microteia-plugin <command> --help" for usage.');
  say();
};

const main = async (): Promise<number> => {
  const [name] = process.argv.slice(2);

  if (name === undefined || name === 'help' || name === '--help' || name === '-h') {
    help();
    return 0;
  }
  if (name === '--version' || name === '-v') {
    say(version());
    return 0;
  }

  const command = COMMANDS.find((candidate) => candidate.name === name);
  if (command === undefined) {
    problem(`Unknown command "${name}".`);
    help();
    return 1;
  }

  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has('help')) {
    say();
    say(command.usage);
    say();
    say(command.summary);
    say();
    return 0;
  }

  return command.run(args);
};

main()
  .then((code) => { process.exitCode = code; })
  .catch((error: unknown) => {
    problem(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
