import { describe, expect, it } from 'vitest';
import { compileComponentWith } from './evaluateExtensionView';
import { PORTAL_HOST_MODULES } from './portalHostApi';
import { HOST_MODULES } from './hostApi';

/**
 * A view de portal roda no navegador de quem é de FORA. Ela recebe as primitivas e `@microteia/portal`
 * — e nada que suponha os stores, as permissões ou as callables do escritório.
 */
describe('o que uma view de portal alcança', () => {
  it('compila contra @microteia/portal', () => {
    const result = compileComponentWith(
      "import { usePortalRecords } from '@microteia/portal';\nexport default function V() { usePortalRecords('x'); return null; }",
      PORTAL_HOST_MODULES,
    );
    expect(result.ok).toBe(true);
  });

  it.each(['@microteia/data', '@microteia/report', '@microteia/settings', '@microteia/functions'])(
    'recusa %s na compilação, com a mensagem — e não ao render, na tela do convidado',
    (name) => {
      const result = compileComponentWith(
        `import * as m from '${name}';\nexport default function V() { return m ? null : null; }`,
        PORTAL_HOST_MODULES,
      );
      expect(result).toMatchObject({ ok: false, error: `module "${name}" is not available to extensions.` });
    },
  );

  it('as primitivas compartilhadas são as MESMAS do escritório — um só @microteia/ui', () => {
    for (const name of ['@microteia/ui', '@microteia/i18n', '@microteia/format', '@microteia/theme']) {
      expect(PORTAL_HOST_MODULES[name]).toBe(HOST_MODULES[name]);
    }
  });
});
