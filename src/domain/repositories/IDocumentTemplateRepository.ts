import type {
  DocumentOutputFormat,
  DocumentTemplate,
  DocumentTemplateSpec,
} from '../schema/document/documentTemplate';

/** O que o escritório grava. A `key` é também o id do documento: um modelo do escritório por chave. */
export type DocumentTemplateInput = DocumentTemplateSpec & { enabled?: boolean; basedOn?: string };

export interface GenerateDocumentInput {
  tenantId: string;
  templateKey: string;
  collection: string;
  recordId: string;
  output?: DocumentOutputFormat;
}

export interface GenerateDocumentResult {
  document: { id: string; name: string; url: string } | null;
  /** Quantas marcas saíram vazias porque a expressão falhou. */
  emptyFields: number;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

export interface IDocumentTemplateRepository {
  subscribe(tenantId: string, onUpdate: (templates: DocumentTemplate[]) => void): () => void;
  getAll(tenantId: string): Promise<DocumentTemplate[]>;
  /** Grava o modelo na chave dele — cria ou substitui. */
  save(tenantId: string, input: DocumentTemplateInput, updatedBy: string | null): Promise<void>;
  delete(tenantId: string, key: string): Promise<void>;
  /**
   * Gera no SERVIDOR e anexa à aba Documentos do registro. A geração não acontece no navegador: o
   * mesmo documento tem de sair do gesto e da automação, e é lá que a permissão é cobrada.
   */
  generate(input: GenerateDocumentInput): Promise<GenerateDocumentResult>;
}
