// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { generateDeepLink, isMicroteiaLink, parseMicroteiaTabKey, setDeepLinkTenant } from './deepLinkUtils';
import { parseRecordLinkTabKey, recordLinkTabKey } from '../../domain/schema/recordLink';

describe('o link universal', () => {
  it('é o mesmo do e-mail: /microteia/<aba>?tenant=<escritório atual>', () => {
    setDeepLinkTenant('t1');
    const link = generateDeepLink(recordLinkTabKey({ collection: 'invoices', recordId: 'nf1' }));
    expect(link).toBe(`${window.location.origin}/microteia/record%3Ainvoices%3Anf1?tenant=t1`);
  });

  it('colado num texto, abre a aba certa — relativo ou absoluto, sem levar a consulta junto', () => {
    setDeepLinkTenant('t1');
    const absolute = generateDeepLink('record:invoices:nf1');
    expect(isMicroteiaLink(absolute)).toBe(true);
    expect(parseMicroteiaTabKey(absolute)).toBe('record:invoices:nf1');
    expect(parseMicroteiaTabKey('/microteia/downloads')).toBe('downloads');
    expect(isMicroteiaLink('https://outro.site/microteia/x')).toBe(false);
  });

  it('o registro é coleção + id, e o id pode ter dois-pontos', () => {
    expect(parseRecordLinkTabKey('record:invoices:a:b')).toEqual({ collection: 'invoices', recordId: 'a:b' });
    expect(parseRecordLinkTabKey('view-dyn:invoices:nf1')).toBeNull();
    expect(parseRecordLinkTabKey('record:invoices:')).toBeNull();
  });
});
