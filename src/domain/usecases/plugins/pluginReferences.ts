import type {
  ActionModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScreenPatchTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';
import type { InputMapping, WorkflowStep } from '../../entities/Workflow';
import { getEntityByCollection, getEntityByEventPrefix } from '../../schema/entityRegistry';
import { splitEntityEventName } from '../../schema/eventCatalog';
import { isLookupCollection } from '../../schema/lookupRegistry';
import { dependencyCollections } from '../../schema/plugin/pluginManifest';
import { validateMigrations } from '../../schema/plugin/migration';
import { screenEventPrefix, templateCollection } from './screenModule';

export type RefKind = 'screen' | 'action' | 'workflow' | 'script';

/**
 * De onde a referência partiu, em duas partes: `origin` é uma REFERÊNCIA de mensagem — "a ação",
 * "a automação" —, e `name` é o nome que o escritório deu ao artefato, que nunca traduz.
 */
export interface RefOrigin {
  origin: string;
  name: string;
}

export interface PackageRef {
  kind: RefKind;
  /** `key` de template (screen) ou `templateId` (action/workflow/script). */
  id: string;
  from: RefOrigin;
}

/** O nome de cada tipo de artefato, como REFERÊNCIA: quem exibe resolve com o catálogo do usuário. */
export const REF_KIND_KEYS: Record<RefKind, string> = {
  screen: '@core.marketplace/ref.kind.screen',
  action: '@core.marketplace/ref.kind.action',
  workflow: '@core.marketplace/ref.kind.workflow',
  script: '@core.marketplace/ref.kind.script',
};

/** Ids de input de Step que guardam referências a outros artefatos (Literal com o id). */
export const SCRIPT_ID_INPUT = 'scriptId';
export const TARGET_WORKFLOW_ID_INPUT = 'targetWorkflowId';

export const isCoreCollection = (name: string): boolean =>
  getEntityByCollection(name) !== undefined || isLookupCollection(name);

const literalValue = (mapping: InputMapping | undefined): string | null =>
  mapping && mapping.kind === 'Literal' && typeof mapping.value === 'string' && mapping.value.trim() !== ''
    ? mapping.value
    : null;

const stepLiteral = (step: WorkflowStep, inputId: string): string | null =>
  literalValue(step.configuration?.[inputId]);

export const screenOutRefs = (screen: ScreenModuleTemplate): PackageRef[] => {
  const refs: PackageRef[] = [];
  const from: RefOrigin = { origin: '@core.marketplace/ref.origin.screen', name: screen.key };

  for (const actionId of [...(screen.viewActionIds ?? []), ...(screen.cardActionIds ?? [])]) {
    refs.push({ kind: 'action', id: actionId, from });
  }

  const screenTargets = [
    screen.parentEntity,
    ...screen.fields.map((f) => f.refEntity),
    ...screen.fields.map((f) => f.aggregation?.from),
  ].filter((value): value is string => Boolean(value));

  for (const target of screenTargets) {
    if (!isCoreCollection(target)) refs.push({ kind: 'screen', id: target, from });
  }
  return refs;
};

/**
 * As referências de saída dos CAMPOS de um complemento. O alvo não entra aqui: ele não é uma
 * referência a artefato do pacote, e sim o ponto de acoplamento — conferido por `patchTargetIssue`.
 */
export const screenPatchOutRefs = (patch: ScreenPatchTemplate): PackageRef[] => {
  const from: RefOrigin = { origin: '@core.marketplace/ref.origin.patch', name: patch.target };
  const refs: PackageRef[] = [];

  const targets = [
    ...patch.fields.map((field) => field.refEntity),
    ...patch.fields.map((field) => field.aggregation?.from),
  ].filter((value): value is string => Boolean(value));

  for (const target of targets) {
    if (!isCoreCollection(target)) refs.push({ kind: 'screen', id: target, from });
  }
  for (const actionId of [...(patch.viewActionIds ?? []), ...(patch.cardActionIds ?? [])]) {
    refs.push({ kind: 'action', id: actionId, from });
  }
  return refs;
};

export const actionOutRefs = (action: ActionModuleTemplate): PackageRef[] =>
  action.workflowId
    ? [{
        kind: 'workflow' as const,
        id: action.workflowId,
        from: { origin: '@core.marketplace/ref.origin.action', name: action.key },
      }]
    : [];

/**
 * O gatilho de um workflow é uma referência a uma TELA — por isso entra aqui. Mas o nome do evento
 * não é a chave dela: quem declara `eventPrefix` (ou descreve outra coleção) emite por um nome
 * próprio. A tela é achada pelo que cada uma EMITE (`screenEventPrefix`), e a referência aponta a
 * chave dela; supor que prefixo e chave são a mesma palavra acusaria uma tela inexistente.
 *
 * Prefixo que nenhuma tela do pacote emite e que não é do kernel continua virando referência pelo
 * próprio nome: é o caso legítimo de uma automação que dispara com algo que o pacote não leva.
 */
export const workflowOutRefs = (
  workflow: WorkflowModuleTemplate,
  screens: ScreenModuleTemplate[] = [],
): PackageRef[] => {
  const refs: PackageRef[] = [];
  const from: RefOrigin = { origin: '@core.marketplace/ref.origin.workflow', name: workflow.name };

  for (const step of workflow.steps ?? []) {
    const scriptId = stepLiteral(step, SCRIPT_ID_INPUT);
    if (scriptId) refs.push({ kind: 'script', id: scriptId, from });
    const targetWorkflowId = stepLiteral(step, TARGET_WORKFLOW_ID_INPUT);
    if (targetWorkflowId) refs.push({ kind: 'workflow', id: targetWorkflowId, from });
  }
  const event = splitEntityEventName(workflow.eventName);
  if (event) {
    const emitter = screens.find((screen) => screenEventPrefix(screen) === event.prefix);
    if (emitter) refs.push({ kind: 'screen', id: emitter.key, from });
    else if (!isCoreCollection(event.prefix) && !getEntityByEventPrefix(event.prefix)) {
      refs.push({ kind: 'screen', id: event.prefix, from });
    }
  }
  return refs;
};

export const packageOutRefs = (pkg: MarketplacePlugin): PackageRef[] => [
  ...(pkg.screens ?? []).flatMap(screenOutRefs),
  ...(pkg.screenPatches ?? []).flatMap(screenPatchOutRefs),
  ...(pkg.actions ?? []).flatMap(actionOutRefs),
  ...pkg.workflows.flatMap((workflow) => workflowOutRefs(workflow, pkg.screens ?? [])),
];

/**
 * O texto de um problema do pacote como REFERÊNCIA de mensagem (`@core.marketplace/…`), nunca a
 * frase pronta: a validação nasce no domínio, que não conhece idioma. Quem exibe resolve os dois.
 */
export interface LocalizedIssue {
  message: string;
  messageParams?: Record<string, string>;
}

export interface PackageValidationIssue extends LocalizedIssue {
  ref: PackageRef;
}

const slug = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

/**
 * O alvo de um complemento precisa ser universal — igual em todo escritório. Por nome, só coleção
 * fixa do core (`contracts`): a chave de uma tela do tenant de destino não é conhecida no pacote, e a
 * de uma tela do próprio pacote seria ambígua (os campos pertencem à tela, e não a um complemento).
 * Para estender a tela de OUTRA extensão, o alvo é o `sourceId` universal dela, que não dá para
 * conferir aqui — se ela não estiver instalada, o complemento simplesmente não se aplica.
 */
const patchTargetIssue = (
  patch: ScreenPatchTemplate,
  screenKeys: ReadonlySet<string>,
  screenSourceIds: ReadonlySet<string>,
): PackageValidationIssue | undefined => {
  const ref: PackageRef = {
    kind: 'screen',
    id: patch.target,
    from: { origin: '@core.marketplace/ref.origin.patch', name: patch.target },
  };
  const ownScreen = (patch.targetKind ?? 'collection') === 'sourceId'
    ? screenSourceIds.has(patch.target)
    : screenKeys.has(patch.target);
  if (ownScreen) {
    return {
      ref,
      message: '@core.marketplace/issue.patch.own-screen',
      messageParams: { target: patch.target },
    };
  }
  if ((patch.targetKind ?? 'collection') === 'sourceId') return undefined;
  if (!isCoreCollection(patch.target)) {
    return {
      ref,
      message: '@core.marketplace/issue.patch.unknown-target',
      messageParams: { target: patch.target },
    };
  }
  return undefined;
};

/**
 * O prefixo de eventos é um nome GLOBAL, como a coleção: quem escuta `case.saved` não sabe — nem
 * pode saber — qual extensão publica. Daí as três checagens:
 *
 * - **Nome que o motor não lê.** `lookup`, `workflow` e os eventos de filho (`person_note`) são
 *   dele; uma tela que emitisse por esses nomes nunca teria o gatilho resolvido.
 * - **Prefixo que já é do kernel.** Uma tela `medico` declarando `person` faria toda gravação de
 *   médico disparar as automações de Pessoa do escritório. Declarar o prefixo da PRÓPRIA coleção
 *   fixa é o oposto: é a continuidade que deixa uma entidade sair do kernel sem renomear eventos.
 * - **Duas telas, um nome.** Só é colisão quando as coleções são diferentes — duas telas sobre a
 *   MESMA coleção emitindo o mesmo evento é o esperado, há um só fluxo de dados ali.
 */
const eventPrefixIssues = (screens: ScreenModuleTemplate[]): PackageValidationIssue[] => {
  const issues: PackageValidationIssue[] = [];
  const collectionByPrefix = new Map<string, string>();

  for (const screen of screens) {
    const prefix = screenEventPrefix(screen);
    const collection = templateCollection(screen);
    const ref: PackageRef = {
      kind: 'screen',
      id: screen.key,
      from: { origin: '@core.marketplace/ref.origin.screen', name: screen.key },
    };

    if (!splitEntityEventName(`${prefix}.saved`)) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.screen.reserved-prefix',
        messageParams: { screen: screen.key, prefix },
      });
    }

    const kernelEntity = getEntityByEventPrefix(prefix);
    if (kernelEntity && kernelEntity.collection !== collection) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.screen.kernel-prefix',
        messageParams: { screen: screen.key, prefix, entity: kernelEntity.labelPlural, collection },
      });
    }

    const taken = collectionByPrefix.get(prefix);
    if (taken && taken !== collection) {
      issues.push({
        ref,
        message: '@core.marketplace/issue.screen.duplicate-prefix',
        messageParams: { screen: screen.key, prefix, taken },
      });
    }
    collectionByPrefix.set(prefix, collection);
  }
  return issues;
};

/**
 * O TAMANHO de um pacote, e por que ele passou a importar.
 *
 * Uma extensão instalada é gravada como UM documento (`installed_extensions/{id}`), com o pacote
 * inteiro dentro. O Firestore recusa documento acima de 1 MiB, e a recusa aconteceria na gravação —
 * depois de o usuário ter escolhido o arquivo, com uma mensagem do banco que não explica nada.
 *
 * Até aqui nenhum pacote chegava perto (o maior tem 88 KB). Um pacote de TRADUÇÃO é a primeira coisa
 * capaz de chegar: um idioma completo do sistema são milhares de pares chave/texto. Daí a guarda —
 * o limite vira um recado em português, antes de gravar, com a saída ("divida por idioma") junto.
 */
export const PACKAGE_ADVISORY_BYTES = 400 * 1024;

export const PACKAGE_MAX_BYTES = 800 * 1024;

const packageBytes = (pkg: MarketplacePlugin): number => {
  const json = JSON.stringify(pkg);
  return typeof TextEncoder === 'undefined' ? json.length : new TextEncoder().encode(json).length;
};

const asKb = (bytes: number): string => `${Math.round(bytes / 1024)} KB`;

/** Recusa o pacote grande demais para caber no documento da instalação. Vazio quando cabe. */
export const packageSizeIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const bytes = packageBytes(pkg);
  if (bytes <= PACKAGE_MAX_BYTES) return [];
  return [
    {
      message: '@core.marketplace/issue.package.too-large',
      messageParams: { size: asKb(bytes), limit: asKb(PACKAGE_MAX_BYTES) },
    },
  ];
};

/**
 * Recusa a fila de migração malformada. Não é validação de conteúdo — o que a migração faz com o dado
 * é do autor —, é validação do que impediria a fila de rodar: identidade repetida, versão que não é
 * semver, código com `import` (que o sandbox não resolve), ordem declarada diferente da ordem de
 * execução. Ver `PluginMigration`.
 */
export const packageMigrationIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  validateMigrations(pkg.migrations);

/**
 * As validações de pacote que não apontam para um artefato — tamanho e fila de migração. É UMA porta,
 * e é de propósito: export e import compartilham a mesma checagem, e uma validação nova acrescentada
 * aqui não precisa ser lembrada em cada chamador.
 */
export const packageIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => [
  ...packageSizeIssues(pkg),
  ...packageMigrationIssues(pkg),
];

/** O aviso de que o pacote está grande, mas ainda instala. Para a tela de autoria, não para o import. */
export const packageSizeAdvisory = (pkg: MarketplacePlugin): LocalizedIssue | undefined => {
  const bytes = packageBytes(pkg);
  if (bytes <= PACKAGE_ADVISORY_BYTES || bytes > PACKAGE_MAX_BYTES) return undefined;
  return {
    message: '@core.marketplace/issue.package.near-limit',
    messageParams: { size: asKb(bytes), limit: asKb(PACKAGE_MAX_BYTES) },
  };
};

/**
 * Valida a integridade referencial de um pacote — a MESMA checagem no export (dry-run) e no import.
 * Toda referência de saída precisa estar: (1) incluída no pacote, (2) numa coleção fixa do core, ou
 * (3) coberta por uma dependência declarada (chave namespaced `<slug-do-plugin>__x` de uma
 * `dependencies`). O que sobrar é uma referência pendente — no export, o autor inclui o artefato ou
 * declara a dependência; no import, a instalação é recusada.
 */
export const validatePackage = (pkg: MarketplacePlugin): PackageValidationIssue[] => {
  const screenKeys = new Set((pkg.screens ?? []).map((s) => s.key));
  const actionIds = new Set((pkg.actions ?? []).map((a) => a.templateId));
  const workflowIds = new Set(pkg.workflows.map((w) => w.templateId));
  const scriptIds = new Set((pkg.scripts ?? []).map((s) => s.templateId));
  const dependencies = Object.entries(pkg.manifest.dependencies ?? {});
  const dependencySlugs = dependencies.map(([id]) => slug(id));
  // As coleções que as dependências declaram trazer. Uma entidade que saiu do kernel mantém o nome
  // GLOBAL (`persons`) — não ganha o prefixo da extensão que a descreve, senão os registros mudariam
  // de lugar —, então é a declaração que liga o nome à extensão que o instala.
  const dependencyCollectionNames = new Set(
    dependencies.flatMap(([, dependency]) => dependencyCollections(dependency)),
  );

  const coveredByDependency = (ref: PackageRef): boolean =>
    ref.kind === 'screen'
    && (dependencyCollectionNames.has(ref.id)
      || dependencySlugs.some((depSlug) => ref.id.startsWith(`${depSlug}__`)));

  const bundled = (ref: PackageRef): boolean => {
    switch (ref.kind) {
      case 'screen': return screenKeys.has(ref.id);
      case 'action': return actionIds.has(ref.id);
      case 'workflow': return workflowIds.has(ref.id);
      case 'script': return scriptIds.has(ref.id);
    }
  };

  const screenSourceIds = new Set((pkg.screens ?? []).map((s) => s.sourceId ?? s.key));
  const targetIssues = (pkg.screenPatches ?? [])
    .map((patch) => patchTargetIssue(patch, screenKeys, screenSourceIds))
    .filter((issue): issue is PackageValidationIssue => issue !== undefined);

  return [
    ...targetIssues,
    ...eventPrefixIssues(pkg.screens ?? []),
    ...packageOutRefs(pkg)
      .filter((ref) => !bundled(ref) && !coveredByDependency(ref))
      .map((ref) => ({
        ref,
        message: '@core.marketplace/issue.ref.external',
        messageParams: {
          origin: ref.from.origin,
          name: ref.from.name,
          kind: REF_KIND_KEYS[ref.kind],
          id: ref.id,
        },
      })),
  ];
};
