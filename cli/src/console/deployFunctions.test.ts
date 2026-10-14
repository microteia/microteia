import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';
import {
  failureReason,
  mayConfirmRetryPolicy,
  stripNotices,
  terminalFailure,
  type FunctionDeployOptions,
} from './deployFunctions.js';

/**
 * A saída de um `firebase deploy --only functions:<nome>` que falhou porque a mesma function ainda
 * existe numa região que a fonte não declara mais. É o caso real que motivou tudo isto: oito
 * functions barradas, duas passadas cada, e nenhuma linha do erro impressa.
 *
 * Os dois fluxos estão separados de propósito, e nesta ordem, porque é assim que o `capture` os
 * concatena. O erro sai pelo STDOUT — o transporte de console do logger do `firebase` não declara
 * `stderrLevels`, então até `logger.error` vai para lá — e o stderr carrega só o aviso.
 */
const deletionAbortStdout = [
  'i  deploying functions',
  'i  functions: preparing functions directory for uploading...',
  'i  functions: packaged functions (1.02 MB) for uploading',
  '',
  'Error: The following functions are found in your project but do not exist in your local source code:',
  '\tcallAIProxy(us-central1)',
  '',
  'Aborting because deletion cannot proceed in non-interactive mode. To fix, manually delete the functions by running:',
  '\tfirebase functions:delete callAIProxy --region us-central1',
  '',
].join('\n');

const deprecationStderr = [
  '⚠ DEPRECATION NOTICE: Action required before March 2027',
  '',
  'The functions.config() API and the Cloud Runtime Config service are deprecated. Deploys that rely'
  + ' on functions.config() will fail once Runtime Config shuts down in March 2027.',
  '',
  'The legacy functions:config:* CLI commands are deprecated and will be removed before March 2027.',
  '',
  'Learn how to migrate from functions.config() to the params package:',
  '',
  'https://firebase.google.com/docs/functions/config-env#migrate-config',
  '',
  'To convert existing functions.config() values to params, try the interactive migration command:',
  '',
  '  firebase functions:config:export',
  '',
].join('\n');

const buildFailureStdout = [
  'i  deploying functions',
  'i  functions: updating Node.js 22 function callAIProxy(southamerica-east1)...',
  'functions[callAIProxy(southamerica-east1)]: Deployment error. Build failed: npm ci exited with code 1',
  '⚠  functions: failed to update function projects/acme/locations/southamerica-east1/functions/callAIProxy',
  '',
  'Functions deploy had errors with the following functions:',
  '\tcallAIProxy(southamerica-east1)',
  '',
  'i  functions: cleaning up build files...',
  '',
  'Error: There was an error deploying functions',
  '',
].join('\n');

describe('o aviso de descontinuação sai do caminho do diagnóstico', () => {
  it('reconhece o bloco inteiro e devolve um resumo no lugar dele', () => {
    const { text, summaries } = stripNotices(deprecationStderr);

    expect(text.trim()).toBe('');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toContain('March 2027');
  });

  it('para no fim do bloco, sem engolir o que vier depois', () => {
    const { text } = stripNotices(`${deprecationStderr}Error: something else entirely\n`);
    expect(text).toContain('Error: something else entirely');
    expect(text).not.toContain('DEPRECATION');
  });

  it('não mexe numa saída que não tem aviso nenhum', () => {
    expect(stripNotices(buildFailureStdout)).toEqual({
      text: buildFailureStdout,
      summaries: [],
    });
  });
});

describe('o motivo impresso é o motivo da falha', () => {
  /**
   * A regressão que existiu: o aviso é a única coisa que o `firebase` manda pelo stderr, a saída
   * capturada é `stdout + stderr`, e a busca era pela ÚLTIMA linha casada — com `⚠` no padrão. Toda
   * function que falhava era relatada como "DEPRECATION NOTICE", em vez do motivo dela.
   */
  it('não devolve o aviso de descontinuação quando ele é a última linha da saída', () => {
    const { text } = stripNotices(`${deletionAbortStdout}${deprecationStderr}`);
    const reason = failureReason(text);

    expect(reason).not.toContain('DEPRECATION');
    expect(reason).toContain('do not exist in your local source code');
  });

  it('prefere a causa ao epílogo que toda falha de deploy imprime', () => {
    const reason = failureReason(buildFailureStdout);

    expect(reason).toBe(
      'functions[callAIProxy(southamerica-east1)]: Deployment error. Build failed: npm ci exited with code 1',
    );
    expect(reason).not.toContain('There was an error deploying functions');
  });

  /**
   * A ordem entre "quem falhou" e "por que falhou" varia entre um caso e outro, e por isso a escolha
   * não pode ser por posição: aqui a causa vem DEPOIS do nome, e no caso de build vem antes.
   */
  it('prefere a causa ao nome de quem falhou, venha ela antes ou depois', () => {
    const nameFirst = [
      '⚠  functions: failed to create function auditNestedEntityChange',
      'Error: Request to https://cloudfunctions.googleapis.com/... had HTTP Error: 400, Invalid trigger',
      '',
    ].join('\n');

    expect(failureReason(nameFirst)).toContain('HTTP Error: 400');
  });

  it('cai no nome de quem falhou quando a causa não foi impressa', () => {
    const nameOnly = [
      'i  deploying functions',
      '⚠  functions: failed to create function auditNestedEntityChange',
      '',
    ].join('\n');

    expect(failureReason(nameOnly)).toContain('auditNestedEntityChange');
  });

  it('cai no epílogo quando não há nada mais específico', () => {
    expect(failureReason('i  deploying functions\n\nError: There was an error deploying functions\n'))
      .toBe('Error: There was an error deploying functions');
  });

  it('atravessa a coloração do terminal', () => {
    const bold = '\u001b[1m';
    const red = '\u001b[31m';
    const reset = '\u001b[0m';
    const colored = `i  deploying\n${bold}${red}Error:${reset} HTTP Error: 403, Permission denied\n`;

    expect(failureReason(colored)).toBe('Error: HTTP Error: 403, Permission denied');
  });

  it('diz que não houve saída em vez de devolver vazio', () => {
    expect(failureReason('')).toBe('no output from firebase');
  });
});

describe('a segunda passada só volta ao que repetir pode consertar', () => {
  /**
   * Ela existe para UMA coisa: numa instalação nova as identidades de serviço do Pub/Sub e do
   * Eventarc são criadas durante o primeiro deploy e não propagam a tempo. Tratá-la como remédio de
   * tudo custou, neste caso, oito deploys de quarenta segundos para receber palavra por palavra a
   * mesma recusa — e sugeriu a quem olhava que aquilo era intermitente.
   */
  it('reconhece a recusa de apagar sem terminal, e diz o que fazer', () => {
    const found = terminalFailure(deletionAbortStdout);

    expect(found).toBeDefined();
    expect(found?.hint.join(' ')).toContain('microteia deploy --prune');
  });

  it('reconhece a pergunta sem resposta possível', () => {
    const output = 'Error: Question "Overwrite?" does not have a default and cannot be answered'
      + ' in non-interactive mode';

    expect(terminalFailure(output)).toBeDefined();
  });

  /**
   * A falha de build e a de propagação continuam merecendo a repetição: a primeira pode ser uma
   * instabilidade do Cloud Build, e a segunda é exatamente o que a segunda passada existe para
   * resolver. Marcá-las como definitivas trocaria um defeito pelo oposto dele.
   */
  it('deixa passar o que pode mesmo melhorar na segunda tentativa', () => {
    expect(terminalFailure(buildFailureStdout)).toBeUndefined();
    expect(terminalFailure('HTTP Error: 403, The caller does not have permission')).toBeUndefined();
  });

  it('a definitiva não entra na fila da repetição', () => {
    const source = readFileSync(
      join(repoRoot, 'cli/src/console/deployFunctions.ts'),
      'utf8',
    );

    expect(source).toContain('if (terminal === undefined && pass === 1)');
    expect(source).toContain('retryable.push(name)');
  });
});

describe('a política de repetição que a própria fonte declara é confirmada sem terminal', () => {
  /**
   * O caso real: `runAggregateBackfill` e `runRecordKeyAdoption` declaram `retry: true`. Com
   * terminal, o `firebase` pergunta uma vez e o "Y" publica; sem terminal, ele recusa e pede
   * `--force` — e as duas ficavam fora do ar em todo `microteia deploy`.
   */
  const refusal = [
    '⚠  functions: The following functions will newly be retried in case of failure:'
      + ' runAggregateBackfill(southamerica-east1).',
    '',
    'Error: Pass the --force option to deploy functions with a failure policy',
  ].join('\n');

  const options = (standingCopies: ReadonlySet<string> | null, force = false): FunctionDeployOptions => ({
    projectId: 'office',
    cwd: '.',
    delaySeconds: 0,
    force,
    standingCopies,
  });

  it('confirma quando a function não tem cópia em outra região', () => {
    expect(mayConfirmRetryPolicy('runAggregateBackfill', refusal, options(new Set()))).toBe(true);
  });

  it('não confirma quando há cópia de pé em outra região, que o mesmo --force apagaria', () => {
    const standing = new Set(['runAggregateBackfill']);

    expect(mayConfirmRetryPolicy('runAggregateBackfill', refusal, options(standing))).toBe(false);
    expect(terminalFailure(refusal)?.hint.join(' ')).toContain('microteia deploy --prune');
  });

  it('não confirma quando não deu para saber o que o projeto roda', () => {
    expect(mayConfirmRetryPolicy('runAggregateBackfill', refusal, options(null))).toBe(false);
  });

  it('não repete o que já subiu com --force, nem confirma outra recusa', () => {
    expect(mayConfirmRetryPolicy('runAggregateBackfill', refusal, options(new Set(), true))).toBe(false);
    expect(mayConfirmRetryPolicy('runAggregateBackfill', deletionAbortStdout, options(new Set()))).toBe(false);
  });
});
