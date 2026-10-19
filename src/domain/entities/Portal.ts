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

export interface PortalContext {
  /** O idioma escolhido para este convidado (dele ou do escritório); vazio = o do navegador. */
  locale: string;
  tenantName: string;
  logoURL: string | null;
  screens: PortalScreenInfo[];
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
