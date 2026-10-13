import { describe, it, expect } from 'vitest';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { evaluateFieldExpression } from '../../../domain/schema/fieldExpression';
import type { DocumentTemplateSpec } from '../../../domain/schema/document/documentTemplate';
import { DocumentRenderError } from '../../../domain/repositories/IDocumentRenderer';
import { TemplateDocumentRenderer } from './TemplateDocumentRenderer';
import { PizZip } from './documentLibraries';
import { markdownToBlocks } from './markdownBlocks';

const evaluate = (expr: string, scope: Record<string, unknown>): unknown =>
  evaluateFieldExpression(expr, { value: null, data: scope });

const renderer = new TemplateDocumentRenderer();

const markdown = (body: string): DocumentTemplateSpec => ({
  key: 'receipt',
  title: 'Recibo',
  collection: 'payments',
  format: 'markdown',
  body,
});

const docxWith = async (...lines: string[]): Promise<string> => {
  const document = new Document({
    sections: [{ children: lines.map((line) => new Paragraph({ children: [new TextRun(line)] })) }],
  });
  return (await Packer.toBuffer(document)).toString('base64');
};

const documentText = (data: Buffer): string =>
  (new PizZip(data).file('word/document.xml')?.asText() ?? '').replace(/<[^>]+>/g, '');

describe('markdownToBlocks', () => {
  it('lê título, parágrafo com ênfase, lista numerada, tabela e a quebra de página', () => {
    const blocks = markdownToBlocks('# Título\n\nTexto **forte**.\n\n1. um\n2. dois\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n<!-- pagebreak -->\n');

    expect(blocks.map((block) => block.kind)).toEqual(['heading', 'paragraph', 'list', 'table', 'pageBreak']);
    expect(blocks[1]).toEqual({ kind: 'paragraph', spans: [{ text: 'Texto ' }, { text: 'forte', bold: true }, { text: '.' }] });
  });
});

describe('TemplateDocumentRenderer', () => {
  it('Markdown vira PDF, com o valor mesclado', async () => {
    const result = await renderer.render({
      template: markdown('# Recibo\n\nRecebi de {{payer}} a quantia de {{formatMoney(amount, "pt-br")}}.'),
      output: 'pdf',
      scope: { payer: 'Ana', amount: 10 },
      evaluate,
    });

    expect(result.contentType).toBe('application/pdf');
    expect(result.data.subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.issues).toEqual([]);
  });

  it('Markdown vira DOCX, e o valor entra como texto e não como marcação', async () => {
    const result = await renderer.render({
      template: markdown('Cliente: {{payer}}'),
      output: 'docx',
      scope: { payer: 'A*n*a' },
      evaluate,
    });

    expect(result.extension).toBe('docx');
    expect(documentText(result.data)).toContain('Cliente: A*n*a');
  });

  it('o modelo DOCX repete o laço e respeita a condição, com item e posição', async () => {
    const content = await docxWith(
      'Contrato de {{client.name}}',
      '{{#each installments}}',
      '{{index}}. {{formatMoney(amount, "pt-br")}}{{#if paid}} (pago){{/if}}',
      '{{/each}}',
    );

    const result = await renderer.render({
      template: { ...markdown(''), format: 'docx', body: undefined, content },
      output: 'docx',
      scope: { client: { name: 'Ana' }, installments: [{ amount: 10, paid: true }, { amount: 20, paid: false }] },
      evaluate,
    });
    const text = documentText(result.data);

    expect(text).toContain('Contrato de Ana');
    expect(text).toContain('1. R$');
    expect(text).toContain('(pago)');
    expect(text.match(/\(pago\)/g)).toHaveLength(1);
    expect(text).toContain('2. R$');
  });

  it('remonta as marcas do DOCX para que os caminhos sejam hidratados', async () => {
    const content = await docxWith('{{caseId.clientId.name}}');

    expect(renderer.templateText({ ...markdown(''), format: 'docx', content })).toContain('{{caseId.clientId.name}}');
  });

  it('recusa DOCX → PDF em vez de entregar outro formato', async () => {
    const content = await docxWith('x');

    await expect(renderer.render({
      template: { ...markdown(''), format: 'docx', content },
      output: 'pdf',
      scope: {},
      evaluate,
    })).rejects.toBeInstanceOf(DocumentRenderError);
  });

  it('diz que o modelo DOCX está quebrado, e não que o documento saiu vazio', async () => {
    const content = await docxWith('{{#each items}}');

    await expect(renderer.render({
      template: { ...markdown(''), format: 'docx', content },
      output: 'docx',
      scope: {},
      evaluate,
    })).rejects.toMatchObject({ reference: '@core.documents/render.docx-template' });
  });
});
