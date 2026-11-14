import type { MailboxListing, MailboxSettings } from '../schema/mailbox';

export interface SaveMailboxInput {
  /** Ausente: cria. */
  id: string | null;
  /** Só na criação: a caixa nasce da pessoa (`own`) ou do escritório (`office`). */
  scope: 'own' | 'office';
  settings: MailboxSettings;
  /** Vazio MANTÉM a senha gravada. A caixa de encaminhamento não tem senha. */
  password: string;
}

/** As caixas de e-mail passam por uma callable só: nenhuma leitura nem gravação direta no Firestore. */
export interface IMailboxService {
  list(tenantId: string): Promise<MailboxListing>;
  save(tenantId: string, input: SaveMailboxInput): Promise<string>;
  remove(tenantId: string, id: string): Promise<void>;
  test(tenantId: string, id: string): Promise<void>;
}
