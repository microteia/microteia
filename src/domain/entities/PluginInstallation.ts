export interface PluginInstallation {
  /** Doc id = pluginId (DNS reverso). Uma instalação por plugin por tenant. */
  pluginId: string;
  tenantId: string;
  version: string;
  enabled: boolean;
  /** Configuração livre do plugin, preenchida pelo escritório. */
  config: Record<string, unknown>;
  /** Permissões concedidas na instalação — o teto do que o plugin pode fazer no tenant. */
  grantedPermissions: string[];
  installedAt: Date;
  installedBy: string;
  updatedAt: Date;
  updatedBy?: string;
}

export interface InstallPluginInput {
  pluginId: string;
  version: string;
  grantedPermissions: string[];
  config?: Record<string, unknown>;
}

export type PluginLifecycleErrorCode =
  | 'already-installed'
  | 'not-installed'
  | 'not-newer-version'
  | 'invalid-version';

export interface PluginLifecycleError {
  code: PluginLifecycleErrorCode;
  message: string;
}
