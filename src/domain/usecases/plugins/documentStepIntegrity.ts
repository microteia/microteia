import type { WorkflowParameter, WorkflowParameterType, WorkflowStep } from '../../entities/Workflow';
import type { Contribution } from '../../schema/plugin/contribution';
import type { DocumentTemplateSource } from '../../schema/document/documentTemplate';
import { DOCUMENT_TEMPLATE_POINT, isSingleRecordParameter } from '../../schema/document/documentTemplate';
import { coreStepMetadata, inputsForTemplateSource } from '../../schema/workflowStepCatalog';
import type { PackageRef, PackageValidationIssue } from './pluginReferences';

/**
 * O passo `render-document` conferido contra o MODELO que ele cita.
 *
 * O passo recebe os dados do modelo como `param.<chave>` — inputs dinâmicos, que nascem dos
 * parâmetros do modelo escolhido em design-time. A integridade de passo (`workflowIntegrity.ts`) só
 * conferia o prefixo deles, e o resto do contrato ficava para a geração, no escritório: um parâmetro
 * com erro de digitação era ignorado e o campo saía em branco; um `belongsTo` que não aponta para um
 * registro, um `recordId` num modelo de dados, um parâmetro obrigatório sem valor — todos recusados
 * só no clique, ou na automação já rodando.
 *
 * As regras são as mesmas que o editor do passo e o motor já aplicam, lidas das mesmas fontes:
 * `inputsForTemplateSource` decide que input vale para qual origem, e `isSingleRecordParameter` decide
 * quem pode ser o dono do documento. Nenhuma regra nova nasce aqui.
 *
 * Quem resolve o modelo é quem chama: a porta do pacote só enxerga os modelos do PRÓPRIO pacote, e as
 * ferramentas de autoria enxergam também os do diretório e os do retrato da instalação. Um modelo que
 * não se enxerga não é conferido — o escritório pode ter o seu na mesma chave.
 */

export const RENDER_DOCUMENT_STEP_ID = 'render-document';

const TEMPLATE_KEY_INPUT = 'templateKey';
const PAYLOAD_INPUT = 'payload';
const BELONGS_TO_INPUT = 'belongsTo';
const DESTINATION_INPUT = 'destination';
const PARAM_PREFIX = 'param.';

/** Um parâmetro do modelo, na FORMA que o passo precisa conhecer — sem rótulo, sem regra, sem opção. */
export interface DocumentParameterContract {
  key: string;
  type: WorkflowParameterType;
  required?: boolean;
  list?: boolean;
  entityType?: string;
}

/**
 * O que um passo precisa saber de um modelo para ser conferido. É o que viaja no retrato da instalação:
 * a forma, nunca o texto do modelo.
 */
export interface DocumentTemplateContract {
  key: string;
  source: DocumentTemplateSource;
  /** Vazio num modelo `payload` = qualquer objeto é aceito como vem, e nenhuma chave é conferida. */
  parameters: DocumentParameterContract[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;

const parameterContractOf = (raw: unknown): DocumentParameterContract | null => {
  const record = asRecord(raw);
  if (record === null || typeof record.key !== 'string' || record.key === '' || typeof record.type !== 'string') return null;
  return {
    key: record.key,
    type: record.type as WorkflowParameterType,
    ...(record.required === true ? { required: true } : {}),
    ...(record.list === true ? { list: true } : {}),
    ...(typeof record.entityType === 'string' && record.entityType !== '' ? { entityType: record.entityType } : {}),
  };
};

/**
 * O contrato de um modelo declarado, lido da metadata crua. Tolerante de propósito: a forma do modelo
 * é conferida por quem valida a contribuição, e aqui basta saber a chave, a origem e os parâmetros.
 */
export const documentTemplateContractOf = (raw: unknown): DocumentTemplateContract | null => {
  const record = asRecord(raw);
  if (record === null || typeof record.key !== 'string' || record.key === '') return null;
  return {
    key: record.key,
    source: record.source === 'payload' ? 'payload' : 'record',
    parameters: (Array.isArray(record.parameters) ? record.parameters : [])
      .map(parameterContractOf)
      .filter((one): one is DocumentParameterContract => one !== null),
  };
};

/** Os modelos que uma lista de contribuições declara (`document.template`), como contrato. */
export const declaredDocumentTemplates = (contributes: readonly Contribution[] | undefined): DocumentTemplateContract[] =>
  (contributes ?? [])
    .filter((contribution) => contribution?.point === DOCUMENT_TEMPLATE_POINT)
    .map((contribution) => documentTemplateContractOf(contribution.metadata))
    .filter((one): one is DocumentTemplateContract => one !== null);

const literalText = (step: WorkflowStep, input: string): string | null => {
  const mapping = asRecord(step.configuration?.[input]);
  return mapping?.kind === 'Literal' && typeof mapping.value === 'string' && mapping.value.trim() !== ''
    ? mapping.value.trim()
    : null;
};

/**
 * A chave do modelo que o passo cita, quando ela é conhecida no pacote: um `Literal`. Vinda de uma
 * expressão ou da saída de outro passo, ela só existe em runtime — e aí não há o que conferir.
 */
export const renderDocumentTemplateKey = (step: WorkflowStep): string | null =>
  step.stepDefinitionId === RENDER_DOCUMENT_STEP_ID ? literalText(step, TEMPLATE_KEY_INPUT) : null;

/** `param.cliente.nome` preenche o parâmetro `cliente`, como em "Chamar Workflow". */
const parameterOfInput = (input: string): string => input.slice(PARAM_PREFIX.length).split('.')[0];

/**
 * Os problemas do passo diante do modelo que ele cita. Todos são certezas — o motor recusaria, ou
 * descartaria em silêncio, em qualquer escritório em que este modelo responda pela chave.
 */
export const renderDocumentStepIssues = (
  step: WorkflowStep,
  template: DocumentTemplateContract,
  ref: PackageRef,
): PackageValidationIssue[] => {
  const configuration = step.configuration ?? {};
  const configured = Object.keys(configuration);
  const issue = (message: string, params: Record<string, string>): PackageValidationIssue => ({
    ref,
    message,
    messageParams: { step: step.id, template: template.key, ...params },
  });

  const inputs = coreStepMetadata(RENDER_DOCUMENT_STEP_ID).inputs;
  const applicable = inputsForTemplateSource(inputs, template.source);
  const applicableIds = new Set(applicable.map((input) => input.id));

  const otherSource = inputs
    .filter((input) => input.templateSource !== undefined && !applicableIds.has(input.id) && configuration[input.id] !== undefined)
    .map((input) => issue(
      input.templateSource?.is === 'record' ? '@core.marketplace/issue.step.document.record-only' : '@core.marketplace/issue.step.document.payload-only',
      { input: input.id },
    ));

  const missing = applicable
    .filter((input) => input.templateSource?.required && configuration[input.id] === undefined)
    .map((input) => issue('@core.marketplace/issue.step.document.input-required', { input: input.id }));

  const params = configured.filter((key) => key.startsWith(PARAM_PREFIX));
  if (template.source === 'record') {
    return [...otherSource, ...params.map((input) => issue('@core.marketplace/issue.step.document.payload-only', { input })), ...missing];
  }

  const declared = new Map<string, Pick<WorkflowParameter, 'type' | 'entityType' | 'list' | 'required'>>(
    template.parameters.map((parameter) => [parameter.key, parameter]),
  );
  const expected = template.parameters.map((parameter) => parameter.key).join(', ');

  const unknown = declared.size === 0
    ? []
    : params
      .filter((input) => !declared.has(parameterOfInput(input)))
      .map((input) => issue('@core.marketplace/issue.step.document.unknown-parameter', { input, parameter: parameterOfInput(input), expected }));

  const belongsTo = literalText(step, BELONGS_TO_INPUT);
  const owner = belongsTo === null ? undefined : declared.get(belongsTo);
  const notAnOwner = belongsTo !== null && (owner === undefined || !isSingleRecordParameter(owner))
    ? [issue('@core.marketplace/issue.step.document.belongs-to-invalid', {
        parameter: belongsTo,
        expected: template.parameters.filter(isSingleRecordParameter).map((parameter) => parameter.key).join(', ') || '—',
      })]
    : [];

  // O `payload` em bloco pode trazer qualquer chave, e o que ele traz só se sabe em runtime.
  const filled = new Set(params.map(parameterOfInput));
  const unfilled = configuration[PAYLOAD_INPUT] !== undefined
    ? []
    : template.parameters
      .filter((parameter) => parameter.required && !filled.has(parameter.key))
      .map((parameter) => issue('@core.marketplace/issue.step.document.parameter-required', { parameter: parameter.key }));

  const homeless = literalText(step, DESTINATION_INPUT) === 'record' && configuration[BELONGS_TO_INPUT] === undefined
    ? [issue('@core.marketplace/issue.step.document.destination-without-owner', {})]
    : [];

  return [...otherSource, ...unknown, ...notAnOwner, ...unfilled, ...homeless, ...missing];
};
