import { describe, expect, it } from 'vitest';
import { KERNEL_PAGES } from '../domain/schema/ui/kernelPages';
import { UI_PAGE_POINT } from '../domain/schema/ui/uiExtensionPoints';
import { CORE_PLUGINS } from './index';

const addressOf = (page: { key?: unknown; keyPrefix?: unknown }): string =>
  typeof page.keyPrefix === 'string' && page.keyPrefix !== '' ? `prefix:${page.keyPrefix}` : `key:${String(page.key)}`;

describe('KERNEL_PAGES', () => {
  /**
   * É uma segunda escrita das páginas do kernel, e existe só porque o portão do pacote não pode
   * importar `plugins/`. Uma página que entra ou sai do kernel sem passar pela lista faria o portão
   * recusar um item de menu legítimo — ou aceitar um que abre em branco.
   */
  it('é exatamente o conjunto de páginas que os plugins internos contribuem', () => {
    const contributed = CORE_PLUGINS
      .flatMap((record) => record.manifest.contributes ?? [])
      .filter((contribution) => contribution.point === UI_PAGE_POINT)
      .map((contribution) => addressOf(contribution.metadata));

    expect([...KERNEL_PAGES.map(addressOf)].sort()).toEqual([...contributed].sort());
  });
});

describe('as páginas do kernel que não voltam numa sessão reaberta (#15)', () => {
  /**
   * A decisão fica escrita aqui: são as abas que só fazem sentido no gesto que as abriu — criar algo
   * novo, clonar, editar um passo a partir do workflow. Uma página nova desse tipo que esqueça o
   * `restore: false` reapareceria vazia na próxima entrada; esta lista é onde a omissão é vista.
   */
  it('são exatamente as transitórias', () => {
    const transient = CORE_PLUGINS
      .flatMap((record) => record.manifest.contributes ?? [])
      .filter((contribution) => contribution.point === UI_PAGE_POINT && contribution.metadata.restore === false)
      .map((contribution) => addressOf(contribution.metadata));

    expect(transient.sort()).toEqual([
      'key:document-template-design',
      'key:new-action',
      'key:new-script',
      'key:new-workflow',
      'key:report-design',
      'prefix:document-template-clone:',
      'prefix:edit-workflow-step:',
      'prefix:new-dyn:',
      'prefix:new-workflow:clone:',
    ]);
  });
});
