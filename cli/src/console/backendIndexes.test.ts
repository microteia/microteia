import { describe, expect, it } from 'vitest';
import { indexKey } from '../kernel/backendShape.js';
import type { FirestoreIndexSpec } from '../kernel/backendShape.js';
import {
  convergeIndexes,
  decodeIndex,
  describeIndex,
  encodeIndex,
  parseIndexState,
  serializeIndexState,
} from './backendIndexes.js';

/**
 * A memória dos índices de extensão, e o defeito que ela fecha.
 *
 * O que havia era só o `firestore.indexes.json` de dentro de `.microteia/install/`, e o `unpack` apaga
 * aquele diretório inteiro — de propósito, é o que faz o upgrade ser confiável. O pacote traz apenas a
 * baseline, porque o índice reivindicado por uma extensão sai dela no `pack` para não viajar até quem
 * não a instalou. Somando os dois: trocar de kernel apagava a memória de todo índice de extensão, e o
 * `microteia deploy` seguinte perguntava se podia apagá-los do PROJETO.
 */
const auditLogs: FirestoreIndexSpec = {
  collectionGroup: 'auditLogs',
  queryScope: 'COLLECTION',
  fields: [
    { fieldPath: 'tenantId', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' },
  ],
};

const tagged: FirestoreIndexSpec = {
  collectionGroup: 'records',
  queryScope: 'COLLECTION_GROUP',
  fields: [
    { fieldPath: 'labels', arrayConfig: 'CONTAINS' },
    { fieldPath: 'order-date', order: 'ASCENDING' },
    { fieldPath: 'owner.name' },
  ],
};

describe('o índice guardado no microteia.yaml', () => {
  it('volta idêntico, com escopo, direção e array-contains', () => {
    for (const index of [auditLogs, tagged]) {
      expect(decodeIndex(encodeIndex(index))).toEqual(index);
    }
  });

  /**
   * A identidade tem de sobreviver à ida e volta, e não só o conteúdo: é `indexKey` que decide se o
   * índice lembrado é o mesmo que a extensão reivindica. Um campo sem `order` que voltasse como
   * `ASCENDING` mudaria a chave e o mesmo índice apareceria duas vezes no arquivo.
   */
  it('preserva a CHAVE, inclusive do campo sem ordenação declarada', () => {
    const decoded = decodeIndex(encodeIndex(tagged));
    expect(decoded).not.toBeNull();
    expect(indexKey(decoded as FirestoreIndexSpec)).toBe(indexKey(tagged));
  });

  it('lê de volta a lista inteira, sem duplicar o que se repete', () => {
    const state = serializeIndexState([auditLogs, tagged, { ...auditLogs }]);
    expect(state.skipped).toEqual([]);
    expect(parseIndexState(state.value)).toHaveLength(2);
    expect(parseIndexState(state.value).map(indexKey).sort())
      .toEqual([auditLogs, tagged].map(indexKey).sort());
  });

  it('é legível no arquivo — é ele que fica ao lado das functions do escritório', () => {
    expect(encodeIndex(auditLogs)).toBe('auditLogs:tenantId+,createdAt-');
    expect(encodeIndex(tagged)).toBe('records/group:labels*,order-date+,owner.name?');
  });

  it('nada guardado é lista vazia, e lista vazia não escreve chave nenhuma', () => {
    expect(parseIndexState(null)).toEqual([]);
    expect(parseIndexState('')).toEqual([]);
    expect(serializeIndexState([]).value).toBeNull();
  });

  /**
   * Entrada corrompida é descartada, não fatal. O pior caso de descartar é perder a memória de um
   * índice, que é o comportamento anterior a este módulo; o pior caso de lançar é um `microteia.yaml`
   * editado à mão impedir um upgrade — e o arquivo É editado à mão.
   */
  it('descarta a entrada que não decodifica em vez de impedir o upgrade', () => {
    expect(parseIndexState('auditLogs:tenantId+,createdAt-;lixo;:;x:')).toEqual([auditLogs]);
    expect(decodeIndex('sem-marca:campo')).toBeNull();
    expect(decodeIndex('a/group/group:x+')).toBeNull();
  });

  /**
   * O nome que contém um separador fica de FORA com aviso, em vez de voltar do arquivo virado noutro
   * índice. Exige acento grave no caminho do campo para acontecer, e "só aconteceria" é como um defeito
   * silencioso começa.
   */
  it('recusa lembrar o que não representa sem ambiguidade, em vez de deturpar', () => {
    const ambiguous: FirestoreIndexSpec = {
      collectionGroup: 'records',
      queryScope: 'COLLECTION',
      fields: [{ fieldPath: 'a;b', order: 'ASCENDING' }, { fieldPath: 'x', order: 'ASCENDING' }],
    };
    const state = serializeIndexState([auditLogs, ambiguous]);
    expect(state.skipped).toEqual([ambiguous]);
    expect(parseIndexState(state.value)).toEqual([auditLogs]);
  });

  it('o campo que termina em marca também não é lembrado às cegas', () => {
    const ends: FirestoreIndexSpec = {
      collectionGroup: 'records',
      queryScope: 'COLLECTION',
      fields: [{ fieldPath: 'total+', order: 'ASCENDING' }, { fieldPath: 'x', order: 'ASCENDING' }],
    };
    expect(serializeIndexState([ends]).skipped).toEqual([ends]);
  });

  it('descreve o índice em uma linha, que é o que o operador lê', () => {
    expect(describeIndex(auditLogs)).toBe('auditLogs: tenantId, createdAt');
    expect(describeIndex(tagged)).toBe('records (collection group): labels, order-date, owner.name');
  });
});

describe('a convergência do firestore.indexes.json instalado', () => {
  const baseline: FirestoreIndexSpec[] = [{
    collectionGroup: 'workflows',
    queryScope: 'COLLECTION',
    fields: [{ fieldPath: 'tenantId', order: 'ASCENDING' }, { fieldPath: 'name', order: 'ASCENDING' }],
  }];

  /** O caso do relato: o pacote recém-desempacotado é a baseline, e o que faltava tem de voltar. */
  it('devolve ao arquivo recém-trocado o índice lembrado, e diz que ele faltava', () => {
    const convergence = convergeIndexes(baseline, baseline, [auditLogs]);
    expect(convergence.desired).toEqual([...baseline, auditLogs]);
    expect(convergence.missing).toEqual([auditLogs]);
    expect(convergence.changed).toBe(true);
  });

  it('não mexe no arquivo quando ele já declara exatamente o esperado', () => {
    const convergence = convergeIndexes([...baseline, auditLogs], baseline, [auditLogs]);
    expect(convergence.missing).toEqual([]);
    expect(convergence.changed).toBe(false);
  });

  /**
   * Com `--prune` o que se deixa de manter SAI do arquivo — e é aí que o `firebase` pode oferecer a
   * exclusão, que é a hora certa de perguntar: alguém pediu.
   */
  it('reescreve a partir da baseline, então o que se deixa de manter sai', () => {
    const convergence = convergeIndexes([...baseline, auditLogs], baseline, []);
    expect(convergence.desired).toEqual(baseline);
    expect(convergence.missing).toEqual([]);
    expect(convergence.changed).toBe(true);
  });

  it('não duplica o índice que a extensão reivindica e a baseline já traz', () => {
    const convergence = convergeIndexes(baseline, baseline, [...baseline, auditLogs]);
    expect(convergence.desired).toHaveLength(2);
  });
});

/**
 * O relato inteiro, passo a passo — é a forma mais curta de dizer o que este módulo existe para
 * impedir, e o único lugar em que os quatro comandos aparecem na ordem em que a pessoa os rodou.
 */
describe('o cenário que trouxe este módulo', () => {
  const baseline: FirestoreIndexSpec[] = [{
    collectionGroup: 'workflows',
    queryScope: 'COLLECTION',
    fields: [{ fieldPath: 'tenantId', order: 'ASCENDING' }, { fieldPath: 'name', order: 'ASCENDING' }],
  }];
  const claimed: FirestoreIndexSpec = {
    collectionGroup: 'notices',
    queryScope: 'COLLECTION',
    fields: [{ fieldPath: 'status', order: 'ASCENDING' }, { fieldPath: 'dueDate', order: 'DESCENDING' }],
  };

  it('provisionar, desativar a extensão, trocar de kernel — e nada é oferecido para exclusão', () => {
    // deploy + provision com a extensão instalada: o arquivo do pacote é a baseline, e o provision converge.
    const provisioned = convergeIndexes(baseline, baseline, [claimed]);
    expect(provisioned.missing).toEqual([claimed]);

    // O que ficou declarado é gravado na RAIZ, que é o que o unpack não alcança.
    const recorded = serializeIndexState([claimed]).value;

    // A extensão é desativada. O índice fica no projeto, e é o certo — e a raiz continua lembrando dele.
    const remembered = parseIndexState(recorded);
    expect(remembered).toEqual([claimed]);

    // unpack: `install/` é apagado e o arquivo volta à baseline do pacote novo. Era aqui que a memória
    // acabava, e a publicação seguinte achava no projeto o que o arquivo não declarava.
    const restored = convergeIndexes(baseline, baseline, remembered);
    expect(restored.desired).toEqual([...baseline, claimed]);

    // Com o arquivo completo, publicar índices não encontra nada a apagar, e o provision seguinte
    // também não mexe: o órfão segue declarado e relatado.
    expect(convergeIndexes(restored.desired, baseline, remembered).changed).toBe(false);

    // Só --prune o deixa cair fora — e é a publicação seguinte que oferece apagá-lo, a pedido.
    expect(convergeIndexes(restored.desired, baseline, []).desired).toEqual(baseline);
  });
});
