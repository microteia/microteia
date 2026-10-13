import { pdfmake } from './documentLibraries';
import type { Content } from 'pdfmake/interfaces';
import type { Block, CellAlign, Span } from './markdownBlocks';

/**
 * As fontes PADRÃO do PDF (as 14 que todo leitor tem), e nenhum arquivo de fonte no pacote. Cobrem o
 * Latin-1 — acentos, cedilha, aspas curvas, travessão, euro —, que é o que um documento de escritório
 * escreve. Um modelo em outro alfabeto pede outra fonte, e isso é uma capacidade a acrescentar quando
 * houver quem a peça, não um peso de vários megabytes em toda instalação.
 */
const FONTS = {
  Times: { normal: 'Times-Roman', bold: 'Times-Bold', italics: 'Times-Italic', bolditalics: 'Times-BoldItalic' },
  Courier: { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' },
};

const STANDARD_FONT_FILES = new Set(Object.values(FONTS).flatMap((family) => Object.values(family)));

let configured = false;

/**
 * O gerador não lê disco nem rede: nada que o modelo traga pode fazê-lo buscar um arquivo do servidor
 * ou falar com outro host. A única leitura permitida são as próprias fontes padrão, que o `pdfmake`
 * pede pelo nome. A política é posta uma vez por instância, antes do primeiro documento.
 */
const configure = (): void => {
  if (configured) return;
  pdfmake.setFonts(FONTS);
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((path) => STANDARD_FONT_FILES.has(path));
  configured = true;
};

const HEADING_SIZES = [18, 15, 13, 12, 11, 11];

const inline = (spans: Span[]): Content[] =>
  spans.map((span) => ({
    text: span.lineBreak ? `${span.text}\n` : span.text,
    ...(span.bold ? { bold: true } : {}),
    ...(span.italics ? { italics: true } : {}),
    ...(span.strike ? { decoration: 'lineThrough' as const } : {}),
    ...(span.code ? { font: 'Courier' } : {}),
    ...(span.link ? { link: span.link, decoration: 'underline' as const } : {}),
  }));

const alignmentOf = (align: CellAlign): 'left' | 'center' | 'right' => align ?? 'left';

const content = (blocks: Block[]): Content[] =>
  blocks.map((block): Content => {
    switch (block.kind) {
      case 'heading':
        return {
          text: inline(block.spans),
          bold: true,
          fontSize: HEADING_SIZES[block.level - 1] ?? 11,
          // O título do documento vai ao centro; as seções, à esquerda — o desenho de toda procuração
          // e todo contrato, e o que um `#` de Markdown não teria como dizer de outro jeito.
          alignment: block.level === 1 ? 'center' : 'left',
          margin: [0, block.level === 1 ? 0 : 10, 0, 8],
        };
      case 'paragraph':
        return { text: inline(block.spans), alignment: 'justify', margin: [0, 0, 0, 8] };
      case 'list': {
        const items = block.items.map((item) => ({ stack: content(item) }));
        return block.ordered
          ? { ol: items, start: block.start, margin: [0, 0, 0, 8] }
          : { ul: items, margin: [0, 0, 0, 8] };
      }
      case 'table':
        return {
          table: {
            headerRows: 1,
            widths: block.header.map(() => '*'),
            body: [
              block.header.map((cell, column) => ({ text: inline(cell), bold: true, alignment: alignmentOf(block.align[column]) })),
              ...block.rows.map((row) =>
                row.map((cell, column) => ({ text: inline(cell), alignment: alignmentOf(block.align[column]) })),
              ),
            ],
          },
          margin: [0, 0, 0, 8],
        };
      case 'quote':
        return { stack: content(block.blocks), italics: true, margin: [24, 0, 0, 8] };
      case 'code':
        return { text: block.text, font: 'Courier', fontSize: 9, margin: [0, 0, 0, 8], preserveLeadingSpaces: true };
      case 'rule':
        return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 451, y2: 0, lineWidth: 0.5 }], margin: [0, 4, 0, 12] };
      case 'pageBreak':
        return { text: '', pageBreak: 'after' };
      default:
        return { text: '' };
    }
  });

export const blocksToPdf = async (blocks: Block[], title: string): Promise<Buffer> => {
  configure();
  const pdf = pdfmake.createPdf({
    info: { title },
    pageSize: 'A4',
    pageMargins: [72, 72, 72, 72],
    defaultStyle: { font: 'Times', fontSize: 11, lineHeight: 1.25 },
    content: content(blocks),
  });
  return pdf.getBuffer();
};
