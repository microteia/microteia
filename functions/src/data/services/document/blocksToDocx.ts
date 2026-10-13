import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ParagraphChild } from 'docx';
import type { Block, CellAlign, Span } from './markdownBlocks';

const ORDERED = 'ordered';

const HEADINGS = [
  HeadingLevel.TITLE,
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
] as const;

const runsOf = (spans: Span[]): ParagraphChild[] =>
  spans.map((span) => {
    const run = new TextRun({
      text: span.text,
      bold: span.bold,
      italics: span.italics,
      strike: span.strike,
      font: span.code ? 'Courier New' : undefined,
      break: span.lineBreak ? 1 : undefined,
      style: span.link ? 'Hyperlink' : undefined,
    });
    return span.link ? new ExternalHyperlink({ link: span.link, children: [run] }) : run;
  });

const alignmentOf = (align: CellAlign) =>
  align === 'center' ? AlignmentType.CENTER : align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT;

/**
 * Cada lista numerada recomeça do próprio início: no Word isso é uma INSTÂNCIA nova da mesma
 * numeração. Sem o contador, a segunda lista do documento continuaria a contagem da primeira.
 */
interface Emitter {
  nextListInstance: () => number;
}

const paragraphs = (blocks: Block[], emitter: Emitter, level = 0): (Paragraph | Table)[] =>
  blocks.flatMap((block): (Paragraph | Table)[] => {
    switch (block.kind) {
      case 'heading':
        return [new Paragraph({
          heading: HEADINGS[Math.min(block.level, HEADINGS.length) - 1],
          alignment: block.level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: runsOf(block.spans),
        })];
      case 'paragraph':
        return [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runsOf(block.spans) })];
      case 'list': {
        const instance = block.ordered ? emitter.nextListInstance() : 0;
        return block.items.flatMap((item) =>
          item.flatMap((inner, index): (Paragraph | Table)[] => {
            if (inner.kind === 'list') return paragraphs([inner], emitter, level + 1);
            if (index > 0 || (inner.kind !== 'paragraph' && inner.kind !== 'heading')) {
              return paragraphs([inner], emitter, level + 1);
            }
            return [new Paragraph({
              children: runsOf(inner.spans),
              ...(block.ordered
                ? { numbering: { reference: ORDERED, level: Math.min(level, 8), instance } }
                : { bullet: { level: Math.min(level, 8) } }),
            })];
          }),
        );
      }
      case 'table':
        return [new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: block.header.map((cell, column) => new TableCell({
                children: [new Paragraph({
                  alignment: alignmentOf(block.align[column]),
                  children: runsOf(cell.map((span) => ({ ...span, bold: true }))),
                })],
              })),
            }),
            ...block.rows.map((row) => new TableRow({
              children: row.map((cell, column) => new TableCell({
                children: [new Paragraph({ alignment: alignmentOf(block.align[column]), children: runsOf(cell) })],
              })),
            })),
          ],
        })];
      case 'quote':
        return paragraphs(block.blocks, emitter, level);
      case 'code':
        return block.text.split('\n').map((line) => new Paragraph({
          children: [new TextRun({ text: line, font: 'Courier New', size: 18 })],
        }));
      case 'rule':
        return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'auto', space: 1 } } })];
      case 'pageBreak':
        return [new Paragraph({ children: [new PageBreak()] })];
      default:
        return [];
    }
  });

export const blocksToDocx = async (blocks: Block[], title: string): Promise<Buffer> => {
  let instances = 0;
  const document = new Document({
    title,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 22 } } } },
    numbering: {
      config: [{
        reference: ORDERED,
        levels: Array.from({ length: 9 }, (_unused, level) => ({
          level,
          format: LevelFormat.DECIMAL,
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    sections: [{ children: paragraphs(blocks, { nextListInstance: () => ++instances }) }],
  });
  return Packer.toBuffer(document);
};
