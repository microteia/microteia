import { isReferenceableStepId } from '../../../shared/workflowHelpers';
import type { TranslateFn } from '../../../shared/i18n/useT';

export interface AutocompleteItem {
  value: string;
  label: string;
  description?: string;
  category?: string;
  snippet?: string;
  detail?: string;
}

export interface EventField {
  path: string;
  label: string;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  signature: string;
  example: string;
  category: string;
  minArgs: number;
  maxArgs?: number;
}

export interface StepOutputField {
  stepId: string;
  stepName: string;
  outputId: string;
  outputLabel: string;
}

export interface WorkflowVariable {
  name: string;
  definedBy: string;
}

const commonSnippets = (t: TranslateFn): AutocompleteItem[] => [
  {
    value: 'if(condition, trueValue, falseValue)',
    label: t('expression.snippet.if.label'),
    description: t('expression.snippet.if.description'),
    category: t('expression.category.snippet'),
    snippet: 'if(${1:condition}, ${2:trueValue}, ${3:falseValue})',
  },
  {
    value: 'formatDate(date, "DD/MM/YYYY")',
    label: t('expression.snippet.format-date.label'),
    description: t('expression.snippet.format-date.description'),
    category: t('expression.category.snippet'),
    snippet: 'formatDate(${1:date}, "DD/MM/YYYY")',
  },
  {
    value: 'coalesce(value, "default")',
    label: t('expression.snippet.coalesce.label'),
    description: t('expression.snippet.coalesce.description'),
    category: t('expression.category.snippet'),
    snippet: 'coalesce(${1:value}, "${2:default}")',
  },
  {
    value: 'concat(text1, " ", text2)',
    label: t('expression.snippet.concat.label'),
    description: t('expression.snippet.concat.description'),
    category: t('expression.category.snippet'),
    snippet: 'concat(${1:text1}, " ", ${2:text2})',
  },
  {
    value: 'dateDiff(date1, date2, "days")',
    label: t('expression.snippet.date-diff.label'),
    description: t('expression.snippet.date-diff.description'),
    category: t('expression.category.snippet'),
    snippet: 'dateDiff(${1:date1}, ${2:date2}, "days")',
  },
];

export type ExpressionContextRoot = 'event' | 'input' | 'output' | 'actor';

/**
 * Raízes de contexto do Workflow. Só existem quando a expressão é avaliada pelo `ExpressionEngine`;
 * as expressões de campo e de Action rodam no `fieldExpression`, cujo escopo é plano (as variáveis
 * ficam na raiz). Sugeri-las ali levaria a `input.isNew`, que parseia mas resolve para indefinido.
 */
const contextVariables = (t: TranslateFn): Record<ExpressionContextRoot, AutocompleteItem> => ({
  event: {
    value: 'event.',
    label: 'event',
    description: t('expression.context.event'),
    category: t('expression.category.context'),
  },
  input: {
    value: 'input.',
    label: 'input',
    description: t('expression.context.input'),
    category: t('expression.category.context'),
  },
  output: {
    value: 'output.',
    label: 'output',
    description: t('expression.context.output'),
    category: t('expression.category.context'),
  },
  actor: {
    value: 'actor.',
    label: 'actor',
    description: t('expression.context.actor'),
    category: t('expression.category.context'),
  },
});

export const buildAutocompleteItems = (
  t: TranslateFn,
  mode: 'function' | 'field' | 'input' | 'output',
  query: string,
  functions: FunctionDefinition[],
  eventFields: EventField[],
  stepOutputFields: StepOutputField[],
  workflowVariables: WorkflowVariable[],
  includeSnippets = true,
  contextRoots: ExpressionContextRoot[] = [],
): AutocompleteItem[] => {
  const q = query.toLowerCase();
  const items: AutocompleteItem[] = [];

  // Consulta com ponto é navegação de campo (`produto.`): nome de função nunca tem ponto, então
  // oferecer funções/atalhos aqui só produziria ruído — vindo de casar com a descrição.
  const isMemberQuery = q.includes('.');

  if (mode === 'function') {
    // Funções e operadores (operadores vêm junto em 'functions')
    const matchingFunctions = isMemberQuery
      ? []
      : functions.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q),
        );
    
    // Regex de validação compilada uma vez (não dentro do map!)
    const validIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    
    items.push(
      ...matchingFunctions
        .map((f): AutocompleteItem | null => {
          // Fallback seguro: se por algum motivo a função não tem 'name', pula
          if (!f || typeof f.name !== 'string') return null;
          
          // Test() é mais eficiente que match() quando só precisamos de booleano
          const hasParens = validIdentifierRegex.test(f.name);
          
          return {
            value: f.name,
            label: `${f.name}${hasParens ? '()' : ''}`,
            description: f.description,
            category: f.category,
            detail: f.signature,
          };
        })
        .filter((item): item is AutocompleteItem => item !== null),
    );

    // Variáveis do workflow
    const matchingVariables = workflowVariables.filter((v) => v.name.toLowerCase().includes(q));
    items.push(
      ...matchingVariables.map((v) => ({
        value: v.name,
        label: v.name,
        description: t('expression.variable.defined-by', { by: v.definedBy }),
        category: t('expression.category.variable'),
      })),
    );

    // Contextos (event, input, output) — só os que existem no escopo desta expressão
    const roots = contextVariables(t);
    const matchingContexts = contextRoots
      .map((root) => roots[root])
      .filter((c) => !q || c.value.toLowerCase().includes(q) || c.label.toLowerCase().includes(q));
    items.push(...matchingContexts);

    if (includeSnippets && !isMemberQuery) {
      const matchingSnippets = commonSnippets(t).filter(
        (s) => s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q),
      );
      items.push(...matchingSnippets);
    }
  } else if (mode === 'field') {
    const matchingFields = eventFields.filter((f) => f.path.toLowerCase().includes(q));
    items.push(
      ...matchingFields.map((f) => ({
        value: f.path,
        label: f.path,
        description: f.label,
        category: t('expression.category.field'),
      })),
    );
  } else if (mode === 'input') {
    // Outputs estáticos dos steps anteriores
    const matchingOutputs = stepOutputFields.filter((f) => f.outputId.toLowerCase().includes(q));
    items.push(
      ...matchingOutputs.map((f) => ({
        value: f.outputId,
        label: f.outputId,
        description: `${f.stepName} → ${f.outputLabel}`,
        category: t('expression.category.output'),
      })),
    );

    // Variáveis dinâmicas (ex: SetVariable)
    const matchingVariables = workflowVariables.filter((v) => v.name.toLowerCase().includes(q));
    items.push(
      ...matchingVariables.map((v) => ({
        value: v.name,
        label: v.name,
        description: t('expression.variable.short', { by: v.definedBy }),
        category: t('expression.category.variable'),
      })),
    );
  } else if (mode === 'output') {
    // A consulta é tudo o que veio depois de `output.`: sem ponto, o usuário ainda escolhe o STEP;
    // com ponto, o prefixo já fixou o step e o que resta filtra as saídas dele.
    const referenceable = stepOutputFields.filter((field) => isReferenceableStepId(field.stepId));
    const separator = query.indexOf('.');

    if (separator >= 0) {
      const stepId = query.slice(0, separator);
      const outputQuery = query.slice(separator + 1).toLowerCase();
      items.push(
        ...referenceable
          .filter((field) => field.stepId === stepId && field.outputId.toLowerCase().includes(outputQuery))
          .map((field) => ({
            value: `${field.stepId}.${field.outputId}`,
            label: field.outputId,
            description: `${field.stepName} → ${field.outputLabel}`,
            category: t('expression.category.output'),
          })),
      );
    } else {
      const offered = new Set<string>();
      referenceable.forEach((field) => {
        if (offered.has(field.stepId) || !field.stepId.toLowerCase().includes(q)) return;
        offered.add(field.stepId);
        items.push({
          value: `${field.stepId}.`,
          label: field.stepId,
          // Desde que o Step passou a se chamar pelo próprio identificador, nome e id coincidem na
          // maioria dos casos — repetir o mesmo texto na descrição só ocuparia a linha de baixo.
          ...(field.stepName === field.stepId ? {} : { description: field.stepName }),
          category: t('expression.category.step'),
        });
      });
    }
  }

  return items.sort((a, b) => {
    const aStarts = a.value.toLowerCase().startsWith(q);
    const bStarts = b.value.toLowerCase().startsWith(q);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    
    const aExact = a.value.toLowerCase() === q;
    const bExact = b.value.toLowerCase() === q;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    
    return a.value.localeCompare(b.value);
  });
};

export const insertSnippet = (snippet: string, cursorPos: number): { text: string; newCursor: number } => {
  const placeholderPattern = /\$\{(\d+):([^}]*)\}/g;
  let result = snippet;
  let firstPlaceholderPos = -1;
  let firstPlaceholderLength = 0;

  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  let match: RegExpExecArray | null = placeholderPattern.exec(snippet);

  while (match !== null) {
    const placeholder = match[2];
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      replacement: placeholder,
    });

    if (firstPlaceholderPos === -1) {
      firstPlaceholderPos = match.index;
      firstPlaceholderLength = placeholder.length;
    }

    match = placeholderPattern.exec(snippet);
  }

  replacements.reverse().forEach((r) => {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  });

  const newCursor = cursorPos + (firstPlaceholderPos >= 0 ? firstPlaceholderPos + firstPlaceholderLength : result.length);

  return { text: result, newCursor };
};
