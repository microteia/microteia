import { describe, expect, it } from 'vitest';
import { normalizeCode } from './normalizeCode';

/**
 * The script itself only runs in the sandbox, on the server. What can be wrong in it — the rule — lives
 * in a file of its own, and this is where it is tried, without installing anything.
 */
describe('normalizeCode', () => {
  it('deixa o código em maiúsculas, aparado e com hífen no lugar dos espaços', () => {
    expect(normalizeCode(' ab  c ')).toEqual({ code: 'AB-C', changed: true });
  });

  it('não acusa mudança no código que já estava normalizado', () => {
    expect(normalizeCode('AB-C')).toEqual({ code: 'AB-C', changed: false });
  });

  it.each([[null], [undefined], [''], ['   ']])('trata %j como ausência de código', (value) => {
    expect(normalizeCode(value)).toEqual({ code: null, changed: false });
  });
});
