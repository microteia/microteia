/** A mensagem entregue guardada inteira (`.eml`), de onde o passo "Salvar anexo do e-mail" tira o arquivo. */
export interface IMailRawStore {
  /** Guarda e devolve o caminho. O caminho é fixo pela chave: guardar de novo regrava o mesmo conteúdo. */
  save(tenantId: string, key: string, raw: Buffer): Promise<string>;
  /** `null` quando o arquivo não existe mais (a retenção venceu). */
  read(path: string): Promise<Buffer | null>;
}
