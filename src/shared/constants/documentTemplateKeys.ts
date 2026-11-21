/** A lista dos modelos de documento — para onde a autoria devolve quem exclui o modelo aberto. */
export const DOCUMENT_TEMPLATES_TAB = 'document-templates';

/** A aba da autoria de um modelo NOVO. Com sufixo, ela abre um modelo que já existe. */
export const DOCUMENT_TEMPLATE_DESIGN_TAB = 'document-template-design';

export const DOCUMENT_TEMPLATE_DESIGN_TAB_PREFIX = 'document-template-design:';

/**
 * A aba do CLONE de um modelo. Prefixo próprio, e não `document-template-design:clone:`: assim o que
 * vem depois de `document-template-design:` é SEMPRE uma chave de modelo, e quem lê a aba não precisa
 * saber que existe uma palavra reservada no meio dela.
 */
export const DOCUMENT_TEMPLATE_CLONE_TAB_PREFIX = 'document-template-clone:';

export const buildDocumentTemplateDesignTabKey = (templateKey: string): string =>
  `${DOCUMENT_TEMPLATE_DESIGN_TAB_PREFIX}${templateKey}`;

export const buildDocumentTemplateCloneTabKey = (templateKey: string): string =>
  `${DOCUMENT_TEMPLATE_CLONE_TAB_PREFIX}${templateKey}`;

/** O que a aba da autoria abre: um modelo novo, um que existe, ou o clone de um que existe. */
export type DocumentTemplateDesignTarget =
  | { mode: 'new' }
  | { mode: 'edit'; key: string }
  | { mode: 'clone'; key: string };

export const parseDocumentTemplateDesignTabKey = (tabKey: string): DocumentTemplateDesignTarget => {
  if (tabKey.startsWith(DOCUMENT_TEMPLATE_DESIGN_TAB_PREFIX)) {
    return { mode: 'edit', key: tabKey.slice(DOCUMENT_TEMPLATE_DESIGN_TAB_PREFIX.length) };
  }
  if (tabKey.startsWith(DOCUMENT_TEMPLATE_CLONE_TAB_PREFIX)) {
    return { mode: 'clone', key: tabKey.slice(DOCUMENT_TEMPLATE_CLONE_TAB_PREFIX.length) };
  }
  return { mode: 'new' };
};
