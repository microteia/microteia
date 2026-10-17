import { useCallback, useMemo } from 'react';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import { useLabel } from '../i18n/useT';

/**
 * O nome legível da extensão dona de um artefato, a partir do `ownerPluginId` dele.
 *
 * O mapa é montado uma vez por mudança nas instaladas, e não a cada linha da lista. A extensão que já
 * não está instalada — o artefato sobreviveu a ela — devolve o próprio id: é a única identificação que
 * resta, e esconder a origem seria pior que mostrá-la crua.
 */
export const useExtensionName = (): ((pluginId: string | null | undefined) => string | null) => {
  const { installed } = useInstalledExtensions();
  const label = useLabel();

  const names = useMemo(
    () => new Map(installed.map((extension) => [extension.id, label(extension.package.manifest.name) || extension.id])),
    [installed, label],
  );

  return useCallback((pluginId) => (pluginId ? names.get(pluginId) ?? pluginId : null), [names]);
};
