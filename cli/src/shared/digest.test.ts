import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digestMismatch, digestOfFile } from './digest.js';

/**
 * O pacote não carregava hash nenhum, e enquanto o tarball chegava à mão — anexo, pendrive, Drive — o
 * transporte era confiável por construção. Baixado, não é: um download interrompido produz um `.tgz`
 * menor que o `tar` recusa com uma mensagem sobre FORMATO, e quem instala vai procurar o defeito no
 * pacote em vez de na rede.
 */
let root = '';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'microteia-digest-'));
  return async () => { await rm(root, { recursive: true, force: true }); };
});

const file = async (contents: string): Promise<string> => {
  const path = join(root, 'artifact.tgz');
  await writeFile(path, contents);
  return path;
};

describe('a impressão digital de um artefato', () => {
  it('é o sha256 do conteúdo, com o tamanho em bytes', async () => {
    expect(await digestOfFile(await file('microteia'))).toEqual({
      bytes: 9,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it('o mesmo conteúdo dá o mesmo hash, e um byte diferente dá outro', async () => {
    const first = await digestOfFile(await file('microteia'));
    const again = await digestOfFile(await file('microteia'));
    const other = await digestOfFile(await file('microteiA'));
    expect(again.sha256).toBe(first.sha256);
    expect(other.sha256).not.toBe(first.sha256);
  });
});

describe('o que a divergência diz a quem instala', () => {
  const expected = { bytes: 100, sha256: 'a'.repeat(64) };

  /**
   * As duas frases mandam procurar em lugares diferentes, e é por isso que o tamanho é conferido
   * primeiro: ele é o caso comum e o que tem conserto óbvio.
   */
  it('tamanho menor é rede, e a mensagem diz isso', () => {
    expect(digestMismatch(expected, { bytes: 60, sha256: 'a'.repeat(64) }))
      .toMatch(/did not finish/);
  });

  it('tamanho certo com hash errado é o caso grave, e não é confundido com o outro', () => {
    const problem = digestMismatch(expected, { bytes: 100, sha256: 'b'.repeat(64) });
    expect(problem).toMatch(/sha256/);
    expect(problem).not.toMatch(/did not finish/);
  });

  it('e o que confere devolve null, para o chamador não ter que interpretar texto', () => {
    expect(digestMismatch(expected, { ...expected })).toBeNull();
  });
});
