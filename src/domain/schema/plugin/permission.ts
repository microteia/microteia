import type { PluginDiagnostic } from './diagnostics';
import { error } from './diagnostics';

export type PermissionDomain = 'data' | 'workflow' | 'script' | 'capability' | 'ui' | 'net';

export const PERMISSION_DOMAINS: readonly PermissionDomain[] = [
  'data',
  'workflow',
  'script',
  'capability',
  'ui',
  'net',
] as const;

export const PERMISSION_DOMAIN_LABELS: Record<PermissionDomain, string> = {
  data: '@core.marketplace/permission.domain.data',
  workflow: '@core.marketplace/permission.domain.workflow',
  script: '@core.marketplace/permission.domain.script',
  capability: '@core.marketplace/permission.domain.capability',
  ui: '@core.marketplace/permission.domain.ui',
  net: '@core.marketplace/permission.domain.net',
};

export interface ParsedPermission {
  domain: PermissionDomain;
  resource: string;
  action: string;
  raw: string;
}

const SEGMENT_PATTERN = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

const isSegment = (value: string): boolean => value === '*' || SEGMENT_PATTERN.test(value);

/**
 * Aceita `dominio:acao` (recurso implícito `*`) e `dominio:recurso:acao`. A forma curta existe
 * para permissões sem recurso natural (`workflow:run`), sem obrigar o manifest a escrever `*`.
 */
export const parsePermission = (raw: string): ParsedPermission | null => {
  if (typeof raw !== 'string') return null;
  const parts = raw.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  const domain = parts[0] as PermissionDomain;
  if (!PERMISSION_DOMAINS.includes(domain)) return null;

  const resource = parts.length === 3 ? parts[1] : '*';
  const action = parts.length === 3 ? parts[2] : parts[1];
  if (!isSegment(resource) || !isSegment(action)) return null;

  return { domain, resource, action, raw: raw.trim() };
};

export const isValidPermission = (raw: string): boolean => parsePermission(raw) !== null;

const segmentCovers = (granted: string, required: string): boolean =>
  granted === '*' || granted === required;

/** Uma permissão concedida cobre a exigida quando domínio bate e cada segmento cobre o seu. */
export const permissionCovers = (granted: string, required: string): boolean => {
  const grantedPermission = parsePermission(granted);
  const requiredPermission = parsePermission(required);
  if (!grantedPermission || !requiredPermission) return false;
  return (
    grantedPermission.domain === requiredPermission.domain &&
    segmentCovers(grantedPermission.resource, requiredPermission.resource) &&
    segmentCovers(grantedPermission.action, requiredPermission.action)
  );
};

export const isPermitted = (granted: string[], required: string): boolean =>
  granted.some((permission) => permissionCovers(permission, required));

export const validatePermissions = (
  permissions: string[] | undefined,
  pluginId: string,
): PluginDiagnostic[] =>
  (permissions ?? []).flatMap((permission, index) =>
    isValidPermission(permission)
      ? []
      : [
          error({
            code: 'permission.invalid',
            message: '@core.marketplace/diagnostic.permission.invalid',
            messageParams: { permission: String(permission), domains: PERMISSION_DOMAINS.join(', ') },
            pluginId,
            path: `permissions[${index}]`,
          }),
        ],
  );
