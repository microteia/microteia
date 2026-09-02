import type { WorkflowParameter } from '../../domain/entities/Workflow';
import type { InputDefinition } from '../../domain/entities/WorkflowStepCatalog';

/**
 * Resolve uma referência de mensagem — com os parâmetros de interpolação, quando a referência os
 * pede. É a mesma assinatura de `useLabel`, e ela precisa dos dois argumentos porque este módulo
 * INTRODUZ referências próprias (o rótulo de uma lista), e não só repassa as declaradas.
 */
type LabelFn = (value: string | null | undefined, params?: Record<string, string>) => string;

/**
 * O parâmetro com os RÓTULOS resolvidos — e nada mais tocado.
 *
 * Toda tela que pede um parâmetro o faz atravessar este módulo, então resolver aqui cobre as três de
 * uma vez: o Step "Chamar Workflow", o "Executar" do fluxo e a ação que pergunta antes de disparar.
 * A alternativa era três pontos que precisariam lembrar da mesma coisa — e dois deles não lembravam.
 *
 * Desce nos `fields` e nas `options` porque o rótulo declarativo não para na folha: um parâmetro de
 * objeto tem filhos com rótulo próprio, e um `select` tem uma opção por rótulo.
 *
 * É IDEMPOTENTE, como `useResolvedFields`: `resolveLabel` devolve texto comum intacto, então aplicar
 * duas vezes é seguro — o que permite um ponto de resolução em vez de ramos que precisam concordar.
 */
export const parameterForDisplay = (label: LabelFn, parameter: WorkflowParameter): WorkflowParameter => ({
  ...parameter,
  label: label(parameter.label),
  options: parameter.options?.map((option) => ({ ...option, label: label(option.label) })),
  fields: parameter.fields?.map((field) => parameterForDisplay(label, field)),
});

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
  resolve: LabelFn,
  parameter: WorkflowParameter,
  idPrefix = 'param',
  labelPrefix = '',
): InputDefinition[] => {
  const id = `${idPrefix}.${parameter.key}`;
  const label = labelPrefix ? `${labelPrefix} › ${parameter.label}` : parameter.label;
  if (parameter.list) {
    return [{
      // O rótulo de uma lista é a ÚNICA referência que este módulo inventa — as outras chegam
      // prontas de `parameterForDisplay`. Ela é resolvida AQUI, e não deixada para quem consome, pela
      // razão de sempre: quem consome não sabe que ela existe, e o que aparecia na tela era o
      // "{name} (lista)" cru.
      id,
      label: resolve('@core.automation/output.list', { name: label }),
      required: parameter.required ?? false,
      type: 'String',
    }];
  }
  if (parameter.type === 'Object') {
    return (parameter.fields ?? []).flatMap((child) => flattenParameterInputs(resolve, child, id, label));
  }
  return [parameterToInputDefinition(parameter, id, label)];
};
