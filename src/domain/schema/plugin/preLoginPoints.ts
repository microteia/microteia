/**
 * Os pontos que fazem efeito ANTES de haver escritório — na tela de entrada e nas outras rotas
 * públicas.
 *
 * A lista existe porque a instalação pode carimbar extensões que carregam no boot, e uma extensão
 * carimbada que não contribua para nenhum destes pontos **carregaria sem fazer nada**. Isso é pior
 * que um erro: quem a carimbou acredita que ela está no ar. O `deploy` do Console recusa esse caso, e
 * é contra esta lista que ele decide.
 *
 * Por que só estes quatro:
 *
 * - `auth.provider` é o motivo de tudo — é por ele que um SSO chega à tela de entrada.
 * - `i18n.messages` porque o `LocaleProvider` está acima do roteador: sem ele, a extensão carimbada
 *   não teria como traduzir o próprio rótulo, e escreveria numa língua só.
 * - `theme.definition` e `theme.tokens` porque o `ThemeProvider` também está acima, e a escolha de
 *   tema em `/login` vem do navegador. É o que permite a uma instalação chegar já com a própria cara.
 * - `ui.slot` pelas regiões `login.header` e `login.footer`.
 *
 * O que NÃO está aqui não é proibido — é INÓCUO no boot. Tela, menu, aba, widget, comando, dado e
 * permissão só existem dentro do escritório, e o caminho deles continua sendo instalar a extensão.
 *
 * A lista é DERIVADA daqui pelo `pack`, que a põe no manifesto do pacote. O Console não a conhece de
 * cor de propósito: ele é versionado separadamente do kernel, e uma cópia dela ali passaria a
 * descrever o contrato de outra versão em silêncio.
 */
export const PRE_LOGIN_POINTS: readonly string[] = [
  'auth.provider',
  'i18n.messages',
  'theme.definition',
  'theme.tokens',
  'ui.slot',
] as const;
