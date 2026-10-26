import { describe, expect, it } from 'vitest';
import { recordDocumentFileToHash } from './recordDocumentHash';

const location = { tenantId: 't1', parent: 'mensagens', parentId: 'r1' };
const path = 'tenants/t1/mensagens/r1/1700000000_laudo.pdf';

describe('recordDocumentFileToHash', () => {
  it('devolve o arquivo do documento que ainda não tem hash', () => {
    expect(recordDocumentFileToHash(location, { storagePath: path })).toBe(path);
  });

  it('nunca recalcula: o hash gravado é imutável', () => {
    expect(recordDocumentFileToHash(location, { storagePath: path, sha256: 'a'.repeat(64) })).toBeNull();
  });

  it('não lê o documento apagado nem o que está sendo excluído', () => {
    expect(recordDocumentFileToHash(location, null)).toBeNull();
    expect(recordDocumentFileToHash(location, { storagePath: path, deletedBy: 'u1' })).toBeNull();
  });

  it('só lê a pasta do PRÓPRIO registro — o caminho é dado do cliente', () => {
    expect(recordDocumentFileToHash(location, { storagePath: 'tenants/t2/mensagens/r1/x.pdf' })).toBeNull();
    expect(recordDocumentFileToHash(location, { storagePath: 'tenants/t1/mensagens/r2/x.pdf' })).toBeNull();
    expect(recordDocumentFileToHash(location, { storagePath: 'tenants/t1/mensagens/r1/../r2/x.pdf' })).toBeNull();
    expect(recordDocumentFileToHash(location, { storagePath: 'tenants/t1/mensagens/r1/' })).toBeNull();
    expect(recordDocumentFileToHash(location, { storagePath: 42 })).toBeNull();
  });

  it('coleção reservada não é registro de tela', () => {
    expect(recordDocumentFileToHash({ ...location, parent: 'portalRecords' }, { storagePath: 'tenants/t1/portalRecords/r1/x' }))
      .toBeNull();
  });
});
