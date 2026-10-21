import { describe, expect, it } from 'vitest';
import { extensionCodeOf, isCodeTrusted } from './codeTrust';

describe('confiança no código de extensão', () => {
  it('a serialização não depende da ordem das views', () => {
    const a = extensionCodeOf({ views: [{ key: 'b', source: '2' }, { key: 'a', source: '1' }] });
    const b = extensionCodeOf({ views: [{ key: 'a', source: '1' }, { key: 'b', source: '2' }] });
    expect(a).toBe(b);
    expect(extensionCodeOf({ views: [] })).toBeNull();
  });

  it('procedência basta; fora dela, só o hash do código de AGORA', () => {
    expect(isCodeTrusted({ source: 'public' }, true, null)).toBe(true);
    expect(isCodeTrusted({ source: 'builtin' }, true, null)).toBe(true);
    expect(isCodeTrusted({ source: 'imported', codeTrust: { hash: 'h1' } }, true, 'h1')).toBe(true);
    expect(isCodeTrusted({ source: 'imported', codeTrust: { hash: 'h1' } }, true, 'h2')).toBe(false);
    expect(isCodeTrusted({ source: 'imported' }, true, 'h1')).toBe(false);
    expect(isCodeTrusted({ source: 'imported' }, false, null)).toBe(true);
  });
});
