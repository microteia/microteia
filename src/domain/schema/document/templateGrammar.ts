// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/document/templateGrammar.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { extractFieldExpressionPaths, fieldExpressionSyntaxError } from '../fieldExpression';

/**
 * A gramática dos campos de mesclagem de um modelo de documento.
 *
 * Não é uma linguagem nova: o que vai entre `{{ }}` é uma EXPRESSÃO de campo — a mesma de
 * `compute`/`validate`, com os mesmos caminhos (`caseId.clientId.name`) e as mesmas funções
 * (`formatDate`, `formatMoney`). O que a gramática acrescenta são só os dois blocos que uma expressão
 * não tem como dizer: repetir (`{{#each lista}}…{{/each}}`) e incluir sob condição
 * (`{{#if expressão}}…{{/if}}`).
 *
 * É a mesma nos dois formatos. No Markdown quem a percorre é `renderTemplate`; no DOCX é o
 * docxtemplater, ensinado a reconhecer os mesmos dois blocos — e por isso não há `else`: o que um
 * formato não consegue dizer, o outro não oferece.
 */

export type TemplateNode =
  | { kind: 'text'; text: string }
  | { kind: 'expr'; expr: string }
  | { kind: 'each'; expr: string; children: TemplateNode[] }
  | { kind: 'if'; expr: string; children: TemplateNode[] };

export type TemplateBlockKind = 'each' | 'if';

export interface TemplateIssue {
  /** REFERÊNCIA de mensagem: a validação roda também no backend, que não conhece idioma. */
  error: string;
  errorParams?: Record<string, string>;
}

export interface ParsedTemplate {
  nodes: TemplateNode[];
  issues: TemplateIssue[];
}

/**
 * Os nomes que o laço acrescenta ao escopo de cada item. `item` é o elemento inteiro — o único jeito
 * de ler uma lista de textos — e `index` é a posição a partir de 1, porque quem lê o documento conta
 * a partir de 1. Vencem um campo de mesmo nome, como `isNew` vence nas expressões de ação.
 */
export const TEMPLATE_LOOP_VARIABLES = ['item', 'index'] as const;

const TAG = /\{\{\s*([\s\S]*?)\s*\}\}/g;
const OPEN_BLOCK = /^#(each|if)\s+([\s\S]+)$/;
const CLOSE_BLOCK = /^\/(each|if)$/;

interface Frame {
  kind: TemplateBlockKind | 'root';
  expr: string;
  children: TemplateNode[];
}

/** As recusas da GRAMÁTICA — o texto tem problema, mas o modelo tem forma. Ver `isGrammarIssue`. */
export const GRAMMAR_ISSUES: ReadonlySet<string> = new Set([
  '@core.documents/grammar.expression',
  '@core.documents/grammar.empty-tag',
  '@core.documents/grammar.unexpected-close',
  '@core.documents/grammar.mismatched-close',
  '@core.documents/grammar.unknown-block',
  '@core.documents/grammar.unclosed',
]);

const issue = (error: string, errorParams?: Record<string, string>): TemplateIssue =>
  errorParams ? { error, errorParams } : { error };

const checkExpression = (expr: string, issues: TemplateIssue[]): void => {
  const syntax = fieldExpressionSyntaxError(expr);
  if (syntax) issues.push(issue('@core.documents/grammar.expression', { expression: expr, detail: syntax }));
};

/**
 * Lê o texto do modelo como árvore. NUNCA lança: o que não se fecha, o que fecha o bloco errado e a
 * expressão que não parseia viram `issues`, e a árvore devolvida é a melhor leitura possível — a tela
 * de autoria mostra o problema enquanto a pessoa digita, em vez de recusar o texto inteiro.
 */
export const parseTemplate = (text: string): ParsedTemplate => {
  const issues: TemplateIssue[] = [];
  const stack: Frame[] = [{ kind: 'root', expr: '', children: [] }];
  const top = (): Frame => stack[stack.length - 1];
  let cursor = 0;

  for (const match of text.matchAll(TAG)) {
    const start = match.index ?? 0;
    if (start > cursor) top().children.push({ kind: 'text', text: text.slice(cursor, start) });
    cursor = start + match[0].length;

    const content = match[1].trim();
    if (!content) {
      issues.push(issue('@core.documents/grammar.empty-tag'));
      continue;
    }

    const open = OPEN_BLOCK.exec(content);
    if (open) {
      const expr = open[2].trim();
      checkExpression(expr, issues);
      stack.push({ kind: open[1] as TemplateBlockKind, expr, children: [] });
      continue;
    }

    const close = CLOSE_BLOCK.exec(content);
    if (close) {
      const frame = top();
      if (frame.kind === 'root') {
        issues.push(issue('@core.documents/grammar.unexpected-close', { block: close[1] }));
        continue;
      }
      if (frame.kind !== close[1]) {
        issues.push(issue('@core.documents/grammar.mismatched-close', { expected: frame.kind, found: close[1] }));
      }
      stack.pop();
      top().children.push({ kind: frame.kind, expr: frame.expr, children: frame.children } as TemplateNode);
      continue;
    }

    if (content.startsWith('#') || content.startsWith('/')) {
      issues.push(issue('@core.documents/grammar.unknown-block', { tag: content }));
      continue;
    }

    checkExpression(content, issues);
    top().children.push({ kind: 'expr', expr: content });
  }

  if (cursor < text.length) top().children.push({ kind: 'text', text: text.slice(cursor) });

  while (stack.length > 1) {
    const frame = stack.pop() as Frame;
    issues.push(issue('@core.documents/grammar.unclosed', { block: frame.kind }));
    top().children.push({ kind: frame.kind, expr: frame.expr, children: frame.children } as TemplateNode);
  }

  return { nodes: stack[0].children, issues };
};

/**
 * Os CAMINHOS que o modelo lê, separados por onde são lidos.
 *
 * `root` é o que se lê fora de qualquer laço, sobre o registro. `loops` guarda, por expressão de
 * laço, o que se lê DENTRO dele. Um nome dentro do laço pode ser do item ou do registro — a gramática
 * não tem como saber sem o esquema —, e por isso quem hidrata pede os caminhos do laço aos dois lados:
 * o que não resolve num deles é descartado pelo plano de hidratação, que já é tolerante a isso.
 */
export interface TemplatePaths {
  root: string[];
  loops: Map<string, string[]>;
}

const without = (paths: string[], reserved: readonly string[]): string[] =>
  paths.filter((path) => !reserved.includes(path.split('.')[0]));

export const collectTemplatePaths = (nodes: TemplateNode[]): TemplatePaths => {
  const root = new Set<string>();
  const loops = new Map<string, Set<string>>();

  const walk = (list: TemplateNode[], loopStack: string[]): void => {
    for (const node of list) {
      if (node.kind === 'text') continue;
      const paths = without(extractFieldExpressionPaths(node.expr), TEMPLATE_LOOP_VARIABLES);
      const target = loopStack.length === 0 ? root : (loops.get(loopStack[loopStack.length - 1]) as Set<string>);
      paths.forEach((path) => target.add(path));
      if (loopStack.length > 0) paths.forEach((path) => root.add(path));
      if (node.kind === 'each') {
        if (!loops.has(node.expr)) loops.set(node.expr, new Set());
        walk(node.children, [...loopStack, node.expr]);
      } else if (node.kind === 'if') {
        walk(node.children, loopStack);
      }
    }
  };
  walk(nodes, []);

  return {
    root: [...root],
    loops: new Map([...loops].map(([expr, paths]) => [expr, [...paths]])),
  };
};

/** O que a renderização precisa saber avaliar — injetado, para que a gramática não escolha motor. */
export type TemplateEvaluator = (expr: string, scope: Record<string, unknown>) => unknown;

export interface RenderIssue {
  expression: string;
  detail: string;
}

export interface RenderTemplateOptions {
  evaluate: TemplateEvaluator;
  /** Como o VALOR vira texto no formato de destino — o Markdown escapa o que o dado traz. */
  write?: (text: string) => string;
}

export interface RenderedTemplate {
  text: string;
  issues: RenderIssue[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

/**
 * O valor como TEXTO de documento. Objeto vira vazio, e não JSON: `{{clientId}}` de um vínculo
 * navegado é o registro inteiro, e um documento com `{"id":"…"}` no meio é pior que um espaço em
 * branco — quem escreveu quer `{{clientId.name}}`, e o vazio é o que aparece na pré-visualização.
 */
export const templateValueText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(templateValueText).filter((text) => text !== '').join(', ');
  if (isPlainObject(value)) return '';
  return String(value);
};

/**
 * O escopo do item de um laço: o registro de fora continua legível, o item vence o nome repetido, e
 * os dois reservados vencem os dois.
 */
export const loopItemScope = (
  parent: Record<string, unknown>,
  item: unknown,
  position: number,
): Record<string, unknown> => ({
  ...parent,
  ...(isPlainObject(item) ? item : {}),
  item,
  index: position,
});

/**
 * Percorre a árvore e devolve o texto final. É TOLERANTE, e diz o que tolerou: uma expressão que
 * estoura vira vazio no documento e um `RenderIssue` no resultado — quem gera um contrato não pode
 * perder o documento inteiro por um campo, mas também não pode receber um documento com lacuna sem
 * saber onde ela está.
 */
export const renderTemplate = (
  nodes: TemplateNode[],
  scope: Record<string, unknown>,
  options: RenderTemplateOptions,
): RenderedTemplate => {
  const issues: RenderIssue[] = [];
  const write = options.write ?? ((text: string) => text);

  const evaluate = (expr: string, current: Record<string, unknown>): unknown => {
    try {
      return options.evaluate(expr, current);
    } catch (cause) {
      issues.push({ expression: expr, detail: cause instanceof Error ? cause.message : String(cause) });
      return null;
    }
  };

  const walk = (list: TemplateNode[], current: Record<string, unknown>): string =>
    list
      .map((node) => {
        switch (node.kind) {
          case 'text':
            return node.text;
          case 'expr':
            return write(templateValueText(evaluate(node.expr, current)));
          case 'if':
            return evaluate(node.expr, current) ? walk(node.children, current) : '';
          case 'each': {
            const items = evaluate(node.expr, current);
            if (!Array.isArray(items)) return '';
            return items.map((item, index) => walk(node.children, loopItemScope(current, item, index + 1))).join('');
          }
          default:
            return '';
        }
      })
      .join('');

  return { text: walk(nodes, scope), issues };
};

/** O que o texto de um VALOR precisa escapar para não virar marcação no Markdown. */
const MARKDOWN_SPECIAL = /([\\`*_{}[\]()#+!|<>~])/g;

/**
 * O dado entra no Markdown como TEXTO, nunca como marcação: um nome com `*` não pode abrir um
 * negrito, e um endereço de várias linhas tem de continuar em várias linhas (quebra forçada).
 */
export const escapeMarkdownValue = (text: string): string =>
  text.replace(MARKDOWN_SPECIAL, '\\$1').replace(/\r?\n/g, '  \n');
