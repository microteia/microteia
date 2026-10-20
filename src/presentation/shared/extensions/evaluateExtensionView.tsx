import React, { useSyncExternalStore } from 'react';
import { transform } from 'sucrase';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { HOST_MODULES } from './hostApi';

import { useT } from '../i18n/useT';

export type ExtensionPageComponent = React.ComponentType<{ tabKey: string }>;

const makeFallback = (message: string): ExtensionPageComponent => {
  const Fallback: ExtensionPageComponent = () => {
    const t = useT('core.marketplace');
    return (
      <div style={{ padding: 24 }}>
        <InfoBanner message={t('extension.load-failed', { message })} variant="warning" />
      </div>
    );
  };
  Fallback.displayName = 'ExtensionViewFallback';
  return Fallback;
};

/**
 * Compila a fonte (`sucrase`) e a avalia num `new Function` cujo `require` só resolve os módulos da
 * API curada (`HOST_MODULES`), devolvendo o export `default`. Base comum das views e do `startup`.
 */
const compileDefaultExport = (source: string, modules: Record<string, unknown> = HOST_MODULES): unknown => {
  const { code } = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    jsxRuntime: 'automatic',
    production: true,
  });

  const requireHost = (name: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name];
    throw new Error(`module "${name}" is not available to extensions.`);
  };

  const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
  const factory = new Function('require', 'module', 'exports', code) as (
    require: (name: string) => unknown,
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void;
  factory(requireHost, moduleObject, moduleObject.exports);

  return (moduleObject.exports.default ?? moduleObject.exports) as unknown;
};

/**
 * O mesmo compilador, com OUTRO conjunto de módulos — o do portal, que não tem os stores do
 * escritório. Uma view que importe o que o mapa não tem falha AQUI, com a mensagem, e não ao render.
 */
export const compileComponentWith = <P,>(
  source: string,
  modules: Record<string, unknown>,
): { ok: true; Component: React.ComponentType<P> } | { ok: false; error: string } => {
  try {
    const exported = compileDefaultExport(source, modules);
    if (typeof exported !== 'function') throw new Error('a view precisa exportar um componente React como `default`.');
    return { ok: true, Component: exported as React.ComponentType<P> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

const compile = (source: string): ExtensionPageComponent => {
  const exported = compileDefaultExport(source);
  if (typeof exported !== 'function') {
    throw new Error('a view precisa exportar um componente React como `default`.');
  }
  return exported as ExtensionPageComponent;
};

/** Função de inicialização de uma extensão: recebe o `host` curado e devolve um teardown opcional. */
export type ExtensionStartup = (host: unknown) => (() => void) | void;

export type CompileExtensionStartupResult =
  | { ok: true; startup: ExtensionStartup }
  | { ok: false; error: string };

/**
 * Compila e avalia a fonte de `startup` de uma extensão, devolvendo a função exportada como `default`.
 * Não roda a função nem memoiza — o chamador (host de startup) executa e cuida do teardown.
 */
export const compileExtensionStartup = (source: string): CompileExtensionStartupResult => {
  try {
    const exported = compileDefaultExport(source);
    if (typeof exported !== 'function') {
      throw new Error('the startup must export a `(host) => cleanup?` function as `default`.');
    }
    return { ok: true, startup: exported as ExtensionStartup };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

export type CompileExtensionViewResult =
  | { ok: true; Component: ExtensionPageComponent }
  | { ok: false; error: string };

/**
 * Compila e avalia a fonte, devolvendo o resultado (usado pela autoria para validar/pré-visualizar).
 * Não memoiza nem gera fallback — o chamador decide o que fazer com o erro. Não pega erros de
 * RENDER (esses só aparecem ao montar o componente), só de compilação e carga do módulo.
 */
export const compileExtensionView = (source: string): CompileExtensionViewResult => {
  try {
    return { ok: true, Component: compile(source) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};

/**
 * Um componente ESTÁVEL que só avalia o módulo da extensão FORA do render.
 *
 * Quem pede a view está renderizando (`useUiContributions`, o `useMemo` do catálogo de
 * configurações). Avaliar o módulo ali executa os `styled.div` dele no meio do render, e o
 * styled-components, em desenvolvimento, sonda se foi chamado dentro de um componente chamando um
 * hook — que entra na lista de hooks de quem estava renderizando. O resultado era "change in the
 * order of Hooks" no painel do escritório. A avaliação acontece então na inscrição do
 * `useSyncExternalStore`, que roda no commit, onde o módulo se comporta como um import comum.
 */
export const deferredComponent = <P extends object>(
  compileNow: () => React.ComponentType<P>,
  displayName: string,
): React.ComponentType<P> => {
  let compiled: React.ComponentType<P> | null = null;
  const subscribe = (notify: () => void): (() => void) => {
    if (!compiled) {
      compiled = compileNow();
      notify();
    }
    return () => undefined;
  };
  const getSnapshot = () => compiled;
  const Deferred: React.FC<P> = (props) => {
    const Component = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return Component ? React.createElement(Component, props) : null;
  };
  Deferred.displayName = displayName;
  return Deferred;
};

const cache = new Map<string, { source: string; Component: ExtensionPageComponent }>();

/**
 * Compila a fonte de uma view de extensão (`sucrase`) e a avalia num `new Function` cujo `require` só
 * resolve os módulos da API curada do host (`HOST_MODULES`). Devolve o componente exportado como
 * `default`. Erro de compilação ou avaliação NÃO derruba o app: vira um componente de fallback que
 * mostra a mensagem — mesma tolerância do `WidgetRenderer`. Resultado memoizado por `cacheKey`
 * (`pluginId::viewKey`), reavaliando só quando a fonte muda (nova versão da extensão).
 *
 * SEGURANÇA — o que É e o que NÃO é: `HOST_MODULES` limita o que o `require` resolve, e nada além
 * disso. Corpo de `new Function` roda em escopo GLOBAL, então `fetch`, `sendBeacon`, `localStorage` e
 * o DOM continuam alcançáveis. Isto não é um sandbox, e sombrear globais não faria dele um
 * (`({}).constructor.constructor` devolve `Function`).
 *
 * A contenção real é de PROCEDÊNCIA: só chega aqui código de extensão vinda do catálogo aprovado por
 * SYSTEM, ou cujo código um admin do escritório revisou explicitamente. Ver `extensionCodeTrust`.
 */
export const evaluateExtensionView = (cacheKey: string, source: string): ExtensionPageComponent => {
  const cached = cache.get(cacheKey);
  if (cached && cached.source === source) return cached.Component;

  const Component = deferredComponent<{ tabKey: string }>(() => {
    const result = compileExtensionView(source);
    return result.ok ? result.Component : makeFallback(result.error);
  }, `ExtensionView(${cacheKey})`);
  cache.set(cacheKey, { source, Component });
  return Component;
};
