import type { IWorkflowQueryRepository, WorkflowEqualityFilter, WorkflowQueryPage, WorkflowQueryRow } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { SchemaContext } from '../../../domain/schema/pathResolver';
import type { MemberVisibilitySpec, RecordReader } from '../../../domain/schema/memberVisibility';
import { readerRestriction, readerSeesRecord, resolveMemberVisibility } from '../../../domain/schema/memberVisibility';
import { compareDocumentIds } from './documentIdOrder';

/**
 * A leitura do servidor quando ela é ENTREGUE a uma pessoa — o agente, o relatório, o documento.
 *
 * O Admin SDK passa por cima do `firestore.rules`, e por isso a visibilidade por registro
 * (`memberVisibility`) só vale aqui se for aplicada aqui. São duas peças, e as duas devolvem o que já
 * recebiam quando não há leitor (a automação) ou quando ele supervisiona: nada muda para quem não usa
 * a declaração.
 */

/**
 * O fetcher que não entrega o registro que o leitor não vê. O registro apontado por uma referência
 * volta como AUSENTE — o mesmo de uma referência a um registro excluído —, e a leitura por id também.
 * É o que impede o relatório de projetar `resposta.texto` de uma resposta alheia, ou o documento de
 * listar o filho que a regra esconde.
 */
export const readerFetcher = (
  fetcher: IWorkflowRecordFetcher,
  ctx: SchemaContext,
  reader: RecordReader | null | undefined,
): IWorkflowRecordFetcher => {
  if (!reader) return fetcher;
  return {
    fetchByIds: async (tenantId, collection, ids) => {
      const fetched = await fetcher.fetchByIds(tenantId, collection, ids);
      const spec = resolveMemberVisibility(ctx, collection);
      if (readerRestriction(spec, collection, reader) === null) return fetched;
      return new Map([...fetched].map(([id, data]) => [
        id,
        data && readerSeesRecord(spec, collection, reader, data) ? data : null,
      ]));
    },
  };
};

export interface ReaderScan {
  rows: WorkflowQueryRow[];
  /** Nenhuma das consultas bateu no teto, e a união coube nele. */
  complete: boolean;
}

/**
 * A varredura de quem a visibilidade restringe: só o que o NOMEIA, consultado no banco — e não a
 * coleção inteira filtrada depois, que, numa coleção maior que o teto, esconderia da pessoa os
 * próprios registros.
 *
 * Por campo declarado, duas consultas, ambas servidas pelos índices de campo único que toda coleção
 * ganha: `campo == uid` junto dos filtros de igualdade (igualdades se juntam sem índice composto), e
 * `campo array-contains uid` SOZINHO (ao lado de outro filtro pediria um índice que ninguém tem como
 * criar). Os filtros de igualdade que a segunda não levou são conferidos em memória por quem chama —
 * como já faz a leitura por id.
 *
 * As duas formas, e não a que o campo declara hoje, pelo motivo de `memberVisibilityClauses`: um campo
 * que passou de simples a `multi` guarda texto nos registros antigos e lista nos novos.
 */
export const scanVisibleRows = async (
  queryRepository: IWorkflowQueryRepository,
  tenantId: string,
  collection: string,
  equalityFilters: WorkflowEqualityFilter[],
  spec: MemberVisibilitySpec,
  uid: string,
  maxScan: number,
  page?: WorkflowQueryPage,
): Promise<ReaderScan> => {
  const scans = await Promise.all(spec.userFields.flatMap((field) => [
    queryRepository.queryByEquality(tenantId, collection, [...equalityFilters, { path: field, value: uid }], maxScan, page),
    queryRepository.queryByEquality(tenantId, collection, [{ path: field, value: uid, op: 'array-contains' }], maxScan, page),
  ]));

  const byId = new Map<string, WorkflowQueryRow>();
  for (const row of scans.flat()) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  const union = [...byId.values()];
  if (page) return pagedUnion(scans, union, maxScan);
  return {
    rows: union.slice(0, maxScan),
    complete: scans.every((scan) => scan.length < maxScan) && union.length <= maxScan,
  };
};

/**
 * A união em ordem de id, cortada onde todas as varreduras ainda respondem.
 *
 * Cada varredura que bateu no teto só garante o que vai até o ÚLTIMO id que ela trouxe; depois dele,
 * pode haver registro dela que não veio. O corte é o menor desses ids: até ali a união é exata, e o
 * cursor da página seguinte começa depois do último registro que ficou — sem pular nenhum.
 */
const pagedUnion = (scans: WorkflowQueryRow[][], union: WorkflowQueryRow[], maxScan: number): ReaderScan => {
  const bounds = scans
    .filter((scan) => scan.length >= maxScan)
    .map((scan) => scan[scan.length - 1].id)
    .sort(compareDocumentIds);
  const bound = bounds[0];
  const ordered = union
    .filter((row) => bound === undefined || compareDocumentIds(row.id, bound) <= 0)
    .sort((left, right) => compareDocumentIds(left.id, right.id));
  return {
    rows: ordered.slice(0, maxScan),
    complete: bound === undefined && ordered.length <= maxScan,
  };
};
