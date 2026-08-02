import { describe, expect, it } from 'vitest';
import { MARKETPLACE_CATALOG } from './catalog';
import { QUERY_VALUE_MAPPING_KINDS } from '../../presentation/pages/ViewWorkflow/components/QueryBuilderControl/QueryBuilderControl.viewmodel';
import { EVENT_FIELD_PATH_PREFIX, buildConditionEventFields } from '../../presentation/shared/conditionHelpers';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import { materializePluginScreens } from '../../domain/usecases/plugins/screenModule';
import type { MarketplacePlugin, WorkflowModuleTemplate } from '../../domain/entities/MarketplacePlugin';
import type { Condition, WorkflowStep } from '../../domain/entities/Workflow';
import type { QuerySpec } from '../../domain/schema/querySpec';
import type { SchemaScreen } from '../../domain/schema/pathResolver';

/**
 * Uma automação que viaja numa extensão é INSTALADA no escritório, e lá ela é um registro comum: o
 * admin abre, lê e ajusta pelo mesmo construtor de sempre. Executar, portanto, não basta — a
 * declaração precisa ser RELEGÍVEL por quem a abre.
 *
 * O motor resolve as cinco variantes de `InputMapping`; os construtores da autoria, não. Um filtro
 * de consulta gravado como `{ kind: 'Event' }` roda perfeitamente e aparece na tela como "Valor
 * fixo" VAZIO — o escritório lê uma mentira, e o primeiro toque na linha apaga o filtro. Uma
 * comparação apontando para a saída de um step roda, e o seletor de campo a marca em vermelho,
 * porque só oferece os campos do evento.
 *
 * Nenhum teste de execução pega isso: os dois casos passam. Este pega.
 */

const screenOf = (screen: MarketplacePlugin['screens'] extends (infer S)[] | undefined ? S : never): SchemaScreen => ({
  id: screen.key,
  collection: screen.dataCollection,
  titleSingular: screen.titleSingular,
  titlePlural: screen.titlePlural,
  titleFieldKey: screen.titleFieldKey,
  fields: screen.fields.map((field) => ({ ...field, origin: 'plugin' as const })),
});

/** Todos os steps do workflow, inclusive os que moram dentro de ramos e de repetições. */
const allSteps = (steps: WorkflowStep[]): WorkflowStep[] =>
  steps.flatMap((step) => [
    step,
    ...allSteps(step.branches?.whenTrue ?? []),
    ...allSteps(step.branches?.whenFalse ?? []),
    ...allSteps(step.loop?.body ?? []),
  ]);

const allConditions = (condition: Condition | undefined): Condition[] => {
  if (!condition) return [];
  if (condition.kind === 'LogicalAnd' || condition.kind === 'LogicalOr') {
    return [condition, ...condition.conditions.flatMap(allConditions)];
  }
  if (condition.kind === 'Not') return [condition, ...allConditions(condition.condition)];
  return [condition];
};

const querySpecsOf = (workflow: WorkflowModuleTemplate): QuerySpec[] =>
  allSteps(workflow.steps ?? [])
    .map((step) => step.configuration?.query)
    .filter((mapping) => mapping?.kind === 'Literal')
    .map((mapping) => (mapping as { value: QuerySpec }).value)
    .filter((spec): spec is QuerySpec => !!spec && Array.isArray(spec.where));

const comparisonsOf = (workflow: WorkflowModuleTemplate) =>
  [
    ...allConditions(workflow.condition),
    ...allSteps(workflow.steps ?? []).flatMap((step) => allConditions(step.condition)),
  ].filter((condition) => condition.kind === 'FieldComparison');

const workflowsOf = (plugin: MarketplacePlugin) =>
  plugin.workflows.map((workflow) => [plugin.manifest.name, workflow.name, workflow] as const);

const CASOS = MARKETPLACE_CATALOG.flatMap(workflowsOf);

/** O contexto de esquema que o construtor teria: todas as telas que o catálogo instala. */
const schemaContext = createSchemaContext(
  MARKETPLACE_CATALOG.flatMap((plugin) => (plugin.screens ?? []).map(screenOf)),
);

describe('automações das extensões — a autoria consegue reabri-las', () => {
  it.each(CASOS)('%s / "%s" — filtros vêm de uma origem que o construtor de consulta oferece', (_plugin, _nome, workflow) => {
    for (const spec of querySpecsOf(workflow)) {
      for (const predicate of spec.where) {
        if (!predicate.value) continue;
        expect(
          QUERY_VALUE_MAPPING_KINDS,
          `filtro "${predicate.path}" da consulta em "${spec.table}"`,
        ).toContain(predicate.value.kind);
      }
    }
  });

  it.each(CASOS)('%s / "%s" — cada comparação aponta para um campo que o seletor oferece', (_plugin, _nome, workflow) => {
    const oferecidos = new Set(
      buildConditionEventFields(workflow.eventName, schemaContext, workflow.parameters)
        .map((field) => `${EVENT_FIELD_PATH_PREFIX}${field.path}`),
    );

    for (const condition of comparisonsOf(workflow)) {
      if (condition.kind !== 'FieldComparison') continue;
      expect(
        [...oferecidos],
        `a comparação lê "${condition.fieldPath}", que o seletor de campo não oferece — use um nó de Expressão`,
      ).toContain(condition.fieldPath);
    }
  });

  /**
   * O par de nomes que engana: a COMPARAÇÃO lê o contexto cru (`outputs`), a EXPRESSÃO lê o escopo
   * publicado para ela (`output`, singular) — e é o singular que o autocomplete oferece. Escrever o
   * plural numa expressão devolve indefinido em silêncio, e a condição vira sempre falsa.
   */
  it.each(CASOS)('%s / "%s" — expressões leem as saídas por "output.", como o autocomplete ensina', (_plugin, _nome, workflow) => {
    const expressoes = [
      ...allConditions(workflow.condition),
      ...allSteps(workflow.steps ?? []).flatMap((step) => allConditions(step.condition)),
    ]
      .filter((condition) => condition.kind === 'Expression')
      .map((condition) => (condition as { expression: string }).expression);

    for (const expressao of expressoes) {
      expect(expressao, `a expressão "${expressao}" usa "outputs." (plural)`).not.toMatch(/\boutputs\./);
    }
  });

  /** Um step só existe se o motor souber resolvê-lo — e um id vazio só vale nos nós de controle. */
  it.each(CASOS)('%s / "%s" — todo step de ação declara um passo do catálogo', (_plugin, _nome, workflow) => {
    for (const step of allSteps(workflow.steps ?? [])) {
      if (step.type === 'Condition' || step.type === 'Loop') {
        expect(step.stepDefinitionId, `nó de controle "${step.id}"`).toBe('');
        continue;
      }
      expect(step.stepDefinitionId, `step "${step.id}"`).not.toBe('');
    }
  });
});

/** A tela instalada precisa existir para o construtor resolver os caminhos das consultas. */
describe('as telas do catálogo materializam num contexto de esquema válido', () => {
  it('toda coleção consultada por uma automação é descrita por alguma tela do catálogo', () => {
    const descritas = new Set(
      MARKETPLACE_CATALOG.flatMap((plugin) =>
        materializePluginScreens(plugin, 'u1').map(({ screenKey, input }) => input.dataCollection ?? screenKey),
      ),
    );

    for (const [plugin, nome, workflow] of CASOS) {
      for (const spec of querySpecsOf(workflow)) {
        expect(descritas, `${plugin}: a automação "${nome}" consulta "${spec.table}"`).toContain(spec.table);
      }
    }
  });
});
