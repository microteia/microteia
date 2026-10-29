import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BACKEND_ROOT = join(__dirname, '..', '..');

/** Uma linha de histórico como o Condition a gravava antes: o campo presente, com valor vazio. */
const HISTORY_WITH_EMPTY_FIELD = { logs: [{ level: 'INFO', stepDefinitionId: undefined }] };

/** `batch.set` passa o dado pelo serializador de verdade e não fala com a rede: só o `commit` falaria. */
const acceptsEmptyField = (db: ReturnType<typeof getFirestore>): boolean => {
  try {
    db.batch().set(db.doc('tenants/t1/workflow_executions/e1'), HISTORY_WITH_EMPTY_FIELD);
    return true;
  } catch {
    return false;
  }
};

/** Cada teste parte de um processo novo: app nenhum, e o `getDb()` sem instância guardada. */
const freshModule = async () => {
  vi.resetModules();
  return import('./initFirebase');
};

const arquivosTs = (raiz: string): string[] =>
  readdirSync(raiz).flatMap((nome) => {
    const caminho = join(raiz, nome);
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho);
    return nome.endsWith('.ts') ? [caminho] : [];
  });

describe('getDb — a instância que o kernel usa', () => {
  beforeEach(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  afterEach(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it('o cold start configura a instância: quem a pega depois, por qualquer porta e em qualquer ordem, já a recebe pronta', async () => {
    const { initFirebase, getDb } = await freshModule();
    initFirebase();

    expect(acceptsEmptyField(getFirestore())).toBe(true);
    expect(getDb()).toBe(getFirestore());
    expect(acceptsEmptyField(getDb())).toBe(true);
  });

  it('a instância já usada antes de getDb() é recusada em voz alta — e não fica guardada sem a configuração', async () => {
    const { getDb } = await freshModule();
    initializeApp();
    // O mesmo estado que uma leitura deixa: o Admin SDK congela as configurações no primeiro uso.
    getFirestore().settings({});

    expect(() => getDb()).toThrow(/used before getDb\(\) could configure it/);
    expect(() => getDb()).toThrow(/used before getDb\(\) could configure it/);
  });

  it('chamar initFirebase de novo não reconfigura nem troca a instância', async () => {
    const { initFirebase, getDb } = await freshModule();
    initFirebase();
    const first = getDb();

    initFirebase();

    expect(getDb()).toBe(first);
  });
});

describe('getDb — a única porta para o Firestore no backend', () => {
  // A instância é uma só por processo, e quem a abre primeiro decide se ela aceita campo vazio. Um
  // repositório com `getFirestore()` próprio foi o que fez a ação do portal falhar ao gravar o histórico
  // depois de já ter aplicado os efeitos do fluxo.
  it('nenhum arquivo do backend abre o Firestore por fora de getDb()', () => {
    const porFora = arquivosTs(BACKEND_ROOT)
      .filter((arquivo) => !arquivo.endsWith('.test.ts') && !arquivo.endsWith(join('firebase', 'initFirebase.ts')))
      .filter((arquivo) => /\bgetFirestore\s*\(/.test(readFileSync(arquivo, 'utf8')))
      .map((arquivo) => relative(BACKEND_ROOT, arquivo));

    expect(porFora).toEqual([]);
  });
});
