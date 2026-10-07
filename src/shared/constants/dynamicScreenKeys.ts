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
  /**
   * O campo que recebe o pai, quando não é o `parentFieldKey` da tela — a lista de uma aba contribuída
   * prende os registros por um campo de referência qualquer, e o novo tem de nascer preso a ele.
   */
  parentFieldKey?: string;
}

/** Chaves de aba de detalhe das telas fixas — o resto é tela dinâmica. */
const BUILTIN_VIEW_PREFIX: Record<string, string> = {
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
export const buildChildNewTabKey = (
  screenKey: string,
  parentEntity: string,
  parentId: string,
  parentFieldKey?: string,
): string =>
  `${DYN_NEW_PREFIX}${screenKey}:parent:${parentEntity}:${parentId}${parentFieldKey ? `:${parentFieldKey}` : ''}`;

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
      return {
        kind: 'new',
        screenKey,
        parentEntity: parts[2],
        parentId: parts[3],
        ...(parts[4] ? { parentFieldKey: parts[4] } : {}),
      };
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

/**
 * O ENDEREÇO de um registro segundo a tela que o apresenta: o `recordTabPrefix` declarado ou, no
 * silêncio, a aba genérica (`view-dyn:`).
 *
 * Existe porque a declaração precisa valer em TODAS as pontas que endereçam um registro — abrir pela
 * coleção (`useOpenRecord`), copiar o link e duplicar pelo cartão, e o link do cabeçalho do detalhe.
 * Enquanto só a primeira a respeitava, uma tela com detalhe próprio abria pela auditoria na tela
 * certa e copiava o endereço da errada: o mesmo registro passava a ter dois endereços, e o que ia
 * para a área de transferência não era o que o usuário estava vendo.
 */
export const recordTabKeyOf = (
  screen: { id: string; recordTabPrefix?: string | null } | null | undefined,
  screenKey: string,
  recordId: string,
): string => {
  const prefix = screen?.recordTabPrefix?.trim();
  return prefix ? `${prefix}${recordId}` : buildViewTabKey(screenKey, recordId);
};
