import { describe, it, expect } from 'vitest';
import { publicExtensionFromDoc } from './publicExtensionMapping';

const stored = {
  package: {
    manifest: { id: 'com.acme.kanban', version: '1.2.0', kernel: '^2.0.0', name: 'Kanban' },
    summary: 'Quadro',
    workflows: [],
    views: [{ key: 'kanban', title: 'Kanban', icon: 'layoutGrid', source: 'export default () => null;' }],
  },
  ownerTenantId: 't1',
  ownerName: 'Alex',
  ownerPhotoURL: null,
  version: '1.2.0',
  status: 'approved',
  hasCode: true,
  publishedBy: 'u1',
};

describe('publicExtensionMapping', () => {
  it('lê pacote, versão, status e autor do documento', () => {
    const back = publicExtensionFromDoc('com.acme.kanban', stored);
    expect(back.domain).toBe('com.acme.kanban');
    expect(back.version).toBe('1.2.0');
    expect(back.status).toBe('approved');
    expect(back.hasCode).toBe(true);
    expect(back.ownerName).toBe('Alex');
    expect(back.package.views?.[0].source).toBe('export default () => null;');
  });

  it('entrada anterior à regra de publicação não tem prova', () => {
    expect(publicExtensionFromDoc('com.acme.kanban', stored).proof).toBeNull();
  });

  it('lê a prova gravada pela callable', () => {
    const provenAt = new Date('2026-11-15T10:00:00Z');
    const back = publicExtensionFromDoc('com.acme.kanban', {
      ...stored,
      proof: { tenantId: 't1', version: '1.2.0', revision: 'abc', provenBy: 'u1', provenAt },
    });
    expect(back.proof).toEqual({ tenantId: 't1', version: '1.2.0', revision: 'abc', provenBy: 'u1', provenAt });
  });
});
