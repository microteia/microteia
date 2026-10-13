import { lexer } from 'marked';
import type { Token, Tokens } from 'marked';

/**
 * O documento como BLOCOS, entre o Markdown e o arquivo.
 *
 * O Markdown é lido uma vez e os dois emissores (PDF e DOCX) andam sobre esta árvore, e não sobre os
 * tokens do `marked`: com dois percursos sobre o formato da biblioteca, um negrito tratado num lado e
 * esquecido no outro faria o mesmo modelo dizer coisas diferentes conforme o formato pedido.
 */
export interface Span {
  text: string;
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
  /** Quebra de linha forçada DEPOIS do texto. */
  lineBreak?: boolean;
}

export type CellAlign = 'left' | 'center' | 'right' | null;

export type Block =
  | { kind: 'heading'; level: number; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { kind: 'table'; align: CellAlign[]; header: Span[][]; rows: Span[][][] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' }
  | { kind: 'pageBreak' };

/**
 * A quebra de página não existe no Markdown. O comentário HTML é a convenção que não aparece em
 * nenhum visualizador de Markdown e sobrevive a qualquer editor — por isso é ele, e não um marcador
 * inventado que apareceria como texto na pré-visualização.
 */
const PAGE_BREAK = /^<!--\s*page-?break\s*-->$/i;

type Style = Omit<Span, 'text' | 'lineBreak'>;

const spansOf = (tokens: readonly Token[] | undefined, style: Style = {}): Span[] =>
  (tokens ?? []).flatMap((token): Span[] => {
    switch (token.type) {
      case 'strong':
        return spansOf((token as Tokens.Strong).tokens, { ...style, bold: true });
      case 'em':
        return spansOf((token as Tokens.Em).tokens, { ...style, italics: true });
      case 'del':
        return spansOf((token as Tokens.Del).tokens, { ...style, strike: true });
      case 'codespan':
        return [{ ...style, code: true, text: (token as Tokens.Codespan).text }];
      case 'link':
        return spansOf((token as Tokens.Link).tokens, { ...style, link: (token as Tokens.Link).href });
      case 'br':
        return [{ ...style, text: '', lineBreak: true }];
      case 'text': {
        const text = token as Tokens.Text;
        return text.tokens && text.tokens.length > 0 ? spansOf(text.tokens, style) : [{ ...style, text: decode(text.text) }];
      }
      case 'escape':
        return [{ ...style, text: (token as Tokens.Escape).text }];
      case 'image':
        return [{ ...style, text: (token as Tokens.Image).text }];
      case 'html':
        return [];
      default:
        return typeof token.raw === 'string' ? [{ ...style, text: token.raw }] : [];
    }
  });

/** O `marked` entrega o texto já com as entidades HTML que ele próprio escapou. */
const decode = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const blocksOf = (tokens: readonly Token[]): Block[] =>
  tokens.flatMap((token): Block[] => {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading;
        return [{ kind: 'heading', level: heading.depth, spans: spansOf(heading.tokens) }];
      }
      case 'paragraph':
        return [{ kind: 'paragraph', spans: spansOf((token as Tokens.Paragraph).tokens) }];
      case 'text': {
        const text = token as Tokens.Text;
        return [{ kind: 'paragraph', spans: text.tokens ? spansOf(text.tokens) : [{ text: decode(text.text) }] }];
      }
      case 'list': {
        const list = token as Tokens.List;
        return [{
          kind: 'list',
          ordered: list.ordered,
          start: typeof list.start === 'number' ? list.start : 1,
          items: list.items.map((item) => blocksOf(item.tokens)),
        }];
      }
      case 'table': {
        const table = token as Tokens.Table;
        return [{
          kind: 'table',
          align: table.align,
          header: table.header.map((cell) => spansOf(cell.tokens)),
          rows: table.rows.map((row) => row.map((cell) => spansOf(cell.tokens))),
        }];
      }
      case 'blockquote':
        return [{ kind: 'quote', blocks: blocksOf((token as Tokens.Blockquote).tokens) }];
      case 'code':
        return [{ kind: 'code', text: (token as Tokens.Code).text }];
      case 'hr':
        return [{ kind: 'rule' }];
      case 'html':
        return PAGE_BREAK.test((token as Tokens.HTML).text.trim()) ? [{ kind: 'pageBreak' }] : [];
      default:
        return [];
    }
  });

export const markdownToBlocks = (markdown: string): Block[] => blocksOf(lexer(markdown, { gfm: true, breaks: false }));
