import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { AppliedBackend } from '../../entities/AppliedBackend';
import type { PluginRecord } from '../../../kernel';
import { extensionRecordFrom } from './extensionRecordFrom';
import { isExtensionBackendApplied } from './extensionBackendState';

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
 *
 * A segunda condição é o BACKEND: extensão que exige Cloud Function ou índice só entra depois que o
 * Microteia Console os criou no projeto. Aqui ela é excluída INTEIRA, e não parcialmente — deixar o
 * menu e a tela aparecerem sem o servidor por trás é o defeito que parece CORS e manda procurar no
 * lugar errado. Ver `extensionBackendState`.
 *
 * A terceira é o DADO: extensão com migração obrigatória em dívida também fica fora, pela mesma
 * razão invertida — o servidor está lá, mas o dado ainda não está no formato que as telas dela
 * esperam. Ver `extensionMigrationState`. `migrationPendingIds` vazio é o caso de quem não declara
 * migração nenhuma, que é a maioria.
 */
export const installedExtensionRecords = (
  installed: InstalledExtension[],
  trustedIds: ReadonlySet<string>,
  projectApplied: AppliedBackend | null,
  migrationPendingIds: ReadonlySet<string> = new Set<string>(),
): PluginRecord[] =>
  installed
    .filter((extension) => extension.active)
    .filter((extension) => isExtensionBackendApplied(extension, projectApplied))
    .filter((extension) => !migrationPendingIds.has(extension.id))
    .map((extension) => extensionRecordFrom(extension.package, trustedIds.has(extension.id)));
