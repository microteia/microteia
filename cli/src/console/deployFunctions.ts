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
 * O deploy é UMA A UMA, e não `--only functions` de uma vez, porque em lote ele estoura a quota de
 * CPU do projeto — o motivo pelo qual `scripts/deploy-functions-individually.cjs` existe deste lado.
 * O cliente bate exatamente na mesma parede, com a diferença de que ele não tem o script.
 *
 * A segunda passada não é teimosia: numa instalação nova as identidades de serviço do Pub/Sub e do
 * Eventarc são criadas DURANTE o primeiro deploy e não propagam a tempo, então toda function de
 * gatilho falha enquanto as callables sobem normalmente. Repetir resolve, e sem isso a primeira
 * instalação parece quebrada quando está apenas incompleta.
 */
const deployOne = async (
  name: string,
  options: FunctionDeployOptions,
): Promise<{ ok: boolean; output: string; notices: string[]; seconds: number }> => {
  const args = ['deploy', '--only', `functions:${name}`, '--project', options.projectId];
  if (options.force) args.push('--force');

  const startedAt = Date.now();
  const result = await capture(FIREBASE_BIN, args, { cwd: options.cwd });
  const cleaned = stripNotices(`${result.stdout}${result.stderr}`);

  return {
    ok: result.code === 0,
    output: cleaned.text.trim(),
    notices: cleaned.summaries,
    seconds: Math.round((Date.now() - startedAt) / 1000),
  };
};

export const deployFunctionsOneByOne = async (
  names: string[],
  options: FunctionDeployOptions,
): Promise<FunctionDeployReport> => {
  const deployed: string[] = [];
  const failed: FunctionDeployFailure[] = [];
  const notices = new Set<string>();
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

    for (let index = 0; index < remaining.length; index += 1) {
      const name = remaining[index];
      const label = `[${index + 1}/${remaining.length}] ${name}`;

      pending(label);
      const { ok, output, notices: given, seconds } = await deployOne(name, options);
      for (const notice of given) notices.add(notice);

      if (ok) {
        success(`${label} (${seconds}s)`);
        deployed.push(name);
      } else {
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
      }

      if (index < remaining.length - 1 && options.delaySeconds > 0) {
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
