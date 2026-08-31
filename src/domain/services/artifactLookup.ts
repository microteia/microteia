import { parseArtifactRef } from '../schema/plugin/artifactRef';

/**
 * O mínimo que um artefato precisa expor para ser achado por uma referência: o id local, o id
 * universal de origem e o conjunto de donos.
 */
export interface OwnedArtifact {
  id: string;
  sourceId?: string | null;
  ownerPluginIds?: string[] | null;
}

/**
 * Acha um artefato de id gerado — automação, ação ou script — pelo que um passo guarda: o id LOCAL,
 * ou a referência QUALIFICADA `<pluginId>/<sourceId>` a um artefato de outra extensão.
 *
 * É o espelho puro do `findByRef` dos repositórios do backend, e existe pela mesma razão: quem chama
 * não sabe qual das duas formas está gravada ali. No front a busca é em memória — os stores já
 * carregam as listas inteiras —, então resolver por nome não custa uma leitura sequer.
 *
 * O DONO precisa bater, e não só o `sourceId`: a instalação deduplica por `sourceId` sem olhar de
 * quem é, então duas extensões sem relação que usem o mesmo `templateId` já hoje compartilham um
 * documento. Sem o filtro, `com.a.x/notificar` acharia a cópia de `com.c.y`.
 */
export const findByArtifactRef = <T extends OwnedArtifact>(
  all: readonly T[],
  ref: string,
): T | undefined => {
  const qualified = parseArtifactRef(ref);
  if (!qualified) return all.find((one) => one.id === ref);
  return all.find((one) => one.sourceId === qualified.artifactId
    && (one.ownerPluginIds ?? []).includes(qualified.pluginId));
};
