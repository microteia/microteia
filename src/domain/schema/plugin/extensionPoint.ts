import type { PluginDiagnostic } from './diagnostics';
import { error } from './diagnostics';
import { isValidSemVer, satisfiesRange } from './semver';

export type ImplKind = 'code' | 'script' | 'widget' | 'workflow';

export const IMPL_KINDS: readonly ImplKind[] = ['code', 'script', 'widget', 'workflow'] as const;

/**
 * `code` roda JavaScript compilado no bundle e por isso é privilégio de plugins first-party.
 * Plugin vindo do Marketplace só contribui implementação declarativa (`widget`, `workflow`) ou
 * código em sandbox (`script`) — é essa linha que permite centenas de plugins sem revisar JS.
 */
export const THIRD_PARTY_IMPL_KINDS: readonly ImplKind[] = ['script', 'widget', 'workflow'] as const;

export const isTrustedOnlyImplKind = (kind: ImplKind): boolean => !THIRD_PARTY_IMPL_KINDS.includes(kind);

export interface ExtensionPointDefinition {
  id: string;
  apiVersion: string;
  title: string;
  description?: string;
  ownerPluginId: string;
  allowedImplKinds: ImplKind[];
  implRequired: boolean;
  multiple: boolean;
}

const EXTENSION_POINT_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export const isValidExtensionPointId = (id: string): boolean =>
  typeof id === 'string' && EXTENSION_POINT_ID_PATTERN.test(id);

/**
 * Uma contribuição escrita para a versão X do contrato roda num ponto na versão Y quando Y está
 * em `^X` — ou seja, o ponto pode ter evoluído aditivamente, mas nunca ter mudado de major nem
 * ser mais antigo que o contrato que a contribuição espera.
 */
export const isApiVersionCompatible = (contributionApiVersion: string, pointApiVersion: string): boolean =>
  isValidSemVer(contributionApiVersion) && satisfiesRange(pointApiVersion, `^${contributionApiVersion}`);

export const validateExtensionPoint = (
  definition: ExtensionPointDefinition,
  pluginId: string,
  index = 0,
): PluginDiagnostic[] => {
  const diagnostics: PluginDiagnostic[] = [];
  const at = (field: string) => `extensionPoints[${index}].${field}`;

  if (!isValidExtensionPointId(definition?.id)) {
    diagnostics.push(
      error({
        code: 'extensionPoint.invalid',
        message: '@core.marketplace/diagnostic.point.id.invalid',
        messageParams: { id: String(definition?.id) },
        pluginId,
        path: at('id'),
      }),
    );
  }
  if (!isValidSemVer(definition?.apiVersion)) {
    diagnostics.push(
      error({
        code: 'extensionPoint.invalid',
        message: '@core.marketplace/diagnostic.point.api-version.invalid',
        messageParams: { id: String(definition?.id) },
        pluginId,
        path: at('apiVersion'),
      }),
    );
  }
  if (!definition?.title?.trim()) {
    diagnostics.push(
      error({
        code: 'extensionPoint.invalid',
        message: '@core.marketplace/diagnostic.point.title.missing',
        messageParams: { id: String(definition?.id) },
        pluginId,
        path: at('title'),
      }),
    );
  }
  if (!Array.isArray(definition?.allowedImplKinds)) {
    diagnostics.push(
      error({
        code: 'extensionPoint.invalid',
        message: '@core.marketplace/diagnostic.point.impl-kinds.missing',
        messageParams: { id: String(definition?.id) },
        pluginId,
        path: at('allowedImplKinds'),
      }),
    );
  } else {
    definition.allowedImplKinds.forEach((kind, kindIndex) => {
      if (!IMPL_KINDS.includes(kind)) {
        diagnostics.push(
          error({
            code: 'extensionPoint.invalid',
            message: '@core.marketplace/diagnostic.point.impl-kind.unknown',
            messageParams: { kind: String(kind), allowed: IMPL_KINDS.join(', ') },
            pluginId,
            path: at(`allowedImplKinds[${kindIndex}]`),
          }),
        );
      }
    });
    if (definition.implRequired && definition.allowedImplKinds.length === 0) {
      diagnostics.push(
        error({
          code: 'extensionPoint.invalid',
          message: '@core.marketplace/diagnostic.point.impl-required-none-allowed',
          messageParams: { id: definition.id },
          pluginId,
          path: at('allowedImplKinds'),
        }),
      );
    }
  }

  return diagnostics;
};
