import type { MailboxSettings, MailboxView } from '../schema/mailbox';

export interface SaveMailboxInput {
  /** Ausente: cria. */
  id: string | null;
  /** Só na criação: a caixa nasce da pessoa (`own`) ou do escritório (`office`). */
  scope: 'own' | 'office';
  settings: MailboxSettings;
  /** Vazio MANTÉM a senha gravada. */
  password: string;
}

/** As caixas de e-mail passam por uma callable só: nenhuma leitura nem gravação direta no Firestore. */
export interface IMailboxService {
  list(tenantId: string): Promise<MailboxView[]>;
  save(tenantId: string, input: SaveMailboxInput): Promise<string>;
  remove(tenantId: string, id: string): Promise<void>;
  test(tenantId: string, id: string): Promise<void>;
}
