/**
 * O endereço de uma página: o que `resolvePageContribution` casa com a chave de uma aba. `key` casa
 * exatamente; `keyPrefix` casa pelo começo (`view-dyn:` → `view-dyn:produtos:123`).
 */
export interface PageAddress {
  key: string;
  keyPrefix?: string;
}

export const pageAddressMatches = (page: PageAddress, tabKey: string): boolean =>
  (page.key !== '' && page.key === tabKey) || (!!page.keyPrefix && tabKey.startsWith(page.keyPrefix));

/**
 * As páginas que os plugins `core.*` desenham — o que um item de menu de extensão pode abrir sem
 * declarar dependência de ninguém.
 *
 * Mora no domínio, e não é lida do `CORE_PLUGINS`, porque quem pergunta é o portão do pacote
 * (`validatePluginPackage`), e ele roda no SDK e no terminal, que não podem importar `plugins/`. É uma
 * segunda escrita da mesma verdade, e por isso `kernelPages.test.ts` a confronta com as contribuições
 * reais: uma página do kernel que entra ou sai sem passar por aqui reprova ali.
 */
export const KERNEL_PAGES: PageAddress[] = [
  { key: 'profile' },
  { key: 'screen-builder' },
  { key: '', keyPrefix: 'dyn:' },
  { key: '', keyPrefix: 'new-dyn:' },
  { key: '', keyPrefix: 'view-dyn:' },
  { key: 'reports' },
  { key: '', keyPrefix: 'rep:' },
  { key: 'report-design' },
  { key: '', keyPrefix: 'report-design:' },
  { key: 'document-templates' },
  { key: 'workflows' },
  { key: 'new-workflow' },
  { key: '', keyPrefix: 'new-workflow:clone:' },
  { key: '', keyPrefix: 'view-workflow:' },
  { key: '', keyPrefix: 'edit-workflow-step:' },
  { key: 'scripts' },
  { key: 'new-script' },
  { key: '', keyPrefix: 'view-script:' },
  { key: 'actions' },
  { key: 'new-action' },
  { key: '', keyPrefix: 'view-action:' },
  { key: 'function-reference' },
  { key: 'data-function-reference' },
  { key: 'access-management' },
  { key: 'audit-logs' },
  { key: 'data-processor' },
  { key: 'tenant-settings' },
  { key: '', keyPrefix: 'tenant-settings:' },
  { key: 'marketplace' },
  { key: 'plugin-author' },
  { key: '', keyPrefix: 'plugin-author:' },
  { key: 'settings' },
  { key: 'translations' },
  { key: 'license' },
];
