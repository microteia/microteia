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
  /** A tela-pai no portal: os registros desta aparecem DENTRO dos dela, e não soltos no menu. */
  parent: { collection: string } | null;
  fields: PortalFieldInfo[];
  /** O convidado cria registros desta tela: o que ele preenche, e a que o novo se vincula. */
  create: {
    fields: PortalFieldInfo[];
    link: { collection: string; label: string };
  } | null;
}

export interface PortalFieldInfo {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: Array<{ key: string; label: string }>;
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
  surface: 'list' | 'detail' | 'page' | 'widget' | 'home';
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
  updatedAt: Date | null;
}

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
