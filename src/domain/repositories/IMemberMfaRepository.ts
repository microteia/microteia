import type {
  MemberMfaOverview,
  MemberMfaPolicy,
  SecondFactorEnrollment,
  SecondFactorSession,
  SecondFactorStatus,
} from '../schema/memberMfa';

/**
 * O segundo fator — tudo pelo servidor, que guarda o segredo, conta as tentativas, abre a sessão e
 * audita. A primeira metade é da PESSOA (o próprio fator); a segunda, do ESCRITÓRIO (a política).
 */
export interface IMemberMfaRepository {
  status(tenantId: string): Promise<SecondFactorStatus>;
  /** `issuer` é o nome que o aplicativo autenticador mostra ao lado da conta. */
  enroll(tenantId: string, issuer: string): Promise<SecondFactorEnrollment>;
  confirm(tenantId: string, code: string): Promise<SecondFactorSession>;
  /** O código do aplicativo, ou um código de recuperação. */
  verify(tenantId: string, code: string): Promise<SecondFactorSession>;
  regenerateRecoveryCodes(tenantId: string): Promise<string[]>;

  overview(tenantId: string): Promise<MemberMfaOverview>;
  savePolicy(tenantId: string, policy: MemberMfaPolicy): Promise<MemberMfaOverview>;
  reset(tenantId: string, userId: string): Promise<MemberMfaOverview>;
}
