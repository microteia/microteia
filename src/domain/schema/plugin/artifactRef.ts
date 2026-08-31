/**
 * A REFERÊNCIA a uma automação, ação ou script de OUTRA extensão — `com.acme.utils/normalizar-cpf`.
 *
 * Os três são artefatos de id GERADO, e é isso que os separa da tela. A identidade de uma tela é o
 * nome da coleção, que é o mesmo em todo escritório, e por isso uma referência a ela atravessa o
 * pacote intacta. A identidade dos três é um id local que a instalação pode RENOMEAR
 * (`installedArtifactId`, quando o nome já está ocupado no destino), então quem empacota não tem como
 * saber por qual nome o artefato vai atender no escritório de quem instala.
 *
 * O que sobrevive à instalação é o `sourceId` — o id universal de origem, que é justamente a chave
 * pela qual `materializeArtifacts` já deduplica. Daí a forma da referência: à esquerda o id da
 * extensão dona, à direita o `sourceId` dela.
 *
 * **Os dois espaços de nomes são disjuntos por construção.** Um id de artefato é
 * `^[a-z][a-z0-9-]*$` e nunca contém `/`; logo a presença da barra já significa "qualificado", e
 * nenhuma referência qualificada pode ser confundida com um artefato que o próprio pacote carrega.
 * É a mesma leitura de `qualifyKey`, onde uma chave de mensagem com `/` é absoluta. Não há sigilo:
 * o `@` já é o da referência de MENSAGEM (`messageRef.ts`), e reusá-lo confundiria as duas.
 *
 * Os dois padrões moram aqui juntos, e não cada um no seu arquivo, porque é este módulo que precisa
 * conferir as duas metades — e é a vizinhança deles que torna a disjunção acima verificável em um
 * lugar só.
 */

/** O que separa a extensão dona do artefato. Nunca aparece dentro de nenhuma das duas metades. */
export const ARTIFACT_REF_SEPARATOR = '/';

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

export const isValidPluginId = (id: unknown): id is string =>
  typeof id === 'string' && PLUGIN_ID_PATTERN.test(id);

/**
 * O identificador de um artefato de id gerado, no mesmo padrão das chaves de tela: minúsculas,
 * dígitos e hífen, começando por letra. Curto o bastante para caber numa referência e estável o
 * bastante para ser escrito à mão.
 */
const ARTIFACT_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const MAX_ARTIFACT_ID_LENGTH = 60;

export const isArtifactId = (id: unknown): id is string => {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return ARTIFACT_ID_PATTERN.test(trimmed) && trimmed.length <= MAX_ARTIFACT_ID_LENGTH;
};

export interface ArtifactRef {
  pluginId: string;
  /** O `sourceId` do artefato no pacote da extensão dona — nunca o id local dela no escritório. */
  artifactId: string;
}

export const artifactRef = (pluginId: string, artifactId: string): string =>
  `${pluginId}${ARTIFACT_REF_SEPARATOR}${artifactId}`;

/**
 * Se o valor TENTA ser uma referência qualificada. Serve para separar o erro de digitação
 * (`com.acme.utils/Normalizar CPF`) do id local legítimo: sem isso os dois cairiam na mesma recusa
 * genérica, e a única que ajuda é a que diz qual das duas coisas o autor escreveu.
 */
export const hasRefSeparator = (value: unknown): boolean =>
  typeof value === 'string' && value.includes(ARTIFACT_REF_SEPARATOR);

/**
 * Corta na PRIMEIRA barra: nenhuma das duas metades pode conter uma, então uma segunda barra torna a
 * metade direita inválida — que é o veredito certo, e não um corte diferente.
 */
export const parseArtifactRef = (value: unknown): ArtifactRef | null => {
  if (typeof value !== 'string') return null;
  const separator = value.indexOf(ARTIFACT_REF_SEPARATOR);
  if (separator < 0) return null;
  const pluginId = value.slice(0, separator);
  const artifactId = value.slice(separator + 1);
  if (!isValidPluginId(pluginId) || !isArtifactId(artifactId)) return null;
  return { pluginId, artifactId: artifactId.trim() };
};

export const isArtifactRef = (value: unknown): boolean => parseArtifactRef(value) !== null;
