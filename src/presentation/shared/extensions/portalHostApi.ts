import { useCallback, useEffect, useMemo, useState } from 'react';
import { HOST_MODULES } from './hostApi';
import { usePortal } from '../../../stores/usePortal';
import { usePortalNavigation as useNavigationStore } from '../../../stores/usePortalNavigation';
import { portalRecordDocId, portalSubjectKey } from '../../../domain/schema/portal';
import type { PortalDocument, PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';

/** Um registro como a view de portal o recebe: a projeção, endereçada pelo id do REGISTRO. */
export interface PortalViewRecord {
  collection: string;
  recordId: string;
  title: string;
  data: Record<string, unknown>;
  labels: Record<string, string>;
  updatedAt: Date | null;
}

const toViewRecord = (record: PortalRecord): PortalViewRecord => ({
  collection: record.collection,
  recordId: record.recordId,
  title: record.title,
  data: record.data,
  labels: record.labels,
  updatedAt: record.updatedAt,
});

/** A tela exposta: títulos, campos expostos e o que o convidado preenche ao criar. */
const usePortalScreen = (collection: string): PortalScreenInfo | null => {
  const { context } = usePortal();
  return useMemo(() => context?.screens.find((screen) => screen.collection === collection) ?? null, [context, collection]);
};

/**
 * Os registros de uma tela que o convidado vê — todos, ou só os filhos de um registro
 * (`parent: { collection, recordId }`): as notas do prestador aberto.
 */
const usePortalRecords = (
  collection: string,
  options: { parent?: { collection: string; recordId: string } } = {},
): { records: PortalViewRecord[]; loading: boolean } => {
  const { recordsByCollection, isCollectionLoading } = usePortal();
  const parentKey = options.parent ? portalSubjectKey(options.parent.collection, options.parent.recordId) : null;
  const records = useMemo(
    () => (recordsByCollection[collection] ?? [])
      .filter((record) => parentKey === null || record.parentKeys.includes(parentKey))
      .map(toViewRecord),
    [recordsByCollection, collection, parentKey],
  );
  return { records, loading: isCollectionLoading(collection) };
};

const usePortalRecord = (collection: string, recordId: string): PortalViewRecord | null => {
  const { recordsByCollection } = usePortal();
  return useMemo(() => {
    const id = portalRecordDocId(collection, recordId);
    const found = (recordsByCollection[collection] ?? []).find((record) => record.id === id);
    return found ? toViewRecord(found) : null;
  }, [recordsByCollection, collection, recordId]);
};

/** Abrir, voltar e criar — a MESMA pilha que a casca genérica mostra. */
const usePortalNavigation = () => {
  const navigation = useNavigationStore();
  return useMemo(() => ({
    openRecord: (collection: string, recordId: string) => navigation.openRecord(collection, portalRecordDocId(collection, recordId)),
    back: navigation.back,
    /** `parentRecordId` fixa o pai — o formulário não pergunta. Sem ele, pergunta. */
    create: (collection: string, parentRecordId?: string) => navigation.startCreate(collection, parentRecordId ?? null),
  }), [navigation]);
};

/** Os documentos compartilhados de um registro, e o gesto de abrir um deles. */
const usePortalDocuments = (
  collection: string,
  recordId: string,
): { documents: PortalDocument[]; loading: boolean; open: (documentId: string) => Promise<void> } => {
  const { getDocuments, getDocumentUrl } = usePortal();
  const projectionId = portalRecordDocId(collection, recordId);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- outro registro recomeça a lista
    setLoading(true);
    getDocuments(projectionId)
      .then((loaded) => { if (active) setDocuments(loaded); })
      .catch(() => { if (active) setDocuments([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectionId, getDocuments]);

  const open = useCallback(async (documentId: string) => {
    // A janela abre antes da espera: aberta depois de uma promessa, o navegador a bloqueia.
    const opened = window.open('', '_blank');
    try {
      const url = await getDocumentUrl(projectionId, documentId);
      if (opened) opened.location.href = url;
    } catch (error) {
      opened?.close();
      throw error;
    }
  }, [projectionId, getDocumentUrl]);

  return { documents, loading, open };
};

/** Cria um registro pelo portal. A recusa de validação chega já traduzida, no `message`. */
const usePortalSubmit = () => usePortal().submit;

const portalModule = {
  usePortalScreen,
  usePortalRecords,
  usePortalRecord,
  usePortalNavigation,
  usePortalDocuments,
  usePortalSubmit,
} as const;

/**
 * O que uma view de PORTAL alcança. É um subconjunto deliberado da API do escritório: as primitivas
 * de interface, idioma, formato e tema, e `@microteia/portal`. Fora ficam `@microteia/data`,
 * `@microteia/report`, `@microteia/settings` e `@microteia/functions` — todos supõem os stores, as
 * permissões ou as callables de quem é DO escritório, e uma view que os pedisse quebraria na tela do
 * convidado. Pedidos assim falham na compilação, com a mensagem.
 */
export const PORTAL_HOST_MODULES: Record<string, unknown> = {
  react: HOST_MODULES.react,
  'react/jsx-runtime': HOST_MODULES['react/jsx-runtime'],
  'react/jsx-dev-runtime': HOST_MODULES['react/jsx-dev-runtime'],
  'styled-components': HOST_MODULES['styled-components'],
  '@microteia/ui': HOST_MODULES['@microteia/ui'],
  '@microteia/i18n': HOST_MODULES['@microteia/i18n'],
  '@microteia/format': HOST_MODULES['@microteia/format'],
  '@microteia/theme': HOST_MODULES['@microteia/theme'],
  '@microteia/portal': portalModule,
};
