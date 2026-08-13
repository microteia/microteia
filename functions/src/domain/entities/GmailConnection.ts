/**
 * O único escopo que a ingestão pede: LER a caixa. Fica ao lado da entidade porque quem autoriza
 * (a troca do código) e quem informa a tela precisam dizer exatamente o mesmo — escopo divergente
 * entre os dois é autorização que o Google concede e o Gmail recusa.
 */
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailConnection {
  id: string;
  tenantId: string;
  email: string;
  scopes: string[];
  authorizedBy: string;
  authorizedByName: string;
  authorizedAt: Date;
  historyId?: string;
  expiration?: string;
}
