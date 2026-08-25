import type { DocumentReference } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';

import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { RuleIssue } from '../../domain/schema/fieldRules';
import { describeRuleIssues } from '../../domain/schema/fieldRules';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/pathResolver';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { SchemaLookup, SchemaTagList } from '../../domain/schema/screenEntity';
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
    tagCollection?: string | null;
    dataCollection?: string | null;
    eventPrefix?: string | null;
  }[],
): SchemaScreen[] =>
  definitions.map((definition) => ({
    id: definition.id,
    collection: definition.dataCollection ?? undefined,
    titleSingular: definition.titleSingular,
    titlePlural: definition.titlePlural,
    titleFieldKey: definition.titleFieldKey,
    fields: definition.fields,
    tagCollection: definition.tagCollection,
    eventPrefix: definition.eventPrefix,
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
