import type {
  DocumentOutputFormat,
  DocumentTemplate,
  DocumentTemplateSpec,
} from '../schema/document/documentTemplate';
import type { DocumentDestination } from '../schema/document/documentDownloads';

/** O que o escritório grava. A `key` é também o id do documento: um modelo do escritório por chave. */
export type DocumentTemplateInput = DocumentTemplateSpec & { enabled?: boolean; basedOn?: string };

export interface GenerateDocumentInput {
  tenantId: string;
  templateKey: string;
  collection: string;
  recordId: string;
  output?: DocumentOutputFormat;
  /** Ausente = o destino que o modelo declara. */
  destination?: DocumentDestination;
  /** Dias em Downloads (`0` = não expira). Ausente = o do modelo, depois o do escritório. */
  expiresInDays?: number;
}

export interface GenerateDocumentResult {
  document: { id: string; name: string; url: string } | null;
  destination?: DocumentDestination;
  /** ISO; só em Downloads, e `null` quando o item não expira. */
  expiresAt?: string | null;
  /** Quantas marcas saíram vazias porque a expressão falhou. */
  emptyFields: number;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

export interface PreviewDocumentInput {
  tenantId: string;
  /** O modelo como está no editor — gravado ou não. */
  template: DocumentTemplateSpec;
  /** O registro, num modelo de tela. */
  recordId?: string;
  /** Os dados, num modelo de dados. Ausente = o exemplo do modelo. */
  payload?: Record<string, unknown>;
}

export interface PreviewDocumentResult {
  preview: { text: string; fileName: string; output: DocumentOutputFormat } | null;
  /** As marcas que saíram vazias e por quê. */
  empty: { expression: string; detail: string }[];
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
   * Gera no SERVIDOR e entrega na aba Documentos do registro ou em Downloads. A geração não acontece no navegador: o
   * mesmo documento tem de sair do gesto e da automação, e é lá que a permissão é cobrada.
   */
  generate(input: GenerateDocumentInput): Promise<GenerateDocumentResult>;
  /** O texto que o modelo produz, mesclado no SERVIDOR pelo mesmo caso de uso que gera — sem arquivo. */
  preview(input: PreviewDocumentInput): Promise<PreviewDocumentResult>;
}
