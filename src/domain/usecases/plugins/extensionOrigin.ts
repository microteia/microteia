import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { TenantExtension, TenantExtensionOrigin } from '../../entities/TenantExtension';
import { LocalizedError } from '../../errors/LocalizedError';

/**
 * Campos que a tela "Criar extensão" NUNCA escreve. Um pacote que tenha qualquer um deles não nasceu
 * ali: veio de fora — do SDK, de outro escritório, de um `.json` trocado de mão.
 */
const FOREIGN_MANIFEST_KEYS = [
  'publisher', 'license', 'homepage', 'exports', 'provides', 'consumes', 'permissions',
  'extensionPoints', 'lifecycle', 'backend',
] as const;
const FOREIGN_PACKAGE_KEYS = ['overview', 'reports'] as const;

const present = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

/**
 * A origem de um documento gravado antes de a origem existir.
 *
 * A inferência só vai num sentido, e é de propósito: um campo que a tela de autoria não escreve PROVA
 * que o pacote veio de fora; a ausência deles não prova nada. No caso ambíguo a resposta é `authored`,
 * o comportamento de antes — travar a edição de algo que o escritório montou aqui seria tirar dele o
 * único lugar em que a extensão existe.
 */
export const legacyOriginOf = (pkg: MarketplacePlugin): TenantExtensionOrigin => {
  const manifest = (pkg.manifest ?? {}) as unknown as Record<string, unknown>;
  const body = pkg as unknown as Record<string, unknown>;
  const foreign = FOREIGN_MANIFEST_KEYS.some((key) => present(manifest[key]))
    || FOREIGN_PACKAGE_KEYS.some((key) => present(body[key]));
  return foreign ? 'imported' : 'authored';
};

export const isTenantExtensionOrigin = (value: unknown): value is TenantExtensionOrigin =>
  value === 'authored' || value === 'imported';

/**
 * Editar e exportar são gestos de quem tem a FONTE. A extensão importada é usada aqui — ativada,
 * instalada, publicada no catálogo —, mas a fonte dela está com quem a escreveu: editá-la criaria uma
 * versão paralela que a próxima versão do autor apagaria, e exportá-la redistribuiria o trabalho dele.
 */
export const isAuthoredHere = (extension: TenantExtension | undefined): boolean =>
  extension?.origin === 'authored';

/**
 * Gravar pela tela de autoria por cima de uma extensão importada é recusado: seria editar, por outro
 * caminho, o que não se edita.
 */
export const authoringRefusal = (existing: TenantExtension | undefined): LocalizedError | null =>
  existing?.origin === 'imported'
    ? new LocalizedError('@core.marketplace/author.imported-locked', { id: existing.id })
    : null;

/**
 * Importar por cima de uma extensão MONTADA aqui é recusado: trocaria a fonte do escritório por uma
 * cópia que ele não pode mais editar. Importar por cima de uma importada é a atualização dela — a
 * versão nova que o autor mandou.
 */
export const importRefusal = (existing: TenantExtension | undefined): LocalizedError | null =>
  existing?.origin === 'authored'
    ? new LocalizedError('@core.marketplace/import.authored-here', { id: existing.id })
    : null;
