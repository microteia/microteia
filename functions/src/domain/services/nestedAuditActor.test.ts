import { describe, expect, it } from 'vitest';
import { nestedAuditActor } from './nestedAuditActor';

const attached = { name: 'a.pdf', createdBy: 'ana', createdByName: 'Ana', createdByPhotoUrl: 'ana.png' };

describe('nestedAuditActor', () => {
  it('a inclusão é de quem anexou', () => {
    expect(nestedAuditActor('CREATE', {}, attached)).toEqual({ uid: 'ana', name: 'Ana', photoURL: 'ana.png' });
  });

  it('compartilhar com o portal é de quem compartilhou, não de quem anexou', () => {
    const shared = { ...attached, portalShared: true, portalSharedBy: 'bia' };
    expect(nestedAuditActor('UPDATE', attached, shared)).toEqual({ uid: 'bia' });
    expect(nestedAuditActor('UPDATE', shared, { ...shared, portalShared: false, portalSharedBy: 'workflow-engine' }))
      .toEqual({ uid: 'workflow-engine' });
  });

  it('a exclusão é de quem excluiu, e cai no autor quando o carimbo falta', () => {
    expect(nestedAuditActor('DELETE', { ...attached, deletedBy: 'caio', deletedByName: 'Caio' }, {}))
      .toEqual({ uid: 'caio', name: 'Caio', photoURL: '' });
    expect(nestedAuditActor('DELETE', attached, {})).toEqual({ uid: 'ana' });
  });
});
