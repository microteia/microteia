import type { IRecordSearchRepository } from '../repositories/IRecordSearchRepository';
import type { SchemaContext } from '../schema/pathResolver';
import type { RecordReader } from '../schema/memberVisibility';
import { readerSeesRecord, resolveMemberVisibility } from '../schema/memberVisibility';
import {
  matchesSearchTerms,
  pickServerSearchTerm,
  RECORD_SEARCH_MAX_RESULTS,
  RECORD_SEARCH_RESTRICTED_WINDOW,
  searchQueryTerms,
} from '../schema/recordSearch';

export interface RecordSearchQueryDeps {
  repository: IRecordSearchRepository;
  schemaContext: (tenantId: string) => Promise<SchemaContext>;
}

/**
 * A busca de quem tem a leitura restrita por registro. O cliente não pode fazê-la: a regra exige o
 * filtro de visibilidade (`or()` de `==` e `array-contains`), e somá-lo ao `array-contains` dos termos
 * pediria dois `array-contains` e índice composto. Aqui o servidor lê a janela de candidatos e aplica
 * a MESMA pergunta da regra (`readerSeesRecord`) a cada um.
 *
 * Devolve só os ids: o cliente lê cada registro pela própria regra, e é ela, e não esta função, que
 * decide o que ele recebe. Uma divergência entre as duas contas resultaria em menos resultados, nunca
 * num registro entregue a quem não o vê.
 */
export const searchVisibleRecordIds = async (
  tenantId: string,
  collection: string,
  text: string,
  limit: number,
  reader: RecordReader,
  deps: RecordSearchQueryDeps,
): Promise<string[]> => {
  const terms = searchQueryTerms(text);
  const term = pickServerSearchTerm(terms);
  if (!term) return [];
  const ctx = await deps.schemaContext(tenantId);
  const spec = resolveMemberVisibility(ctx, collection);
  const candidates = await deps.repository.searchCandidates(tenantId, collection, term, RECORD_SEARCH_RESTRICTED_WINDOW);
  return candidates
    .filter((record) => matchesSearchTerms(record.data.searchTerms, terms))
    .filter((record) => readerSeesRecord(spec, collection, reader, record.data))
    .slice(0, Math.min(Math.max(limit, 1), RECORD_SEARCH_MAX_RESULTS))
    .map((record) => record.id);
};
