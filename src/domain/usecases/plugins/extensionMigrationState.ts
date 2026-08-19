import type { ExtensionMigrationState } from '../../entities/ExtensionMigration';
import type { InstalledExtension } from '../../entities/InstalledExtension';
import { hasBlockingMigrations, pendingPluginMigrations } from '../../services/pluginMigrations';
import type { PluginMigration } from '../../schema/plugin/migration';

/**
 * A ponte entre a cópia instalada e o histórico de migração dela — o gêmeo de `extensionBackendState`,
 * e pelo mesmo motivo: instalada não é o mesmo que EM CONDIÇÕES DE RODAR.
 *
 * Aqui o que falta não é do projeto Firebase, é do DADO: enquanto a migração obrigatória não rodou, a
 * extensão fica fora do boot. Falha FECHADA de propósito — a alternativa é cada tela da extensão
 * tolerar para sempre os dois formatos do dado, que é o custo que a migração existe para evitar.
 */
export type ExtensionMigrationStates = ReadonlyMap<string, ExtensionMigrationState>;

export const extensionMigrations = (extension: InstalledExtension): PluginMigration[] =>
  extension.package.migrations ?? [];

export const extensionHasMigrations = (extension: InstalledExtension): boolean =>
  extensionMigrations(extension).length > 0;

export const pendingExtensionMigrations = (
  extension: InstalledExtension,
  states: ExtensionMigrationStates,
): PluginMigration[] => pendingPluginMigrations(extensionMigrations(extension), states.get(extension.id) ?? null);

/** Instalada, com migração obrigatória em dívida — o que a tela de Extensões precisa mostrar. */
export const isExtensionMigrationPending = (
  extension: InstalledExtension,
  states: ExtensionMigrationStates,
): boolean => hasBlockingMigrations(extensionMigrations(extension), states.get(extension.id) ?? null);

/**
 * O último erro de migração desta extensão, para a tela explicar por que ela não subiu. Some sozinho
 * quando a fila passa inteira.
 */
export const extensionMigrationError = (
  extension: InstalledExtension,
  states: ExtensionMigrationStates,
) => states.get(extension.id)?.lastError ?? null;
