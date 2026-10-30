import type { QualifiedContribution } from '../schema/plugin/contribution';
import type { PortalFieldInput } from '../schema/portalFieldInput';
import type { PortalTemplate } from '../schema/ui/portalTemplate';
import { PORTAL_PROFILE_KEYS, portalGuestName, type PortalProfile } from '../schema/portal';
import type {
  PortalIdentityProvider,
  PortalRequiredClaim,
  PortalSignInSettings,
  PortalVerifiedIdentity,
} from '../schema/portalIdentity';

/** Um escritório em que a pessoa é convidada do portal. */
export interface PortalMembership {
  tenantId: string;
  tenantName: string;
  /** O idioma de quem convidou — vale antes de haver contexto, e nas telas de erro. */
  locale?: string;
  /** O que o convidado informou a ESTE escritório. */
  profile: PortalProfile;
}

/** Uma tela exposta, como o portal a recebe: só os campos expostos, com os rótulos já traduzidos. */
export interface PortalScreenInfo {
  id: string;
  collection: string;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  documents: boolean;
  /** A tela registra no servidor cada abertura de registro do convidado (`portal.trackViews`). */
  trackViews: boolean;
  /** A tela oferece ações do escritório no registro aberto (`portal.actions`): os botões vêm do servidor. */
  actions: boolean;
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
  /**
   * O desenho declarado da tela (`portal.template`), como o servidor o deixa sair: só o exposto, com
   * o texto já no idioma do convidado. Ausente — e num contexto guardado antes dele —, o padrão.
   */
  template?: PortalTemplate | null;
}

/** Um campo como o portal o recebe; nos preenchíveis, com a máscara e a busca externa já resolvidas. */
export interface PortalFieldInfo extends PortalFieldInput {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  /** As do campo e as da lista do escritório; a cor é token do tema ou hex, e só existe quando há. */
  options?: Array<{ key: string; label: string; color?: string }>;
}

/**
 * Um botão do registro aberto no portal — uma ação do escritório, já no idioma do convidado. O estado é o
 * do registro AGORA, avaliado pelo servidor sobre o registro inteiro: o convidado não vê as condições.
 */
export interface PortalRecordAction {
  id: string;
  title: string;
  icon: string;
  /** A pergunta antes de executar — `null` quando a ação dispara direto. */
  confirmMessage: string | null;
  danger: boolean;
  disabled: boolean;
}

/** O desfecho de uma ação do portal: só o status do fluxo, e os botões refeitos depois dele. */
export interface PortalActionOutcome {
  status: { code: 'SUCCESS' | 'WARNING' | 'ERROR'; message: string };
  actions: PortalRecordAction[];
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
  /** O fuso do escritório — é nele que o portal diz que dia é. Ausente num contexto anterior a ele. */
  timeZone?: string;
  tenantName: string;
  logoURL: string | null;
  screens: PortalScreenInfo[];
  views: PortalViewInfo[];
  /** Os textos das extensões que trazem view — o catálogo do escritório não chega ao portal. */
  bundles: Array<{ locale: string; namespace: string; messages: Record<string, string> }>;
  /** Os temas das extensões ligadas — o convidado não lê as extensões instaladas. */
  themes?: QualifiedContribution[];
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
  /** O SHA-256 do arquivo, para o convidado conferir o que recebeu. `null` enquanto não foi calculado. */
  sha256: string | null;
}

/** Um convidado, como o escritório o administra. */
export interface PortalGuest {
  userId: string;
  email: string;
  displayName: string;
  subjectKeys: string[];
  /** O que ele provou ao entrar por um provedor do escritório. Ausente: entra pelo link de e-mail. */
  identity?: PortalVerifiedIdentity;
  /** O escritório desligou o método por que ele entra — o convite está aqui, e não abre nada. */
  suspended?: boolean;
}

/** O convite que exige provar um atributo — listado até ser revogado, aceito ou não. */
export interface PortalIdentityInvite {
  id: string;
  email: string;
  displayName: string;
  claim: PortalRequiredClaim;
  subjectKeys: string[];
  /** Alguém já entrou por ele. */
  accepted: boolean;
}

/** A configuração de entrada como a aba a vê — o segredo do cliente nunca volta, só SE existe. */
export interface PortalSignInSettingsView extends PortalSignInSettings {
  providers: Array<PortalIdentityProvider & { hasSecret: boolean }>;
}

/**
 * Os marcadores que as boas-vindas do escritório aceitam — a mesma sintaxe `{nome}` do catálogo de
 * mensagens. Os fixos são o que o portal sabe sem perguntar; cada chave do perfil do convidado vira
 * `{profile.<chave>}` sozinha, e por isso o perfil cresce sem que esta lista precise mudar.
 */
export const PORTAL_WELCOME_PLACEHOLDERS: readonly string[] = [
  'firstName',
  'name',
  'email',
  'office',
  ...PORTAL_PROFILE_KEYS.map((key) => `profile.${key}`),
];

/**
 * Os valores dos marcadores. O nome é o do perfil, senão o da conta, senão o e-mail — a frase nunca
 * fica com um buraco no lugar do nome.
 */
export const portalWelcomeValues = (input: {
  profile: PortalProfile;
  accountName: string;
  email: string;
  office: string;
}): Record<string, string> => {
  const known = portalGuestName(input.profile, input.accountName);
  return {
    firstName: known ? known.split(/\s+/)[0] : input.email,
    name: known || input.email,
    email: input.email,
    office: input.office,
    ...Object.fromEntries(PORTAL_PROFILE_KEYS.map((key) => [`profile.${key}`, input.profile[key] ?? ''])),
  };
};

/**
 * Preenche os marcadores conhecidos. O desconhecido fica como está: chave entre chaves pode ser
 * texto do escritório, e apagá-la mudaria o que ele escreveu.
 */
export const fillPortalWelcome = (text: string, values: Readonly<Record<string, string>>): string =>
  text.replace(/\{([\w.]+)\}/g, (match, token: string) => (Object.hasOwn(values, token) ? values[token] : match));
