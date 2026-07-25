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

/**
 * Compila a fonte (`sucrase`) e a avalia num `new Function` cujo `require` só resolve os módulos da
 * API curada (`HOST_MODULES`), devolvendo o export `default`. Base comum das views e do `startup`.
 */
const compileDefaultExport = (source: string): unknown => {
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

  return (moduleObject.exports.default ?? moduleObject.exports) as unknown;
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
      throw new Error('o startup precisa exportar uma função `(host) => cleanup?` como `default`.');
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

  const result = compileExtensionView(source);
  const Component = result.ok ? result.Component : makeFallback(result.error);
  cache.set(cacheKey, { source, Component });
  return Component;
};
