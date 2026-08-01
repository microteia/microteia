import type { CapabilityProvision, CapabilityRequirement } from './capability';
import { validateProvisions, validateRequirements } from './capability';
import type { Contribution } from './contribution';
import { findDuplicateContributions, validateContribution } from './contribution';
import type { PluginDiagnostic } from './diagnostics';
import { error } from './diagnostics';
import type { ExtensionPointDefinition } from './extensionPoint';
import { validateExtensionPoint } from './extensionPoint';
import { validatePermissions } from './permission';
import { isValidRange, isValidSemVer, satisfiesRange } from './semver';

export interface PluginPublisher {
  name: string;
  url?: string;
  email?: string;
}

export type PluginLifecycleHook =
  | { kind: 'script'; scriptId: string }
  | { kind: 'workflow'; workflowId: string };

export interface PluginLifecycle {
  onInstall?: PluginLifecycleHook;
  onUpgrade?: PluginLifecycleHook;
  onEnable?: PluginLifecycleHook;
  onDisable?: PluginLifecycleHook;
  onUninstall?: PluginLifecycleHook;
}

/**
 * Uma dependência declarada: a faixa de versão sozinha, ou a faixa mais as COLEÇÕES que ela traz.
 *
 * A forma longa existe porque uma entidade que sai do kernel mantém o nome GLOBAL da coleção
 * (`persons`) — ela não ganha o prefixo da extensão que passou a descrevê-la, senão os registros
 * mudariam de lugar. Sem dizer o que a dependência traz, a validação não teria como distinguir
 * "referencia uma coleção que a extensão de Pessoas instala" de "referencia uma tela que ninguém
 * tem": as duas são apenas um nome.
 */
export type PluginDependency = string | { version: string; collections?: string[] };

export const dependencyRange = (dependency: PluginDependency): string =>
  typeof dependency === 'string' ? dependency : dependency.version;

export const dependencyCollections = (dependency: PluginDependency): string[] =>
  typeof dependency === 'string' ? [] : (dependency.collections ?? []);

export interface PluginManifest {
  id: string;
  version: string;
  kernel: string;
  name: string;
  description?: string;
  icon?: string;
  homepage?: string;
  publisher?: PluginPublisher;
  dependencies?: Record<string, PluginDependency>;
  provides?: CapabilityProvision[];
  consumes?: CapabilityRequirement[];
  permissions?: string[];
  extensionPoints?: ExtensionPointDefinition[];
  contributes?: Contribution[];
  lifecycle?: PluginLifecycle;
}

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

export const isValidPluginId = (id: string): boolean =>
  typeof id === 'string' && PLUGIN_ID_PATTERN.test(id);

export const isKernelCompatible = (manifest: PluginManifest, kernelVersion: string): boolean =>
  satisfiesRange(kernelVersion, manifest?.kernel);

export interface ValidateManifestOptions {
  trusted?: boolean;
  kernelVersion?: string;
  points?: Map<string, ExtensionPointDefinition>;
  /**
   * O `PluginHost` desliga esta etapa na primeira passada: só depois de saber quais plugins
   * carregam é que os pontos de extensão existem, e validar contribuições antes disso acusaria
   * "ponto desconhecido" em todas elas.
   */
  validateContributions?: boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateShape = (manifest: PluginManifest): PluginDiagnostic[] => {
  const diagnostics: PluginDiagnostic[] = [];
  const pluginId = manifest?.id;

  if (!isValidPluginId(pluginId)) {
    diagnostics.push(
      error({
        code: 'manifest.id.invalid',
        message: `Id de plugin "${pluginId}" é inválido. Use DNS reverso com ao menos dois segmentos (ex.: "com.acme.contratos").`,
        pluginId,
        path: 'id',
      }),
    );
  }
  if (!isValidSemVer(manifest?.version)) {
    diagnostics.push(
      error({
        code: 'manifest.version.invalid',
        message: `A versão "${manifest?.version}" não é um semver válido.`,
        pluginId,
        path: 'version',
      }),
    );
  }
  if (!isValidRange(manifest?.kernel)) {
    diagnostics.push(
      error({
        code: 'manifest.kernel.invalid',
        message: `A faixa de kernel "${manifest?.kernel}" é inválida. Use algo como "^1.0.0".`,
        pluginId,
        path: 'kernel',
      }),
    );
  }
  if (!manifest?.name?.trim()) {
    diagnostics.push(
      error({
        code: 'manifest.field.missing',
        message: 'O plugin precisa de um nome legível.',
        pluginId,
        path: 'name',
      }),
    );
  }

  return diagnostics;
};

const validateDependencies = (manifest: PluginManifest): PluginDiagnostic[] => {
  const dependencies = manifest?.dependencies;
  if (dependencies === undefined) return [];
  if (!isPlainObject(dependencies)) {
    return [
      error({
        code: 'manifest.invalid',
        message: 'As dependências precisam ser um objeto { pluginId: faixa }.',
        pluginId: manifest?.id,
        path: 'dependencies',
      }),
    ];
  }

  return Object.entries(dependencies).flatMap(([dependencyId, dependency]) => {
    const diagnostics: PluginDiagnostic[] = [];
    const range = dependencyRange(dependency as PluginDependency);
    if (!isValidPluginId(dependencyId)) {
      diagnostics.push(
        error({
          code: 'manifest.id.invalid',
          message: `A dependência "${dependencyId}" não é um id de plugin válido.`,
          pluginId: manifest.id,
          path: `dependencies.${dependencyId}`,
        }),
      );
    }
    if (!isValidRange(range)) {
      diagnostics.push(
        error({
          code: 'dependency.range.invalid',
          message: `A faixa "${range}" da dependência "${dependencyId}" é inválida.`,
          pluginId: manifest.id,
          path: `dependencies.${dependencyId}`,
        }),
      );
    }
    return diagnostics;
  });
};

const validateExtensionPoints = (manifest: PluginManifest): PluginDiagnostic[] => {
  const points = manifest?.extensionPoints ?? [];
  const seen = new Set<string>();
  return points.flatMap((point, index) => {
    const diagnostics = validateExtensionPoint(point, manifest.id, index);
    if (seen.has(point?.id)) {
      diagnostics.push(
        error({
          code: 'extensionPoint.duplicate',
          message: `O ponto de extensão "${point?.id}" foi declarado mais de uma vez neste plugin.`,
          pluginId: manifest.id,
          path: `extensionPoints[${index}].id`,
        }),
      );
    }
    seen.add(point?.id);
    return diagnostics;
  });
};

/**
 * Valida um manifest inteiro. Nunca lança: todo problema vira diagnóstico, porque um plugin
 * malformado do Marketplace precisa ser recusado com explicação, não derrubar o carregamento
 * dos outros.
 */
export const validatePluginManifest = (
  manifest: PluginManifest,
  options: ValidateManifestOptions = {},
): PluginDiagnostic[] => {
  if (!isPlainObject(manifest)) {
    return [error({ code: 'manifest.invalid', message: 'O manifest precisa ser um objeto.' })];
  }

  const { trusted = false, kernelVersion, points, validateContributions = true } = options;
  const diagnostics: PluginDiagnostic[] = [
    ...validateShape(manifest),
    ...validateDependencies(manifest),
    ...validatePermissions(manifest.permissions, manifest.id),
    ...validateProvisions(manifest.provides, manifest.id),
    ...validateRequirements(manifest.consumes, manifest.id),
    ...validateExtensionPoints(manifest),
  ];

  if (kernelVersion && isValidRange(manifest.kernel) && !isKernelCompatible(manifest, kernelVersion)) {
    diagnostics.push(
      error({
        code: 'manifest.kernel.incompatible',
        message: `O plugin "${manifest.name || manifest.id}" exige o Microteia ${manifest.kernel}, mas esta instalação está na versão ${kernelVersion}.`,
        pluginId: manifest.id,
        path: 'kernel',
      }),
    );
  }

  if (!validateContributions) return diagnostics;

  const contributions = manifest.contributes ?? [];
  const declaredPoints = new Map(points ?? []);
  for (const point of manifest.extensionPoints ?? []) {
    if (point?.id) declaredPoints.set(point.id, point);
  }

  diagnostics.push(...findDuplicateContributions(contributions, manifest.id));
  contributions.forEach((contribution, index) => {
    diagnostics.push(
      ...validateContribution(contribution, {
        pluginId: manifest.id,
        trusted,
        point: declaredPoints.get(contribution?.point),
        index,
      }),
    );
  });

  return diagnostics;
};
