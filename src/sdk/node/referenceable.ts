import type { MarketplacePlugin, ScreenModuleTemplate } from '../../domain/entities/MarketplacePlugin';
import { artifactRef } from '../../domain/schema/plugin/artifactRef';
import type { ExportedArtifact, ExportedArtifactKind, InstalledExtensionSummary } from '../../domain/usecases/plugins/crossExtensionRefs';
import { crossExtensionRefChecks, crossRefIssue } from '../../domain/usecases/plugins/crossExtensionRefs';
import { REF_KIND_KEYS, SCRIPT_ID_INPUT, TARGET_WORKFLOW_ID_INPUT } from '../../domain/usecases/plugins/pluginReferences';
import { referencedExtensionIds } from '../../domain/usecases/plugins/crossExtensionRefs';
import { INSTALLED_CATALOG_FILE, refreshInstalledCatalog } from './installedCatalog';
import { describeMessage, packageText } from './messages';
import type { WorkspaceCatalog } from './workspaceCatalog';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * O QUE SE PODE REFERENCIAR DAQUI, e se uma referência já escrita resolve.
 *
 * As duas perguntas moram juntas porque a resposta das duas sai da mesma lista, e porque separá-las
 * foi exatamente o defeito: a superfície exportada passou a viajar no retrato da instalação e a ser
 * anunciada em três respostas — todas sobre entidade, tela e campo. Quem escreve o passo pergunta o
 * passo, não a entidade, e ali a lista não chegava. Um nome que não se enxerga é um nome que não se
 * escreve; e uma referência que ninguém confere aqui só é conferida no escritório de quem instala.
 *
 * Duas fontes, e a diferença entre elas não é decorativa:
 *
 * - o **workspace** — os `plugin.ts` deste diretório. É o caso mais comum de compartilhamento (a
 *   `utils` e quem a usa, escritas lado a lado) e o único que o retrato não alcança, porque a `utils`
 *   ainda não está instalada em lugar nenhum. Aqui a lista vazia é afirmação: o pacote está na mão.
 * - a **instalação** — o retrato que o Console exporta. Ali a lista vazia pode ser silêncio de um
 *   Console anterior ao campo, e é `exportsKnown` que carrega a distinção. Um retrato sem superfície
 *   NÃO entra na lista de donos conhecidos: o portão lê `exports` ausente como "não exporta nada", e
 *   apresentar silêncio como recusa é pior que dizer que não se sabe.
 *
 * Precedência: o workspace vence, como já vence para coleção. É o pacote que está sendo editado, e é
 * dele que sairá a próxima versão instalada.
 */

/** De onde a superfície foi lida. É o que dá o peso da resposta: um retrato envelhece, um `plugin.ts` não. */
export type ReferenceableSource = 'workspace' | 'installation';

export interface ReferenceableArtifact {
  /** A referência JÁ NA FORMA em que se escreve: `<pluginId>/<sourceId>`. */
  ref: string;
  pluginId: string;
  id: string;
  kind: ExportedArtifactKind;
  name: string;
  from: ReferenceableSource;
  /** Onde a referência deste tipo cabe. Ausente para `unknown`: ele não cabe em lugar nenhum. */
  writtenIn?: string;
  /** Só na instalação: a extensão está lá e está desligada. O artefato dela continua existindo. */
  disabled?: boolean;
}

/**
 * As duas propriedades de tela que guardam id de ação, tipadas contra `ScreenModuleTemplate` para que
 * renomear uma delas não deixe esta frase mentindo em silêncio.
 */
const ACTION_ID_PROPERTIES: (keyof ScreenModuleTemplate)[] = ['viewActionIds', 'cardActionIds'];

/**
 * Onde cada tipo cabe, derivado dos mesmos nomes de input que o leitor de referências usa. Escrever
 * `scriptId` à mão aqui seria uma segunda verdade sobre o mesmo contrato.
 */
const WRITTEN_IN: Record<ExportedArtifactKind, string | undefined> = {
  script: `\`configuration.${SCRIPT_ID_INPUT}\` of a script step`,
  workflow: `\`configuration.${TARGET_WORKFLOW_ID_INPUT}\` of a step that calls a flow, or \`workflowId\` of an action`,
  action: `${ACTION_ID_PROPERTIES.map((one) => `\`${one}\``).join(' / ')} of a screen`,
  unknown: undefined,
};

const asReferenceable = (
  pluginId: string,
  exported: ExportedArtifact,
  from: ReferenceableSource,
  disabled = false,
): ReferenceableArtifact => ({
  ref: artifactRef(pluginId, exported.id),
  pluginId,
  id: exported.id,
  kind: exported.kind,
  name: exported.name,
  from,
  ...(WRITTEN_IN[exported.kind] === undefined ? {} : { writtenIn: WRITTEN_IN[exported.kind] }),
  ...(disabled ? { disabled: true } : {}),
});

/**
 * A lista inteira, workspace primeiro. Uma extensão presente nas duas fontes aparece uma vez, pela
 * versão do workspace — a mesma precedência que a coleção já segue, e pela mesma razão.
 */
export const referenceableArtifacts = (read: WorkspaceCatalog): ReferenceableArtifact[] => {
  const authoredHere = new Set(read.authored.map((one) => one.pluginId));
  const workspace = read.authored.flatMap((one) =>
    one.exports.map((exported) => asReferenceable(one.pluginId, exported, 'workspace')));

  const installed = (read.installed?.extensions ?? [])
    .filter((one) => !authoredHere.has(one.id))
    .flatMap((one) =>
      (one.exports ?? []).map((exported) => asReferenceable(one.id, exported, 'installation', !one.active)));

  return [...workspace, ...installed];
};

/**
 * Os donos que este diretório consegue ENXERGAR, na forma que o portão da instalação recebe.
 *
 * Uma extensão do retrato SEM `exports` fica de fora de propósito: o portão lê a chave ausente como
 * "não exporta nada", e uma recusa fabricada a partir do silêncio de um Console velho é pior que uma
 * resposta dizendo que não se sabe. Quem monta o relatório trata esse caso à parte.
 */
export const knownOwners = (read: WorkspaceCatalog): InstalledExtensionSummary[] => {
  const authoredHere = read.authored.map((one) => ({
    id: one.pluginId,
    version: one.version,
    exports: one.exports.map((exported) => exported.id),
  }));
  const ids = new Set(authoredHere.map((one) => one.id));

  const fromInstallation = (read.installed?.extensions ?? [])
    .filter((one) => !ids.has(one.id) && one.exports !== undefined)
    .map((one) => ({
      id: one.id,
      version: one.version,
      exports: (one.exports ?? []).map((exported) => exported.id),
    }));

  return [...authoredHere, ...fromInstallation];
};

/**
 * O veredito de UMA referência qualificada, como este diretório consegue dizê-lo.
 *
 * `absent-there` existe porque o retrato lista TODAS as extensões instaladas: a ausência da dona
 * nele é informação, não silêncio — a instalação naquele escritório seria recusada. Não é `refused`
 * porque o pacote pode ser destinado a outro escritório, e um veredito que confunde as duas coisas
 * ensina o autor a ignorar o relatório.
 */
export type CrossRefStatus = 'ok' | 'refused' | 'absent-there' | 'unverifiable';

export interface CrossRefFinding {
  ref: string;
  kind: string;
  /** Que artefato do pacote escreveu a referência, resolvido para texto. */
  writtenBy: string;
  status: CrossRefStatus;
  detail: string;
}

/**
 * O MESMO portão que a instalação cobra, rodado aqui — com uma diferença, e ela é a única: a ausência
 * da dona não é recusa, porque este diretório não é o escritório.
 *
 * Sem isto o laço curto tinha um buraco do tamanho do compartilhamento: `validate_plugin` prometia
 * "the exact same checks the platform runs on install", conferia a forma da referência e a dependência
 * declarada, e não conferia as duas que só o outro lado responde — se o `sourceId` está no `exports`
 * da dona e se a versão satisfaz a faixa. Um id trocado passava aqui e era recusado no escritório de
 * quem instala, que é o lugar em que ninguém pode consertá-lo.
 */
export const crossRefFindings = (pkg: MarketplacePlugin, read: WorkspaceCatalog): CrossRefFinding[] => {
  const snapshot = read.installed;
  const listedThere = new Map((snapshot?.extensions ?? []).map((one) => [one.id, one]));
  const surfaces = new Map(referenceableArtifacts(read).map((one) => [one.ref, one]));

  // O nome do artefato que escreveu a referência é do PACOTE, e pode ser uma chave: quem aponta o
  // passo para outra extensão é um fluxo, e fluxo tem nome que alguém lê.
  const describe = packageText(pkg);

  return crossExtensionRefChecks(pkg, knownOwners(read)).map((check): CrossRefFinding => {
    const head = {
      ref: check.ref.id,
      kind: describeMessage(REF_KIND_KEYS[check.ref.kind]),
      /**
       * `origin` é uma referência que pode ter PARÂMETRO: a de passo é `step "{step}" of automation`,
       * e o `{step}` chega como parâmetro IRMÃO, do mesmo jeito que a recusa do kernel o monta
       * (`refusal` em `pluginReferences.ts`). Resolvê-la sem os parâmetros imprimia o `{step}` cru
       * para o autor — e a referência dentro de um passo é justamente o caso em que ele precisa saber
       * QUAL passo, num fluxo com dois laços de cinco.
       */
      writtenBy: `${describeMessage(
        check.ref.from.origin,
        check.ref.from.step === undefined ? undefined : { step: check.ref.from.step },
      )} "${describe(check.ref.from.name)}"`,
    };

    if (check.verdict.kind === 'ok') {
      const found = surfaces.get(check.ref.id);
      const where = found?.from === 'workspace'
        ? `the plugin.ts of ${check.pluginId} in this workspace`
        : `${INSTALLED_CATALOG_FILE}, taken ${snapshot?.ageDays ?? '?'} day(s) ago`;
      return { ...head, status: 'ok', detail: `${check.pluginId} exports it, according to ${where}.` };
    }

    if (check.verdict.kind === 'version-unsatisfied' || check.verdict.kind === 'not-exported') {
      const issue = crossRefIssue(pkg, check);
      return {
        ...head,
        status: 'refused',
        detail: issue === null ? '' : describeMessage(issue.message, issue.messageParams),
      };
    }

    const owner = listedThere.get(check.pluginId);
    if (owner !== undefined) {
      return {
        ...head,
        status: 'unverifiable',
        detail: `${check.pluginId} IS installed in ${snapshot?.tenantName}, but the snapshot does not record what it `
          + 'exports — it was taken by a Console older than that field. Whether this reference resolves cannot be '
          + `told from here. ${refreshInstalledCatalog(snapshot?.tenantId ?? '<tenantId>')}.`,
      };
    }

    if (snapshot === null) {
      return {
        ...head,
        status: 'unverifiable',
        detail: `${check.pluginId} is not authored in this workspace, and there is no ${INSTALLED_CATALOG_FILE} here, `
          + 'so whether it is installed — and whether it exports this artifact — cannot be told from here. '
          + `${refreshInstalledCatalog()} — or author it beside this package.`,
      };
    }

    return {
      ...head,
      status: 'absent-there',
      detail: `${check.pluginId} is not installed in ${snapshot.tenantName}, as of the snapshot taken `
        + `${snapshot.ageDays ?? '?'} day(s) ago, and is not authored here either. Installing this package THERE would `
        + 'be refused. If it is meant for another organization, that is not a defect in the package.',
    };
  });
};

/**
 * O relatório, a partir do diretório — a porta que o terminal e o servidor MCP usam.
 *
 * O catálogo só é lido quando o pacote aponta para fora: conferir um pacote que não referencia
 * ninguém não paga o preço de compilar todos os `plugin.ts` do diretório. Referência qualificada ao
 * PRÓPRIO pacote não conta, e não precisa: `validatePackage` já a recusa com `issue.ref.self`.
 */
export const crossRefReport = (pkg: MarketplacePlugin, root: string): CrossRefFinding[] =>
  referencedExtensionIds(pkg).length === 0 ? [] : crossRefFindings(pkg, readWorkspaceCatalog(root));
