/**
 * O agregado público de uma extensão (`extension_stats/{id}`), escrito só pelo backend: quantos
 * escritórios a instalaram a partir do catálogo, e a soma e a quantidade dos votos. A média é
 * derivada na leitura — guardar a soma é o que permite recalculá-la sem arredondamento acumulado.
 */
export interface ExtensionStats {
  id: string;
  installs: number;
  ratingCount: number;
  ratingSum: number;
}

/** O voto de uma pessoa, de uma a cinco estrelas, dado em nome do escritório que tem a extensão. */
export interface ExtensionRatingInput {
  pluginId: string;
  userId: string;
  tenantId: string;
  stars: number;
}
