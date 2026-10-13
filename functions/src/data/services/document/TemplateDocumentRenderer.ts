import { escapeMarkdownValue, parseTemplate, renderTemplate } from '../../../domain/schema/document/templateGrammar';
import type {
  DocumentRenderInput,
  IDocumentRenderer,
  RenderedDocument,
} from '../../../domain/repositories/IDocumentRenderer';
import { DocumentRenderError } from '../../../domain/repositories/IDocumentRenderer';
import { markdownToBlocks } from './markdownBlocks';
import { blocksToPdf } from './blocksToPdf';
import { blocksToDocx } from './blocksToDocx';
import { docxTemplateText, renderDocxTemplate } from './renderDocxTemplate';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Markdown → PDF ou DOCX, pelo modelo neutro de blocos; DOCX → DOCX, pelo docxtemplater. Nos dois a
 * gramática é a mesma, e no Markdown o valor mesclado é escapado: o dado entra como TEXTO, nunca como
 * marcação.
 */
export class TemplateDocumentRenderer implements IDocumentRenderer {
  templateText(template: DocumentRenderInput['template']): string {
    return template.format === 'docx'
      ? docxTemplateText(Buffer.from(template.content ?? '', 'base64'))
      : template.body ?? '';
  }

  async render(input: DocumentRenderInput): Promise<RenderedDocument> {
    const { template, output } = input;

    if (template.format === 'docx') {
      if (output !== 'docx') {
        throw new DocumentRenderError('@core.documents/render.output-unsupported', { format: template.format, output });
      }
      const rendered = renderDocxTemplate(Buffer.from(template.content ?? '', 'base64'), input.scope, input.evaluate);
      return { data: rendered.data, contentType: DOCX, extension: 'docx', issues: rendered.issues };
    }

    const merged = renderTemplate(parseTemplate(template.body ?? '').nodes, input.scope, {
      evaluate: input.evaluate,
      write: escapeMarkdownValue,
    });
    const blocks = markdownToBlocks(merged.text);

    return output === 'pdf'
      ? { data: await blocksToPdf(blocks, template.title), contentType: PDF, extension: 'pdf', issues: merged.issues }
      : { data: await blocksToDocx(blocks, template.title), contentType: DOCX, extension: 'docx', issues: merged.issues };
  }
}
