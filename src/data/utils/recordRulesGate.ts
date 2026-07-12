import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { RuleIssue } from '../../domain/schema/fieldRules';
import { describeRuleIssues } from '../../domain/schema/fieldRules';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/pathResolver';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import { formatAndValidateRecord } from '../../domain/schema/recordRules';

export class RecordRulesError extends Error {
  readonly issues: RuleIssue[];

  constructor(issues: RuleIssue[]) {
    super(describeRuleIssues(issues));
    this.name = 'RecordRulesError';
    this.issues = issues;
  }
}

let schemaContext: SchemaContext = createSchemaContext([]);

/**
 * Última porta antes da rede: os repositórios não têm como alcançar um Store React, então o
 * ScreenDefinitionStore empurra as telas do tenant corrente para cá sempre que elas mudam.
 * Sem isso, os campos dinâmicos ficariam sem regra na hora da gravação.
 */
export const setRecordRulesScreens = (screens: SchemaScreen[]): void => {
  schemaContext = createSchemaContext(screens);
};

export const toSchemaScreens = (
  definitions: { id: string; titleSingular: string; titleFieldKey: string; fields: FieldDefinition[] }[],
): SchemaScreen[] =>
  definitions.map((definition) => ({
    id: definition.id,
    titleSingular: definition.titleSingular,
    titleFieldKey: definition.titleFieldKey,
    fields: definition.fields,
  }));

export const validateRecordRules = (table: string, data: object): RuleIssue[] =>
  formatAndValidateRecord(schemaContext, table, data as Record<string, unknown>).issues;

/**
 * Formata o registro e lança RecordRulesError se alguma regra de campo não passar.
 * Chamado por todo create/update de repositório das entidades com schema.
 */
export const applyRecordRules = <T extends object>(table: string, data: T): T => {
  const outcome = formatAndValidateRecord(schemaContext, table, data as Record<string, unknown>);
  if (outcome.issues.length > 0) throw new RecordRulesError(outcome.issues);
  return outcome.data as T;
};
