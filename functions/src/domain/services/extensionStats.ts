/**
 * Uma cópia instalada conta como instalação quando veio do catálogo — público ou embutido.
 *
 * A cópia `private` fica de fora porque é a extensão que o escritório escreveu para si: contá-la
 * criaria `extension_stats/{id}` com o identificador de algo que ninguém publicou, e a coleção é
 * legível por todo usuário autenticado.
 */
export const countsAsCatalogInstall = (data: Record<string, unknown> | undefined): boolean =>
  data !== undefined && data.source !== 'private';
