import { Timestamp } from 'firebase-admin/firestore';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import {
  AGENT_DOCUMENT_MAX_MB,
  DOCUMENT_TYPES_COLLECTION,
  agentDocumentContentType,
  agentDocumentName,
  inspectAgentFileContent,
  resolveAgentDocumentType,
  type DocumentTypeOption,
} from '../../domain/schema/agent/agentDocument';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { identifyActor } from '../workflow/identifyActor';
import type { AgentSession } from './authenticateAgent';

/** Quantos documentos `list_documents` devolve. A aba da tela não pagina; o agente também não. */
const DOCUMENTS_PAGE = 200;

const ONE_MB = 1024 * 1024;

export type AgentDocumentOutcome =
  | { ok: true; value: unknown }
  | { ok: false; error: string; params?: Record<string, string> };

/**
 * O registro e a coleção física dele, ou a recusa.
 *
 * As mesmas três perguntas da regra do Firestore para a aba, na mesma ordem: a coleção existe, a tela
 * dela TEM a aba Documentos, e o registro existe. A segunda é a que a regra não faz e a tela faz — sem
 * ela o agente anexaria a um registro cuja aba ninguém vê.
 */
const resolveDocumentOwner = async (
  schema: SchemaContext,
  tenantId: string,
  collection: string,
  recordId: string,
): Promise<{ ok: true; physical: string } | { ok: false; error: string; params?: Record<string, string> }> => {
  const resolved = resolveQueryTable(collection, schema);
  if (resolved === null || !schema.screens.has(collection)) {
    return { ok: false, error: '@core.automation/mutation.table.unknown', params: { table: collection } };
  }
  if (schema.screens.get(collection)?.hasDocuments !== true) {
    return { ok: false, error: '@core.access/agent.document.not-enabled', params: { collection } };
  }
  if (recordId === '') return { ok: false, error: '@core.records/record.not-found' };
  const record = await getDb().doc(`tenants/${tenantId}/${resolved.physicalCollection}/${recordId}`).get();
  if (!record.exists) return { ok: false, error: '@core.records/record.not-found' };
  return { ok: true, physical: resolved.physicalCollection };
};

/**
 * Os tipos que a aba oferece: os da lista do escritório, a mesma que a tela lê. O kernel não traz
 * tipo nenhum — quem traz vocabulário é a extensão, semeando a lista (`lookups[].options`).
 */
export const documentTypeOptions = async (
  tenantId: string,
  catalog: MessageCatalog,
): Promise<DocumentTypeOption[]> => {
  const snapshot = await getDb().collection(`tenants/${tenantId}/${DOCUMENT_TYPES_COLLECTION}`).get();
  const office = snapshot.docs
    .map((doc) => doc.data())
    .filter((data) => typeof data.key === 'string' && typeof data.label === 'string')
    .map((data) => ({ key: data.key as string, label: data.label as string }));
  return office
    .map((option) => ({ key: option.key, label: resolveLabel(catalog, option.label) }));
};

/** O que `describe_screen` acrescenta numa tela com a aba Documentos. */
export const describeDocuments = async (
  schema: SchemaContext,
  tenantId: string,
  collection: string,
  catalog: MessageCatalog,
): Promise<Record<string, unknown> | null> => {
  if (schema.screens.get(collection)?.hasDocuments !== true) return null;
  return {
    maxSizeMb: AGENT_DOCUMENT_MAX_MB,
    types: await documentTypeOptions(tenantId, catalog),
  };
};

const isoOf = (value: unknown): string | null => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
};

export const listAgentDocuments = async (
  schema: SchemaContext,
  session: AgentSession,
  collection: string,
  recordId: string,
  catalog: MessageCatalog,
): Promise<AgentDocumentOutcome> => {
  const owner = await resolveDocumentOwner(schema, session.tenantId, collection, recordId);
  if (!owner.ok) return owner;

  const [snapshot, types] = await Promise.all([
    getDb()
      .collection(`tenants/${session.tenantId}/${owner.physical}/${recordId}/documents`)
      .orderBy('createdAt', 'desc')
      .limit(DOCUMENTS_PAGE)
      .get(),
    documentTypeOptions(session.tenantId, catalog),
  ]);
  const labelOf = new Map(types.map((option) => [option.key, option.label]));

  return {
    ok: true,
    value: {
      documents: snapshot.docs.map((doc) => {
        const data = doc.data();
        const type = typeof data.type === 'string' && data.type !== '' ? data.type : undefined;
        return {
          id: doc.id,
          name: data.name,
          ...(type ? { type, typeLabel: labelOf.get(type) ?? type } : {}),
          ...(typeof data.description === 'string' && data.description !== '' ? { description: data.description } : {}),
          url: data.url,
          ...(typeof data.contentType === 'string' ? { contentType: data.contentType } : {}),
          ...(typeof data.size === 'number' ? { size: data.size } : {}),
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          ...(typeof data.createdVia === 'string' ? { createdVia: data.createdVia } : {}),
          createdAt: isoOf(data.createdAt),
        };
      }),
      count: snapshot.size,
      complete: snapshot.size < DOCUMENTS_PAGE,
    },
  };
};

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Anexa um arquivo à aba Documentos, como se tivesse sido enviado pela tela.
 *
 * Mesmo caminho no bucket, mesmo documento na subcoleção, mesmo link com token de download — é o que
 * faz a tela, a cascata de exclusão e a auditoria o tratarem como qualquer outro anexo. A diferença
 * é `createdVia: 'agent'`, o mesmo carimbo que um registro gravado pelo agente leva.
 *
 * A gravação é a de todo anexo do servidor (`IRecordDocumentWriter`): bucket primeiro, documento
 * depois, e o arquivo apagado se o documento falhar.
 */
export const attachAgentDocument = async (
  schema: SchemaContext,
  session: AgentSession,
  input: Record<string, unknown>,
  catalog: MessageCatalog,
): Promise<AgentDocumentOutcome> => {
  const collection = asText(input.collection);
  const recordId = asText(input.recordId);

  const name = agentDocumentName(typeof input.fileName === 'string' ? input.fileName : '');
  if (name === null) return { ok: false, error: '@core.access/agent.document.name-invalid' };

  const content = inspectAgentFileContent(typeof input.content === 'string' ? input.content : '');
  if (!content.ok) {
    if (content.reason === 'too-large') {
      return {
        ok: false,
        error: '@core.access/agent.document.too-large',
        params: { size: ((content.size ?? 0) / ONE_MB).toFixed(1), limit: String(AGENT_DOCUMENT_MAX_MB) },
      };
    }
    return {
      ok: false,
      error: content.reason === 'empty' ? '@core.access/agent.document.empty' : '@core.access/agent.document.content-invalid',
    };
  }

  const owner = await resolveDocumentOwner(schema, session.tenantId, collection, recordId);
  if (!owner.ok) return owner;

  const requestedType = asText(input.type);
  let type: string | undefined;
  if (requestedType !== '') {
    const options = await documentTypeOptions(session.tenantId, catalog);
    const resolved = resolveAgentDocumentType(options, requestedType);
    if (resolved === null) {
      return {
        ok: false,
        error: '@core.access/agent.document.type-unknown',
        params: { type: requestedType, accepted: options.map((option) => option.key).join(', ') },
      };
    }
    type = resolved;
  }

  const contentType = agentDocumentContentType(name, asText(input.contentType) || content.contentType);
  const actor = await identifyActor(session.userId, 'agent', session.permissions);
  const description = asText(input.description);

  try {
    const attached = await getDI().getRecordDocumentWriter().attach({
      tenantId: session.tenantId,
      physicalCollection: owner.physical,
      recordId,
      name,
      contentType,
      data: Buffer.from(content.base64, 'base64'),
      type,
      description,
      author: { uid: session.userId, name: actor.name, photoUrl: actor.photoURL, via: 'agent' },
    });
    return {
      ok: true,
      value: {
        id: attached.id,
        name,
        ...(attached.type ? { type: attached.type } : {}),
        ...(attached.description ? { description: attached.description } : {}),
        url: attached.url,
        contentType,
        size: attached.size,
      },
    };
  } catch (error) {
    console.error('[agentDocuments] Falha ao anexar o documento:', error);
    return { ok: false, error: '@core.access/agent.document.upload-failed' };
  }
};
