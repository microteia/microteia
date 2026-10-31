import type {
  PortalRequiredClaim,
  PortalSignInSettings,
  PortalVerifiedIdentity,
} from '../schema/portalIdentity';
import type { PortalSubjectRole } from '../schema/portalRole';

/** O que a descoberta OIDC de um emissor diz — só o que o portal usa. */
export interface OidcDiscovery {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  userinfoEndpoint: string | null;
  /** `token_endpoint_auth_methods_supported`; ausente na descoberta, o padrão da especificação. */
  tokenAuthMethods: string[];
}

/**
 * A recusa do protocolo, com o PASSO em que aconteceu — é o que a Auditoria registra, e o que o
 * escritório precisa para saber se o defeito é do provedor, da configuração ou de quem tentou entrar.
 */
export type OidcFailureStep = 'discovery' | 'exchange' | 'token' | 'userinfo';

export class OidcFailure extends Error {
  constructor(readonly step: OidcFailureStep, detail: string) {
    super(detail);
    this.name = 'OidcFailure';
  }
}

/** O cliente OIDC do servidor. Toda falha é `OidcFailure`; nada aqui confia no navegador. */
export interface IOidcClient {
  discover(issuer: string): Promise<OidcDiscovery>;
  exchangeCode(input: {
    discovery: OidcDiscovery;
    clientId: string;
    clientSecret: string | null;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<{ idToken: string; accessToken: string | null }>;
  /** As claims do ID token, depois de conferir assinatura, emissor, público, validade e `nonce`. */
  verifyIdToken(input: {
    discovery: OidcDiscovery;
    idToken: string;
    clientId: string;
    nonce: string;
    now: Date;
  }): Promise<Record<string, unknown>>;
  userInfo(input: { discovery: OidcDiscovery; accessToken: string }): Promise<Record<string, unknown>>;
}

/** O pedido de entrada entre a ida ao provedor e a volta. */
export interface PortalSignInRequest {
  tenantId: string;
  providerId: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
  /** Para onde voltar no portal depois de entrar — já conferido como caminho do portal. */
  next: string | null;
  /** O convite que o link de convite apontava — a recusa por claim diferente é auditada contra ele. */
  inviteId: string | null;
  expiresAt: Date;
}

export interface IPortalSignInRequestRepository {
  save(stateHash: string, request: PortalSignInRequest): Promise<void>;
  /**
   * GASTA o pedido e o devolve — numa transação: duas voltas com o mesmo `state` não passam as duas.
   * `null` quando não existe, já foi gasto ou venceu.
   */
  consume(stateHash: string, now: Date): Promise<PortalSignInRequest | null>;
}

/** A configuração de entrada do portal, com os segredos dos clientes — só o servidor a lê. */
export interface PortalIdentityConfig {
  settings: PortalSignInSettings;
  /** O segredo de cada cliente, por id do provedor. Ausente: cliente público, só PKCE. */
  secrets: Record<string, string>;
}

export interface IPortalIdentityConfigRepository {
  get(tenantId: string): Promise<PortalIdentityConfig>;
  save(tenantId: string, config: PortalIdentityConfig, userId: string): Promise<void>;
}

/** Um convite por identidade, como o servidor o lê. */
export interface PortalIdentityInvite {
  id: string;
  /** Para quem o escritório o mandou, e o nome que lista — o contato, não a prova. */
  email: string;
  displayName: string;
  claim: PortalRequiredClaim;
  subjectKeys: string[];
  /** O papel em cada sujeito que tem um (EV-38) — somado ao acesso de quem aceitou, como os sujeitos. */
  subjectRoles?: PortalSubjectRole[];
  /** As contas que já o aceitaram — uma por provedor que atestou a mesma claim. */
  boundUserIds: string[];
  invitedBy: string;
  locale?: string;
}

export interface PortalIdentityInviteGrant {
  email: string;
  displayName: string;
  claim: PortalRequiredClaim;
  invitedBy: string;
  locale?: string;
}

/** O convidado que entrou por um provedor, como o convite dele é gravado. */
export interface PortalIdentityBinding {
  userId: string;
  tenantName: string;
  email: string;
  displayName: string;
  invitedBy: string;
  locale?: string;
  /** O `sub` do provedor — é o que a conta representa, e não muda. */
  subject: string;
  verified: PortalVerifiedIdentity;
  /**
   * As claims de convite que esta entrada PROVOU, como `portalProofKey` — a prova que sobrevive à
   * revogação. Vazia, a conta deixa de ter prova.
   */
  proofKeys: string[];
}

/**
 * A prova da última entrada de uma conta: quem o provedor disse que ela é, e quando. O acesso
 * (`portalUsers/{uid}`) some com o último sujeito revogado; a prova não — é ela que deixa o convite
 * refeito para a mesma claim religar a conta, sem esperar a pessoa entrar de novo.
 */
export interface PortalIdentityProof {
  userId: string;
  provider: string;
  subject: string;
  level: string | null;
  /** O nome que a lista do escritório mostra. */
  displayName: string;
  proofKeys: string[];
  verifiedAt: Date;
}

export interface IPortalIdentityRepository {
  findInvitesByClaimKeys(tenantId: string, claimKeys: string[]): Promise<PortalIdentityInvite[]>;
  getInvite(tenantId: string, inviteId: string): Promise<PortalIdentityInvite | null>;
  invitesBoundTo(tenantId: string, userId: string): Promise<PortalIdentityInvite[]>;
  /** Os convites com este contato — o que a revogação por e-mail alcança. */
  invitesByEmail(tenantId: string, email: string): Promise<PortalIdentityInvite[]>;
  /**
   * Acrescenta o sujeito ao convite da claim (criando-o se preciso), numa transação: dois convites
   * simultâneos para a mesma claim não abrem dois. `granted` é `true` quando o vínculo é NOVO; com
   * `role`, o papel do sujeito passa a ser esse (`roleChanged`), e sem ele o que havia fica.
   */
  grantInvite(
    tenantId: string,
    grant: PortalIdentityInviteGrant,
    subjectKey: string,
    role?: string,
  ): Promise<{ invite: PortalIdentityInvite; granted: boolean; roleChanged: boolean }>;
  /** Tira o sujeito (ou todos, com `null`) e o papel dele; sem sujeito nenhum, o convite deixa de existir. */
  revokeInvite(tenantId: string, inviteId: string, subjectKey: string | null): Promise<boolean>;
  /**
   * Grava o acesso de quem entrou: o convite dele (`portalUsers/{uid}`) com os sujeitos dos convites
   * aceitos e a identidade provada, e a conta nos convites. Os sujeitos são SUBSTITUÍDOS: são sempre
   * a soma dos convites que a identidade satisfaz agora. A prova da conta é substituída junto, na
   * mesma escrita (sem `proofKeys`, apagada).
   */
  bind(tenantId: string, binding: PortalIdentityBinding, invites: PortalIdentityInvite[]): Promise<void>;
  /** A prova da última entrada desta conta, ou `null`. */
  proofOf(tenantId: string, userId: string): Promise<PortalIdentityProof | null>;
  /** As contas do escritório cuja última entrada provou esta claim (`portalProofKey`). */
  proofsFor(tenantId: string, proofKey: string): Promise<PortalIdentityProof[]>;
  /**
   * Liga ao convite uma conta que já provou a claim dele, e refaz o acesso da conta — o que o `bind`
   * faria na próxima entrada. A conta sem acesso o recebe com a identidade DAQUELA prova (provedor,
   * nível e hora), nunca com uma hora de agora que ninguém atestou.
   */
  rebind(tenantId: string, invite: PortalIdentityInvite, proof: PortalIdentityProof, tenantName: string): Promise<void>;
  /**
   * Refaz os sujeitos (e os papéis) de uma conta pela soma dos convites a que ela está vinculada; sem nenhum, o
   * acesso deixa de existir. É o que propaga ao convidado o convite alterado depois do aceite.
   */
  syncAccount(tenantId: string, userId: string): Promise<void>;
  /**
   * Suspende (ou devolve) quem entra pelo link de e-mail — o que desligar o método significa para os
   * convidados que já existem. Devolve quantos mudaram.
   */
  setEmailGuestsSuspended(tenantId: string, suspended: boolean): Promise<number>;
}

/** A conta de quem entra por um provedor, e a credencial que abre a sessão dela no navegador. */
export interface IPortalIdentityAccountService {
  /** Cria a conta se ela ainda não existe. O uid é escolhido pelo servidor — e é isso que a prova. */
  ensureAccount(userId: string, displayName: string): Promise<void>;
  signInToken(userId: string): Promise<string>;
}

/** A linha de Auditoria de uma entrada por identidade — aceita, ou recusada e por quê. */
export interface PortalSignInAuditEntry {
  tenantId: string;
  outcome: 'verified' | 'refused';
  provider: string;
  /** A conta que entrou (ou tentaria entrar). */
  userId: string;
  /** Quem a pessoa disse ser no provedor — para o escritório reconhecer a tentativa. */
  name: string;
  verified?: PortalVerifiedIdentity;
  reason?: PortalSignInRefusal;
  /** O contato do convite em questão, quando havia um. */
  email?: string;
  /** A claim que o convite exigia e o login não provou — o NOME, nunca o valor. */
  claimName?: string;
}

/**
 * Por que uma entrada foi recusada. `token` e `exchange` são do protocolo (provedor ou configuração);
 * `mismatch` e `not-invited` são de quem tentou entrar.
 */
export type PortalSignInRefusal = 'discovery' | 'exchange' | 'token' | 'userinfo' | 'mismatch' | 'not-invited';

export type PortalSignInAudit = (entry: PortalSignInAuditEntry) => Promise<void>;
