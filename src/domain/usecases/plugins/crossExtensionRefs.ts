import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { parseArtifactRef } from '../../schema/plugin/artifactRef';
import { dependencyRange } from '../../schema/plugin/pluginManifest';
import { satisfiesRange } from '../../schema/plugin/semver';
import type { LocalizedIssue, PackageRef } from './pluginReferences';
import { REF_KIND_KEYS, eventUnresolvedIssue, isCollectionRef, packageOutRefs, pendingEventRefs } from './pluginReferences';
import { screenEventPrefix } from './screenModule';

/**
 * O TIPO do artefato exportado, e ele não é enfeite: é o que decide ONDE a referência cabe — um
 * script vai em `scriptId`, uma automação em `targetWorkflowId`, uma ação na lista de ações de uma
 * tela. `unknown` é o export declarado que não casa com artefato nenhum do pacote.
 */
export type ExportedArtifactKind = 'workflow' | 'action' | 'script' | 'unknown';

/** Um artefato da superfície pública de um pacote, na forma em que outra extensão o referencia. */
export interface ExportedArtifact {
  /** O `sourceId` — a metade direita de `<pluginId>/<sourceId>`. */
  id: string;
  kind: ExportedArtifactKind;
  name: string;
}

/**
 * A SUPERFÍCIE PÚBLICA de um pacote: cada id de `manifest.exports` casado com o artefato que o
 * atende, para ganhar tipo e nome.
 *
 * É a outra metade do portão abaixo. Ele responde "esta referência resolve?"; esta responde "o que
 * há para referenciar?" — e sem a segunda a primeira só serve a quem já sabia o nome de cor. Um
 * nome que não se enxerga é um nome que não se escreve.
 *
 * Export declarado que não casa com nada fica na lista como `unknown` em vez de sumir: a extensão
 * está prometendo o que não entrega, e esconder isso adia a descoberta para a primeira execução.
 *
 * O que o artefato FAZ nunca entra aqui — passos e código são comportamento. Nome e tipo são
 * contrato.
 */
export const exportedSurface = (pkg: MarketplacePlugin): ExportedArtifact[] => {
  const named = new Map<string, ExportedArtifact>();
  const collect = <T extends { templateId: string }>(
    entries: readonly T[],
    kind: Exclude<ExportedArtifactKind, 'unknown'>,
    nameOf: (one: T) => string,
  ): void => {
    for (const one of entries) {
      if (named.has(one.templateId)) continue;
      named.set(one.templateId, { id: one.templateId, kind, name: nameOf(one) || one.templateId });
    }
  };
  collect(pkg.workflows, 'workflow', (one) => one.name);
  collect(pkg.actions ?? [], 'action', (one) => one.title);
  collect(pkg.scripts ?? [], 'script', (one) => one.name);

  return (pkg.manifest.exports ?? [])
    .map((id) => named.get(id) ?? { id, kind: 'unknown' as const, name: id })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

/** O que o portão precisa saber de cada extensão que o escritório já tem. */
export interface InstalledExtensionSummary {
  id: string;
  version: string;
  exports?: string[];
  /** Os prefixos de evento que as telas dela emitem (`emittedEventPrefixes`). Ausente: nenhum conhecido. */
  eventPrefixes?: readonly string[];
}

/** Os prefixos que as telas de um pacote emitem — é o que o gatilho de OUTRA extensão escuta. */
export const emittedEventPrefixes = (pkg: MarketplacePlugin): string[] =>
  Array.from(new Set((pkg.screens ?? []).map(screenEventPrefix)));

/**
 * O VEREDITO de um gatilho que escuta outra extensão (`pendingEventRefs`), contra as extensões que se
 * enxerga. `undeclared` é o prefixo emitido por uma extensão que o pacote não declara: a instalação
 * não pode contar com ela, e a frase diz qual declarar.
 */
export type EventRefVerdict =
  | { kind: 'ok'; pluginId: string }
  | { kind: 'undeclared'; pluginId: string }
  | { kind: 'unknown' };

export interface EventRefCheck {
  ref: PackageRef;
  prefix: string;
  verdict: EventRefVerdict;
}

/**
 * Cada gatilho pendente, resolvido pelas telas das extensões conhecidas. Uma dependência declarada que
 * emite o prefixo vence qualquer outra emissora: é ela que a instalação garante presente.
 */
export const eventRefChecks = (
  pkg: MarketplacePlugin,
  known: readonly InstalledExtensionSummary[],
): EventRefCheck[] => {
  const declared = new Set(Object.keys(pkg.manifest.dependencies ?? {}));
  const others = known.filter((extension) => extension.id !== pkg.manifest.id);

  return pendingEventRefs(pkg).map((ref): EventRefCheck => {
    const emitters = others.filter((extension) => (extension.eventPrefixes ?? []).includes(ref.id));
    const dependency = emitters.find((extension) => declared.has(extension.id));
    if (dependency) return { ref, prefix: ref.id, verdict: { kind: 'ok', pluginId: dependency.id } };
    if (emitters.length > 0) return { ref, prefix: ref.id, verdict: { kind: 'undeclared', pluginId: emitters[0].id } };
    return { ref, prefix: ref.id, verdict: { kind: 'unknown' } };
  });
};

/** A recusa de um veredito de gatilho, ou `null`. A mesma frase na instalação e no terminal. */
export const eventRefIssue = (check: EventRefCheck): LocalizedIssue | null => {
  const { ref, verdict } = check;
  if (verdict.kind === 'ok') return null;
  if (verdict.kind === 'unknown') {
    const { message, messageParams } = eventUnresolvedIssue(ref);
    return { message, messageParams };
  }
  return {
    message: '@core.marketplace/issue.ref.event-undeclared',
    messageParams: { origin: ref.from.origin, name: ref.from.name, prefix: check.prefix, plugin: verdict.pluginId },
  };
};

/**
 * O VEREDITO de uma referência qualificada contra o que se sabe das extensões do escritório.
 *
 * Ele mora separado da recusa porque um dos quatro casos MUDA de significado conforme quem pergunta:
 * `owner-absent` é recusa na instalação — a dona não está lá — e é "não dá para conferir daqui" no
 * terminal de autoria, onde o catálogo do diretório não é o escritório. Enquanto a decisão e a recusa
 * eram a mesma função, a única forma de o terminal conferir as outras três era reescrevê-las: duas
 * cópias da mesma regra, e uma checagem nova em uma delas nunca chegando à outra.
 */
export type CrossRefVerdict =
  | { kind: 'ok' }
  | { kind: 'owner-absent' }
  | { kind: 'version-unsatisfied'; range: string; installed: string }
  | { kind: 'not-exported' };

export interface CrossRefCheck {
  ref: PackageRef;
  pluginId: string;
  artifactId: string;
  verdict: CrossRefVerdict;
}

/**
 * Cada referência qualificada do pacote, conferida uma vez, na ordem em que aparece.
 *
 * Referência a TELA fica de fora: a identidade dela é o nome da coleção, igual em todo escritório, e
 * por isso ela não passa por `exports`. O mesmo artefato apontado por dois passos é conferido uma
 * vez — o autor conserta uma coisa.
 */
export const crossExtensionRefChecks = (
  pkg: MarketplacePlugin,
  installed: readonly InstalledExtensionSummary[],
): CrossRefCheck[] => {
  const dependencies = pkg.manifest.dependencies ?? {};
  const byId = new Map(installed.map((extension) => [extension.id, extension]));
  const checks: CrossRefCheck[] = [];
  const seen = new Set<string>();

  for (const ref of packageOutRefs(pkg)) {
    const qualified = parseArtifactRef(ref.id);
    if (!qualified || isCollectionRef(ref)) continue;
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);

    const common = { ref, pluginId: qualified.pluginId, artifactId: qualified.artifactId };
    const owner = byId.get(qualified.pluginId);
    if (!owner) {
      checks.push({ ...common, verdict: { kind: 'owner-absent' } });
      continue;
    }

    const range = dependencies[qualified.pluginId] === undefined
      ? undefined
      : dependencyRange(dependencies[qualified.pluginId]);
    if (range !== undefined && !satisfiesRange(owner.version, range)) {
      checks.push({ ...common, verdict: { kind: 'version-unsatisfied', range, installed: owner.version } });
      continue;
    }

    checks.push({
      ...common,
      verdict: (owner.exports ?? []).includes(qualified.artifactId) ? { kind: 'ok' } : { kind: 'not-exported' },
    });
  }

  return checks;
};

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
 * O gatilho que escuta OUTRA extensão (`case.saved`) passa pelo mesmo portão: aqui todo pacote
 * instalado está à vista, e um prefixo que nenhuma dependência declarada emite é recusa — não aviso.
 *
 * Extensão instalada porém DESLIGADA passa: o artefato dela continua sendo documento do escritório e
 * continua existindo. Quem avisa que nada disso está no ar é o `PluginHost`, com
 * `dependency.disabled` — recusar aqui repetiria o recado no lugar errado.
 */
export const crossExtensionRefIssues = (
  pkg: MarketplacePlugin,
  installed: readonly InstalledExtensionSummary[],
): LocalizedIssue[] => [
  ...crossExtensionRefChecks(pkg, installed).map((check) => crossRefIssue(pkg, check)),
  ...eventRefChecks(pkg, installed).map(eventRefIssue),
].filter((issue): issue is LocalizedIssue => issue !== null);

/**
 * A RECUSA de um veredito, ou `null` quando não há o que recusar.
 *
 * Ela é exposta por veredito, e não só em lista, porque quem confere fora da instalação precisa da
 * frase COLADA na referência que a causou — e porque a frase é do kernel: redigi-la de novo no
 * terminal faria o autor ler uma recusa diferente da que o escritório vê na tela.
 */
export const crossRefIssue = (pkg: MarketplacePlugin, check: CrossRefCheck): LocalizedIssue | null => {
  const { ref, pluginId, artifactId, verdict } = check;
  if (verdict.kind === 'ok') return null;
  if (verdict.kind === 'owner-absent') {
    return {
      message: '@core.marketplace/install.dependency-missing',
      messageParams: { plugin: pluginId, kind: REF_KIND_KEYS[ref.kind], id: artifactId },
    };
  }
  if (verdict.kind === 'version-unsatisfied') {
    return {
      message: '@core.marketplace/diagnostic.dependency.unsatisfied',
      messageParams: {
        id: pkg.manifest.id,
        dependency: pluginId,
        range: verdict.range,
        installed: verdict.installed,
      },
    };
  }
  return {
    message: '@core.marketplace/issue.ref.not-exported',
    messageParams: {
      origin: ref.from.origin,
      name: ref.from.name,
      ...(ref.from.step ? { step: ref.from.step } : {}),
      kind: REF_KIND_KEYS[ref.kind],
      id: ref.id,
      plugin: pluginId,
    },
  };
};

/**
 * As extensões que este pacote referencia, na ordem em que aparecem. É o que a autoria precisa para
 * DERIVAR a `dependencies` do manifesto: o autor escolhe o artefato num seletor, nunca digita uma
 * dependência, e sem ela o próprio `validatePackage` recusaria o pacote com `issue.ref.undeclared` —
 * uma recusa que o autor não teria como atender pela tela.
 */
export const referencedExtensionIds = (pkg: MarketplacePlugin): string[] => {
  const ids: string[] = [];
  for (const ref of packageOutRefs(pkg)) {
    const qualified = parseArtifactRef(ref.id);
    if (!qualified || isCollectionRef(ref) || qualified.pluginId === pkg.manifest.id) continue;
    if (!ids.includes(qualified.pluginId)) ids.push(qualified.pluginId);
  }
  return ids;
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
 * O GATILHO de um dependente quebra do mesmo jeito: Pushes escuta `case.saved`, e uma versão de
 * Processos cuja tela deixa de emitir `case` instala, converge, e a automação de Pushes para de
 * disparar — sem erro, porque um evento que ninguém publica não falha, só não acontece. Ver
 * `dependentEventIssues`.
 *
 * O que ele NÃO cobra é o `exports` que encolheu com o artefato ainda no pacote: ali nada quebra em
 * execução — a resolução é por `sourceId` e dono, nunca pela lista —, e o estreitamento do contrato
 * é cobrado de quem depende, no próximo gesto dele, por `issue.ref.not-exported`.
 */
export const dependentRefIssues = (
  incoming: MarketplacePlugin,
  dependents: readonly DependentExtension[],
  previous?: MarketplacePlugin,
): LocalizedIssue[] => [
  ...dependentArtifactIssues(incoming, dependents),
  ...dependentEventIssues(incoming, dependents, previous),
];

const dependentArtifactIssues = (
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
      if (!qualified || isCollectionRef(ref)) continue;
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
          ...(ref.from.step ? { step: ref.from.step } : {}),
          kind: REF_KIND_KEYS[ref.kind],
          id: qualified.artifactId,
        },
      });
    }
  }

  return issues;
};

const emitterSummary = (id: string, pkg: MarketplacePlugin): InstalledExtensionSummary => ({
  id,
  version: pkg.manifest.version,
  eventPrefixes: emittedEventPrefixes(pkg),
});

/**
 * O portão inverso do GATILHO: o prefixo que a versão em mãos deixou de emitir e que um dependente
 * escuta. Só conta o que ESTA troca quebra — o veredito do dependente é calculado com a versão
 * instalada (`previous`) e com a que chega, e recusa apenas o que era `ok` resolvido por ela e deixou
 * de ser. Sem `previous` é instalação nova, e ela não tira prefixo de ninguém.
 *
 * Uma outra dependência declarada que continue emitindo o prefixo mantém o gatilho de pé: é a mesma
 * resolução da instalação, rodada duas vezes, e não uma regra paralela.
 */
const dependentEventIssues = (
  incoming: MarketplacePlugin,
  dependents: readonly DependentExtension[],
  previous: MarketplacePlugin | undefined,
): LocalizedIssue[] => {
  if (previous === undefined) return [];
  const pluginId = incoming.manifest.id;
  const others = dependents.filter((dependent) => dependent.id !== pluginId);
  const summaries = others.map((dependent) => emitterSummary(dependent.id, dependent.package));
  const before = [...summaries, emitterSummary(pluginId, previous)];
  const after = [...summaries, emitterSummary(pluginId, incoming)];

  return others.flatMap((dependent) => {
    const now = eventRefChecks(dependent.package, after);
    return eventRefChecks(dependent.package, before).flatMap((check, index): LocalizedIssue[] => {
      if (check.verdict.kind !== 'ok' || check.verdict.pluginId !== pluginId) return [];
      if (now[index].verdict.kind === 'ok') return [];
      return [{
        message: '@core.marketplace/install.dependent-event-breaks',
        messageParams: {
          dependent: dependent.id,
          origin: check.ref.from.origin,
          name: check.ref.from.name,
          prefix: check.prefix,
        },
      }];
    });
  });
};
