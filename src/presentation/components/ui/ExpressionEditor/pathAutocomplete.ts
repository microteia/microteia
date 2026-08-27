import type { PathRoot, SchemaContext } from '../../../../domain/schema/pathResolver';
import { parsePath, resolvePath, stripEventPrefix, suggestNextSegments } from '../../../../domain/schema/pathResolver';
import { extractExpressionPaths } from '../../../../domain/schema/expressionPaths';
import type { AutocompleteItem } from './autocompleteHelpers';

export interface ActiveEventPath {
  completedPath: string;
  query: string;
  queryStart: number;
}

const buildActivePathExtractor =
  (prefix: string) =>
  (textBefore: string): ActiveEventPath | null => {
    const match = textBefore.match(
      new RegExp(`(?:^|[^a-zA-Z0-9_.])${prefix}\\.((?:[a-zA-Z0-9_]+\\.)*)([a-zA-Z0-9_]*)$`),
    );
    if (!match) return null;
    return {
      completedPath: match[1].endsWith('.') ? match[1].slice(0, -1) : match[1],
      query: match[2],
      queryStart: textBefore.length - match[2].length,
    };
  };

export const extractActiveEventPath = buildActivePathExtractor('event');
export const extractActiveInputPath = buildActivePathExtractor('input');

/**
 * O resolvedor entra por PARÂMETRO, e é obrigatório. Duas coisas que a tela mostra passam por ele:
 *
 * - o `label` da sugestão, que é o nome do CAMPO. Vale para o campo de uma extensão e também para o
 *   do kernel: `changeType` declara `@core.automation/event-field.change-type`, e era essa a chave
 *   que aparecia na descrição da sugestão;
 * - o `detail`, que é o nome da ENTIDADE apontada — a de uma extensão declara `@ns/screen.singular`,
 *   e o autocomplete mostrava a chave ao lado do campo;
 * - a `category` do grupo, que era o único literal entre os sete grupos do editor. Os outros seis
 *   já saíam de `t('expression.category.*')`; este dizia "Campo", em português, no código.
 *
 * Obrigatório e sem valor padrão de propósito: um padrão que devolve o texto como está transforma
 * "esqueci de passar o resolvedor" em "a chave aparece na tela", que é o defeito silencioso que este
 * módulo já teve.
 */
export const buildPathAutocompleteItems = (
  ctx: SchemaContext,
  root: PathRoot,
  active: ActiveEventPath,
  label: (value: string | null | undefined) => string,
): AutocompleteItem[] => {
  const suggestions = suggestNextSegments(ctx, root, parsePath(active.completedPath));
  const query = active.query.toLowerCase();
  return suggestions
    .filter(
      (suggestion) =>
        !query ||
        suggestion.insertText.toLowerCase().includes(query) ||
        suggestion.label.toLowerCase().includes(query),
    )
    .sort((a, b) => {
      const aStarts = a.insertText.toLowerCase().startsWith(query);
      const bStarts = b.insertText.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.insertText.localeCompare(b.insertText);
    })
    .map((suggestion) => ({
      value: suggestion.isLeaf ? suggestion.insertText : `${suggestion.insertText}.`,
      label: suggestion.isLeaf ? suggestion.insertText : `${suggestion.insertText}…`,
      description: suggestion.detail
        ? `${label(suggestion.label)} — ${label(suggestion.detail)}`
        : label(suggestion.label),
      category: label('@core.ui/expression.category.field'),
    }));
};

export interface EventPathIssue {
  path: string;
  error: string;
}

export const findInvalidEventPath = (
  ctx: SchemaContext,
  root: PathRoot,
  expression: string,
): EventPathIssue | null => {
  for (const path of extractExpressionPaths(expression)) {
    const segments = stripEventPrefix(path);
    if (!segments) continue;
    const resolution = resolvePath(ctx, root, segments);
    if (!resolution.valid && resolution.error) {
      return { path, error: resolution.error };
    }
  }
  return null;
};
