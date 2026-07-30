import type { DocumentReference } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';

import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { RuleIssue } from '../../domain/schema/fieldRules';
import { describeRuleIssues } from '../../domain/schema/fieldRules';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/pathResolver';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import type { SchemaLookup, SchemaTagList } from '../../domain/schema/screenEntity';
import { collectFieldLogicTargets, formatAndValidateRecord } from '../../domain/schema/recordRules';

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
let schemaContext: SchemaContext = createSchemaContext();

const rebuild = (): void => {
  schemaContext = createSchemaContext(schemaScreens, schemaLookups, schemaTagLists);
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

export const toSchemaScreens = (
  definitions: {
    id: string;
    titleSingular: string;
    titlePlural?: string;
    titleFieldKey: string;
    fields: FieldDefinition[];
    tagCollection?: string | null;
  }[],
): SchemaScreen[] =>
  definitions.map((definition) => ({
    id: definition.id,
    titleSingular: definition.titleSingular,
    titlePlural: definition.titlePlural,
    titleFieldKey: definition.titleFieldKey,
    fields: definition.fields,
    tagCollection: definition.tagCollection,
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
