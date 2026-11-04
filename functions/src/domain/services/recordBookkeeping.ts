import { RECORD_KEY_REFS_FIELD } from '../schema/recordKeys';
import { RECORD_SEARCH_FIELD } from '../schema/recordSearch';

/**
 * Os campos que a plataforma grava SOBRE um registro sem que nada tenha acontecido a ele: a
 * contabilidade das reservas de chave (`keyRefs`, gravada pela adoção) e os termos de busca
 * (`searchTerms`, gravados pela derivação). Nenhum caminho de negócio grava qualquer um deles sozinho —
 * o formulário e a automação os levam junto do valor que os justifica, ou não os levam.
 */
const BOOKKEEPING_FIELDS: ReadonlySet<string> = new Set([RECORD_KEY_REFS_FIELD, RECORD_SEARCH_FIELD]);

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

/**
 * A gravação só mexeu em contabilidade. Não é fato de negócio: não publica `.saved`, não audita, não
 * recalcula agregado, não reprojeta o portal — e não rederiva a busca, que é quem a gravou. Sem isso,
 * cada registro salvo produziria um segundo `.saved` e uma segunda linha de auditoria, um segundo
 * depois do primeiro, sem mudança nenhuma que alguém tenha feito.
 */
export const isBookkeepingWrite = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): boolean => {
  if (!before || !after) return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  let touched = false;
  for (const key of keys) {
    if (sameJson(before[key], after[key])) continue;
    if (!BOOKKEEPING_FIELDS.has(key)) return false;
    touched = true;
  }
  return touched;
};
