import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { sanitizeHtml } from './sanitizeHtml';

export interface HtmlViewProps {
  html: string;
  /**
   * Altura da moldura, em pixels. O conteúdo rola DENTRO dela — o quadro não se ajusta sozinho ao
   * texto, e isso é consequência direta do isolamento: medir a altura exigiria um script rodando
   * dentro do quadro, que é exatamente o que ele existe para impedir.
   */
  height?: number;
  /** Texto exibido quando não há conteúdo. */
  emptyMessage?: string;
}

export interface HtmlViewViewModel {
  srcDoc: string;
  height: number;
}

const DEFAULT_HEIGHT = 420;

/**
 * O documento que vai para dentro da moldura. Leva o tema junto porque o quadro isolado não herda
 * NADA da aplicação: sem isto, um e-mail sem estilo próprio apareceria em Times New Roman preto
 * sobre branco no meio de uma tela escura.
 *
 * `<base target="_blank">` é o que mantém os links úteis: sem `allow-top-navigation` um clique não
 * faria nada, e com ele o e-mail poderia arrastar a aplicação inteira para outro endereço.
 */
const buildSrcDoc = (
  body: string,
  colors: { text: string; muted: string; background: string; border: string; primary: string },
  fontFamily: string,
): string => `<!doctype html>
<html><head><meta charset="utf-8"><base target="_blank">
<style>
  html, body { margin: 0; padding: 12px; background: ${colors.background}; }
  body {
    color: ${colors.text};
    font-family: ${fontFamily};
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  a { color: ${colors.primary}; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; border-collapse: collapse; }
  td, th { border-color: ${colors.border}; }
  hr { border: none; border-top: 1px solid ${colors.border}; }
  blockquote { margin: 0 0 0 8px; padding-left: 8px; border-left: 2px solid ${colors.border}; color: ${colors.muted}; }
</style></head>
<body>${body}</body></html>`;

export const useHtmlViewViewModel = (props: HtmlViewProps): HtmlViewViewModel => {
  const { html, height = DEFAULT_HEIGHT, emptyMessage = 'Sem conteúdo disponível.' } = props;
  const theme = useTheme();

  const srcDoc = useMemo(() => {
    const clean = sanitizeHtml(html ?? '').trim();
    const body = clean === '' ? `<p>${emptyMessage}</p>` : clean;
    return buildSrcDoc(
      body,
      {
        text: theme.colors.text,
        muted: theme.colors.textMuted,
        background: theme.colors.surface,
        border: theme.colors.border,
        primary: theme.colors.primary,
      },
      theme.fonts.body,
    );
  }, [html, emptyMessage, theme]);

  return { srcDoc, height };
};
