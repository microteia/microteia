/**
 * Os construtores de contribuição — o açúcar que evita cada pacote montar o objeto à mão e repetir a
 * versão da API em cada linha.
 *
 * Moram no SDK, e não em `plugins/`, porque saem desta casa: um autor de fora escreve contra eles.
 * Por isso nenhum importa React — `lazyView`, que precisa dele, ficou em `plugins/contributionBuilders`,
 * onde continua sendo privilégio de primeira parte (só quem está no bundle resolve `impl: code` por
 * chave).
 */
import type { Contribution } from '../domain/schema/plugin/contribution';
import type { AuthProviderMetadata } from '../domain/schema/auth';
import { AUTH_API_VERSION, AUTH_PROVIDER_POINT } from '../domain/schema/auth';
import type { WidgetSpec } from '../domain/schema/ui/widgetSpec';
import type { SettingsSection } from '../domain/schema/settings';
import type {
  UiCommandMetadata,
  UiMenuItemMetadata,
  UiNavMetadata,
  UiPageMetadata,
  UiRecordActionMetadata,
  UiSlotMetadata,
  UiTabMetadata,
  UiWidgetMetadata,
} from '../domain/schema/ui/uiExtensionPoints';
import {
  UI_API_VERSION,
  UI_COMMAND_POINT,
  UI_MENU_POINT,
  UI_NAV_POINT,
  UI_PAGE_POINT,
  UI_RECORD_ACTION_POINT,
  UI_SETTINGS_POINT,
  UI_SLOT_POINT,
  UI_TAB_POINT,
  UI_WIDGET_POINT,
} from '../domain/schema/ui/uiExtensionPoints';

const slug = (value: string): string =>
  value
    .replace(/:$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

/**
 * Uma contribuição de tela. O `id` sai da chave e é estável entre versões, que é o que permite ao
 * Marketplace comparar uma versão com a seguinte. Abas paramétricas ganham o sufixo `-prefix`
 * porque o slug de `tenant-settings:` seria idêntico ao de `tenant-settings` — sem isso, a tela
 * de prefixo colidiria com a de chave exata e seria descartada como duplicada.
 */
export const page = (metadata: UiPageMetadata, implKey: string): Contribution => ({
  point: UI_PAGE_POINT,
  id: metadata.key ? slug(metadata.key) : `${slug(metadata.keyPrefix ?? implKey)}-prefix`,
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

/**
 * Uma tela DECLARATIVA (Widget DSL) — o único jeito de um plugin de terceiro entregar página, já
 * que `impl: code` é vetado a quem não é interno. O Kernel a renderiza pelo `WidgetRenderer`.
 */
export const widgetPage = (metadata: UiPageMetadata, spec: WidgetSpec): Contribution => ({
  point: UI_PAGE_POINT,
  id: metadata.key ? slug(metadata.key) : `${slug(metadata.keyPrefix ?? 'widget')}-prefix`,
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'widget', spec: spec as unknown as Record<string, unknown> },
});

export const nav = (metadata: UiNavMetadata): Contribution => ({
  point: UI_NAV_POINT,
  id: slug(metadata.key),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
});

/**
 * Uma ação sobre um registro (cartão da listagem, cabeçalho do detalhe). O `id` sai da chave, como
 * nas telas: é estável entre versões, e é por ele que o Marketplace compara uma com a seguinte.
 */
export const recordAction = (metadata: UiRecordActionMetadata, implKey: string): Contribution => ({
  point: UI_RECORD_ACTION_POINT,
  id: slug(metadata.key),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

export const command = (id: string, metadata: UiCommandMetadata, implKey: string): Contribution => ({
  point: UI_COMMAND_POINT,
  id: slug(id),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

/**
 * Um widget de superfície implementado em CÓDIGO (plugin interno). O `id` sai da chave, como nas
 * telas: é estável entre versões e é por ele que o Marketplace compara uma com a seguinte.
 */
export const surfaceWidget = (metadata: UiWidgetMetadata, implKey: string): Contribution => ({
  point: UI_WIDGET_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

/**
 * Uma ABA de uma superfície, implementada em CÓDIGO (plugin interno). O `id` sai da superfície mais
 * a chave, como nos widgets: duas superfícies podem ter uma aba de mesmo nome sem se atropelarem.
 */
export const surfaceTab = (metadata: UiTabMetadata, implKey: string): Contribution => ({
  point: UI_TAB_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

/** Uma aba DECLARATIVA (Widget DSL) — o caminho de quem não pode entregar código. */
export const surfaceTabSpec = (metadata: UiTabMetadata, spec: WidgetSpec): Contribution => ({
  point: UI_TAB_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'widget', spec: spec as unknown as Record<string, unknown> },
});

/**
 * Um TRECHO de uma região do shell, implementado em CÓDIGO (plugin interno). O `id` sai da superfície
 * mais a chave, como nos widgets e nas abas: duas regiões podem hospedar um trecho de mesmo nome sem
 * se atropelarem.
 */
export const surfaceSlot = (metadata: UiSlotMetadata, implKey: string): Contribution => ({
  point: UI_SLOT_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});

/** Um trecho DECLARATIVO (Widget DSL) — o caminho de quem não pode entregar código. */
export const surfaceSlotSpec = (metadata: UiSlotMetadata, spec: WidgetSpec): Contribution => ({
  point: UI_SLOT_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'widget', spec: spec as unknown as Record<string, unknown> },
});

/**
 * Um ITEM de menu. Não tem `impl`, e é o ponto: a declaração É a contribuição — o que o item faz sai
 * da própria `action`, que o shell sabe executar. É o que põe o menu ao alcance de quem só declara.
 */
export const menuItem = (metadata: UiMenuItemMetadata): Contribution => ({
  point: UI_MENU_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
});

/** Um widget DECLARATIVO (Widget DSL) — o caminho de quem não pode entregar código. */
export const surfaceWidgetSpec = (metadata: UiWidgetMetadata, spec: WidgetSpec): Contribution => ({
  point: UI_WIDGET_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'widget', spec: spec as unknown as Record<string, unknown> },
});

/**
 * Um MEIO DE ENTRAR. Não tem `impl`, e é o ponto: a declaração é a contribuição inteira — o Firebase
 * Auth do projeto já sabe falar OIDC e SAML, e o que falta é o pacote dizer com quem. Exigir código
 * aqui tornaria o SSO privilégio de primeira parte, que é justamente o oposto do que ele precisa ser.
 */
export const authProvider = (metadata: AuthProviderMetadata): Contribution => ({
  point: AUTH_PROVIDER_POINT,
  id: slug(metadata.key),
  apiVersion: AUTH_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
});

/**
 * Uma seção da tela de Configurações. Não tem `impl`: a declaração das propriedades É a
 * contribuição, e é o hospedeiro genérico que sabe desenhar cada tipo.
 */
export const settingsSection = (section: SettingsSection): Contribution => ({
  point: UI_SETTINGS_POINT,
  id: slug(section.key),
  apiVersion: UI_API_VERSION,
  metadata: { ...section } as unknown as Record<string, unknown>,
});

/**
 * Uma contribuição de METADATA para um ponto QUALQUER — inclusive um publicado por outra extensão.
 * Os construtores acima existem porque o ponto é do kernel e a forma da metadata é conhecida aqui;
 * um ponto de terceiro não tem como ganhar construtor próprio, e sem esta porta a única saída seria
 * cada pacote montar o objeto à mão e repetir a versão da API.
 */
export const pointContribution = (
  point: string,
  id: string,
  metadata: Record<string, unknown>,
  apiVersion = '1.0.0',
): Contribution => ({
  point,
  id: slug(id),
  apiVersion,
  metadata: { ...metadata },
});
