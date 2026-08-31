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
