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

/**
 * Issue #47: o arquivo de LEIAUTE FIXO — cabeçalho, uma linha por filho, rodapé — que integrações pedem.
 * A gramática é a mesma; o valor sai como está, na codificação e na quebra de linha declaradas.
 */
describe('modelo de texto de leiaute fixo (#47)', () => {
  const text = (body: string, extra: Partial<DocumentTemplateSpec> = {}): DocumentTemplateSpec => ({
    key: 'monthly-file',
    title: 'Arquivo mensal',
    collection: 'companies',
    format: 'text',
    body,
    ...extra,
  });
  const scope = {
    taxId: '12.ABC.345/01DE-35',
    invoices: [{ number: 42, customer: 'Ação & Cia *Ltda*' }, { number: 7, customer: 'B' }],
  };
  const body = '|0000|{{taxId}}|\n{{#each invoices}}|C100|{{padLeft(number, 5, "0")}}|{{padRight(customer, 8)}}|\n{{/each}}|9999|{{length(invoices) + 2}}|';

  it('mescla cabeçalho, uma linha por item e rodapé, sem escapar nada', async () => {
    const result = await renderer.render({ template: text(body), output: 'txt', scope, evaluate });
    expect(result.contentType).toBe('text/plain; charset=utf-8');
    expect(result.extension).toBe('txt');
    expect(result.data.toString('utf8')).toBe(
      '|0000|12.ABC.345/01DE-35|\n|C100|00042|Ação & C|\n|C100|00007|B       |\n|9999|4|',
    );
    expect(result.issues).toEqual([]);
  });

  it('CRLF e Latin-1 são honrados; o caractere que o Latin-1 não tem sai como "?"', async () => {
    const result = await renderer.render({
      template: text('A{{name}}\nB', { encoding: 'latin1', lineEnding: 'crlf' }),
      output: 'txt',
      scope: { name: 'ção€' },
      evaluate,
    });
    expect(result.contentType).toBe('text/plain; charset=iso-8859-1');
    expect([...result.data]).toEqual([0x41, 0xe7, 0xe3, 0x6f, 0x3f, 0x0d, 0x0a, 0x42]);
  });

  it('XML é a mesma mesclagem, com o tipo de arquivo do XML', async () => {
    const result = await renderer.render({
      template: text('<a>{{taxId}}</a>'),
      output: 'xml',
      scope,
      evaluate,
    });
    expect(result.contentType).toBe('application/xml; charset=utf-8');
    expect(result.extension).toBe('xml');
    expect(result.data.toString('utf8')).toBe('<a>12.ABC.345/01DE-35</a>');
  });

  it('o texto não produz PDF', async () => {
    await expect(renderer.render({ template: text('x'), output: 'pdf', scope: {}, evaluate }))
      .rejects.toBeInstanceOf(DocumentRenderError);
  });
});
