import type { PluginRecord } from '../../kernel';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { THEME_DEFINITION_POINT, themeContribution } from '../../domain/schema/theme';

/**
 * **Escuro** e **Claro** — os dois temas que vêm com o sistema, e o piso da lista de aparência.
 *
 * Eles são extensões de verdade: um manifest com uma contribuição de tema, no mesmo formato que
 * qualquer escritório pode baixar, editar e reimportar. O que os torna especiais é apenas ONDE
 * moram — viajam no bundle, como `CORE_PLUGINS`, em vez de instalados por escritório. Disso decorre
 * tudo o resto: estão sempre presentes, valem também em `/login` e `/license` (que rodam antes de
 * haver escritório), e não há como desinstalá-los, porque não há instalação a desfazer.
 *
 * Note o que eles NÃO têm: nenhuma cor. `extends` aponta para a base do kernel e o corpo é vazio,
 * porque nada neles difere dela. Não é economia — é a prova de que a base do kernel é exatamente o
 * tema que o escritório vê, e não uma paleta paralela que pode divergir dela em silêncio.
 *
 * E, principalmente: eles não conhecem vocabulário de domínio. Redefinir a cor de uma fase
 * processual é direito de um TEMA, e o Themis o exerce — mas Themis é extensão, e uma extensão pode
 * conhecer outra. Estes dois viajam no bundle e não se desinstalam: são kernel na prática, e um
 * escritório que nunca instalou Processos não pode carregar quatro cores de processo na paleta
 * dele. O tom de "sentença" vem de quem tem sentença.
 *
 * Quem quiser variar não sobrepõe estes dois: baixa um deles, troca `id` e `name`, mexe nas cores e
 * importa. O resultado é um tema a mais na lista, ao lado — nunca por cima.
 */
export const darkThemePackage: MarketplacePlugin = {
  summary: '@core.theme/package.dark.summary',
  workflows: [],
  manifest: {
    id: 'com.microteia.theme-dark',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Dark',
    description:
      'The dark theme that ships with Microteia.',
    icon: 'palette',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.theme': '^1.0.0' },
    contributes: [
      themeContribution({ id: 'dark', name: '@core.theme/theme.dark', extends: 'dark' }),
    ],
  },
};

export const whiteThemePackage: MarketplacePlugin = {
  summary: '@core.theme/package.white.summary',
  workflows: [],
  manifest: {
    id: 'com.microteia.theme-white',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'White',
    description:
      'The light theme that ships with Microteia.',
    icon: 'palette',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.theme': '^1.0.0' },
    contributes: [
      themeContribution({ id: 'white', name: '@core.theme/theme.white', extends: 'light' }),
    ],
  },
};

/**
 * Os pacotes do sistema, para a tela de Extensões mostrá-los e oferecer o download. É a MESMA
 * declaração que o Kernel carrega — a linha na tela e o tema no ar nunca podem divergir.
 */
export const SYSTEM_THEME_PACKAGES: MarketplacePlugin[] = [darkThemePackage, whiteThemePackage];

/**
 * Os ids que SÓ o pacote do sistema pode reivindicar — `themeSpecsOf` recusa qualquer outro plugin
 * que declare um deles.
 *
 * Sem esta trava, um pacote instalado no escritório declarando `id: 'dark'` podia passar na frente
 * do tema do sistema e trocar a aparência de todo mundo. Desinstalar já era impossível; sobrepor
 * não podia continuar sendo. A lista é DERIVADA dos pacotes acima, e não escrita à mão: um tema do
 * sistema novo já nasce protegido.
 */
export const RESERVED_THEME_IDS: Readonly<Record<string, string>> = Object.fromEntries(
  SYSTEM_THEME_PACKAGES.flatMap((themePackage) =>
    (themePackage.manifest.contributes ?? [])
      .filter((contribution) => contribution.point === THEME_DEFINITION_POINT)
      .map((contribution) => [String(contribution.metadata.id), themePackage.manifest.id])),
);

/**
 * **Acrescentar um tema do sistema é criar o pacote acima e somar uma linha nesta lista.** Nada no
 * Kernel muda, e nenhum outro plugin precisa saber.
 */
export const BUNDLED_THEME_PLUGINS: PluginRecord[] = SYSTEM_THEME_PACKAGES.map((themePackage) => ({
  manifest: themePackage.manifest,
}));
