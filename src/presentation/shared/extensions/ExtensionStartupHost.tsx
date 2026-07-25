import React, { useEffect } from 'react';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import { compileExtensionStartup } from './evaluateExtensionView';
import { makeExtensionHost } from './extensionHost';
import { clearPluginServices } from './extensionServices';

/**
 * Executa o `startup` das extensões INSTALADAS e ATIVAS quando o escritório carrega — o ponto em que
 * cada extensão REGISTRA seus serviços (comandos ⌘K, etc.) no host. Reroda quando a lista de
 * instaladas muda (instalar/ativar/desativar), sempre limpando os serviços do plugin antes (o teardown
 * do efeito). Código de startup é de fonte confiável (cópia instalada, mesmo modelo das `views`); um
 * erro é isolado por extensão e não derruba o app.
 */
export const ExtensionStartupHost: React.FC = () => {
  const { installed } = useInstalledExtensions();

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    for (const extension of installed) {
      if (!extension.active) continue;
      const source = extension.package.startup;
      if (!source) continue;

      const pluginId = extension.package.manifest.id;
      const result = compileExtensionStartup(source);
      if (!result.ok) {
        console.error(`[extension startup] ${pluginId}: ${result.error}`);
        continue;
      }
      try {
        const teardown = result.startup(makeExtensionHost(pluginId));
        cleanups.push(() => {
          clearPluginServices(pluginId);
          if (typeof teardown === 'function') teardown();
        });
      } catch (err) {
        console.error(`[extension startup] ${pluginId} falhou ao executar:`, err);
        clearPluginServices(pluginId);
      }
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [installed]);

  return null;
};
