import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { parseArtifactRef } from '../../schema/plugin/artifactRef';
import { dependencyRange } from '../../schema/plugin/pluginManifest';
import { satisfiesRange } from '../../schema/plugin/semver';
import type { LocalizedIssue } from './pluginReferences';
import { REF_KIND_KEYS, packageOutRefs } from './pluginReferences';

/** O que o portão precisa saber de cada extensão que o escritório já tem. */
export interface InstalledExtensionSummary {
  id: string;
  version: string;
  exports?: string[];
}

/**
 * O PORTÃO da referência a outra extensão, cobrado na instalação.
 *
 * `validatePackage` confere o que dá para conferir com um pacote na mão: a forma da referência e a
 * dependência declarada. O que ela não alcança é o outro lado — se a extensão dona está instalada,
 * se a versão dela satisfaz a faixa, e se o `sourceId` está mesmo no `exports` dela. Essas três
 * respostas só existem onde se enxerga o escritório, e é por isso que elas moram aqui.
 *
 * **Falha FECHADA.** Uma referência que não resolve recusa a instalação em vez de instalar um passo
 * que só vai falar na primeira execução — meses depois, num log, com um nome que não diz de quem é.
 * O `PluginHost` já recusa CARREGAR a extensão cuja dependência falta; o que faltava era recusar o
 * gesto que a coloca lá.
 *
 * Extensão instalada porém DESLIGADA passa: o artefato dela continua sendo documento do escritório e
 * continua existindo. Quem avisa que nada disso está no ar é o `PluginHost`, com
 * `dependency.disabled` — recusar aqui repetiria o recado no lugar errado.
 */
export const crossExtensionRefIssues = (
  pkg: MarketplacePlugin,
  installed: readonly InstalledExtensionSummary[],
): LocalizedIssue[] => {
  const dependencies = pkg.manifest.dependencies ?? {};
  const byId = new Map(installed.map((extension) => [extension.id, extension]));
  const issues: LocalizedIssue[] = [];
  const seen = new Set<string>();

  for (const ref of packageOutRefs(pkg)) {
    const qualified = parseArtifactRef(ref.id);
    if (!qualified || ref.kind === 'screen') continue;
    // O mesmo artefato referenciado por dois passos é um problema só: o autor conserta uma coisa.
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);

    const owner = byId.get(qualified.pluginId);
    if (!owner) {
      issues.push({
        message: '@core.marketplace/install.dependency-missing',
        messageParams: { plugin: qualified.pluginId, kind: REF_KIND_KEYS[ref.kind], id: qualified.artifactId },
      });
      continue;
    }

    const range = dependencies[qualified.pluginId] === undefined
      ? undefined
      : dependencyRange(dependencies[qualified.pluginId]);
    if (range !== undefined && !satisfiesRange(owner.version, range)) {
      issues.push({
        message: '@core.marketplace/diagnostic.dependency.unsatisfied',
        messageParams: {
          id: pkg.manifest.id,
          dependency: qualified.pluginId,
          range,
          installed: owner.version,
        },
      });
      continue;
    }

    if (!(owner.exports ?? []).includes(qualified.artifactId)) {
      issues.push({
        message: '@core.marketplace/issue.ref.not-exported',
        messageParams: {
          origin: ref.from.origin,
          name: ref.from.name,
          kind: REF_KIND_KEYS[ref.kind],
          id: ref.id,
          plugin: qualified.pluginId,
        },
      });
    }
  }

  return issues;
};

/** O que o portão precisa saber de cada extensão que já aponta para a que está sendo aplicada. */
export interface DependentExtension {
  id: string;
  package: MarketplacePlugin;
}

/** Os `sourceId` que o pacote traz — o `templateId` de um artefato de id gerado É o `sourceId` dele. */
const providedArtifactIds = (pkg: MarketplacePlugin): Set<string> => new Set([
  ...pkg.workflows.map((template) => template.templateId),
  ...(pkg.actions ?? []).map((template) => template.templateId),
  ...(pkg.scripts ?? []).map((template) => template.templateId),
]);

/**
 * O MESMO portão, no sentido inverso: a versão que chega pode ter deixado de trazer um artefato que
 * outra extensão instalada referencia.
 *
 * **Por que a atualização era o caminho perigoso, e não a desinstalação.** `applyPackageArtifacts`
 * converge, e converger inclui remover o que sumiu do pacote (`releaseVanishedGeneratedArtifacts`):
 * a extensão dona deixa de ser dona do artefato, e ele é apagado quando não sobra dona nenhuma. O
 * dependente continua instalado, ligado e carregado — nada o tira do ar, porque a dependência dele
 * não sumiu, só o artefato —, e a falha só aparece na primeira execução do passo. Na desinstalação o
 * `PluginHost` ao menos recusa carregar o dependente, com `dependency.missing` na tela.
 *
 * **Perder o DONO já basta para quebrar**, ainda que o documento sobreviva por ter outra dona:
 * `findByRef` casa `sourceId` E dono, então um artefato que uma terceira extensão mantém vivo deixa
 * de atender `com.a/x` no instante em que `com.a` sai dos donos dele.
 *
 * **Dependente DESLIGADO conta.** Ele não está rodando, mas a referência segue gravada no passo
 * dele, e deixar passar trocaria a recusa de agora pela mesma falha silenciosa no dia em que o
 * escritório o religasse — que é exatamente o que este portão existe para não fazer.
 *
 * O que ele NÃO cobra é o `exports` que encolheu com o artefato ainda no pacote: ali nada quebra em
 * execução — a resolução é por `sourceId` e dono, nunca pela lista —, e o estreitamento do contrato
 * é cobrado de quem depende, no próximo gesto dele, por `issue.ref.not-exported`.
 */
export const dependentRefIssues = (
  incoming: MarketplacePlugin,
  dependents: readonly DependentExtension[],
): LocalizedIssue[] => {
  const pluginId = incoming.manifest.id;
  const provided = providedArtifactIds(incoming);
  const issues: LocalizedIssue[] = [];
  const seen = new Set<string>();

  for (const dependent of dependents) {
    if (dependent.id === pluginId) continue;
    for (const ref of packageOutRefs(dependent.package)) {
      const qualified = parseArtifactRef(ref.id);
      if (!qualified || ref.kind === 'screen') continue;
      if (qualified.pluginId !== pluginId || provided.has(qualified.artifactId)) continue;
      // Dois passos do mesmo dependente apontando para o mesmo artefato são um problema só.
      const seenKey = `${dependent.id} ${ref.id}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);

      issues.push({
        message: '@core.marketplace/install.dependent-breaks',
        messageParams: {
          dependent: dependent.id,
          origin: ref.from.origin,
          name: ref.from.name,
          kind: REF_KIND_KEYS[ref.kind],
          id: qualified.artifactId,
        },
      });
    }
  }

  return issues;
};
