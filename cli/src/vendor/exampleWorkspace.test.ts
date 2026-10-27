import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import ts from 'typescript';
import { repoRoot } from '../shared/paths.js';
import { stageExamples } from './exampleSources.js';
import { workspaceTsconfig } from '../../../src/sdk/node/workspace/reconcile';
import { workspaceDevDependencies } from '../../../src/sdk/node/workspace/templates';
import {
  declaresFunctions,
  functionDependencies,
} from '../../../src/sdk/node/workspace/functionDependencies';
import { EXAMPLES_DIR } from '../../../src/sdk/node/workspacePlugins';

/**
 * Os exemplos são checados aqui por TRÊS projetos — `extsrc`, `extbackend` e `extscripts` —, e chegam ao
 * escritório para ser checados por UM: o `tsconfig.json` semeado em `extensions/`. Cada projeto daqui
 * passava, e o de lá acusava 21 erros: o `firebase-functions` que as functions importam não estava
 * declarado no workspace, e os scripts de sandbox não tinham os globais declarados em lugar nenhum.
 *
 * Este teste monta o workspace como o escritório o recebe — os exemplos como viajam, o `tsconfig.json`
 * da semente e, em `node_modules`, SÓ o que o `sync` declara — e exige zero diagnóstico. Uma dependência
 * que o `sync` não declare não está aqui, e o import dela reprova; é o que faz deste o portão da
 * afirmação que o `AGENTS.md` faz ao autor: um erro em `examples/` é defeito do pacote.
 */
let workspace: string;

/**
 * O pacote vem de `functions/node_modules` quando ele existe — é a versão que a instalação usa — e da raiz
 * quando não: a raiz tem outra série do `firebase-functions`, e um teste que só rodasse com as functions
 * instaladas seria um teste que só roda numa máquina.
 */
const installed = (name: string): string | null => [
  join(repoRoot, 'functions/node_modules', name),
  join(repoRoot, 'node_modules', name),
].find((candidate) => existsSync(candidate)) ?? null;

const link = async (name: string, target: string): Promise<void> => {
  const at = join(workspace, 'node_modules', name);
  await mkdir(dirname(at), { recursive: true });
  await symlink(target, at, 'dir');
};

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'microteia-workspace-'));
  await stageExamples(repoRoot, join(workspace, EXAMPLES_DIR));
  await writeFile(join(workspace, 'tsconfig.json'), workspaceTsconfig());
  await link('@microteia/sdk', join(repoRoot, 'sdk'));

  const declared = {
    ...workspaceDevDependencies(),
    ...(declaresFunctions(workspace, EXAMPLES_DIR) ? functionDependencies([repoRoot]) : {}),
  };
  for (const name of Object.keys(declared)) {
    const target = installed(name);
    if (target !== null) await link(name, target);
  }
});

afterAll(async () => {
  if (workspace !== undefined) await rm(workspace, { recursive: true, force: true });
});

const diagnose = (): string[] => {
  const parsed = ts.getParsedCommandLineOfConfigFile(join(workspace, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  if (parsed === undefined) throw new Error('tsconfig.json could not be parsed');

  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.file === undefined || diagnostic.start === undefined) return text;
    const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${relative(workspace, diagnostic.file.fileName)}:${line + 1} TS${diagnostic.code} ${text}`;
  });
};

describe('os exemplos, no workspace do escritório', () => {
  it('o SDK está construído — sem ele o caso abaixo não provaria nada', () => {
    expect(existsSync(join(repoRoot, 'sdk/lib/sdk/index.d.ts')), 'rode "npm run build:sdk"').toBe(true);
    expect(existsSync(join(repoRoot, 'sdk/types/microteia-sandbox.d.ts')), 'rode "npm run build:host-types"').toBe(true);
  });

  it('há function e script entre eles — sem os dois, o caso abaixo passaria por nada', () => {
    expect(declaresFunctions(workspace, EXAMPLES_DIR)).toBe(true);
    expect(existsSync(join(workspace, EXAMPLES_DIR, 'library-example/scripts'))).toBe(true);
  });

  it('passam no tsconfig.json semeado, com só as dependências que o sync declara', () => {
    expect(diagnose()).toEqual([]);
  }, 60_000);
});
