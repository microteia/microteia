import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { PluginRecord } from '../../../kernel';
import { extensionRecordFrom } from './extensionRecordFrom';

/**
 * Extensões INSTALADAS ATIVAS viram `PluginRecord`s do Kernel do tenant. A cópia veio de uma fonte
 * confiável (catálogo público aprovado, ou uma privada do próprio autor), então rodar seu código é
 * seguro — mesma superfície de API curada das autorais.
 */
export const installedExtensionRecords = (installed: InstalledExtension[]): PluginRecord[] =>
  installed
    .filter((extension) => extension.active)
    .map((extension) => extensionRecordFrom(extension.package));
