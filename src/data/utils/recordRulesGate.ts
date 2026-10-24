import type { DocumentReference } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';

import type { FieldDefinition, FieldOrigin } from '../../domain/entities/entitySchemas';
import type { RuleIssue } from '../../domain/schema/fieldRules';
import { LocalizedError } from '../../domain/errors/LocalizedError';
import { describeRuleIssues } from '../../domain/schema/fieldRules';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/pathResolver';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { SchemaLookup, SchemaTagList } from '../../domain/schema/screenEntity';
import { resolveEntityKeys } from '../../domain/schema/screenEntity';
import type { RecordKeyPlan, RecordKeySpec } from '../../domain/schema/recordKeys';
import { planRecordKeys } from '../../domain/schema/recordKeys';
import { declaredRecordKeySignatures } from '../../domain/schema/recordKeyAdoption';
import { readEditWindow, resolveEditWindow } from '../../domain/schema/editWindow';
import type { ResolvedEditWindow } from '../../domain/schema/editWindow';
import type { FieldRulePreset } from '../../domain/schema/fieldRulePresets';
import { applyDerivedFields, collectFieldLogicTargets, formatAndValidateRecord } from '../../domain/schema/recordRules';

export class RecordRulesError extends Error {
  readonly issues: RuleIssue[];

  constructor(issues: RuleIssue[]) {
    super(describeRuleIssues(issues));
    this.name = 'RecordRulesError';
    this.issues = issues;
  }
}

/** A chave que já pertence a outro registro, com o valor que colidiu. */
export interface RecordKeyConflict {
  name: string;
  fields: string[];
  values: string[];
  /** REFERÊNCIA de mensagem declarada na chave; ausente = a do núcleo. */
  message?: string;
}

/**
 * O conflito de chave chega ao formulário pelo canal que já existe — `RuleIssue`, um por CAMPO da
 * chave —, e não por uma via nova de erro. Foi a razão de `RecordKeyEntry` carregar `fields`: sem
 * eles a mensagem apareceria solta no topo, longe do campo que a pessoa precisa corrigir.
 */
export class RecordKeyConflictError extends RecordRulesError {
  readonly conflicts: RecordKeyConflict[];

  constructor(conflicts: RecordKeyConflict[]) {
    super(conflicts.flatMap((conflict) => conflict.fields.map((field) => ({
      path: field,
      label: field,
      error: conflict.message ?? '@core.records/key.duplicate',
      errorParams: { key: conflict.name, value: conflict.values.join(' + ') },
    }))));
    this.name = 'RecordKeyConflictError';
    this.conflicts = conflicts;
  }
}

/** A chave obrigatória cujo valor não veio — recusa antes da rede, como qualquer regra de campo. */
export class RecordKeyMissingError extends RecordRulesError {
  constructor(gaps: { name: string; fields: string[] }[]) {
    super(gaps.flatMap((gap) => gap.fields.map((field) => ({
      path: field,
      label: field,
      error: '@core.records/key.required',
      errorParams: { key: gap.name },
    }))));
    this.name = 'RecordKeyMissingError';
  }
}

/**
 * A gravação que a janela de edição da tela recusa. Chega como `LocalizedError` porque é assim que a
 * tela já mostra um erro com parâmetros — nenhuma via nova de mensagem. A mesma recusa vem do
 * `firestore.rules` quando o relógio do navegador está atrasado; esta é a que chega antes da rede, com
 * o motivo dito.
 */
export class EditWindowClosedError extends LocalizedError {
  constructor(minutes: number, gesture: 'update' | 'delete') {
    super(
      gesture === 'update' ? '@core.records/edit-window.update-closed' : '@core.records/edit-window.delete-closed',
      { minutes: String(minutes) },
    );
    this.name = 'EditWindowClosedError';
  }
}

let schemaScreens: SchemaScreen[] = [];
let schemaLookups: SchemaLookup[] = [];
let schemaTagLists: SchemaTagList[] = [];
let schemaFieldRulePresets: FieldRulePreset[] = [];
let schemaContext: SchemaContext = createSchemaContext();

const rebuild = (): void => {
  schemaContext = createSchemaContext(
    schemaScreens,
    schemaLookups,
    schemaTagLists,
    schemaFieldRulePresets,
  );
};

/**
 * Última porta antes da rede: os repositórios não têm como alcançar um Store React, então o
 * ScreenDefinitionStore empurra as telas do tenant corrente para cá sempre que elas mudam.
 * Sem isso, os campos dinâmicos ficariam sem regra na hora da gravação.
 */
export const setRecordRulesScreens = (screens: SchemaScreen[]): void => {
  schemaScreens = screens;
  rebuild();
};

/** Mesmo mecanismo, para as listas declaradas pelo tenant (empurradas pelo `LookupStore`). */
export const setRecordRulesLookups = (lookups: SchemaLookup[]): void => {
  schemaLookups = lookups;
  rebuild();
};

/** Idem para os conjuntos de etiquetas (empurrados pelo `TagStore`). */
export const setRecordRulesTagLists = (tagLists: SchemaTagList[]): void => {
  schemaTagLists = tagLists;
  rebuild();
};

/**
 * Idem para as máscaras/formatações/validações declaradas pelas extensões instaladas (empurradas
 * pelo `FieldRulePresetBridge`, que lê as contribuições do Kernel do tenant).
 */
export const setRecordRulesFieldRulePresets = (presets: FieldRulePreset[]): void => {
  schemaFieldRulePresets = presets;
  rebuild();
};

/**
 * A tela que declara `dataCollection` entra pela COLEÇÃO que descreve, não pelo próprio nome: o que
 * ela declara vale para todo mundo que grava naquela coleção, venha de qual tela vier. É o que
 * permite uma extensão descrever inteiramente uma entidade — e continuar descrevendo depois que a
 * declaração equivalente sair do kernel.
 */
export const toSchemaScreens = (
  definitions: {
    id: string;
    titleSingular: string;
    titlePlural?: string;
    titleFieldKey: string;
    fields: FieldDefinition[];
    keys?: RecordKeySpec[] | null;
    tagCollection?: string | null;
    dataCollection?: string | null;
    eventPrefix?: string | null;
    hasDocuments?: boolean;
    origin?: FieldOrigin;
    editWindow?: unknown;
    memberWritableFields?: string[] | null;
  }[],
): SchemaScreen[] =>
  definitions.map((definition) => ({
    id: definition.id,
    collection: definition.dataCollection ?? undefined,
    titleSingular: definition.titleSingular,
    titlePlural: definition.titlePlural,
    titleFieldKey: definition.titleFieldKey,
    fields: definition.fields,
    keys: definition.keys,
    tagCollection: definition.tagCollection,
    eventPrefix: definition.eventPrefix,
    hasDocuments: definition.hasDocuments,
    origin: definition.origin,
    editWindow: readEditWindow(definition.editWindow),
    memberWritableFields: definition.memberWritableFields ?? null,
  }));

const tableHasComputedFields = (table: string): boolean =>
  collectFieldLogicTargets(schemaContext, table, 'compute').length > 0;

/**
 * Lê o registro existente para servir de base ao escopo dos campos computados num update parcial.
 * Quando a tabela não tem nenhum campo computado, nada é lido — o baseline não teria uso e a
 * leitura extra sairia de graça no lugar errado.
 */
export const loadRecordBaseline = async (
  table: string,
  ref: DocumentReference,
): Promise<Record<string, unknown> | undefined> => {
  if (!tableHasComputedFields(table)) return undefined;
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
};

/**
 * O portão de LEITURA, espelho do `applyRecordRules`: devolve a função que põe os campos derivados
 * (`logic.derive`) em cada registro lido da coleção.
 *
 * É uma FÁBRICA, e não uma função por registro, por duas razões. Os alvos são resolvidos uma vez por
 * leitura, em vez de uma vez por documento — uma listagem de 200 registros percorria o schema 200
 * vezes. E o instante é capturado uma vez: todos os registros de uma mesma leitura respondem sobre o
 * mesmo momento, senão dois vizinhos discordariam sobre que dia é hoje numa lista que atravessa a
 * meia-noite.
 *
 * Sem nenhum campo derivado, devolve a identidade — nada é copiado e nada é avaliado.
 */
export const makeRecordDeriver = (table: string): (<T extends object>(record: T) => T) => {
  if (collectFieldLogicTargets(schemaContext, table, 'derive').length === 0) {
    return <T extends object>(record: T): T => record;
  }
  const at = new Date();
  return <T extends object>(record: T): T =>
    applyDerivedFields(schemaContext, table, record as Record<string, unknown>, at) as T;
};

/**
 * As reservas de chave que uma gravação precisa fazer, sobre o registro COMPLETO — o payload
 * mesclado com o que já estava gravado. A mescla não é detalhe: um update que toca um campo só de
 * uma chave composta continua sendo a mesma chave, e planejar sobre o payload parcial reservaria uma
 * chave com metade dos valores vazios. O `baseline` é também o "antes": a chave que o update não
 * muda fica com a reserva que tinha — ou, num registro antigo, com a varredura de adoção.
 */
export const planRecordKeysFor = (
  table: string,
  data: object,
  baseline?: object,
): RecordKeyPlan => {
  const keys = resolveEntityKeys(schemaContext, table);
  if (keys.length === 0) return { entries: [], gaps: [], held: [] };
  const previous = baseline as Record<string, unknown> | undefined;
  const merged = { ...previous, ...(data as Record<string, unknown>) };
  return planRecordKeys(keys, merged, table, schemaContext.fieldRulePresets, previous);
};

/**
 * Nome → assinatura das chaves da coleção, sobre o MESMO catálogo de formatações da gravação — com
 * as das extensões. É o que a listagem compara com o job de adoção; um catálogo sem elas daria a uma
 * chave `cpf` uma assinatura que o servidor nunca adotaria.
 */
export const recordKeySignaturesFor = (table: string): Record<string, string> =>
  declaredRecordKeySignatures(resolveEntityKeys(schemaContext, table), schemaContext.fieldRulePresets);

/** As chaves declaradas da coleção, como a gravação as vê. */
export const recordKeysFor = (table: string): RecordKeySpec[] => resolveEntityKeys(schemaContext, table);

/** A coleção declara alguma chave? É o que decide se a gravação precisa virar lote. */
export const tableHasRecordKeys = (table: string): boolean =>
  resolveEntityKeys(schemaContext, table).length > 0;

export const validateRecordRules = (table: string, data: object): RuleIssue[] =>
  formatAndValidateRecord(schemaContext, table, data as Record<string, unknown>).issues;

/**
 * Formata o registro e lança RecordRulesError se alguma regra de campo não passar.
 * Chamado por todo create/update de repositório das entidades com schema.
 *
 * `baseline` é o registro já existente: serve de base ao escopo dos campos computados quando o
 * update envia apenas parte dos campos.
 */
export const applyRecordRules = <T extends object>(
  table: string,
  data: T,
  baseline?: object,
): T => {
  const outcome = formatAndValidateRecord(schemaContext, table, data as Record<string, unknown>, {
    baseline: baseline as Record<string, unknown> | undefined,
  });
  if (outcome.issues.length > 0) throw new RecordRulesError(outcome.issues);
  return outcome.data as T;
};

/** A janela de edição da coleção, como a gravação a vê. `null` = sem prazo. */
export const editWindowFor = (table: string): ResolvedEditWindow | null => resolveEditWindow(schemaContext, table);
