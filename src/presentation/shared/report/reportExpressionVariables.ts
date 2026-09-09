import type { WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { ReportPathOption } from './useReportPathOptions';

/**
 * O ID do registro, que não é campo declarado de tela nenhuma — mas a linha varrida sempre o carrega,
 * e é por ele que uma expressão fala de um registro específico.
 */
const RECORD_ID = 'id';

/**
 * As variáveis que o editor de expressão do relatório oferece — o escopo da LINHA, plano por caminho.
 *
 * Saem dos MESMOS `pathOptions` dos seletores de campo, e por um motivo: a expressão pergunta sobre o
 * dado que o relatório já sabe ler, e um segundo vocabulário aqui divergiria do primeiro na próxima
 * vez que um tipo de campo novo entrasse.
 *
 * Um campo de REFERÊNCIA entra pelo apontado (`cliente.id`), e nunca pelo caminho cru: a hidratação
 * troca o id pelo registro inteiro, então comparar o caminho cru com um id não acha nada — e o
 * sintoma seria um relatório vazio sobre uma coleção cheia, sem uma palavra dizendo por quê.
 */
export const reportExpressionVariables = (
  pathOptions: ReportPathOption[],
  recordIdLabel: string,
): WorkflowVariable[] => {
  const variables: WorkflowVariable[] = [];
  const seen = new Set<string>();
  const push = (name: string, definedBy: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    variables.push({ name, definedBy });
  };

  push(RECORD_ID, recordIdLabel);

  for (const option of pathOptions) {
    if (option.field.type === 'reference') {
      push(`${option.field.refDenormKey ?? option.field.key}.${RECORD_ID}`, option.label);
      continue;
    }
    push(option.value, option.label);
  }

  return variables;
};
