import { describe, expect, it } from 'vitest';
import {
  BACKEND_APPLIED_PATH,
  appliedEntryOf,
  backendAppliedFields,
  parseBackendApplied,
  reduceBackendApplied,
} from './backendApplied.js';
import { CLI_VERSION } from '../shared/paths.js';

/**
 * A FORMA deste documento é contrato entre dois artefatos versionados à parte: o Console escreve, o
 * kernel lê para liberar a cópia nova. Um campo renomeado aqui é uma extensão que volta a ficar pendente
 * sem erro em lugar nenhum.
 *
 * O par do outro lado é `appliedBackendFromDoc`, em `data/repositories/`, com o teste dele.
 */

const ENTRY = { pluginId: 'com.acme.sync', fingerprint: '{"functions":["acmeSync"]}' };

describe('o documento do que o projeto tem aplicado', () => {
  it('mora num documento só, de nome fixo, ao lado do resíduo', () => {
    expect(BACKEND_APPLIED_PATH).toBe('/backend_state/applied');
  });

  it('grava a lista com id e fingerprint, a data como data e a versão do Console', () => {
    const fields = backendAppliedFields(
      [{ ...ENTRY, approvedHash: 'abc', approvedBy: 'ops@acme.com' }],
      new Date('2026-11-07T10:00:00.000Z'),
    );
    expect(fields.writtenAt).toEqual({ timestampValue: '2026-11-07T10:00:00.000Z' });
    expect(fields.consoleVersion).toEqual({ stringValue: CLI_VERSION });
    expect(fields.extensions).toEqual({
      arrayValue: {
        values: [{
          mapValue: {
            fields: {
              pluginId: { stringValue: 'com.acme.sync' },
              fingerprint: { stringValue: ENTRY.fingerprint },
              approvedHash: { stringValue: 'abc' },
              approvedBy: { stringValue: 'ops@acme.com' },
            },
          },
        }],
      },
    });
  });

  /** A lista vazia é o que apaga a entrada da extensão que saiu — escrever só quando há o que dizer a deixaria lá. */
  it('grava a lista vazia em vez de pular a escrita', () => {
    expect(backendAppliedFields([], new Date()).extensions).toEqual({ arrayValue: { values: [] } });
  });

  it('lê de volta o que escreveu e descarta a entrada que não libera nada', () => {
    expect(parseBackendApplied({
      extensions: [ENTRY, { pluginId: '', fingerprint: 'x' }, { pluginId: 'a' }, 'lixo', null],
    })).toEqual([ENTRY]);
    expect(parseBackendApplied(null)).toEqual([]);
    expect(parseBackendApplied({ extensions: 'não é lista' })).toEqual([]);
  });

  it('a entrada vale só para o MESMO fingerprint da mesma extensão', () => {
    expect(appliedEntryOf([ENTRY], ENTRY)).toEqual(ENTRY);
    expect(appliedEntryOf([ENTRY], { ...ENTRY, fingerprint: 'outro' })).toBeUndefined();
    expect(appliedEntryOf([ENTRY], { ...ENTRY, pluginId: 'com.acme.outra' })).toBeUndefined();
  });
});

describe('a redução antes de mudar o projeto', () => {
  /**
   * A extensão que saiu de todo escritório pode ter a function apagada pelo `--prune` desta execução: a
   * entrada dela não pode sobreviver a ele, ou a próxima instalação nasceria liberada contra o nada.
   */
  it('tira a extensão que nenhum escritório tem mais', () => {
    expect(reduceBackendApplied([ENTRY], [])).toEqual([]);
  });

  it('tira o fingerprint superado — o deploy vai trocar o código que ele descrevia', () => {
    expect(reduceBackendApplied([ENTRY], [{ pluginId: ENTRY.pluginId, fingerprint: 'novo' }])).toEqual([]);
  });

  it('mantém o que a cópia mais nova continua exigindo', () => {
    expect(reduceBackendApplied([ENTRY], [ENTRY])).toEqual([ENTRY]);
  });

  it('só remove: o que nunca foi aplicado não entra pela redução', () => {
    expect(reduceBackendApplied([], [ENTRY])).toEqual([]);
  });
});
