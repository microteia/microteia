// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { HtmlView } from './HtmlView.view';
import { sanitizeHtml } from './sanitizeHtml';
import { darkTheme } from '../../../../shared/styles/theme';

describe('sanitizeHtml', () => {
  it('remove os elementos que executam ou carregam de fora', () => {
    const clean = sanitizeHtml(
      '<p>Intimação</p><script>roubar()</script><iframe src="x"></iframe><style>a{}</style>'
      + '<object data="x"></object><embed src="x"><link rel="stylesheet" href="x">',
    );
    expect(clean).toContain('<p>Intimação</p>');
    for (const tag of ['<script', '<iframe', '<style', '<object', '<embed', '<link']) {
      expect(clean).not.toContain(tag);
    }
  });

  it('remove manipuladores de evento, com e sem aspas', () => {
    const clean = sanitizeHtml('<img src=x onerror="roubar()"><a onclick=roubar()>x</a>');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
  });

  it('neutraliza esquemas executáveis, inclusive escritos por entidade HTML', () => {
    expect(sanitizeHtml('<a href="javascript:roubar()">x</a>')).not.toContain('javascript:');
    expect(sanitizeHtml('<a href="javascript&#58;roubar()">x</a>')).not.toContain('javascript&#58;');
  });

  /**
   * O comentário condicional some porque é dentro dele que o HTML de e-mail costuma esconder o que
   * um sanitizador ingênuo não olha — e porque a moldura já não executaria nada mesmo.
   */
  it('remove comentários, inclusive os condicionais', () => {
    expect(sanitizeHtml('<!--[if IE]><script>x()</script><![endif]--><p>ok</p>')).toBe('<p>ok</p>');
  });
});

describe('HtmlView', () => {
  const renderView = (html: string) =>
    render(
      <ThemeProvider theme={darkTheme}>
        <HtmlView html={html} />
      </ThemeProvider>,
    );

  /**
   * A asserção que importa. Acrescentar `allow-scripts` ou `allow-same-origin` a esta lista devolve
   * ao HTML de terceiro o poder de executar, ou de alcançar nossa origem — e é justamente o que este
   * componente existe para impedir. Se alguém precisar mexer aqui, que seja quebrando este teste.
   */
  it('a moldura não concede script nem a nossa origem', () => {
    const { container } = renderView('<p>Intimação</p>');
    const frame = container.querySelector('iframe');

    expect(frame?.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox');
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame?.getAttribute('src')).toBeNull();
  });

  it('o conteúdo vai limpo para dentro da moldura, com os links abrindo fora', () => {
    const { container } = renderView('<p>Intimação</p><script>roubar()</script>');
    const srcDoc = container.querySelector('iframe')?.getAttribute('srcdoc') ?? '';

    expect(srcDoc).toContain('<p>Intimação</p>');
    expect(srcDoc).not.toContain('roubar()');
    expect(srcDoc).toContain('<base target="_blank">');
  });

  it('conteúdo vazio vira a mensagem, não uma moldura em branco', () => {
    const { container } = renderView('   ');
    expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Sem conteúdo disponível.');
  });
});
