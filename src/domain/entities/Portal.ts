/** Um escritório em que a pessoa é convidada do portal. */
export interface PortalMembership {
  tenantId: string;
  tenantName: string;
  /** O idioma de quem convidou — vale antes de haver contexto, e nas telas de erro. */
  locale?: string;
}

/** Uma tela exposta, como o portal a recebe: só os campos expostos, com os rótulos já traduzidos. */
export interface PortalScreenInfo {
  id: string;
  collection: string;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  documents: boolean;
  /** O convidado anexa documentos aqui, escolhendo o tipo entre estes — nunca criando um. */
  uploads: { types: Array<{ key: string; label: string }> } | null;
  /** A tela-pai no portal: os registros desta aparecem DENTRO dos dela, e não soltos no menu. */
  parent: { collection: string } | null;
  fields: PortalFieldInfo[];
  /** O convidado cria registros desta tela: o que ele preenche, e a que o novo se vincula. */
  create: {
    fields: PortalFieldInfo[];
    link: { collection: string; label: string };
  } | null;
  /** O convidado altera estes campos — dos que ele vê —, e só no que criou quando `onlyOwn`. */
  edit: { fields: PortalFieldInfo[]; onlyOwn: boolean } | null;
}

export interface PortalFieldInfo {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  /** As do campo e as da lista do escritório; a cor é token do tema ou hex, e só existe quando há. */
  options?: Array<{ key: string; label: string; color?: string }>;
}

/** Um registro a que o novo pode se vincular — dos que o convidado já enxerga. */
export interface PortalLinkOption {
  recordId: string;
  label: string;
}

/** Uma tela de EXTENSÃO para o portal, entregue pelo servidor só se o escritório confia no código. */
export interface PortalViewInfo {
  pluginId: string;
  /** A view em `views` — o código. */
  viewKey: string;
  surface: 'list' | 'detail' | 'page' | 'widget' | 'home' | 'layout';
  collection?: string;
  /** A entrada no menu ou na home (`page`, `widget`). */
  key?: string;
  title?: string;
  icon?: string;
  order?: number;
  source: string;
}

/** Uma entrada do menu do portal: uma tela de topo, ou uma página de extensão. */
export interface PortalMenuEntry {
  id: string;
  kind: 'screen' | 'page';
  title: string;
  icon: string;
  collection?: string;
  pluginId?: string;
  viewKey?: string;
}

export interface PortalHome {
  /** As boas-vindas que o escritório escreveu — vazio = a frase padrão. */
  welcome: string;
  /** O menu, já na ordem do escritório e sem o que ele escondeu. */
  menu: PortalMenuEntry[];
  widgets: Array<{ id: string; title: string; pluginId: string; viewKey: string }>;
  view: { pluginId: string; viewKey: string } | null;
  /** A casca: `sidebar`, `top`, ou a de uma extensão. Ausente num contexto guardado antes dela. */
  layout?: { id: string; pluginId?: string; viewKey?: string };
}

export interface PortalContext {
  /** O idioma escolhido para este convidado (dele ou do escritório); vazio = o do navegador. */
  locale: string;
  tenantName: string;
  logoURL: string | null;
  screens: PortalScreenInfo[];
  views: PortalViewInfo[];
  /** Os textos das extensões que trazem view — o catálogo do escritório não chega ao portal. */
  bundles: Array<{ locale: string; namespace: string; messages: Record<string, string> }>;
  home: PortalHome;
}

/** A PROJEÇÃO de um registro — o que saiu do escritório para o convidado, e nada além. */
export interface PortalRecord {
  /** O id da projeção, que é o que endereça os documentos dela. */
  id: string;
  collection: string;
  recordId: string;
  screenId: string;
  title: string;
  data: Record<string, unknown>;
  labels: Record<string, string>;
  /** O registro-pai no portal (`colecao/id`) — o prestador de uma nota. */
  parentKeys: string[];
  /** A condição do escritório deixava alterar quando o registro foi gravado. Quem decide é o servidor. */
  editable: boolean;
  /** O convidado que o criou pelo portal — vazio quando nasceu no escritório. */
  portalOwner: string | null;
  updatedAt: Date | null;
}

/**
 * O convidado vê o botão de alterar este registro. É só o DESENHO: a condição foi avaliada quando o
 * registro foi gravado, e a callable confere tudo de novo — o que vale é a resposta dela.
 */
export const canEditPortalRecord = (
  screen: Pick<PortalScreenInfo, 'edit'> | null | undefined,
  record: Pick<PortalRecord, 'editable' | 'portalOwner'>,
  userId: string | null,
): boolean =>
  !!screen?.edit && record.editable && (!screen.edit.onlyOwn || (!!userId && record.portalOwner === userId));

export interface PortalDocument {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  createdAt: Date | null;
}

/** Um convidado, como o escritório o administra. */
export interface PortalGuest {
  userId: string;
  email: string;
  displayName: string;
  subjectKeys: string[];
}
