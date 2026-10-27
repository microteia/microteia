import type { User } from '../entities';
import type { AuthProviderSpec } from '../schema/auth';

export interface IAuthRepository {
  /**
   * Entra pelo provedor DECLARADO. Um método só, e não um por provedor: os dois que existiam
   * (`signInWithGoogle`, `signInWithFacebook`) obrigavam o repositório a conhecer de antemão cada
   * meio de entrada, e um SSO de escritório não tem como estar escrito aqui.
   *
   * Devolve `null` quando o fluxo é `redirect`: nesse caminho a página sai do ar antes de haver
   * usuário, e quem o recebe é `consumeRedirectResult`, na volta.
   */
  signInWithProvider(spec: AuthProviderSpec): Promise<User | null>;
  /**
   * O usuário que voltou de um fluxo `redirect`, ou `null` se não houve nenhum. Chamado no boot: sem
   * isso, quem entra por SSO com janela bloqueada volta para a tela de entrada já autenticado no
   * Firebase e sem nada na tela dizendo isso.
   */
  consumeRedirectResult(): Promise<User | null>;
  signInWithEmail(email: string, password: string): Promise<User>;
  signUpWithEmail(email: string, password: string, displayName: string): Promise<User>;
  sendEmailVerification(): Promise<void>;
  sendPasswordResetEmail(email: string): Promise<void>;
  /**
   * O link de entrada por e-mail, sem senha — o caminho de quem é convidado do portal. Quem envia é o
   * próprio Firebase Auth, e o link volta para `continueUrl`.
   */
  /** `locale` vira o idioma do e-mail e da página intermediária do próprio Firebase. */
  sendSignInLink(email: string, continueUrl: string, locale?: string): Promise<void>;
  isSignInLink(url: string): boolean;
  signInWithLink(email: string, url: string): Promise<User>;
  /**
   * A sessão aberta pelo token que o SERVIDOR emitiu — a entrada do portal por um provedor de
   * identidade do escritório, conferida lá antes de o token existir.
   */
  signInWithToken(token: string): Promise<User>;
  /**
   * Quando ESTA sessão provou o segundo fator (segundos), ou `null`. Vem da claim que o servidor pôs no
   * token ao abrir a sessão — a mesma que as regras leem.
   */
  getSecondFactorVerifiedAt(): Promise<number | null>;
  /** O e-mail confirmado — ou a conta que não tem e-mail porque foi o servidor quem verificou quem é. */
  isEmailVerified(): boolean;
  refreshEmailVerification(): Promise<boolean>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
}
