import { Docxtemplater, PizZip } from './documentLibraries';
import { loopItemScope, templateValueText } from '../../../domain/schema/document/templateGrammar';
import type { RenderIssue, TemplateEvaluator } from '../../../domain/schema/document/templateGrammar';
import { DocumentRenderError } from '../../../domain/repositories/IDocumentRenderer';

/**
 * Ensina ao docxtemplater os dois blocos da gramática. Para ele, laço e condição são a mesma coisa
 * (`{#x}…{/x}`, repetido se `x` for lista, incluído se for verdadeiro); o que muda aqui é só como se
 * ESCREVE a abertura e o fechamento, para que `{{#each}}`/`{{/each}}` valham no Word como no Markdown.
 *
 * Uma instância POR documento: o docxtemplater marca o módulo como anexado e recusa reaproveitá-lo.
 */
const grammarModule = (): Docxtemplater.DXT.Module => ({
  name: 'microteia-template-grammar',
  matchers: () => [
    ['#each ', 'loop', { expandTo: 'auto', location: 'start', inverted: false, block: 'each' }],
    ['#if ', 'loop', { expandTo: 'auto', location: 'start', inverted: false, block: 'if' }],
    ['/each', 'loop', { location: 'end' }],
    ['/if', 'loop', { location: 'end' }],
  ],
});

/**
 * O escopo de quem está dentro de laços, na mesma forma do Markdown (`loopItemScope`).
 *
 * O docxtemplater empilha um nível por bloco aberto. A condição empilha a MESMA referência do nível
 * de fora; o laço empilha o ITEM, que é outra. É essa diferença que separa os dois, e sem ela um
 * `{{#if}}` dentro de um `{{#each}}` sobrescreveria `item` e `index` com o próprio escopo.
 */
const mergedScope = (scopeList: unknown[], positions: number[]): Record<string, unknown> => {
  let merged = (scopeList[0] ?? {}) as Record<string, unknown>;
  for (let level = 1; level < scopeList.length; level += 1) {
    if (scopeList[level] === scopeList[level - 1]) continue;
    merged = loopItemScope(merged, scopeList[level], (positions[level - 1] ?? 0) + 1);
  }
  return merged;
};

interface TemplatePart {
  block?: 'each' | 'if';
}

const explain = (cause: unknown): string => {
  const errors = (cause as { properties?: { errors?: { properties?: { explanation?: string } }[] } })?.properties?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((one) => one.properties?.explanation ?? '').filter(Boolean).join('; ');
  }
  return cause instanceof Error ? cause.message : String(cause);
};

/**
 * O texto do documento com as marcas remontadas, em todas as partes que o docxtemplater percorre —
 * corpo, cabeçalho, rodapé. O Word parte `{{cliente.nome}}` em vários trechos de XML quando alguém
 * formata no meio da marca; ler o XML cru perderia esses caminhos, e o documento sairia com o vínculo
 * sem navegar.
 */
const TEXT_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;

export const docxTemplateText = (content: Buffer): string => {
  try {
    const template = new Docxtemplater(new PizZip(content), {
      paragraphLoop: true,
      delimiters: { start: '{{', end: '}}' },
      modules: [grammarModule()],
    });
    const parts = [...new Set(template.targets)].filter((target) => TEXT_PARTS.test(target));
    return parts.map((target) => template.getFullText(target)).join('\n');
  } catch (cause) {
    throw new DocumentRenderError('@core.documents/render.docx-template', { detail: explain(cause) });
  }
};

export const renderDocxTemplate = (
  content: Buffer,
  scope: Record<string, unknown>,
  evaluate: TemplateEvaluator,
): { data: Buffer; issues: RenderIssue[] } => {
  const issues: RenderIssue[] = [];

  const safely = (expr: string, current: Record<string, unknown>): unknown => {
    try {
      return evaluate(expr, current);
    } catch (cause) {
      issues.push({ expression: expr, detail: cause instanceof Error ? cause.message : String(cause) });
      return null;
    }
  };

  let template: Docxtemplater;
  try {
    template = new Docxtemplater(new PizZip(content), {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      modules: [grammarModule()],
      parser: (tag: string) => ({
        get: (_scope: unknown, context) => {
          const current = mergedScope(context.scopeList, context.scopePathItem);
          const block = (context.meta?.part as TemplatePart | undefined)?.block;
          const value = safely(tag.trim(), current);
          if (block === 'each') return Array.isArray(value) ? value : [];
          if (block === 'if') return Boolean(value);
          return templateValueText(value);
        },
      }),
    });
  } catch (cause) {
    throw new DocumentRenderError('@core.documents/render.docx-template', { detail: explain(cause) });
  }

  try {
    template.render(scope);
  } catch (cause) {
    throw new DocumentRenderError('@core.documents/render.docx-template', { detail: explain(cause) });
  }

  return { data: template.toBuffer({ compression: 'DEFLATE' }) as Buffer, issues };
};
