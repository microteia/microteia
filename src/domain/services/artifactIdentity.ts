import type { TranslateFn } from '../schema/i18n/messages';
/**
 * O IDENTIFICADOR de um artefato de id gerado — automação, ação e script.
 *
 * Nasceu como id do banco, ilegível e invisível na tela: quem montava uma Ação não tinha como saber
 * qual automação estava escolhendo, e um pacote só conseguia apontar para ela pelo `templateId`.
 * Passa a ser um NOME, no mesmo espírito das chaves de tela: minúsculas, dígitos e hífen, começando
 * por letra. Curto o bastante para caber numa referência e estável o bastante para ser escrito à mão.
 *
 * É o MESMO identificador dos dois lados da viagem: o `templateId` que o pacote carrega vira o id do
 * documento no escritório que instala. Um conceito, e não um par de nomes a conciliar — foi a
 * divergência entre os dois que fazia uma automação instalada aparecer como `NehhFXIJ40ZcaCV2SLjT`
 * enquanto a criada à mão ao lado dela aparecia como `avisar-cliente`.
 */
const ARTIFACT_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export const MAX_ARTIFACT_ID_LENGTH = 60;

/**
 * O artefato a que o identificador pertence. Vira SUFIXO de chave (`artifact.taken.workflow`) em vez
 * de entrar na frase: em português a mensagem precisa concordar em gênero ("um script" × "uma
 * ação"), e nenhuma interpolação resolve concordância — só a frase inteira por artefato resolve.
 */
export type ArtifactKind = 'workflow' | 'action' | 'script';

export const isArtifactId = (id: string): boolean => {
  const trimmed = id.trim();
  return ARTIFACT_ID_PATTERN.test(trimmed) && trimmed.length <= MAX_ARTIFACT_ID_LENGTH;
};

export const artifactIdIssue = (
  t: TranslateFn,
  id: string,
  taken: ReadonlySet<string> = new Set(),
  kind: ArtifactKind = 'workflow',
): string | undefined => {
  const trimmed = id.trim();
  if (!trimmed) return t('artifact.id.required');
  if (trimmed.length > MAX_ARTIFACT_ID_LENGTH) {
    return t('artifact.id.too-long', { max: MAX_ARTIFACT_ID_LENGTH });
  }
  if (!ARTIFACT_ID_PATTERN.test(trimmed)) {
    return t('artifact.id.invalid');
  }
  if (taken.has(trimmed)) {
    return t(`artifact.taken.${kind}`, { id: trimmed });
  }
  return undefined;
};

/**
 * O identificador derivado do NOME, para quem não quer escolher um: acentos viram a letra base,
 * o resto que não é letra ou dígito vira hífen, e o que sobrar entra em minúsculas.
 *
 * `taken` desempata com sufixo numérico, como o resto da plataforma faz com nomes de coleção — dois
 * "Avisar cliente" viram `avisar-cliente` e `avisar-cliente-2`.
 */
export const deriveArtifactId = (name: string, taken: ReadonlySet<string> = new Set()): string => {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ARTIFACT_ID_LENGTH);

  // Nome só de símbolos, ou começando por número, não produz um identificador válido sozinho.
  const seed = ARTIFACT_ID_PATTERN.test(base) ? base : `wf-${base}`.replace(/-+$/, '');
  if (!taken.has(seed)) return seed;

  // O desempate é com hífen, e não com sublinhado: o sublinhado não passa na própria validação.
  let suffix = 2;
  while (taken.has(`${seed}-${suffix}`)) suffix += 1;
  return `${seed}-${suffix}`;
};

/**
 * O id LOCAL de um artefato que chega por um PACOTE: o identificador universal dele quando serve, e
 * um derivado do nome quando não serve.
 *
 * Não serve em dois casos, e os dois acontecem de verdade: (1) o pacote foi exportado antes de o
 * identificador existir e carrega o id do banco de origem (`NehhFXIJ40ZcaCV2SLjT`, que nem passa no
 * padrão); (2) o escritório já tem OUTRO artefato ocupando esse identificador. Nos dois casos o
 * `sourceId` continua sendo o universal — quem liga um pacote ao outro é ele, não o id local.
 */
export const installedArtifactId = (
  templateId: string,
  name: string,
  taken: ReadonlySet<string>,
): string =>
  isArtifactId(templateId) && !taken.has(templateId.trim())
    ? templateId.trim()
    : deriveArtifactId(name, taken);
