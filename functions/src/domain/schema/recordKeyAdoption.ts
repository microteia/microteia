// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordKeyAdoption.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordKeyAdoption.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldRulePresetCatalog } from './fieldRulePresets';
import type { RecordKeySpec } from './recordKeys';
import { recordKeyIsSparse } from './recordKeys';

/**
 * A adoção de uma chave sobre os registros que JÁ existiam quando ela foi declarada (ou quando a
 * normalização dela mudou). A gravação só reserva o valor que ela própria escreve; o registro antigo
 * não passa por gravação nenhuma, e sem a varredura a chave "valeria" com as duplicatas de antes
 * escondidas embaixo dela.
 *
 * Um documento por COLEÇÃO em `tenants/{tenantId}/record_key_adoptions/{coleção}` — e não por tela:
 * a reserva é da coleção (o `keyId` começa por ela), e é a coleção que a varredura percorre.
 */
export const RECORD_KEY_ADOPTION_COLLECTION = 'record_key_adoptions';

/**
 * A partir de qual `KERNEL_VERSION` uma chave declarada sobre uma coleção com registros é adotada
 * sozinha. É o que o guia de autoria cita.
 */
export const RECORD_KEY_ADOPTION_SINCE_KERNEL = '2.29.0';

/** Quantas passadas completas a adoção tenta quando algum registro falhou. */
export const RECORD_KEY_ADOPTION_MAX_ATTEMPTS = 3;

/** Sem gravação no job por mais que isto, uma passada `running` está parada. */
export const RECORD_KEY_ADOPTION_STALL_MS = 10 * 60_000;

/**
 * Quantos conflitos o job LISTA. A contagem é sempre a real; a lista é o que se mostra e o que se
 * reconfere quando um dos registros muda. Passando disto, resolver os listados dispara uma passada
 * nova, que encontra os seguintes.
 */
export const RECORD_KEY_ADOPTION_MAX_LISTED = 50;

export type RecordKeyAdoptionStatus = 'running' | 'blocked' | 'done';

/**
 * Um registro antigo que impede a chave de valer.
 *
 * - `duplicate`: o valor dele já está reservado por OUTRO registro vivo (`holderId`);
 * - `missing`: a chave não é esparsa (ou é primária) e ele não tem o valor.
 */
export interface RecordKeyAdoptionIssue {
  key: string;
  kind: 'duplicate' | 'missing';
  recordId: string;
  holderId?: string;
  /** Os valores normalizados — é o que a pessoa procura na listagem. Vazio em `missing`. */
  values: string[];
}

/** Chave cuja normalização cita uma formatação que esta instalação não tem. */
export interface RecordKeyAdoptionBlockage {
  key: string;
  preset: string;
}

export interface RecordKeyAdoptionState {
  status: RecordKeyAdoptionStatus;
  /** Nome → assinatura das chaves em adoção. Não vazio = há chave que ainda não vale. */
  pending: Record<string, string>;
  /** Nome → assinatura das chaves que já valem sobre todo registro. */
  adopted: Record<string, string>;
  generation: number;
  round: number;
  cursor: string | null;
  leaseUntil: number | null;
  touchedAt: number;
  attempts: number;
  processed: number;
  reserved: number;
  failed: number;
  failedIds: string[];
  /** Os conflitos listados (no máximo `RECORD_KEY_ADOPTION_MAX_LISTED`). */
  issues: RecordKeyAdoptionIssue[];
  /** Quantos conflitos há de fato — pode passar da lista. */
  issueCount: number;
  blocked: RecordKeyAdoptionBlockage[];
  /** Um registro listado mudou: a próxima rodada reconfere só os listados. */
  recheck: boolean;
}

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * A identidade de uma chave: só o que muda QUAL reserva um registro recebe, ou se ele recebe uma.
 * `name` é a chave do mapa; `kind` entra pelo que ele decide (`sparse`); `message` fica fora.
 *
 * A formatação entra pelo CONTEÚDO, e não só pelo nome: uma extensão que muda o que `digits` faz muda
 * todas as reservas feitas com ele, e é a mesma varredura que as refaz.
 */
export const recordKeySignature = (key: RecordKeySpec, catalog: FieldRulePresetCatalog): string => {
  const preset = text(key.normalize?.formatPreset);
  return JSON.stringify([
    [...key.fields],
    key.scope ?? 'tenant',
    key.normalize?.trim !== false,
    key.normalize?.caseInsensitive === true,
    preset,
    preset ? catalog.get(preset)?.format ?? null : null,
    recordKeyIsSparse(key),
  ]);
};

/** Nome → assinatura de toda chave declarada para a coleção. */
export const declaredRecordKeySignatures = (
  keys: readonly RecordKeySpec[],
  catalog: FieldRulePresetCatalog,
): Record<string, string> => {
  const declared: Record<string, string> = {};
  for (const key of keys) {
    if (key.fields.length === 0) continue;
    declared[key.name] = recordKeySignature(key, catalog);
  }
  return declared;
};

const sameMap = (left: Record<string, string>, right: Record<string, string>): boolean => {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => right[key] === left[key]);
};

const isEmpty = (map: Record<string, string>): boolean => Object.keys(map).length === 0;

/** A passada — ou a reconferência pedida — sem sinal de vida há mais que o tolerável. */
export const isRecordKeyAdoptionStalled = (state: RecordKeyAdoptionState, now: number): boolean =>
  (state.status === 'running' || state.recheck) && now - state.touchedAt > RECORD_KEY_ADOPTION_STALL_MS;

/**
 * O que fazer com o job de uma coleção, dado o que ela declara agora — o mesmo molde do recálculo de
 * agregados (`planAggregateBackfill`):
 *
 * - `start` — há chave declarada que ainda não vale (nova, normalização alterada, ou o job nunca
 *   existiu — o escritório que já tinha chaves antes da adoção existir);
 * - `resume` — a passada esperava uma formatação; vale conferir de novo;
 * - `nudge` — a passada está parada;
 * - `settle` — uma chave saiu da declaração e o job precisa esquecê-la; com `finish`, não resta nada
 *   em adoção e a passada termina;
 * - `none` — nada.
 *
 * Uma passada que terminou com CONFLITOS não recomeça por aqui: ela espera que um dos registros
 * listados mude (`recheck`). Recomeçar repetiria a varredura inteira para achar os mesmos conflitos.
 */
export type RecordKeyAdoptionPlan =
  | { kind: 'none' }
  | { kind: 'start'; pending: Record<string, string>; adopted: Record<string, string> }
  | { kind: 'resume' }
  | { kind: 'nudge' }
  | { kind: 'settle'; adopted: Record<string, string>; finish: boolean };

export const planRecordKeyAdoption = (
  declared: Record<string, string>,
  state: RecordKeyAdoptionState | null,
  now: number,
): RecordKeyAdoptionPlan => {
  const kept: Record<string, string> = {};
  for (const [name, signature] of Object.entries(state?.adopted ?? {})) {
    if (declared[name] === signature) kept[name] = signature;
  }

  const pending: Record<string, string> = {};
  for (const [name, signature] of Object.entries(declared)) {
    if (kept[name] !== signature) pending[name] = signature;
  }

  if (!state) return isEmpty(pending) ? { kind: 'none' } : { kind: 'start', pending, adopted: kept };

  const keptChanged = !sameMap(kept, state.adopted);

  if (isEmpty(pending)) {
    return state.status !== 'done' || keptChanged || !isEmpty(state.pending)
      ? { kind: 'settle', adopted: kept, finish: true }
      : { kind: 'none' };
  }

  if (!sameMap(pending, state.pending)) return { kind: 'start', pending, adopted: kept };

  if (state.status === 'done') {
    const settled = state.issueCount > 0
      || (state.failed > 0 && state.attempts >= RECORD_KEY_ADOPTION_MAX_ATTEMPTS);
    if (!settled) return { kind: 'start', pending, adopted: kept };
    if (keptChanged) return { kind: 'settle', adopted: kept, finish: false };
    return isRecordKeyAdoptionStalled(state, now) ? { kind: 'nudge' } : { kind: 'none' };
  }

  if (state.status === 'blocked') return { kind: 'resume' };
  if (isRecordKeyAdoptionStalled(state, now)) return { kind: 'nudge' };
  return { kind: 'none' };
};

/**
 * As chaves declaradas que ainda NÃO valem sobre todo registro — o que a interface chama de pendente.
 * Sem job, toda chave declarada está pendente: ninguém conferiu o que já estava gravado.
 */
export const pendingRecordKeyNames = (
  declared: Record<string, string>,
  state: RecordKeyAdoptionState | null,
): string[] => Object.keys(declared).filter((name) => state?.adopted[name] !== declared[name]);

const asStringMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const map: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') map[key] = entry;
  }
  return map;
};

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : [];

const STATUSES: readonly RecordKeyAdoptionStatus[] = ['running', 'blocked', 'done'];

const readIssue = (entry: unknown): RecordKeyAdoptionIssue[] => {
  const raw = entry as Record<string, unknown> | null;
  const key = text(raw?.key);
  const recordId = text(raw?.recordId);
  const kind = raw?.kind === 'missing' ? 'missing' : raw?.kind === 'duplicate' ? 'duplicate' : null;
  if (!key || !recordId || !kind) return [];
  const holderId = text(raw?.holderId);
  return [{ key, kind, recordId, ...(holderId ? { holderId } : {}), values: asStrings(raw?.values) }];
};

/** Lê o documento do job sem confiar na forma — um campo ausente vale o neutro dele. */
export const readRecordKeyAdoptionState = (data: Record<string, unknown>): RecordKeyAdoptionState => ({
  status: STATUSES.includes(data.status as RecordKeyAdoptionStatus)
    ? (data.status as RecordKeyAdoptionStatus)
    : 'done',
  pending: asStringMap(data.pending),
  adopted: asStringMap(data.adopted),
  generation: asCount(data.generation),
  round: asCount(data.round),
  cursor: typeof data.cursor === 'string' && data.cursor !== '' ? data.cursor : null,
  leaseUntil: typeof data.leaseUntil === 'number' ? data.leaseUntil : null,
  touchedAt: asCount(data.touchedAt),
  attempts: asCount(data.attempts),
  processed: asCount(data.processed),
  reserved: asCount(data.reserved),
  failed: asCount(data.failed),
  failedIds: asStrings(data.failedIds),
  issues: Array.isArray(data.issues) ? data.issues.flatMap(readIssue) : [],
  issueCount: asCount(data.issueCount),
  blocked: Array.isArray(data.blocked)
    ? data.blocked.flatMap((entry) => {
      const raw = entry as Record<string, unknown> | null;
      const key = text(raw?.key);
      const preset = text(raw?.preset);
      return key && preset ? [{ key, preset }] : [];
    })
    : [],
  recheck: data.recheck === true,
});
