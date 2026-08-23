import { describe, it, expect } from 'vitest';
import { publicExtensionDataFromInput, publicExtensionFromDoc } from './publicExtensionMapping';
import type { PublishPublicExtensionInput } from '../../domain/repositories/IPublicExtensionRepository';

const input: PublishPublicExtensionInput = {
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
  status: 'pending',
  hasCode: true,
  publishedBy: 'u1',
};

describe('publicExtensionMapping', () => {
  it('round-trip publish→read preserva pacote/versão/status/autor', () => {
    const back = publicExtensionFromDoc(input.package.manifest.id, publicExtensionDataFromInput(input));
    expect(back.domain).toBe('com.acme.kanban');
    expect(back.version).toBe('1.2.0');
    expect(back.status).toBe('pending');
    expect(back.hasCode).toBe(true);
    expect(back.ownerName).toBe('Alex');
    expect(back.package.views?.[0].source).toBe('export default () => null;');
  });

  it('não grava publishedAt no corpo (o repositório acrescenta com serverTimestamp)', () => {
    expect('publishedAt' in publicExtensionDataFromInput(input)).toBe(false);
  });
});
