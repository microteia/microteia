import React, { lazy } from 'react';
import type { Contribution } from '../domain/schema/plugin/contribution';
import type {
  UiCommandMetadata,
  UiNavMetadata,
  UiPageMetadata,
} from '../presentation/shared/uiExtensionPoints';
import {
  UI_API_VERSION,
  UI_COMMAND_POINT,
  UI_NAV_POINT,
  UI_PAGE_POINT,
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

export const nav = (metadata: UiNavMetadata): Contribution => ({
  point: UI_NAV_POINT,
  id: slug(metadata.key),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
});

export const command = (id: string, metadata: UiCommandMetadata, implKey: string): Contribution => ({
  point: UI_COMMAND_POINT,
  id: slug(id),
  apiVersion: UI_API_VERSION,
  metadata: { ...metadata } as unknown as Record<string, unknown>,
  impl: { kind: 'code', key: implKey },
});
