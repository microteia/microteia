import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { identifyActor } from '../workflow/identifyActor';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import type { DocumentOutputFormat } from '../../domain/schema/document/documentTemplate';
import { DOCUMENT_OUTPUT_FORMATS } from '../../domain/schema/document/documentTemplate';

interface RenderDocumentRequest {
  tenantId: string;
  templateKey: string;
  collection: string;
  recordId: string;
  output?: string;
}

interface RenderDocumentResponse {
  document: { id: string; name: string; url: string } | null;
  /** Quantas marcas saíram vazias porque a expressão falhou. */
  emptyFields: number;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * O gesto "Gerar documento" do registro. É o MESMO caso de uso do passo `render-document` — o
 * documento que a pessoa gera na tela é o que a automação gera de madrugada.
 *
 * A cobrança é a da aba Documentos: `<coleção>.update`, porque gerar é anexar, e anexar altera o
 * registro. A coleção vem de quem chama e é conferida contra a do modelo dentro do caso de uso — sem
 * isso, a permissão de uma tela daria acesso a gerar sobre outra.
 *
 * Falha de geração volta em `error` e não lança, como `runAction`: a tela mostra a frase do motivo.
 */
export const renderDocument = onCall(
  { region: 'southamerica-east1', cors: true, memory: '512MiB' },
  async (request): Promise<RenderDocumentResponse> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');

    const data = (request.data ?? {}) as Partial<RenderDocumentRequest>;
    const tenantId = textOf(data.tenantId);
    const templateKey = textOf(data.templateKey);
    const collection = textOf(data.collection);
    const recordId = textOf(data.recordId);
    const output = textOf(data.output);

    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    if (!templateKey || !collection || !recordId) {
      throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    }
    if (output && !(DOCUMENT_OUTPUT_FORMATS as readonly string[]).includes(output)) {
      throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    }

    const permissions = await requirePermission(tenantId, request.auth.uid, collectionPermissionId(collection, 'update'));
    const actor = await identifyActor(request.auth.uid, 'ui', permissions);

    const result = await getDI().getRenderDocumentUseCase().execute({
      tenantId,
      templateKey,
      collection,
      recordId,
      ...(output ? { output: output as DocumentOutputFormat } : {}),
      author: { uid: actor.userId, name: actor.name, photoUrl: actor.photoURL, via: 'ui' },
      permissions,
    });

    if (!result.ok) {
      return {
        document: null,
        emptyFields: 0,
        error: result.error,
        ...(result.errorParams ? { errorParams: result.errorParams } : {}),
      };
    }
    return {
      document: { id: result.document.id, name: result.document.name, url: result.document.url },
      emptyFields: result.issues.length,
      error: null,
    };
  },
);
