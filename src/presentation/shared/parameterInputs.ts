import type { WorkflowParameter } from '../../domain/entities/Workflow';
import type { InputDefinition } from '../../domain/entities/WorkflowStepCatalog';

/**
 * O parâmetro declarado visto como um CONTROLE de entrada — a ponte única entre o que um workflow
 * (ou script) PEDE e o que a tela MOSTRA para preencher.
 *
 * Existe porque o mesmo parâmetro é preenchido em três lugares: no Step "Chamar Workflow", no
 * "Executar" do fluxo e na ação que pergunta antes de disparar. Traduzir o tipo em cada um deles é
 * o que fazia a referência a entidade virar um campo de texto em duas das três telas.
 *
 * Só trata a FOLHA: objeto e lista não são um controle, são um conjunto deles — quem chama decide
 * se desce nos campos (o Step) ou se pede o valor inteiro de uma vez (o formulário de execução).
 */
export const parameterToInputDefinition = (
  parameter: WorkflowParameter,
  id: string = parameter.key,
  label: string = parameter.label,
): InputDefinition => {
  const base = { id, label, required: parameter.required ?? false, rules: parameter.rules };
  switch (parameter.type) {
    case 'EntityReference':
      return { ...base, type: 'EntityReference', entityType: parameter.entityType };
    case 'lookup':
      // Sem lista escolhida não há o que oferecer: cai em texto livre, como a referência sem entidade.
      return parameter.lookupCollection
        ? { ...base, type: 'String', options: { kind: 'Lookup', lookup: parameter.lookupCollection } }
        : { ...base, type: 'String' };
    case 'select':
      return { ...base, type: 'String', options: { kind: 'Static', options: parameter.options ?? [] } };
    case 'Number':
      return { ...base, type: 'Number' };
    case 'Date':
      return { ...base, type: 'Date' };
    case 'Boolean':
      return { ...base, type: 'Boolean' };
    default:
      return { ...base, type: 'String' };
  }
};

/**
 * Os controles de um parâmetro para uma tela que mapeia campo a campo (o Step "Chamar Workflow" e o
 * "Executar Script"): o objeto se desdobra nos filhos, com o id composto que o executor espera.
 */
export const flattenParameterInputs = (
  parameter: WorkflowParameter,
  idPrefix = 'param',
  labelPrefix = '',
): InputDefinition[] => {
  const id = `${idPrefix}.${parameter.key}`;
  const label = labelPrefix ? `${labelPrefix} › ${parameter.label}` : parameter.label;
  if (parameter.list) {
    return [{
      id,
      label: '@core.automation/output.list',
      labelParams: { name: label },
      required: parameter.required ?? false,
      type: 'String',
    }];
  }
  if (parameter.type === 'Object') {
    return (parameter.fields ?? []).flatMap((child) => flattenParameterInputs(child, id, label));
  }
  return [parameterToInputDefinition(parameter, id, label)];
};
