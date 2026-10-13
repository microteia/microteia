import type { DocumentOutputFormat, DocumentTemplateSpec } from '../schema/document/documentTemplate';
import type { RenderIssue, TemplateEvaluator } from '../schema/document/templateGrammar';

export interface DocumentRenderInput {
  template: DocumentTemplateSpec;
  output: DocumentOutputFormat;
  /** O registro hidratado, com as listas declaradas em `datasets`. */
  scope: Record<string, unknown>;
  evaluate: TemplateEvaluator;
}

export interface RenderedDocument {
  data: Buffer;
  contentType: string;
  extension: string;
  /** As expressões que falharam e saíram vazias no documento. */
  issues: RenderIssue[];
}

/**
 * Transformar um modelo mais um escopo num arquivo. É a porta que separa O QUE o documento diz (a
 * gramática, o escopo, a precedência — tudo do domínio) de COMO ele vira bytes (as bibliotecas).
 *
 * Lança `DocumentRenderError` quando o MODELO não pode ser lido — um `.docx` corrompido, um bloco
 * que o Word quebrou ao meio. Expressão que falha não lança: vira `issues`.
 */
export interface IDocumentRenderer {
  /**
   * O TEXTO do modelo, com as marcas como a pessoa as escreveu — é dele que saem os caminhos a
   * hidratar. No Markdown é o próprio corpo; no DOCX é o texto que o Word partiu em pedaços, remontado.
   */
  templateText(template: DocumentTemplateSpec): string;
  render(input: DocumentRenderInput): Promise<RenderedDocument>;
}

export class DocumentRenderError extends Error {
  readonly reference: string;
  readonly params: Record<string, string>;

  constructor(reference: string, params: Record<string, string> = {}) {
    super(reference);
    this.name = 'DocumentRenderError';
    this.reference = reference;
    this.params = params;
  }
}
