import type { UiRecordActionMetadata } from './uiExtensionPoints';

/**
 * Os gestos que TODO registro oferece, como METADATA pura.
 *
 * Vivia junto dos comandos, em `plugins/core.records/recordActionCommands.ts`, e ali é o lugar certo
 * para o COMANDO — que copia para a área de transferência, abre aba, pede exclusão. Mas o `copyLink`
 * arrasta o gerador de deeplink, que arrasta `window`, e isso amarrava a lista a um ambiente de
 * browser.
 *
 * A lista em si é declaração, e quem precisa dela não é só a tela: o SDK a serve ao autor de extensão
 * (é o que um `action.command` pode nomear), e o guia de autoria a derivava À MÃO, em prosa — uma
 * extensão nova de distância de ficar incompleta em silêncio, contra a regra de que afirmação sobre o
 * kernel em documento gerado é derivada e nunca escrita.
 *
 * `slot` é o que permite duas ações disputarem o mesmo lugar: excluir e desvincular ocupam o slot
 * destrutivo (`delete`), e é o `hiddenWhen` de cada uma que decide qual aparece — o kernel não
 * escolhe, a declaração escolhe.
 */
export const RECORD_ACTION_METADATA: Record<string, UiRecordActionMetadata> = {
  copyLink: { key: 'copyLink', title: '@core.records/action.copy-link', icon: 'link', order: 0 },
  clone: { key: 'clone', title: '@core.records/action.clone', icon: 'fileCopy', order: 1 },
  manageTags: { key: 'manageTags', title: '@core.records/action.manage-tags', icon: 'priceTag3', order: 2, requiresTags: true },
  delete: {
    key: 'delete',
    title: '@core.ui/action.delete',
    icon: 'deleteBin',
    order: 3,
    danger: true,
    requiresRecordPermission: 'delete',
    // Dentro da aba de um pai RELACIONADO o registro é uma entidade de topo: apagá-lo dali destruiria
    // o registro inteiro quando o gesto é "tirar daqui". Ali quem aparece é desvincular.
    hiddenWhen: 'relation == "related"',
  },
  generateDocument: {
    key: 'generateDocument',
    title: '@core.documents/action.generate',
    icon: 'fileText',
    order: 2,
    // Gerar é anexar, e anexar altera o registro: a mesma cobrança da aba Documentos.
    requiresRecordPermission: 'update',
  },
  unlink: {
    key: 'unlink',
    // Divide o slot destrutivo com excluir: a tela habilita `delete`, e a relação decide qual das
    // duas o usuário vê.
    slot: 'delete',
    title: '@core.records/action.unlink',
    icon: 'linkUnlink',
    order: 3,
    hiddenWhen: 'relation != "related"',
  },
};

/** Os nomes que um `action.command` pode carregar. Derivado da lista, nunca escrito ao lado dela. */
export const RECORD_ACTION_COMMANDS: readonly string[] = Object.keys(RECORD_ACTION_METADATA);
