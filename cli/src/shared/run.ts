import { spawn } from 'node:child_process';

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CaptureResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * O erro carrega o comando e a saída para que a falha seja legível sem ter que reproduzir a mão.
 * O `deploy-functions-individually.cjs` roda os deploys com `stdio: 'pipe'` e descarta a saída no
 * catch — a falha vira só "❌ Falha no deploy de X", e descobrir o motivo exige rodar de novo. Aqui
 * a saída capturada é sempre reanexada ao erro.
 */
export interface CommandError extends Error {
  command: string;
  code: number;
  stdout: string;
  stderr: string;
}

const commandLine = (command: string, args: string[]): string => [command, ...args].join(' ');

const commandError = (
  command: string,
  args: string[],
  code: number,
  stdout: string,
  stderr: string,
): CommandError => {
  const detail = [stderr.trim(), stdout.trim()].filter((part) => part !== '').join('\n');
  const error = new Error(
    `Command failed (exit ${code}): ${commandLine(command, args)}${detail === '' ? '' : `\n${detail}`}`,
  ) as CommandError;
  error.command = commandLine(command, args);
  error.code = code;
  error.stdout = stdout;
  error.stderr = stderr;
  return error;
};

/** Executa herdando stdio: a saída do `firebase` e do `npm` vai direto para o terminal de quem instala. */
export const run = (command: string, args: string[], options: RunOptions = {}): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env === undefined ? process.env : { ...process.env, ...options.env },
      stdio: 'inherit',
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(commandError(command, args, code ?? -1, '', ''));
    });
  });

/** Executa capturando a saída, para quando ela é DADO (`firebase apps:sdkconfig --json`). */
export const capture = (
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<CaptureResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env === undefined ? process.env : { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });

/** Como `capture`, mas exige sucesso. Use quando a saída é dado e a falha é fatal. */
export const captureOrThrow = async (
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<string> => {
  const result = await capture(command, args, options);
  if (result.code !== 0) {
    throw commandError(command, args, result.code, result.stdout, result.stderr);
  }
  return result.stdout;
};

export const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });
