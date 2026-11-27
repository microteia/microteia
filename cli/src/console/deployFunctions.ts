import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { capture, sleep } from '../shared/run.js';
import { blank, failure, info, pending, success } from '../shared/ui.js';
import { FIREBASE_BIN } from './firebaseCli.js';

export interface FunctionDeployOptions {
  projectId: string;
  cwd: string;
  delaySeconds: number;
  /** `--force` deixa o Firebase configurar sozinho a política de limpeza do Artifact Registry. */
  force: boolean;
  /**
   * As functions que ainda têm cópia numa região abandonada, como `clearRegionOrphans` devolve;
   * `null` quando não deu para saber. Só fora dele a recusa da política de repetição é contornada.
   */
  standingCopies: ReadonlySet<string> | null;
  /**
   * O `firebase.json` sem o `predeploy` das functions (`writeFunctionsDeployConfig`), quando quem chama já
   * compilou. Ausente: o do diretório, e cada comando compila de novo.
   */
  config?: string;
  /** Quantas functions por comando. Ausente: `DEFAULT_FUNCTION_BATCH`. */
  batchSize?: number;
}

export interface FunctionDeployFailure {
  name: string;
  /** A saída do `firebase`, sem os avisos que não têm relação com o resultado. */
  output: string;
  /** A linha que explica a falha. */
  reason: string;
  /** Repetir dá o mesmo resultado: é uma recusa do `firebase`, não uma corrida com o Google. */
  terminal: boolean;
  /** O que fazer a respeito, quando dá para dizer. Impresso UMA vez, não uma por function. */
  hint: string[];
}

export interface FunctionDeployReport {
  deployed: string[];
  failed: FunctionDeployFailure[];
  /** Avisos que valem uma linha no fim do deploy, e não uma linha por function. */
  notices: string[];
}

/**
 * Os avisos que o `firebase` escreve DIRETO no stderr e que não dizem nada sobre esta falha.
 *
 * Tirá-los daqui é o que faz o motivo voltar a ser o motivo. O bloco de descontinuação do Runtime
 * Config sai em TODO deploy de um projeto que ainda tenha valor legado de `functions:config`, e é a
 * única coisa que o `firebase` manda pelo stderr — o erro de verdade sai pelo stdout, porque o
 * transporte de console do logger dele não declara `stderrLevels`. Como a saída capturada era
 * `stdout + stderr` e a busca era pela ÚLTIMA linha casada, o aviso ficava sempre por último e
 * aparecia como motivo de toda function que falhava. Foram oito functions travadas por causa de
 * região antiga sem que uma linha do erro real chegasse a ser impressa.
 *
 * Cada aviso é um bloco contíguo: a linha de título e as seguintes que ainda falam do mesmo assunto.
 * Reconhecer o fim pelo ASSUNTO, e não por um número de linhas, é o que evita engolir o que vier
 * depois dele.
 */
interface Notice {
  title: RegExp;
  body: RegExp;
  summary: string;
}

const NOTICES: Notice[] = [
  {
    title: /DEPRECATION NOTICE/,
    body: /functions[.:]config|Runtime Config|params package|config-env/,
    summary: 'this project still holds legacy functions:config values. They keep working, but Firebase'
      + ' shuts Runtime Config down in March 2027 and deploys that read it stop working then.'
      + ' "firebase functions:config:get" lists what is there.',
  },
];

export const stripNotices = (text: string): { text: string; summaries: string[] } => {
  const lines = text.split('\n');
  const kept: string[] = [];
  const summaries: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const notice = NOTICES.find((candidate) => candidate.title.test(lines[index]));
    if (notice === undefined) {
      kept.push(lines[index]);
      continue;
    }

    summaries.push(notice.summary);
    index += 1;
    while (index < lines.length && (lines[index].trim() === '' || notice.body.test(lines[index]))) {
      index += 1;
    }
    index -= 1;
  }

  return { text: kept.join('\n'), summaries };
};

/**
 * A linha que EXPLICA a falha, tirada da saída do `firebase`.
 *
 * Existe porque imprimir só `fail  [13/23] auditNestedEntityChange` não deixa nada a fazer para quem
 * está instalando: se a segunda passada resolver, o motivo é descartado e nunca chega a ser visto; se
 * não resolver, ele só aparece no fim, depois de mais dez minutos de deploy. O motivo tem de sair no
 * momento da falha.
 *
 * A escolha é por QUANTO a linha informa, e não por onde ela está. Nem a primeira nem a última
 * servem: uma falha real imprime três coisas parecidas em sequência — quem falhou
 * (`failed to create function <nome>`), por que falhou (`HTTP Error: 400, Invalid trigger`) e o
 * epílogo (`There was an error deploying functions`), e a ordem entre as duas primeiras varia. Por
 * posição, sempre se perde uma das duas: pela última vinha o epílogo, pela primeira viria o nome de
 * quem falhou — que o `fail` da linha de cima já disse.
 */
const REASON_LIMIT = 240;

/** Carrega a CAUSA: é ela que diz algo que o resto da saída não diz. */
const CAUSE = /(^|\s)(Error:|HTTP Error|functions\[|✖)/;

/** Só nomeia quem falhou. Vale como motivo apenas quando a causa não foi impressa. */
const SUBJECT = /failed to (create|update|delete)/;

/** O epílogo do `firebase`: verdadeiro em toda falha e específico em nenhuma. */
const EPILOGUE = /^Error: There was an error deploying functions/;

export const failureReason = (output: string): string => {
  const lines = stripVTControlCharacters(output)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const chosen = lines.find((line) => CAUSE.test(line) && !EPILOGUE.test(line))
    ?? lines.find((line) => SUBJECT.test(line))
    ?? lines.find((line) => EPILOGUE.test(line))
    ?? lines[lines.length - 1]
    ?? 'no output from firebase';

  return chosen.length > REASON_LIMIT ? `${chosen.slice(0, REASON_LIMIT - 1)}…` : chosen;
};

/**
 * A falha que repetir não conserta.
 *
 * A segunda passada existe para UMA coisa (identidade de serviço que ainda não propagou), e tratá-la
 * como remédio de tudo custa uma rodada inteira de deploy por function — a de região antiga leva
 * ~40s cada, e a resposta da segunda vez é palavra por palavra a mesma. Pior: repetir sugere a quem
 * está olhando que aquilo é intermitente, quando é uma recusa deliberada do `firebase`.
 */
export interface TerminalFailure {
  match: RegExp;
  hint: string[];
}

/**
 * A recusa do `firebase` sem terminal diante de uma function que passa a ter `retry`.
 *
 * Com terminal ele pergunta "Would you like to proceed with deployment?"; sem, recusa e pede
 * `--force`. A pergunta é sobre o que o PRÓPRIO código declarou (`retry: true` no gatilho), e quem
 * declarou já respondeu: repetir a entrega é o que torna o gatilho confiável. Por isso a recusa é
 * contornada com `--force` naquela function, e só nela — e só quando não há cópia dela em outra
 * região, porque o mesmo `--force` faria o `firebase` apagar essa cópia sem perguntar.
 *
 * A pergunta só existe na primeira vez: com a function no ar já com `retry`, ela não volta.
 */
export const FAILURE_POLICY_REFUSAL = /Pass the --force option to deploy functions with a failure policy/;

const TERMINAL_FAILURES: TerminalFailure[] = [
  {
    match: /Aborting because deletion cannot proceed in non-interactive mode/,
    hint: [
      'The project holds a copy of this function that the source no longer declares — almost always',
      'a leftover in a region the package moved away from. The Firebase CLI will not deploy over it',
      'and cannot ask for permission here, so it refuses. Delete the old copy:',
      '  microteia deploy --prune',
    ],
  },
  {
    match: FAILURE_POLICY_REFUSAL,
    hint: [
      'The function now retries failed deliveries, and the Firebase CLI asks to confirm that once.',
      'It was not confirmed here because the project may still hold a copy of the function in another',
      'region, which the same confirmation would delete without asking. Remove old copies first:',
      '  microteia deploy --prune',
    ],
  },
  {
    match: /does not have a default and cannot be answered in non-interactive mode/,
    hint: [
      'The Firebase CLI needed an answer and this deploy has no terminal to ask it. Run the same',
      'deploy by hand once, from the installation directory, answer the question, and then run',
      '"microteia deploy" again.',
    ],
  },
];

export const terminalFailure = (output: string): TerminalFailure | undefined => {
  const clean = stripVTControlCharacters(output);
  return TERMINAL_FAILURES.find((candidate) => candidate.match.test(clean));
};

/**
 * A function SUBIU, e o `firebase` sai com erro mesmo assim.
 *
 * Sem `--force` ele não cria sozinho a política de limpeza do Artifact Registry e encerra com
 * "Functions successfully deployed but could not set up cleanup policy" — código de saída de falha
 * para um deploy que deu certo. Contado como falha, cada function ia para a segunda passada, falhava de
 * novo do mesmo jeito e terminava no relatório como fora do ar, quando estava no ar. O que falta é uma
 * configuração do projeto, feita uma vez, e por isso vira um aviso único no fim, não uma falha por
 * function. Devolve a região sem política, ou `null`.
 */
const CLEANUP_POLICY_GAP = /Functions successfully deployed but could not set up cleanup policy in location (\S+?)\.?(\s|$)/;

export const missingCleanupPolicy = (output: string): string | null =>
  CLEANUP_POLICY_GAP.exec(stripVTControlCharacters(output))?.[1] ?? null;

export const cleanupPolicyNotice = (location: string, projectId: string): string =>
  `the function images in ${location} have no cleanup policy, so old ones pile up in Artifact Registry`
  + ' and are billed. Set it once with:'
  + ` firebase functions:artifacts:setpolicy --location ${location} --project ${projectId} --force`;

/**
 * O `firebase.json` do deploy de functions, sem o `predeploy` delas.
 *
 * O `predeploy` compila as functions a CADA `firebase deploy`, e o deploy é uma sequência de comandos:
 * mais de cem compilações da mesma fonte. Quem chama compila uma vez e passa este arquivo em `--config`.
 * Ele fica ao lado do original, porque o `firebase` resolve `source` e o `.firebaserc` a partir do
 * diretório do arquivo de configuração.
 */
export const FUNCTIONS_DEPLOY_CONFIG = 'firebase.functions-deploy.json';

export const withoutFunctionsPredeploy = (firebaseJson: string): string => {
  const config = JSON.parse(firebaseJson) as { functions?: unknown };
  const strip = (entry: unknown): unknown => {
    if (typeof entry !== 'object' || entry === null) return entry;
    const rest: Record<string, unknown> = { ...entry };
    delete rest.predeploy;
    return rest;
  };
  if (config.functions !== undefined) {
    config.functions = Array.isArray(config.functions) ? config.functions.map(strip) : strip(config.functions);
  }
  return `${JSON.stringify(config, null, 2)}\n`;
};

export const writeFunctionsDeployConfig = async (directory: string): Promise<string> => {
  const path = join(directory, FUNCTIONS_DEPLOY_CONFIG);
  await writeFile(path, withoutFunctionsPredeploy(await readFile(join(directory, 'firebase.json'), 'utf8')));
  return path;
};

/**
 * Quantas functions vão num mesmo `firebase deploy`.
 *
 * Cada comando paga um custo fixo antes de tocar em qualquer function: carrega o código para descobrir
 * as functions, compacta e envia o diretório inteiro. Uma a uma, eram mais de cem vezes esse custo
 * para subir a mesma fonte. Num lote, ele é pago uma vez, e o `firebase` sobe as functions do lote em
 * paralelo, com o controle de concorrência dele.
 *
 * O lote não é o `--only functions` inteiro porque é ESSE que estoura a quota de CPU do projeto — o
 * motivo de o deploy ter sido uma a uma desde o início. O número abaixo foi medido no `microteia-dev`
 * (ver "Deploy das functions — em lotes" no `ARCHITECTURE.md`), e `--batch` o troca.
 */
export const DEFAULT_FUNCTION_BATCH = 20;

/**
 * Um `firebase deploy --only functions:a,functions:b,...` — com um nome só, é o deploy de uma function.
 *
 * A segunda passada não é teimosia: numa instalação nova as identidades de serviço do Pub/Sub e do
 * Eventarc são criadas DURANTE o primeiro deploy e não propagam a tempo, então toda function de
 * gatilho falha enquanto as callables sobem normalmente. Repetir resolve, e sem isso a primeira
 * instalação parece quebrada quando está apenas incompleta.
 */
const deployCommand = async (
  names: string[],
  options: FunctionDeployOptions,
  force = options.force,
): Promise<{ ok: boolean; succeeded: string[]; output: string; notices: string[]; seconds: number }> => {
  const args = ['deploy', '--only', names.map((name) => `functions:${name}`).join(','), '--project', options.projectId];
  if (options.config !== undefined) args.push('--config', options.config);
  if (force) args.push('--force');

  const startedAt = Date.now();
  const result = await capture(FIREBASE_BIN, args, { cwd: options.cwd });
  const cleaned = stripNotices(`${result.stdout}${result.stderr}`);
  const policyGap = result.code === 0 ? null : missingCleanupPolicy(cleaned.text);
  const ok = result.code === 0 || policyGap !== null;

  return {
    ok,
    succeeded: ok ? [...names] : succeededIn(cleaned.text, names),
    output: cleaned.text.trim(),
    notices: policyGap === null
      ? cleaned.summaries
      : [...cleaned.summaries, cleanupPolicyNotice(policyGap, options.projectId)],
    seconds: Math.round((Date.now() - startedAt) / 1000),
  };
};

/**
 * As functions que o `firebase` declarou no ar, num lote que terminou em erro.
 *
 * Um lote falha por inteiro quando o `firebase` recusa ANTES de deployar (cópia em outra região,
 * política de repetição a confirmar) e falha em parte quando uma function esbarra na quota ou no
 * build. Só a linha de sucesso dele separa os dois casos — `functions[nome(região)] Successful update
 * operation.` (`release/fabricator.js`). Não achar a linha nunca vira "subiu": a function volta para
 * ser deployada sozinha, que é o caminho que sabe explicar a falha.
 */
const SUCCESS_LINE = /functions\[([A-Za-z0-9_-]+)\([^)]*\)\] Successful (?:create|update) operation/g;

export const succeededIn = (output: string, names: readonly string[]): string[] => {
  const reported = new Set([...stripVTControlCharacters(output).matchAll(SUCCESS_LINE)].map((match) => match[1]));
  return names.filter((name) => reported.has(name));
};

export const mayConfirmRetryPolicy = (
  name: string,
  output: string,
  options: FunctionDeployOptions,
): boolean => !options.force
  && options.standingCopies !== null
  && !options.standingCopies.has(name)
  && FAILURE_POLICY_REFUSAL.test(stripVTControlCharacters(output));

/** Tamanho que não é um inteiro positivo (`--batch abc`, `--batch 0`) vira uma a uma. */
export const batchSizeOf = (size: number | undefined): number =>
  size !== undefined && Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;

export const batchesOf = <T>(items: readonly T[], size: number): T[][] => {
  const step = batchSizeOf(size);
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += step) batches.push(items.slice(index, index + step));
  return batches;
};

/**
 * O deploy de uma lista de functions: em lotes de `batchSize`, e o que um lote não subiu é tentado
 * SOZINHO, na mesma passada.
 *
 * Sozinho porque é ali que cada falha tem nome e motivo: a saída de um lote mistura as functions, e a
 * recusa da política de repetição, que se contorna com `--force` naquela function e só nela, não tem
 * como ser contornada no lote sem forçar as outras. O lote é o atalho do caso comum; o caminho de uma
 * function é o que sabe lidar com o resto.
 */
export const deployFunctionList = async (
  names: string[],
  options: FunctionDeployOptions,
): Promise<FunctionDeployReport> => {
  const deployed: string[] = [];
  const failed: FunctionDeployFailure[] = [];
  const notices = new Set<string>();
  const batchSize = batchSizeOf(options.batchSize ?? DEFAULT_FUNCTION_BATCH);
  let remaining = names;

  for (let pass = 1; pass <= 2 && remaining.length > 0; pass += 1) {
    if (pass === 2) {
      info(`\n  Retrying ${remaining.length} function(s). On a new project the Pub/Sub and Eventarc`);
      info('  service identities are created during the first deploy and do not propagate in time.');
    } else if (options.force) {
      // Só na PRIMEIRA instalação, que é o que `force` significa: é ali que o Firebase provisiona build
      // e Artifact Registry, e a primeira function leva vários minutos. Dizer isso ANTES é o que separa
      // "demorado" de "travado" para quem está olhando. Num `provision` de projeto já montado a dica
      // seria falsa, e por isso ela não aparece lá.
      info(`  the first of the ${remaining.length} takes the longest — on a new project Firebase sets`);
      info('  up the build infrastructure before it can deploy anything.');
    }

    const retryable: string[] = [];
    const total = remaining.length;
    let position = 0;

    const attemptAlone = async (name: string): Promise<void> => {
      const label = `[${position}/${total}] ${name}`;
      pending(label);
      let { ok, output, notices: given, seconds } = await deployCommand([name], options);
      for (const notice of given) notices.add(notice);

      if (!ok && mayConfirmRetryPolicy(name, output, options)) {
        info(`        ${name} now retries failed deliveries, as its source declares: confirming it`);
        ({ ok, output, notices: given, seconds } = await deployCommand([name], options, true));
        for (const notice of given) notices.add(notice);
      }

      if (ok) {
        success(`${label} (${seconds}s)`);
        deployed.push(name);
        return;
      }

      const terminal = terminalFailure(output);
      const reason = failureReason(output);
      failure(`${label} (failed after ${seconds}s)`);
      // O motivo AGORA, não só no relatório final: numa instalação nova as functions de gatilho
      // falham na primeira passada por propagação de identidade de serviço, a segunda resolve, e sem
      // esta linha quem instala vê um "fail" que nunca é explicado.
      info(`        ${reason}`);

      if (terminal === undefined && pass === 1) {
        info('        retrying at the end of this pass');
        retryable.push(name);
      } else {
        if (terminal !== undefined) info('        repeating this does not change the answer');
        failed.push({
          name,
          output,
          reason,
          terminal: terminal !== undefined,
          hint: terminal?.hint ?? [],
        });
      }
    };

    const batches = batchesOf(remaining, batchSize);
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];

      if (batch.length === 1) {
        position += 1;
        await attemptAlone(batch[0]);
      } else {
        const first = position + 1;
        const label = `[${first}-${position + batch.length}/${total}] ${batch.length} functions`;
        pending(`${label}: ${batch.join(', ')}`);
        const result = await deployCommand(batch, options);
        for (const notice of result.notices) notices.add(notice);

        const left = batch.filter((name) => !result.succeeded.includes(name));
        if (left.length === 0) success(`${label} (${result.seconds}s)`);
        else {
          failure(`${label}: ${result.succeeded.length} up, ${left.length} not (${result.seconds}s)`);
          info(`        ${failureReason(result.output)}`);
          info('        deploying those one at a time, to tell why');
        }
        deployed.push(...result.succeeded);
        position += result.succeeded.length;

        for (const name of left) {
          position += 1;
          await attemptAlone(name);
        }
      }

      if (index < batches.length - 1 && options.delaySeconds > 0) {
        await sleep(options.delaySeconds);
      }
    }

    remaining = retryable;
  }

  return { deployed, failed, notices: [...notices] };
};

/**
 * O relatório do que não subiu, no fim do comando.
 *
 * Mora aqui, e não em cada comando, porque `deploy` e `provision` imprimiam o mesmo bloco escrito
 * duas vezes — e a cauda de 12 linhas dos dois mostrava o rodapé do aviso de descontinuação, não o
 * erro. A dica sai UMA vez por motivo distinto: oito functions barradas pela mesma região antiga são
 * um problema, não oito.
 */
const TAIL_LINES = 12;

export const reportFailures = (failures: FunctionDeployFailure[]): void => {
  const hints = new Set<string>();

  for (const entry of failures) {
    failure(entry.name);
    info(entry.output.split('\n').slice(-TAIL_LINES).map((line) => `      ${line}`).join('\n'));
    if (entry.hint.length > 0) hints.add(entry.hint.join('\n'));
  }

  for (const hint of hints) {
    blank();
    for (const line of hint.split('\n')) info(`  ${line}`);
  }
};

export const reportNotices = (notices: string[]): void => {
  for (const notice of notices) {
    blank();
    info(`  Note: ${notice}`);
  }
};
