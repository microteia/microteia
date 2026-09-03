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

/**
 * O que o diagnóstico precisa saber de cada extensão do escritório: que ela está lá, se está no ar,
 * e o que ela declara exportar. É a mesma tripla que o `InstalledExtension` guarda, reduzida ao que
 * a pergunta usa — o resolvedor não tem por que enxergar um pacote inteiro.
 */
export interface ArtifactRefOwner {
  id: string;
  active: boolean;
  exports?: readonly string[] | null;
}

/**
 * O resultado de procurar o artefato de uma referência, com o MOTIVO quando ele não aparece.
 *
 * `findByArtifactRef` responde sim ou não, e é o suficiente para quem só precisa executar. Para quem
 * DESENHA a referência não é: uma referência qualificada que não resolve tinha uma única frase na
 * tela — "Registro não encontrado" —, que manda o leitor procurar na coleção local um artefato que
 * nunca esteve lá. O que ele precisa saber é de quem é o artefato e o que falta para ele existir.
 *
 * `unresolved` é o id LOCAL que não casa com nada: ali a ausência é mesmo da coleção do escritório, e
 * a frase genérica está certa.
 *
 * A ORDEM das recusas não é arbitrária — ela é a ordem em que o leitor pode agir. `not-exported`
 * vem antes de `owner-inactive` porque é fato sobre a referência em si: a dona está lá e não promete
 * aquele id, então religá-la não muda nada, e mandar religar primeiro custa uma volta inútil. Já a
 * dona DESLIGADA que exporta o id continua tendo os artefatos dela como documentos do escritório — é
 * por isso que esse caso só chega aqui quando o documento também falta.
 */
export type ArtifactRefResolution<T> =
  | { kind: 'found'; artifact: T }
  | { kind: 'unresolved' }
  | { kind: 'owner-absent'; pluginId: string; artifactId: string }
  | { kind: 'not-exported'; pluginId: string; artifactId: string }
  | { kind: 'owner-inactive'; pluginId: string; artifactId: string }
  | { kind: 'artifact-absent'; pluginId: string; artifactId: string };

export const resolveArtifactRef = <T extends OwnedArtifact>(
  all: readonly T[],
  ref: string,
  owners: readonly ArtifactRefOwner[],
): ArtifactRefResolution<T> => {
  const artifact = findByArtifactRef(all, ref);
  if (artifact) return { kind: 'found', artifact };

  const qualified = parseArtifactRef(ref);
  if (!qualified) return { kind: 'unresolved' };

  const { pluginId, artifactId } = qualified;
  const owner = owners.find((one) => one.id === pluginId);
  if (!owner) return { kind: 'owner-absent', pluginId, artifactId };
  if (!(owner.exports ?? []).includes(artifactId)) return { kind: 'not-exported', pluginId, artifactId };
  if (!owner.active) return { kind: 'owner-inactive', pluginId, artifactId };
  return { kind: 'artifact-absent', pluginId, artifactId };
};
