import React from 'react';
import { S } from './HtmlView.styles';
import { useHtmlViewViewModel, type HtmlViewProps } from './HtmlView.viewmodel';

/**
 * HTML de TERCEIRO exibido dentro da aplicação — o corpo de um e-mail de tribunal, o texto de uma
 * publicação. Renderiza num quadro ISOLADO, e é o isolamento que o torna seguro de usar:
 *
 * - sem `allow-scripts`: nada executa lá dentro, nem `<script>`, nem `onerror`, nem `javascript:`;
 * - sem `allow-same-origin`: o quadro tem origem opaca, então mesmo que algo executasse não
 *   alcançaria nosso DOM, nossos cookies nem o token do Firebase no `localStorage`;
 * - sem `allow-forms` e sem navegação de topo: o conteúdo não consegue postar dados nem arrastar a
 *   aplicação para outro endereço. Links seguem clicáveis, sempre em aba nova.
 *
 * A limpeza do HTML acontece antes (ver `sanitizeHtml`), mas é redundância deliberada: uma extensão
 * que decida errado de quem confiar erra dentro da moldura, e não em cima da sessão de quem lê.
 */
export const HtmlView: React.FC<HtmlViewProps> = (props) => {
  const vm = useHtmlViewViewModel(props);
  return (
    <S.Frame
      $height={vm.height}
      srcDoc={vm.srcDoc}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      loading="lazy"
      title="Conteúdo"
    />
  );
};
