import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_DOCUMENT_TEMPLATES_MANAGE } from '../../domain/schema/access';
import type { DocumentOutputFormat, DocumentTemplateSpec } from '../../domain/schema/document/documentTemplate';
import { DOCUMENT_OUTPUT_FORMATS, documentTemplateIssues, isGrammarIssue } from '../../domain/schema/document/documentTemplate';

interface PreviewDocumentRequest {
  tenantId: string;
  /** O modelo como está no editor — gravado ou não. */
  template: DocumentTemplateSpec;
  recordId?: string;
  payload?: Record<string, unknown>;
  output?: string;
}

interface PreviewDocumentResponse {
  preview: { text: string; fileName: string; output: DocumentOutputFormat } | null;
  /** As marcas que saíram vazias e por quê. */
  empty: { expression: string; detail: string }[];
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A pré-visualização da tela de modelos: o rascunho do editor mesclado contra um registro ou contra
 * o exemplo, pelo MESMO caso de uso que gera — o texto que se vê é o que o documento terá. Nada é
 * gravado nem montado em arquivo.
 *
 * A porta cobra `document-templates.manage`: é gesto de autoria, e o rascunho é texto que ainda não
 * foi aprovado por ninguém. O caso de uso cobra ainda a leitura do registro (ou dos registros que o
 * exemplo aponta) — escrever modelos não dá acesso a registro nenhum.
 */
export const previewDocument = onCall(
  { region: 'southamerica-east1', cors: true, memory: '512MiB' },
  async (request): Promise<PreviewDocumentResponse> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');

    const data = (request.data ?? {}) as Partial<PreviewDocumentRequest>;
    const tenantId = textOf(data.tenantId);
    const recordId = textOf(data.recordId);
    const output = textOf(data.output);
    const template = isPlainObject(data.template) ? (data.template as unknown as DocumentTemplateSpec) : null;

    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    if (!template) throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    if (output && !(DOCUMENT_OUTPUT_FORMATS as readonly string[]).includes(output)) {
      throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    }

    const permissions = await requirePermission(tenantId, request.auth.uid, PERMISSION_DOCUMENT_TEMPLATES_MANAGE);

    // Erro de FORMA não tem leitura nenhuma; o de gramática tem, e a mesclagem aponta onde ficou a lacuna.
    const [shape] = documentTemplateIssues(template).filter((issue) => !isGrammarIssue(issue));
    if (shape) {
      return { preview: null, empty: [], error: shape.error, ...(shape.errorParams ? { errorParams: shape.errorParams } : {}) };
    }

    const result = await getDI().getRenderDocumentUseCase().preview({
      tenantId,
      templateKey: template.key,
      draft: template,
      ...(recordId ? { recordId } : {}),
      ...(isPlainObject(data.payload) ? { payload: data.payload } : {}),
      ...(output ? { output: output as DocumentOutputFormat } : {}),
      chargePermissions: true,
      permissions,
    });

    if (!result.ok) {
      return { preview: null, empty: [], error: result.error, ...(result.errorParams ? { errorParams: result.errorParams } : {}) };
    }
    return {
      preview: { text: result.text, fileName: result.fileName, output: result.output },
      empty: result.issues.map((issue) => ({ expression: issue.expression, detail: issue.detail })),
      error: null,
    };
  },
);
