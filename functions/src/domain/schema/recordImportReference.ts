// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordImportReference.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordImportReference.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SchemaContext } from './pathResolver';
import type { RecordKeySpec } from './recordKeys';
import { planRecordKeys } from './recordKeys';
import { formatAndValidateRecord } from './recordRules';
import { validateWritablePath } from './mutationSpec';
import { resolveEntity, resolveEntityKeys } from './screenEntity';

/**
 * Os campos de REFERÊNCIA de uma importação: o vínculo com o pai, quando ela é feita na aba dele, e a
 * coluna que acha o registro apontado pela chave dele. O navegador pergunta aqui o que oferecer; o
 * servidor, o que aceitar — e os dois chegam à mesma resposta porque o arquivo é o mesmo.
 *
 * Mora fora de `recordImport.ts` porque precisa do schema, e `screenEntity.ts` lê de lá a coleção
 * reservada dos jobs.
 */

/** Para onde um campo de referência da tabela aponta, e se guarda uma lista de ids. */
export interface ImportReferenceTarget {
  /** A coleção física do alvo — a das permissões e das reservas. */
  collection: string;
  label: string;
  multi: boolean;
}

/**
 * O campo é uma referência que a importação pode gravar: existe na tabela, o caminho de gravação o aceita
 * e o alvo é uma entidade conhecida. `null` em qualquer outro caso.
 */
export const resolveImportReference = (
  ctx: SchemaContext,
  collection: string,
  fieldKey: string,
): ImportReferenceTarget | null => {
  const field = resolveEntity(ctx, collection)?.fields.find((candidate) => candidate.key === fieldKey);
  if (!field?.refEntity || validateWritablePath(ctx, collection, fieldKey) !== undefined) return null;
  const target = resolveEntity(ctx, field.refEntity);
  return target ? { collection: target.collection, label: field.label, multi: field.multi === true } : null;
};

/**
 * O campo que prende uma importação ao pai: uma referência de UM id. Num `multi`, gravar o pai
 * substituiria os outros ids da lista do registro que a linha altera — e a importação não lê o registro
 * antes para somar. REFERÊNCIA da recusa, ou `null`.
 */
export const importParentFieldIssue = (ctx: SchemaContext, collection: string, fieldKey: string): string | null => {
  const reference = resolveImportReference(ctx, collection, fieldKey);
  return reference && !reference.multi ? null : '@core.records/import.error.parent-field';
};

/**
 * As chaves do alvo por que uma célula acha o registro: as declaradas, `primary` ou `unique`, de UM campo
 * — uma célula é um valor. A chave composta fica de fora: ela pediria várias colunas para um campo só.
 */
export const importLookupKeys = (ctx: SchemaContext, targetCollection: string): RecordKeySpec[] =>
  resolveEntityKeys(ctx, targetCollection).filter((key) => key.fields.length === 1 && !key.fields[0].includes('.'));

/**
 * O id da reserva que a célula endereça na chave do alvo, ou `null` quando a célula não forma chave. O
 * valor passa ANTES pelas regras do campo do alvo, como na gravação: a reserva guardou o valor já
 * formatado, e é com ele que a normalização da chave (`normalize`, `formatPreset`) compara.
 */
export const importLookupKeyId = (
  ctx: SchemaContext,
  targetCollection: string,
  key: RecordKeySpec,
  value: unknown,
): string | null => {
  const [field] = key.fields;
  const formatted = formatAndValidateRecord(ctx, targetCollection, { [field]: value }).data[field] ?? value;
  const [entry] = planRecordKeys([key], { [field]: formatted }, targetCollection, ctx.fieldRulePresets).entries;
  return entry?.keyId ?? null;
};
