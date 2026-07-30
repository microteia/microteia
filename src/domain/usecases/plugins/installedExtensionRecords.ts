import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { PluginRecord } from '../../../kernel';
import { extensionRecordFrom } from './extensionRecordFrom';

/**
 * Extensões INSTALADAS ATIVAS viram `PluginRecord`s do Kernel do tenant.
 *
 * `trustedIds` é o conjunto que pode EXECUTAR código — cópia do catálogo público (aprovada por
 * SYSTEM) ou cópia cujo código foi revisado e confiado por um admin do escritório. Fora dele, o
 * pacote entra sem `implementations`: telas, campos, listas e workflows continuam valendo, só o
 * JavaScript não roda.
 *
 * Falha FECHADA de propósito: enquanto o hash está sendo calculado o conjunto vem vazio, e o efeito
 * é o código não rodar. O contrário deixaria uma janela em que código não revisado executa.
 */
export const installedExtensionRecords = (
  installed: InstalledExtension[],
  trustedIds: ReadonlySet<string>,
): PluginRecord[] =>
  installed
    .filter((extension) => extension.active)
    .map((extension) => extensionRecordFrom(extension.package, trustedIds.has(extension.id)));
