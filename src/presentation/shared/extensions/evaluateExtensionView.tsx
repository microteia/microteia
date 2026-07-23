import React from 'react';
import { transform } from 'sucrase';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { HOST_MODULES } from './hostApi';

export type ExtensionPageComponent = React.ComponentType<{ tabKey: string }>;

const makeFallback = (message: string): ExtensionPageComponent => {
  const Fallback: ExtensionPageComponent = () => (
    <div style={{ padding: 24 }}>
      <InfoBanner message={`Não foi possível carregar esta extensão: ${message}`} variant="warning" />
    </div>
  );
  Fallback.displayName = 'ExtensionViewFallback';
  return Fallback;
};

const compile = (source: string): ExtensionPageComponent => {
  const { code } = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    jsxRuntime: 'automatic',
    production: true,
  });

  const requireHost = (name: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(HOST_MODULES, name)) return HOST_MODULES[name];
    throw new Error(`o módulo "${name}" não está disponível para extensões.`);
  };

  const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
  const factory = new Function('require', 'module', 'exports', code) as (
    require: (name: string) => unknown,
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void;
  factory(requireHost, moduleObject, moduleObject.exports);

  const exported = (moduleObject.exports.default ?? moduleObject.exports) as unknown;
  if (typeof exported !== 'function') {
    throw new Error('a view precisa exportar um componente React como `default`.');
  }
  return exported as ExtensionPageComponent;
};

const cache = new Map<string, { source: string; Component: ExtensionPageComponent }>();

/**
 * Compila a fonte de uma view de extensão (`sucrase`) e a avalia num `new Function` cujo `require` só
 * resolve os módulos da API curada do host (`HOST_MODULES`). Devolve o componente exportado como
 * `default`. Erro de compilação ou avaliação NÃO derruba o app: vira um componente de fallback que
 * mostra a mensagem — mesma tolerância do `WidgetRenderer`. Resultado memoizado por `cacheKey`
 * (`pluginId::viewKey`), reavaliando só quando a fonte muda (nova versão da extensão).
 *
 * SEGURANÇA: isto executa código arbitrário na thread principal. A contenção é a superfície de
 * `HOST_MODULES` — nada de `firebase`/`fetch`/DI cru. Só é chamado para views de fonte confiável
 * (catálogo publicado por SYSTEM ou embutida); ver `installedPluginRecords`.
 */
export const evaluateExtensionView = (cacheKey: string, source: string): ExtensionPageComponent => {
  const cached = cache.get(cacheKey);
  if (cached && cached.source === source) return cached.Component;

  let Component: ExtensionPageComponent;
  try {
    Component = compile(source);
  } catch (err) {
    Component = makeFallback(err instanceof Error ? err.message : String(err));
  }
  cache.set(cacheKey, { source, Component });
  return Component;
};
