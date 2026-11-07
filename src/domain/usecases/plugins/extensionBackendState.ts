import type { ExtensionBackendPending, InstalledExtension } from '../../entities/InstalledExtension';
import type { AppliedBackend } from '../../entities/AppliedBackend';
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

/** O que a cópia instalada exige AGORA — inclusive o código, quando ele viaja no pacote. */
const declaredFingerprint = (extension: InstalledExtension): string =>
  backendFingerprint(extension.package.manifest.backend, extension.package.backendSource?.hash);

/**
 * O comparado é o FINGERPRINT do que a extensão exige, não a versão dela: uma versão nova que passe a
 * pedir uma function nova volta a ficar pendente sozinha, e uma que só mude texto não re-pendura o que
 * está funcionando.
 *
 * Duas fontes respondem, e basta uma. O carimbo da PRÓPRIA cópia, e o que o PROJETO tem aplicado
 * (`backend_state/applied`): a function é do projeto, então a cópia que chegou depois do último
 * `provision` exigindo exatamente o que ele pôs no ar não está pendente de nada. O segundo é parâmetro
 * obrigatório, e não opcional, para que nenhum ponto que decide a pendência o esqueça — `null` é a
 * resposta explícita de quem não o tem, e cai no carimbo da cópia, que é o comportamento fechado.
 */
export const isExtensionBackendApplied = (
  extension: InstalledExtension,
  projectApplied: AppliedBackend | null,
): boolean => {
  if (!extensionNeedsBackend(extension)) return true;
  const declared = declaredFingerprint(extension);
  if (extension.backendState?.fingerprint === declared) return true;
  return (projectApplied?.extensions ?? []).some(
    (entry) => entry.pluginId === extension.package.manifest.id && entry.fingerprint === declared,
  );
};

/** Instalada, ativa, exigindo backend e ainda sem ele — o que a tela de Extensões precisa mostrar. */
export const isExtensionBackendPending = (
  extension: InstalledExtension,
  projectApplied: AppliedBackend | null,
): boolean => extensionNeedsBackend(extension) && !isExtensionBackendApplied(extension, projectApplied);

/**
 * O motivo gravado pelo Console, quando ele ainda explica a pendência de AGORA.
 *
 * Nulo quando não há motivo (o Console nunca rodou depois da instalação) e quando ele é de outra
 * exigência — o escritório atualizou a extensão depois da recusa. Nos dois casos o certo é a instrução
 * genérica: o que falta é rodar o `provision`, não corrigir o que ele disse da versão anterior.
 */
export const extensionBackendPendingCause = (
  extension: InstalledExtension,
  projectApplied: AppliedBackend | null,
): ExtensionBackendPending | null => {
  if (!isExtensionBackendPending(extension, projectApplied)) return null;
  const pending = extension.backendPending;
  if (!pending) return null;
  return pending.fingerprint === declaredFingerprint(extension) ? pending : null;
};
