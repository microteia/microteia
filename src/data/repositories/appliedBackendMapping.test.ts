import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { appliedBackendFromDoc } from './appliedBackendMapping';

/**
 * O outro lado do contrato de `console/backendApplied.ts`: o Console escreve, isto lê. Um campo que
 * deixasse de casar aqui seria uma extensão voltando a ficar pendente sem erro em lugar nenhum — e um
 * que casasse demais, uma liberada sem backend. Por isso o que não fecha é descartado.
 */
describe('o que o projeto tem aplicado, lido do documento que o Console escreveu', () => {
  it('lê o documento completo, com a data virando Date', () => {
    expect(appliedBackendFromDoc({
      writtenAt: Timestamp.fromDate(new Date('2026-11-07T10:00:00.000Z')),
      consoleVersion: '2.39.0',
      extensions: [{ pluginId: 'com.acme.sync', fingerprint: '{"functions":["acmeSync"]}', approvedHash: 'abc', approvedBy: 'ops@acme.com' }],
    })).toEqual({
      writtenAt: new Date('2026-11-07T10:00:00.000Z'),
      consoleVersion: '2.39.0',
      extensions: [{ pluginId: 'com.acme.sync', fingerprint: '{"functions":["acmeSync"]}', approvedHash: 'abc', approvedBy: 'ops@acme.com' }],
    });
  });

  it('a aprovação é opcional: extensão sem fonte no pacote não tem hash a aprovar', () => {
    expect(appliedBackendFromDoc({ extensions: [{ pluginId: 'a', fingerprint: 'f' }] }).extensions)
      .toEqual([{ pluginId: 'a', fingerprint: 'f', approvedHash: null, approvedBy: null }]);
  });

  it('descarta a entrada sem id ou sem fingerprint — ela não pode liberar nada', () => {
    expect(appliedBackendFromDoc({
      extensions: [{ pluginId: '', fingerprint: 'f' }, { pluginId: 'a' }, { fingerprint: 'f' }, 'lixo', null, 7],
    }).extensions).toEqual([]);
  });

  it('documento de outra versão, sem os campos, vira vazio em vez de estourar', () => {
    expect(appliedBackendFromDoc({})).toEqual({ writtenAt: null, consoleVersion: '', extensions: [] });
    expect(appliedBackendFromDoc({ extensions: 'não é lista', campoNovo: true }).extensions).toEqual([]);
  });
});
