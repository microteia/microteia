import React from 'react';
import { compileComponentWith } from '../../shared/extensions/evaluateExtensionView';
import { PORTAL_HOST_MODULES } from '../../shared/extensions/portalHostApi';
import { PortalViewFallback } from './components/PortalViewFallback';
import type { PortalViewInfo } from '../../../domain/entities/Portal';

/** O que a view de LISTA recebe. O resto ela pede a `@microteia/portal`. */
export interface PortalListViewProps {
  collection: string;
}

/** O que a view de REGISTRO recebe. */
export interface PortalDetailViewProps {
  collection: string;
  recordId: string;
}

export type PortalViewComponent = React.ComponentType<PortalListViewProps & Partial<PortalDetailViewProps>>;

const cache = new Map<string, { source: string; Component: PortalViewComponent }>();

/**
 * A view de portal de uma extensão, compilada com os módulos DO PORTAL. Memoizada pela fonte, como
 * as views do escritório; um erro de compilação vira o aviso no lugar da view, e não derruba a casca.
 */
export const evaluatePortalView = (view: PortalViewInfo): PortalViewComponent => {
  const cacheKey = `${view.pluginId}::${view.viewKey}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.source === view.source) return cached.Component;

  const result = compileComponentWith<PortalListViewProps & Partial<PortalDetailViewProps>>(view.source, PORTAL_HOST_MODULES);
  const Component: PortalViewComponent = result.ok
    ? result.Component
    : () => React.createElement(PortalViewFallback, { message: result.error });
  cache.set(cacheKey, { source: view.source, Component });
  return Component;
};
