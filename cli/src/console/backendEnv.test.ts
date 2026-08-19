import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ensureOfficeEnv,
  ensureRootGitignore,
  officeEnvName,
  officeEnvPath,
  stageOfficeEnv,
} from './backendEnv.js';
import type { BackendParameter } from '../kernel/manifest.js';

/**
 * O defeito que este módulo existe para não repetir: a configuração de backend morava em
 * `.microteia/install/functions/.env.<projectId>`, e o `deploy` substitui o pacote por INTEIRO
 * (`rm -rf install` + rename do staging), preservando explicitamente só `functions/custom` e
 * `functions/node_modules`. Quem preenchia uma credencial à mão a perdia no deploy seguinte — e o pior
 * vinha depois: a impressão digital deixava de bater, o provisionamento marcava as functions como
 * obsoletas e as redeployava com a string VAZIA. O mecanismo escrito para detectar valor faltando
 * passava a ser a causa dele.
 *
 * Daí a fonte ser um arquivo na RAIZ, ao lado do `microteia.yaml`, e o que vive dentro de `install/`
 * ser uma cópia descartável.
 */
const PARAMETERS: BackendParameter[] = [
  { name: 'GOOGLE_CLIENT_ID', required: false },
  { name: 'GOOGLE_CLIENT_SECRET', required: false },
];

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'microteia-env-'));
});

describe('a configuração de backend do escritório', () => {
  it('mora ao lado do microteia.yaml, nunca dentro de .microteia', () => {
    expect(officeEnvName('curatino')).toBe('.env.curatino');
    expect(officeEnvPath('/office', 'curatino')).toBe('/office/.env.curatino');
  });

  it('nasce com todo parâmetro do pacote, vazio, e com um cabeçalho que explica o que fazer', async () => {
    const result = await ensureOfficeEnv(root, 'curatino', PARAMETERS);
    expect(result.created).toBe(true);
    expect(result.added).toEqual(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);

    const content = await readFile(officeEnvPath(root, 'curatino'), 'utf8');
    expect(content).toContain('GOOGLE_CLIENT_ID=');
    expect(content).toContain('microteia provision');
    expect(content).toContain('gitignored');
  });

  /**
   * O caso que perdia dado. O `firebase-functions` valida os `defineString` GLOBALMENTE: um parâmetro
   * novo sem entrada no arquivo recusa o deploy de TODAS as functions — então acrescentar é obrigatório,
   * e reescrever é inadmissível.
   */
  it('ACRESCENTA o que falta e nunca toca no que já foi preenchido', async () => {
    await ensureOfficeEnv(root, 'curatino', [PARAMETERS[0]]);
    const path = officeEnvPath(root, 'curatino');
    await writeFile(path, (await readFile(path, 'utf8')).replace('GOOGLE_CLIENT_ID=', 'GOOGLE_CLIENT_ID=segredo'));

    const result = await ensureOfficeEnv(root, 'curatino', PARAMETERS);
    expect(result.created).toBe(false);
    expect(result.added).toEqual(['GOOGLE_CLIENT_SECRET']);

    const content = await readFile(path, 'utf8');
    expect(content).toContain('GOOGLE_CLIENT_ID=segredo');
    expect(content).toContain('GOOGLE_CLIENT_SECRET=');
  });

  it('não faz nada quando o arquivo já declara tudo — nem uma linha em branco a mais', async () => {
    await ensureOfficeEnv(root, 'curatino', PARAMETERS);
    const before = await readFile(officeEnvPath(root, 'curatino'), 'utf8');

    const result = await ensureOfficeEnv(root, 'curatino', PARAMETERS);
    expect(result.added).toEqual([]);
    expect(await readFile(officeEnvPath(root, 'curatino'), 'utf8')).toBe(before);
  });

  it('um parâmetro comentado não conta como declarado', async () => {
    await writeFile(officeEnvPath(root, 'curatino'), '# GOOGLE_CLIENT_ID=nao-vale\n');
    const result = await ensureOfficeEnv(root, 'curatino', [PARAMETERS[0]]);
    expect(result.added).toEqual(['GOOGLE_CLIENT_ID']);
  });
});

describe('a cópia que o firebase-functions lê', () => {
  it('sai da raiz para dentro de install/functions', async () => {
    await ensureOfficeEnv(root, 'curatino', PARAMETERS);
    const install = join(root, '.microteia', 'install');

    expect(await stageOfficeEnv(root, 'curatino', install)).toBe(true);
    const staged = await readFile(join(install, 'functions', '.env.curatino'), 'utf8');
    expect(staged).toBe(await readFile(officeEnvPath(root, 'curatino'), 'utf8'));
  });

  /** O `provision` pode correr numa instalação que ainda não desempacotou nada. Ausente não é erro. */
  it('não é erro quando a fonte ainda não existe', async () => {
    expect(await stageOfficeEnv(root, 'curatino', join(root, 'install'))).toBe(false);
  });

  /**
   * A prova de que a fonte sobrevive ao que destruía o dado: apagar `install/` por inteiro, como o
   * `unpack` faz, não alcança o arquivo da raiz.
   */
  it('a fonte sobrevive a apagar install/ por inteiro — que é o que o unpack faz', async () => {
    await ensureOfficeEnv(root, 'curatino', PARAMETERS);
    const path = officeEnvPath(root, 'curatino');
    await writeFile(path, 'GOOGLE_CLIENT_ID=segredo\n');

    const install = join(root, '.microteia', 'install');
    await stageOfficeEnv(root, 'curatino', install);
    await rm(join(root, '.microteia'), { recursive: true, force: true });

    expect(await readFile(path, 'utf8')).toContain('segredo');
  });
});

describe('o .gitignore da raiz', () => {
  it('nasce cobrindo o arquivo de configuração e o diretório descartável', async () => {
    expect(await ensureRootGitignore(root)).toBe('created');
    const content = await readFile(join(root, '.gitignore'), 'utf8');
    expect(content).toContain('.env.*');
    expect(content).toContain('.microteia/');
  });

  it('acrescenta a linha que falta num .gitignore que já existe, sem reescrevê-lo', async () => {
    await writeFile(join(root, '.gitignore'), 'node_modules/\n');
    expect(await ensureRootGitignore(root)).toBe('appended');

    const content = await readFile(join(root, '.gitignore'), 'utf8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('.env.*');
  });

  it('reconhece que já está coberto e não duplica nada', async () => {
    await writeFile(join(root, '.gitignore'), '.env*\n');
    expect(await ensureRootGitignore(root)).toBe('ok');
    expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe('.env*\n');
  });

  /** Guarda que não dispara é pior que guarda nenhuma. */
  it('um .gitignore que NÃO cobre é reconhecido como descoberto', async () => {
    await mkdir(join(root, 'sub'), { recursive: true });
    await writeFile(join(root, 'sub', '.gitignore'), 'dist/\n# .env is a comment, not a rule\n');
    expect(await ensureRootGitignore(join(root, 'sub'))).toBe('appended');
  });
});
