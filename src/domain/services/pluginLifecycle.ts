import type {
  InstallPluginInput,
  PluginInstallation,
  PluginLifecycleError,
} from '../entities/PluginInstallation';
import { compareSemVer, parseSemVer } from '../schema/plugin/semver';

/**
 * Regras puras do ciclo de vida de uma instalação. Recebem o estado atual (ou `null` = não
 * instalado) e devolvem o próximo estado OU um erro tipado — nunca lançam, nunca tocam I/O. Os use
 * cases orquestram repositório em volta disto; toda a lógica de negócio (idempotência, versão) mora
 * aqui, testável isoladamente.
 */

export type LifecycleOutcome<T> = { ok: true; value: T } | { ok: false; error: PluginLifecycleError };

const ok = <T>(value: T): LifecycleOutcome<T> => ({ ok: true, value });
const fail = (error: PluginLifecycleError): LifecycleOutcome<never> => ({ ok: false, error });

export interface LifecycleActor {
  tenantId: string;
  userId: string;
  now: Date;
}

export const planInstall = (
  current: PluginInstallation | null,
  input: InstallPluginInput,
  actor: LifecycleActor,
): LifecycleOutcome<PluginInstallation> => {
  if (!parseSemVer(input.version)) {
    return fail({
      code: 'invalid-version',
      message: '@core.marketplace/lifecycle.invalid-version',
      messageParams: { version: input.version },
    });
  }
  if (current) {
    return fail({
      code: 'already-installed',
      message: '@core.marketplace/lifecycle.already-installed',
      messageParams: { id: input.pluginId, version: current.version },
    });
  }
  return ok({
    pluginId: input.pluginId,
    tenantId: actor.tenantId,
    version: input.version,
    enabled: true,
    config: input.config ?? {},
    grantedPermissions: input.grantedPermissions,
    installedAt: actor.now,
    installedBy: actor.userId,
    updatedAt: actor.now,
    updatedBy: actor.userId,
  });
};

const planToggle = (
  current: PluginInstallation | null,
  enabled: boolean,
  actor: LifecycleActor,
): LifecycleOutcome<PluginInstallation> => {
  if (!current) {
    return fail({ code: 'not-installed', message: '@core.marketplace/lifecycle.not-installed' });
  }
  // Idempotente: ativar o que já está ativo é um no-op válido, não um erro.
  return ok({ ...current, enabled, updatedAt: actor.now, updatedBy: actor.userId });
};

export const planEnable = (current: PluginInstallation | null, actor: LifecycleActor) =>
  planToggle(current, true, actor);

export const planDisable = (current: PluginInstallation | null, actor: LifecycleActor) =>
  planToggle(current, false, actor);

export const planUpgrade = (
  current: PluginInstallation | null,
  nextVersion: string,
  actor: LifecycleActor,
): LifecycleOutcome<PluginInstallation> => {
  if (!current) {
    return fail({ code: 'not-installed', message: '@core.marketplace/lifecycle.not-installed' });
  }
  const parsedNext = parseSemVer(nextVersion);
  const parsedCurrent = parseSemVer(current.version);
  if (!parsedNext) {
    return fail({
      code: 'invalid-version',
      message: '@core.marketplace/lifecycle.invalid-version',
      messageParams: { version: nextVersion },
    });
  }
  if (parsedCurrent && compareSemVer(parsedNext, parsedCurrent) <= 0) {
    return fail({
      code: 'not-newer-version',
      message: '@core.marketplace/lifecycle.not-newer',
      messageParams: { version: nextVersion, installed: current.version },
    });
  }
  return ok({ ...current, version: nextVersion, updatedAt: actor.now, updatedBy: actor.userId });
};

export const planUninstall = (
  current: PluginInstallation | null,
): LifecycleOutcome<PluginInstallation> => {
  if (!current) {
    return fail({ code: 'not-installed', message: '@core.marketplace/lifecycle.not-installed' });
  }
  return ok(current);
};
