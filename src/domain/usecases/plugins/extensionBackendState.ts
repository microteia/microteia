import type { InstalledExtension } from '../../entities/InstalledExtension';
import { backendFingerprint, hasBackendRequirement } from '../../schema/plugin/backendRequirement';

/**
 * Uma extensão pode exigir do projeto Firebase o que nenhuma declaração de dados alcança: Cloud
 * Function, índice composto, credencial de backend. Instalar não cria nada disso — quem cria é o
 * Microteia Console, que roda na máquina de quem tem o projeto.
 *
 * Enquanto não criou, a extensão fica PENDENTE e não entra no boot. **Falha fechada**, e é o ponto
 * todo: se ela entrasse, a tela abriria e cada chamada ao servidor falharia no navegador parecendo
 * erro de CORS — que é o defeito mais caro de diagnosticar da instalação inteira, porque manda
 * procurar no frontend, que está correto.
 */
export const extensionNeedsBackend = (extension: InstalledExtension): boolean =>
  hasBackendRequirement(extension.package.manifest.backend);

/**
 * O comparado é o FINGERPRINT do que a extensão exige, não a versão dela: uma versão nova que passe a
 * pedir uma function nova volta a ficar pendente sozinha, e uma que só mude texto não re-pendura o que
 * está funcionando.
 */
export const isExtensionBackendApplied = (extension: InstalledExtension): boolean => {
  if (!extensionNeedsBackend(extension)) return true;
  const applied = extension.backendState?.fingerprint;
  return applied !== undefined && applied === backendFingerprint(extension.package.manifest.backend);
};

/** Instalada, ativa, exigindo backend e ainda sem ele — o que a tela de Extensões precisa mostrar. */
export const isExtensionBackendPending = (extension: InstalledExtension): boolean =>
  extensionNeedsBackend(extension) && !isExtensionBackendApplied(extension);
