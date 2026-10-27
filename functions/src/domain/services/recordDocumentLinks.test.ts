import { describe, expect, it } from 'vitest';
import {
  downloadTokenOf,
  isRecordDocumentLinkSealed,
  needsRecordDocumentLinkRotation,
  pendingRecordDocumentLinkToken,
  recordDocumentLinkState,
  wasEverPortalShared,
} from './recordDocumentLinks';

const url = (token: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/tenants%2Ft%2Fx.pdf?alt=media&token=${token}`;

describe('selo do link permanente de documento', () => {
  it('lê o token da URL do Storage, e nada do que não é URL', () => {
    expect(downloadTokenOf(url('abc'))).toBe('abc');
    expect(downloadTokenOf('https://f/x.pdf')).toBeNull();
    expect(downloadTokenOf('não é url')).toBeNull();
    expect(downloadTokenOf(undefined)).toBeNull();
  });

  it('selado é o selo IGUAL ao token da url; diferente é troca pendente', () => {
    expect(recordDocumentLinkState({ url: url('a'), portalLinkSeal: 'a' })).toBe('sealed');
    expect(recordDocumentLinkState({ url: url('a'), portalLinkSeal: 'b' })).toBe('pending');
    expect(recordDocumentLinkState({ url: url('a') })).toBe('unsealed');
    expect(pendingRecordDocumentLinkToken({ url: url('a'), portalLinkSeal: 'b' })).toBe('b');
    expect(pendingRecordDocumentLinkToken({ url: url('a'), portalLinkSeal: 'a' })).toBeNull();
  });

  it('o selo sem url não sela nada', () => {
    expect(isRecordDocumentLinkSealed({ portalLinkSeal: 'a' })).toBe(false);
  });

  it('compartilhado alguma vez — inclusive o recolhido, que guarda o carimbo', () => {
    expect(wasEverPortalShared({ portalShared: true })).toBe(true);
    expect(wasEverPortalShared({ portalShared: false, portalSharedAt: 'x' })).toBe(true);
    expect(wasEverPortalShared({ name: 'a.pdf' })).toBe(false);
    expect(wasEverPortalShared(null)).toBe(false);
  });

  it('troca só o que já foi compartilhado, não está selado e não está sendo excluído', () => {
    expect(needsRecordDocumentLinkRotation({ url: url('a'), portalShared: true })).toBe(true);
    expect(needsRecordDocumentLinkRotation({ url: url('a'), portalShared: true, portalLinkSeal: 'a' })).toBe(false);
    expect(needsRecordDocumentLinkRotation({ url: url('a'), portalShared: true, portalLinkSeal: 'b' })).toBe(true);
    expect(needsRecordDocumentLinkRotation({ url: url('a') })).toBe(false);
    expect(needsRecordDocumentLinkRotation({ url: url('a'), portalShared: true, deletedBy: 'u' })).toBe(false);
  });
});
