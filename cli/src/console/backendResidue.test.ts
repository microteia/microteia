import { describe, expect, it } from 'vitest';
import { BACKEND_RESIDUE_PATH, backendResidueFields } from './backendResidue.js';
import { CLI_VERSION } from '../shared/paths.js';

/**
 * A FORMA deste documento é contrato entre dois artefatos versionados à parte: o Console escreve, o
 * kernel lê. Um campo renomeado aqui é uma tela que deixa de avisar, sem erro em lugar nenhum — que é o
 * mesmo desfecho de todo o defeito que este documento existe para fechar.
 *
 * O par do outro lado é `backendResidueFromDoc`, em `data/repositories/`, com o teste dele.
 */

const input = {
  scannedAt: new Date('2026-08-28T12:30:00.000Z'),
  tenants: 3,
  extensions: 7,
  functions: [{ name: 'acmeSync', owner: 'com.acme.crm' }],
  indexes: ['auditLogs: tenantId ASC, createdAt DESC'],
};

describe('o documento do resíduo de backend', () => {
  it('mora num documento só, de nome fixo — a órfã é um fato do projeto', () => {
    expect(BACKEND_RESIDUE_PATH).toBe('/backend_state/current');
  });

  it('grava a data como DATA, e não como texto que se parece com uma', () => {
    expect(backendResidueFields(input).scannedAt)
      .toEqual({ timestampValue: '2026-08-28T12:30:00.000Z' });
  });

  /**
   * A contagem da varredura é o que permite CONFERIR a afirmação em vez de acreditar nela: "ninguém mais
   * exige esta function" é uma frase sobre todos os escritórios do projeto, não sobre o último lido.
   */
  it('carrega a varredura que sustenta a afirmação, como número', () => {
    const fields = backendResidueFields(input);
    expect(fields.tenants).toEqual({ integerValue: '3' });
    expect(fields.extensions).toEqual({ integerValue: '7' });
  });

  it('nomeia a versão do Console que fez a varredura', () => {
    expect(backendResidueFields(input).consoleVersion).toEqual({ stringValue: CLI_VERSION });
  });

  it('grava cada órfã com o dono, que é o que torna o relato uma decisão', () => {
    expect(backendResidueFields(input).orphanFunctions).toEqual({
      arrayValue: {
        values: [{
          mapValue: {
            fields: { name: { stringValue: 'acmeSync' }, owner: { stringValue: 'com.acme.crm' } },
          },
        }],
      },
    });
  });

  it('grava o índice órfão na forma legível que o terminal também imprime', () => {
    expect(backendResidueFields(input).orphanIndexes).toEqual({
      arrayValue: { values: [{ stringValue: 'auditLogs: tenantId ASC, createdAt DESC' }] },
    });
  });

  /**
   * Escrever só quando há órfã deixaria a tarja na tela depois de o `--prune` já ter resolvido — e uma
   * tarja que não sai é uma tarja que se aprende a ignorar. Todos os campos são escritos a cada
   * execução, e é a lista vazia que apaga a anterior.
   */
  it('a ausência de resíduo é gravada como lista vazia, e não como ausência de campo', () => {
    const fields = backendResidueFields({ ...input, functions: [], indexes: [] });

    expect(fields.orphanFunctions).toEqual({ arrayValue: { values: [] } });
    expect(fields.orphanIndexes).toEqual({ arrayValue: { values: [] } });
    expect(Object.keys(fields).sort()).toEqual([
      'consoleVersion', 'extensions', 'orphanFunctions', 'orphanIndexes', 'scannedAt', 'tenants',
    ]);
  });

  /** Uma instalação anterior ao registro com dono gravou o nome sem `@`; o dono falta, a function não. */
  it('a órfã sem dono conhecido grava o dono vazio, e não desaparece', () => {
    const fields = backendResidueFields({ ...input, functions: [{ name: 'antiga', owner: '' }] });

    expect(fields.orphanFunctions).toEqual({
      arrayValue: {
        values: [{ mapValue: { fields: { name: { stringValue: 'antiga' }, owner: { stringValue: '' } } } }],
      },
    });
  });
});
