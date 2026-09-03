import type { ArtifactRefOwner, OwnedArtifact } from '../../domain/services/artifactLookup';
import { resolveArtifactRef } from '../../domain/services/artifactLookup';

/**
 * Resolve uma referência de mensagem, com os parâmetros de interpolação. É a assinatura de
 * `useLabel`, e os dois argumentos são necessários porque este módulo INTRODUZ referências próprias
 * — as frases de ausência —, e não só repassa as declaradas.
 */
type LabelFn = (value: string | null | undefined, params?: Record<string, string>) => string;

/** O artefato de id gerado como um seletor precisa dele: o que o acha, mais o nome que ele desenha. */
export interface NamedArtifact extends OwnedArtifact {
  name: string;
}

export interface ArtifactRefTarget {
  /**
   * A linha da lista que corresponde ao valor gravado, ou `null` quando não há artefato para ele.
   *
   * O `value` é o gravado INTACTO — id local ou referência qualificada, exatamente como está no
   * passo. É o que faz reescolher o mesmo alvo no seletor manter a referência qualificada em vez de
   * trocá-la pelo id do documento local: a referência tem de continuar viajando literal, senão ela
   * deixa de sobreviver à extensão dona ser reinstalada.
   */
  option: { value: string; label: string } | null;
  /**
   * O id do DOCUMENTO achado, para quem precisa reconhecer a linha que a lista já traz por ele.
   * `null` sempre que `option` é `null`.
   */
  localId: string | null;
  /**
   * Por que o artefato não foi achado, quando o valor gravado é uma referência QUALIFICADA. `null`
   * quando ele foi achado, e também quando o gravado é um id local ausente — ali a ausência é mesmo
   * da coleção do escritório, e quem desenha já tem a frase genérica certa para ela.
   */
  reason: string | null;
}

/**
 * As frases de ausência, uma por motivo. Elas NOMEIAM a extensão dona de propósito: sem o nome dela,
 * quem lê não tem para onde ir — e era justamente isso que a frase genérica fazia, mandando procurar
 * na coleção local um artefato que nunca esteve lá.
 */
const REASON_REFS = {
  'owner-absent': '@core.automation/step.target.ref.owner-absent',
  'not-exported': '@core.automation/step.target.ref.not-exported',
  'owner-inactive': '@core.automation/step.target.ref.owner-inactive',
  'artifact-absent': '@core.automation/step.target.ref.artifact-absent',
} as const;

/**
 * O ALVO gravado num input que aponta um artefato de id gerado — automação ou script —, na forma em
 * que o seletor o desenha.
 *
 * Existe porque o valor gravado tem duas formas e o seletor só sabia uma. Um passo que aponta para o
 * artefato de outra extensão guarda `<extensão>/<source-id>`, resolvido por dono e `sourceId` a cada
 * execução; a lista do seletor é de ids de documento. Nada casava, e o alvo que EXECUTA certo era
 * desenhado como ausente.
 */
export const artifactRefTarget = (
  resolve: LabelFn,
  all: readonly NamedArtifact[],
  stored: string,
  owners: readonly ArtifactRefOwner[],
): ArtifactRefTarget => {
  const resolution = resolveArtifactRef(all, stored, owners);
  if (resolution.kind === 'found') {
    return {
      option: { value: stored, label: resolve(resolution.artifact.name) },
      localId: resolution.artifact.id,
      reason: null,
    };
  }
  if (resolution.kind === 'unresolved') return { option: null, localId: null, reason: null };
  return {
    option: null,
    localId: null,
    reason: resolve(REASON_REFS[resolution.kind], {
      plugin: resolution.pluginId,
      id: resolution.artifactId,
    }),
  };
};
