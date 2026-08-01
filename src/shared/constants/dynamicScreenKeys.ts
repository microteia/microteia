export const DYN_LIST_PREFIX = 'dyn:';
export const DYN_NEW_PREFIX = 'new-dyn:';
export const DYN_VIEW_PREFIX = 'view-dyn:';

export interface DynamicTabInfo {
  kind: 'list' | 'new' | 'view';
  screenKey: string;
  recordId?: string;
  cloneSourceId?: string;
  /** Presente ao criar um registro filho a partir da aba do pai. */
  parentEntity?: string;
  parentId?: string;
}

/** Chaves de aba de detalhe das telas fixas — o resto é tela dinâmica. */
const BUILTIN_VIEW_PREFIX: Record<string, string> = {
  financials: 'view-financial:',
  deadlines: 'view-deadline:',
};

/**
 * A aba de detalhe de uma tela FIXA, ou `null` quando a entidade não tem uma. Existe separada de
 * `buildEntityViewTabKey` porque "não há aba fixa" e "a aba dinâmica" são respostas diferentes:
 * quem só sabe o nome de uma coleção precisa distinguir as duas para não abrir aba morta.
 */
export const builtinViewTabKey = (entityKey: string, recordId: string): string | null => {
  const prefix = BUILTIN_VIEW_PREFIX[entityKey];
  return prefix ? `${prefix}${recordId}` : null;
};

/**
 * Aba de detalhe de um registro, seja de tela fixa ou dinâmica. Usado para voltar ao pai
 * depois de salvar um registro filho.
 */
export const buildEntityViewTabKey = (entityKey: string, recordId: string): string =>
  builtinViewTabKey(entityKey, recordId) ?? `${DYN_VIEW_PREFIX}${entityKey}:${recordId}`;

/** Novo registro filho, carregando o pai a quem ele pertence (e a quem voltar ao salvar). */
export const buildChildNewTabKey = (screenKey: string, parentEntity: string, parentId: string): string =>
  `${DYN_NEW_PREFIX}${screenKey}:parent:${parentEntity}:${parentId}`;

export const buildListTabKey = (screenKey: string): string => `${DYN_LIST_PREFIX}${screenKey}`;

export const buildNewTabKey = (screenKey: string): string => `${DYN_NEW_PREFIX}${screenKey}`;

export const buildCloneTabKey = (screenKey: string, recordId: string): string =>
  `${DYN_NEW_PREFIX}${screenKey}:clone:${recordId}`;

export const buildViewTabKey = (screenKey: string, recordId: string): string =>
  `${DYN_VIEW_PREFIX}${screenKey}:${recordId}`;

export const parseDynamicTabKey = (tabKey: string): DynamicTabInfo | null => {
  if (tabKey.startsWith(DYN_VIEW_PREFIX)) {
    const [screenKey, recordId] = tabKey.slice(DYN_VIEW_PREFIX.length).split(':');
    if (!screenKey || !recordId) return null;
    return { kind: 'view', screenKey, recordId };
  }
  if (tabKey.startsWith(DYN_NEW_PREFIX)) {
    const parts = tabKey.slice(DYN_NEW_PREFIX.length).split(':');
    const screenKey = parts[0];
    if (!screenKey) return null;
    if (parts[1] === 'clone' && parts[2]) {
      return { kind: 'new', screenKey, cloneSourceId: parts[2] };
    }
    if (parts[1] === 'parent' && parts[2] && parts[3]) {
      return { kind: 'new', screenKey, parentEntity: parts[2], parentId: parts[3] };
    }
    return { kind: 'new', screenKey };
  }
  if (tabKey.startsWith(DYN_LIST_PREFIX)) {
    const screenKey = tabKey.slice(DYN_LIST_PREFIX.length);
    if (!screenKey) return null;
    return { kind: 'list', screenKey };
  }
  return null;
};
