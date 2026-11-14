import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { AppliedBackend } from '../../entities/AppliedBackend';
import { isExtensionBackendApplied } from './extensionBackendState';

/**
 * Em que estado uma Cloud Function de extensão está NESTE escritório.
 *
 * - `disabled` — nenhuma extensão instalada e ativa a reivindica. Nada está no ar.
 * - `pending` — alguma reivindica, mas o projeto Firebase ainda não foi provisionado: a function não
 *   existe, e é isso que separa "instalado" de "alcançável".
 * - `ready` — a function está no ar.
 */
export type BackendFunctionAvailability = 'disabled' | 'pending' | 'ready';

/**
 * A pergunta é pelo NOME DA FUNCTION, nunca pelo id de um plugin: o kernel nomeia só o que é dele, e
 * quem bifurcasse a extensão para um pacote próprio continuaria vendo o recurso ligado.
 */
export const backendFunctionAvailability = (
  installed: readonly InstalledExtension[],
  projectApplied: AppliedBackend | null,
  functionName: string,
): BackendFunctionAvailability => {
  const claimants = installed.filter(
    (extension) => extension.active
      && (extension.package.manifest.backend?.functions ?? []).includes(functionName),
  );
  if (claimants.length === 0) return 'disabled';
  return claimants.some((extension) => isExtensionBackendApplied(extension, projectApplied)) ? 'ready' : 'pending';
};
