/**
 * O SELO do link permanente de um documento de registro — o que diz se o token de download que o
 * arquivo tem AGORA já saiu do escritório pelo portal.
 *
 * O link permanente (`url`, com `token=`) é a chave do arquivo: quem o tem abre, sem regra nenhuma. Com
 * `portal.documentLinks`, o convidado passa a receber só link assinado e curto; mas o token que ele
 * recebeu antes continuaria valendo depois de o convite ser revogado. O selo é como o servidor sabe
 * quais tokens precisam ser trocados:
 *
 * - SELADO: o campo guarda o token que a `url` carrega — esse token nunca foi entregue a um convidado;
 * - SEM SELO: o token pode ter saído (o documento é anterior à declaração, ou foi aberto pelo portal com
 *   o link permanente), e o documento que já foi compartilhado alguma vez tem o token trocado;
 * - PENDENTE: o campo guarda um token que a `url` ainda não carrega — uma troca começou e não terminou.
 *   Quem a encontra a termina com o MESMO token, e por isso duas trocas simultâneas convergem.
 */
export const RECORD_DOCUMENT_LINK_SEAL_FIELD = 'portalLinkSeal';

/**
 * O que a troca do token grava no documento do registro. Não é alteração de ninguém: a auditoria não a
 * registra e as automações não recebem `document.saved` por ela — o arquivo é o mesmo, só a chave mudou.
 */
export const RECORD_DOCUMENT_LINK_STAMPS: readonly string[] = ['url', RECORD_DOCUMENT_LINK_SEAL_FIELD];

/** O token de download de uma URL do Firebase Storage — `null` quando ela não carrega um. */
export const downloadTokenOf = (url: unknown): string | null => {
  if (typeof url !== 'string' || url === '') return null;
  try {
    return new URL(url).searchParams.get('token') || null;
  } catch {
    return null;
  }
};

const sealOf = (data: Record<string, unknown>): string | null => {
  const seal = data[RECORD_DOCUMENT_LINK_SEAL_FIELD];
  return typeof seal === 'string' && seal !== '' ? seal : null;
};

/** O token que a `url` carrega nunca foi entregue a um convidado. */
export const isRecordDocumentLinkSealed = (data: Record<string, unknown>): boolean => {
  const seal = sealOf(data);
  return seal !== null && seal === downloadTokenOf(data.url);
};

/** A troca que começou e não terminou — o token que ela escolheu, para quem a termina usar o mesmo. */
export const pendingRecordDocumentLinkToken = (data: Record<string, unknown>): string | null =>
  isRecordDocumentLinkSealed(data) ? null : sealOf(data);

export type RecordDocumentLinkState = 'sealed' | 'pending' | 'unsealed';

export const recordDocumentLinkState = (data: Record<string, unknown>): RecordDocumentLinkState => {
  if (isRecordDocumentLinkSealed(data)) return 'sealed';
  return sealOf(data) !== null ? 'pending' : 'unsealed';
};

/** Tem selo — inteiro ou pendente. É o que precisa ser tirado quando o token sai pelo portal. */
export const hasRecordDocumentLinkSeal = (data: Record<string, unknown>): boolean => sealOf(data) !== null;

/**
 * O documento já foi compartilhado com o portal alguma vez. `portalSharedAt` fica depois de recolhido —
 * a regra só deixa trocar a marca com o carimbo junto —, e é o que distingue o documento cujo token
 * nunca pôde ter saído.
 */
export const wasEverPortalShared = (data: Record<string, unknown> | null | undefined): boolean =>
  !!data && (data.portalShared === true || (data.portalSharedAt !== undefined && data.portalSharedAt !== null));

/**
 * O token do documento precisa ser trocado: já foi compartilhado, não está selado e não está sendo
 * excluído. O documento nunca compartilhado fica de fora — o token dele não saiu por lugar nenhum.
 */
export const needsRecordDocumentLinkRotation = (data: Record<string, unknown>): boolean =>
  !data.deletedBy && wasEverPortalShared(data) && !isRecordDocumentLinkSealed(data);
