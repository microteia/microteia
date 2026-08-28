import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { backendResidueFromDoc } from './backendResidueMapping';

/**
 * O outro lado do contrato de `console/backendResidue.ts`: o Console escreve, isto lê. Os dois são
 * versionados e distribuídos à parte, então este documento pode ter sido escrito por um Console anterior
 * (sem um campo) ou posterior (com campos que ninguém aqui conhece).
 *
 * A leitura é defensiva por isso, e não por precaução. A alternativa é uma tela que estoura por causa de
 * um campo — e o que ela iria mostrar era um aviso.
 */
describe('o resíduo lido do documento que o Console escreveu', () => {
  const complete = {
    scannedAt: Timestamp.fromDate(new Date('2026-08-28T12:30:00.000Z')),
    consoleVersion: '2.15.0',
    tenants: 3,
    extensions: 7,
    orphanFunctions: [{ name: 'acmeSync', owner: 'com.acme.crm' }],
    orphanIndexes: ['auditLogs: tenantId ASC, createdAt DESC'],
  };

  it('lê o documento completo, com a data virando Date', () => {
    expect(backendResidueFromDoc(complete)).toEqual({
      scannedAt: new Date('2026-08-28T12:30:00.000Z'),
      consoleVersion: '2.15.0',
      tenants: 3,
      extensions: 7,
      orphanFunctions: [{ name: 'acmeSync', owner: 'com.acme.crm' }],
      orphanIndexes: ['auditLogs: tenantId ASC, createdAt DESC'],
    });
  });

  /** Um Console anterior a este documento não gravou campo nenhum: o vazio é resposta, não erro. */
  it('um documento sem nada vira um resíduo vazio, e não uma exceção', () => {
    expect(backendResidueFromDoc({})).toEqual({
      scannedAt: null,
      consoleVersion: '',
      tenants: 0,
      extensions: 0,
      orphanFunctions: [],
      orphanIndexes: [],
    });
  });

  it('um campo que veio com o tipo errado não derruba a leitura dos outros', () => {
    const read = backendResidueFromDoc({
      ...complete,
      tenants: 'três',
      orphanIndexes: 'auditLogs',
      scannedAt: 'ontem',
    });

    expect(read.tenants).toBe(0);
    expect(read.orphanIndexes).toEqual([]);
    expect(read.scannedAt).toBeNull();
    expect(read.orphanFunctions).toEqual([{ name: 'acmeSync', owner: 'com.acme.crm' }]);
  });

  /**
   * O dono é gravado vazio quando a instalação é anterior ao registro `nome@pluginId`. Ele volta como
   * `null` porque é isso que a tela lê para dizer só o nome — o que falta é o dono, não a function.
   */
  it('a órfã com dono vazio volta sem dono, e continua sendo uma órfã', () => {
    expect(backendResidueFromDoc({ orphanFunctions: [{ name: 'antiga', owner: '' }] }).orphanFunctions)
      .toEqual([{ name: 'antiga', owner: null }]);
  });

  it('descarta a entrada de órfã sem nome, que não identifica function nenhuma', () => {
    const read = backendResidueFromDoc({
      orphanFunctions: [{ owner: 'com.acme.crm' }, 'acmeSync', null, { name: 'valida', owner: 'com.x.y' }],
    });

    expect(read.orphanFunctions).toEqual([{ name: 'valida', owner: 'com.x.y' }]);
  });

  /** Um Console mais novo pode acrescentar campo. Ignorar o que não se conhece é o que permite isso. */
  it('ignora um campo que este kernel não conhece', () => {
    expect(backendResidueFromDoc({ ...complete, orphanParameters: ['TOKEN'] }).orphanFunctions)
      .toEqual([{ name: 'acmeSync', owner: 'com.acme.crm' }]);
  });
});
