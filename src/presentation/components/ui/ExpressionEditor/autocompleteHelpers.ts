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
}

const COMMON_SNIPPETS: AutocompleteItem[] = [
  {
    value: 'if(condition, trueValue, falseValue)',
    label: 'if - condicional',
    description: 'Retorna um valor baseado em uma condição',
    category: 'Snippet',
    snippet: 'if(${1:condition}, ${2:trueValue}, ${3:falseValue})',
  },
  {
    value: 'formatDate(date, "DD/MM/YYYY")',
    label: 'formatDate - data brasileira',
    description: 'Formata data no padrão brasileiro',
    category: 'Snippet',
    snippet: 'formatDate(${1:date}, "DD/MM/YYYY")',
  },
  {
    value: 'coalesce(value, "padrão")',
    label: 'coalesce - valor padrão',
    description: 'Usa valor padrão se for nulo',
    category: 'Snippet',
    snippet: 'coalesce(${1:value}, "${2:padrão}")',
  },
  {
    value: 'concat(text1, " ", text2)',
    label: 'concat - juntar textos',
    description: 'Concatena múltiplos textos',
    category: 'Snippet',
    snippet: 'concat(${1:text1}, " ", ${2:text2})',
  },
  {
    value: 'dateDiff(date1, date2, "days")',
    label: 'dateDiff - diferença em dias',
    description: 'Calcula diferença entre datas',
    category: 'Snippet',
    snippet: 'dateDiff(${1:date1}, ${2:date2}, "days")',
  },
];

const CONTEXT_VARIABLES: AutocompleteItem[] = [
  {
    value: 'event.',
    label: 'event',
    description: 'Dados do evento que disparou o workflow',
    category: 'Contexto',
  },
  {
    value: 'input.',
    label: 'input',
    description: 'Dados de entrada configurados para este step',
    category: 'Contexto',
  },
  {
    value: 'output.',
    label: 'output',
    description: 'Saídas de steps anteriores do workflow',
    category: 'Contexto',
  },
];

export const buildAutocompleteItems = (
  mode: 'function' | 'field' | 'context',
  query: string,
  functions: FunctionDefinition[],
  eventFields: EventField[],
  includeSnippets = true,
): AutocompleteItem[] => {
  const q = query.toLowerCase();
  const items: AutocompleteItem[] = [];

  if (mode === 'function') {
    // Funções e operadores (operadores vêm junto em 'functions')
    const matchingFunctions = functions.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q),
    );
    items.push(
      ...matchingFunctions.map((f) => ({
        value: f.name,
        label: `${f.name}${f.name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/) ? '()' : ''}`,
        description: f.description,
        category: f.category,
        detail: f.signature,
      })),
    );

    if (includeSnippets) {
      const matchingSnippets = COMMON_SNIPPETS.filter(
        (s) => s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q),
      );
      items.push(...matchingSnippets);
    }

    if (q.length <= 2) {
      items.push(...CONTEXT_VARIABLES.filter((c) => c.value.toLowerCase().startsWith(q)));
    }
  } else if (mode === 'field') {
    const matchingFields = eventFields.filter((f) => f.path.toLowerCase().includes(q));
    items.push(
      ...matchingFields.map((f) => ({
        value: f.path,
        label: f.path,
        description: f.label,
        category: 'Campo',
      })),
    );
  } else if (mode === 'context') {
    items.push(...CONTEXT_VARIABLES.filter((c) => c.value.toLowerCase().includes(q)));
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

export const insertSnippet = (text: string, snippet: string, cursorPos: number): { text: string; newCursor: number } => {
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
