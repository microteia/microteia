import React, { lazy } from 'react';
import type { Contribution } from '../domain/schema/plugin/contribution';
import type { WidgetSpec } from '../presentation/shared/widget/widgetSpec';
import type { SettingsSection } from '../domain/schema/settings';
import type {
  UiCommandMetadata,
  UiNavMetadata,
  UiPageMetadata,
  UiRecordActionMetadata,
  UiWidgetMetadata,
} from '../presentation/shared/uiExtensionPoints';
import {
  UI_API_VERSION,
  UI_COMMAND_POINT,
  UI_NAV_POINT,
  UI_PAGE_POINT,
  UI_RECORD_ACTION_POINT,
  UI_SETTINGS_POINT,
  UI_WIDGET_POINT,
} from '../presentation/shared/uiExtensionPoints';

export type PageComponent = React.ComponentType<{ tabKey: string }>;

/**
 * Carrega a tela sob demanda. Um manifest precisa poder ser lido sem arrastar o código da tela
 * junto — com centenas de plugins instalados, importar tudo no boot inviabilizaria o bundle.
 */
export const lazyView = (
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
): PageComponent =>
  lazy(async () => ({ default: (await loader())[exportName] as PageComponent }));

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

/** Um widget DECLARATIVO (Widget DSL) — o caminho de quem não pode entregar código. */
export const surfaceWidgetSpec = (metadata: UiWidgetMetadata, spec: WidgetSpec): Contribution => ({
  point: UI_WIDGET_POINT,
  id: slug(`${metadata.surface}-${metadata.key}`),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'widget', spec: spec as unknown as Record<string, unknown> },
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
