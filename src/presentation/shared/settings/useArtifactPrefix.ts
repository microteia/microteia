import { useOptionalSettings } from '../../../stores/useSettings';
import { ARTIFACT_PREFIX_SETTING, isArtifactPrefix } from '../../../domain/schema/plugin/artifactPrefix';

/** A seção de Configurações que guarda o prefixo — declarada pelo `core.tenant`. */
export const PREFIX_SETTINGS_SECTION = 'customization';

/**
 * O prefixo do escritório, ou `null` quando ele não tem um válido — aí os nomes nascem como sempre
 * nasceram. Lido só do escopo do ESCRITÓRIO: o prefixo não é preferência de ninguém. Fora do provedor de
 * configurações (um teste, uma pré-visualização) também é `null`.
 */
export const useArtifactPrefix = (): string | null => {
  const prefix = useOptionalSettings()?.values.tenant[ARTIFACT_PREFIX_SETTING];
  return isArtifactPrefix(prefix) ? prefix : null;
};
