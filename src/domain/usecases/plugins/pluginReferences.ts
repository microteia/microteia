import type {
  ActionModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScreenPatchTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';
import type { ReportModuleTemplate } from '../../entities/Report';
import type { InputMapping, WorkflowStep } from '../../entities/Workflow';
import { flattenSteps } from '../../services/stepTree';
import { getEntityByCollection, getEntityByEventPrefix } from '../../schema/entityRegistry';
import { splitChildRecordEventName, splitEntityEventName } from '../../schema/eventCatalog';
import { isLookupCollection } from '../../schema/lookupRegistry';
import { hasRefSeparator, parseArtifactRef } from '../../schema/plugin/artifactRef';
import { dependencyCollections } from '../../schema/plugin/pluginManifest';
import { validateMigrations } from '../../schema/plugin/migration';
import { validateReportSpecShape } from '../../schema/report/validateReportSpec';
import { deriveReportRequires } from '../../schema/report/reportCapabilities';
import { packageAggregationIssues } from './pluginAggregations';
import { packageDocumentTemplateIssues } from './pluginDocumentTemplates';
import { packagePortalIssues } from './pluginPortal';
import { packageEditWindowIssues } from './pluginEditWindow';
import { packageMemberVisibilityIssues } from './pluginMemberVisibility';
import { packageLookupSeedIssues } from './pluginLookupSeeds';
import { packageIconIssues } from './pluginIcons';
import { packageActionIssues } from './pluginActions';
import { packageImageIssues } from './pluginImage';
import { packageSurfaceIssues } from './pluginSurfaces';
import { packageSettingsIssues, settingsOutRefs } from './pluginSettings';
import { packagePrefixIssues } from './pluginPrefix';
import { screenEventPrefix, templateCollection } from './screenModule';

export type RefKind = 'screen' | 'lookup' | 'action' | 'workflow' | 'script';

/**
 * De onde a referência partiu, em duas partes: `origin` é uma REFERÊNCIA de mensagem — "a ação",
 * "a automação" —, e `name` é o nome que o escritório deu ao artefato, que nunca traduz.
 *
 * `step` é o passo dentro da automação, e existe porque a recusa passou a alcançar QUALQUER
 * profundidade da árvore: num fluxo com dois laços de cinco passos, "a automação X referencia o
 * script Y" manda o autor procurar. Ele não muda a forma de nenhuma mensagem — entra pelo `origin`,
 * que é uma referência aninhada e recebe os parâmetros IRMÃOS da mensagem que o embrulha.
 */
export interface RefOrigin {
  origin: string;
  name: string;
  step?: string;
}

export interface PackageRef {
  kind: RefKind;
  /** `key` de template (screen), coleção (lookup) ou `templateId` (action/workflow/script). */
  id: string;
  from: RefOrigin;
  /**
   * A referência nasceu do GATILHO, e o `id` é um PREFIXO DE EVENTO que nenhuma tela do pacote emite
   * e que não é do kernel. Ele coincide com a chave da tela só quando ela não declara `eventPrefix`;
   * `case.saved` é emitido pela tela de coleção `cases`. Quem resolve é a tela de uma dependência
   * declarada — e só quem enxerga as dependências pode dizer qual (`eventRefChecks`).
   */
  event?: boolean;
}

/**
 * Tela e lista são nomeadas pela COLEÇÃO, um nome global — nunca pela forma qualificada
 * `<pluginId>/<id>`, que é a dos artefatos com id gerado. Quem confere `exports` pula as duas.
 */
export const isCollectionRef = (ref: Pick<PackageRef, 'kind'>): boolean =>
  ref.kind === 'screen' || ref.kind === 'lookup';

/** O nome de cada tipo de artefato, como REFERÊNCIA: quem exibe resolve com o catálogo do usuário. */
export const REF_KIND_KEYS: Record<RefKind, string> = {
  screen: '@core.marketplace/ref.kind.screen',
  lookup: '@core.marketplace/ref.kind.lookup',
  action: '@core.marketplace/ref.kind.action',
  workflow: '@core.marketplace/ref.kind.workflow',
  script: '@core.marketplace/ref.kind.script',
};

/** A origem de uma referência que nasceu DENTRO de um passo — resolve com `{step}` na frase. */
export const WORKFLOW_STEP_ORIGIN = '@core.marketplace/ref.origin.workflow-step';

/** A recusa do gatilho cujo prefixo de evento ninguém visível emite. Nomeia o PREFIXO, não uma tela. */
export const EVENT_UNRESOLVED_MESSAGE = '@core.marketplace/issue.ref.event-unresolved';

/**
 * A ÚNICA recusa cujo `{id}` é um identificador local — um alvo que o pacote não leva e que
 * dependência nenhuma cobre. É o que permite a quem tem o escritório em mãos (a tela de autoria)
 * trocar o id pelo nome do artefato antes de mostrar a frase; toda outra recusa já nomeia o que
 * nomeia. Exportada porque a alternativa é a apresentação comparar a chave como texto solto — e foi
 * exatamente por não haver o que comparar que ela passou a discriminar pela presença de `ref`.
 */
export const REF_EXTERNAL_MESSAGE = '@core.marketplace/issue.ref.external';

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
 * próprio nome, marcada como `event`: é o caso legítimo de uma automação que escuta o que OUTRA
 * extensão emite. Quem a resolve é a tela de uma dependência declarada — ver `pendingEventRefs`.
 *
 * A travessia é da ÁRVORE inteira (`flattenSteps`), não da raiz de `steps`. Enquanto era rasa, uma
 * chamada a script ou a outra automação dentro de um laço ou de um ramo não virava referência — e o
 * que não é referência não é recusado por nada aqui. O que nasce de um passo diz QUAL passo; o
 * gatilho não é de passo nenhum, e continua nomeando só a automação.
 */
export const workflowOutRefs = (
  workflow: WorkflowModuleTemplate,
  screens: ScreenModuleTemplate[] = [],
): PackageRef[] => {
  const refs: PackageRef[] = [];
  const from: RefOrigin = { origin: '@core.marketplace/ref.origin.workflow', name: workflow.name };

  for (const step of flattenSteps(workflow.steps)) {
    const stepFrom: RefOrigin = { ...from, origin: WORKFLOW_STEP_ORIGIN, step: step.id };
    const scriptId = stepLiteral(step, SCRIPT_ID_INPUT);
    if (scriptId) refs.push({ kind: 'script', id: scriptId, from: stepFrom });
    const targetWorkflowId = stepLiteral(step, TARGET_WORKFLOW_ID_INPUT);
    if (targetWorkflowId) refs.push({ kind: 'workflow', id: targetWorkflowId, from: stepFrom });
  }
  // O evento de uma nota ou de um documento depende da tela do PAI, como o do próprio registro.
  const child = splitChildRecordEventName(workflow.eventName);
  const event = splitEntityEventName(workflow.eventName) ?? (child ? { prefix: child.parentPrefix } : null);
  if (event) {
    const emitter = screens.find((screen) => screenEventPrefix(screen) === event.prefix);
    if (emitter) refs.push({ kind: 'screen', id: emitter.key, from });
    else if (!isCoreCollection(event.prefix) && !getEntityByEventPrefix(event.prefix)) {
      refs.push({ kind: 'screen', id: event.prefix, from, event: true });
    }
  }
  return refs;
};

/**
 * A referência de saída de um RELATÓRIO: a coleção que ele cobre.
 *
 * Sem esta perna o relatório viaja apontando para uma coleção que o pacote não leva nem declara em
 * `dependencies`, e a falha aparece SÓ no escritório do cliente — um relatório que abre vazio, sem
 * nada acusando por quê. É a perna quase sempre esquecida, e é a razão de o portão do pacote existir.
 *
 * Coleção do kernel ou lista de opções não vira referência, pelo mesmo `isCoreCollection` que as
 * telas usam: esses nomes são globais e não precisam viajar com ninguém.
 */
export const reportOutRefs = (report: ReportModuleTemplate): PackageRef[] => {
  const table = report.spec?.dataset?.table;
  if (!table || isCoreCollection(table)) return [];
  return [{
    kind: 'screen' as const,
    id: table,
    from: { origin: '@core.marketplace/ref.origin.report', name: report.templateId },
  }];
};

export const packageOutRefs = (pkg: MarketplacePlugin): PackageRef[] => [
  ...(pkg.screens ?? []).flatMap(screenOutRefs),
  ...(pkg.screenPatches ?? []).flatMap(screenPatchOutRefs),
  ...(pkg.actions ?? []).flatMap(actionOutRefs),
  ...(pkg.reports ?? []).flatMap(reportOutRefs),
  ...pkg.workflows.flatMap((workflow) => workflowOutRefs(workflow, pkg.screens ?? [])),
  ...settingsOutRefs(pkg),
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
 * As validações de pacote que não apontam para um artefato — tamanho, fila de migração e ícone. É UMA
 * porta, e é de propósito: export e import compartilham a mesma checagem, e uma validação nova
 * acrescentada aqui não precisa ser lembrada em cada chamador.
 */
/**
 * Os relatórios do pacote, conferidos pela FORMA.
 *
 * A terceira porta do mesmo validador: a autoria confere antes de salvar, a callable antes de
 * executar, e o empacotamento aqui. Sem esta, um relatório que cita uma dimensão que ele não declara
 * viaja no pacote e só falha no escritório do cliente — e a falha é um relatório que não abre, sem
 * nada dizendo por quê.
 *
 * Só a forma, e não o esquema: no empacotamento não EXISTE escritório, não há `SchemaContext` e não
 * pode haver. Caminho é conferido onde o esquema existe.
 *
 * Aviso não reprova: uma dobra que este kernel degrada, ou um balde que ele não conhece, é um
 * relatório que roda — recusá-lo no pacote contradiria a própria regra da degradação.
 */
const packageReportIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.reports ?? []).flatMap((report) => [
    ...validateReportSpecShape(report.spec ?? { v: 0 } as never)
      .filter((issue) => (issue.severity ?? 'error') === 'error')
      .map((issue) => ({
        message: '@core.marketplace/issue.report.invalid',
        messageParams: {
          name: report.templateId,
          field: issue.field,
          detail: issue.error,
          ...(issue.errorParams ?? {}),
        },
      })),
    ...underDeclaredCapabilities(report),
  ]);

/**
 * O `requires` escrito à MENOS — a única forma de escapar do portão de capacidade.
 *
 * `unsupportedReportCapabilities` prefere o `requires` declarado à derivação, e é isso que faz um
 * `requires` omisso valer mais que a verdade do spec: o kernel deixa de recusar pelo nome do recurso
 * que lhe falta e passa a executar o relatório sem ele. O comentário do `ReportSpec` já dizia que o
 * portão do pacote reprovava a divergência; ele não reprovava, e este é o portão.
 *
 * Só a omissão. Token A MAIS não é defeito: é o pacote escrito num SDK que deriva mais do que este
 * kernel — e o caminho correto para ele já existe, que é o kernel recusar o relatório pelo nome da
 * capacidade que não tem, no lugar de o pacote inteiro ser recusado aqui.
 */
const underDeclaredCapabilities = (report: ReportModuleTemplate): LocalizedIssue[] => {
  const declared = report.spec?.requires;
  if (!declared || declared.length === 0) return [];

  const known = new Set(declared);
  return deriveReportRequires(report.spec)
    .filter((capability) => !known.has(capability))
    .map((capability) => ({
      message: '@core.marketplace/issue.report.requires',
      messageParams: { name: report.templateId, capability },
    }));
};

export const packageIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => [
  ...packageSizeIssues(pkg),
  ...packageMigrationIssues(pkg),
  ...packageIconIssues(pkg),
  ...packageActionIssues(pkg),
  ...packageImageIssues(pkg),
  ...packageSurfaceIssues(pkg),
  ...packageSettingsIssues(pkg),
  ...packageReportIssues(pkg),
  ...packageAggregationIssues(pkg),
  ...packageDocumentTemplateIssues(pkg),
  ...packagePortalIssues(pkg),
  ...packageEditWindowIssues(pkg),
  ...packageMemberVisibilityIssues(pkg),
  ...packageLookupSeedIssues(pkg),
  ...packagePrefixIssues(pkg),
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
 * O que cobre uma referência a TELA sem sair do pacote: a chave dele, a coleção que uma tela dele
 * descreve (`dataCollection`), ou o que as dependências declaram trazer — a coleção pelo nome GLOBAL,
 * ou a chave namespaced `<slug-do-plugin>__x`.
 *
 * Uma entidade que saiu do kernel mantém o nome global (`persons`) — não ganha o prefixo da extensão
 * que a descreve, senão os registros mudariam de lugar —, então é a declaração que liga o nome à
 * extensão que o instala.
 */
const screenCoverage = (pkg: MarketplacePlugin): ((id: string) => boolean) => {
  const screenKeys = new Set((pkg.screens ?? []).flatMap((s) => [s.key, templateCollection(s)]));
  const dependencies = Object.entries(pkg.manifest.dependencies ?? {});
  const dependencySlugs = dependencies.map(([id]) => slug(id));
  const dependencyCollectionNames = new Set(
    dependencies.flatMap(([, dependency]) => dependencyCollections(dependency)),
  );
  return (id) =>
    screenKeys.has(id)
    || dependencyCollectionNames.has(id)
    || dependencySlugs.some((depSlug) => id.startsWith(`${depSlug}__`));
};

/**
 * O que cobre uma referência a LISTA DE OPÇÕES: as que o pacote declara em `lookups`, as que as
 * dependências declaram trazer, e a chave namespaced de uma dependência. Uma lista do kernel nem
 * chega a virar referência.
 */
const lookupCoverage = (pkg: MarketplacePlugin): ((id: string) => boolean) => {
  const declared = new Set((pkg.lookups ?? []).map((lookup) => lookup.collection));
  const dependencies = Object.entries(pkg.manifest.dependencies ?? {});
  const dependencySlugs = dependencies.map(([id]) => slug(id));
  const dependencyCollectionNames = new Set(
    dependencies.flatMap(([, dependency]) => dependencyCollections(dependency)),
  );
  return (id) =>
    declared.has(id)
    || dependencyCollectionNames.has(id)
    || dependencySlugs.some((depSlug) => id.startsWith(`${depSlug}__`));
};

/**
 * Os gatilhos que o pacote SOZINHO não resolve: o prefixo não é de tela dele, nem do kernel, nem de
 * nome que as dependências declaram trazer. Quem emite `case.saved` é a tela de coleção `cases`, e
 * `case` não é coleção de ninguém — a resposta mora no pacote da DEPENDÊNCIA, que não está em mãos.
 *
 * Com dependência declarada, `validatePackage` cala e deixa a pergunta a quem enxerga o outro lado:
 * a instalação, que tem os pacotes instalados (`crossExtensionRefIssues`), e o `check`, que tem o
 * workspace e o retrato (`eventRefReport`). Sem dependência nenhuma não há a quem perguntar, e a
 * recusa é dele. Um prefixo por automação: o autor conserta uma coisa.
 */
export const pendingEventRefs = (pkg: MarketplacePlugin): PackageRef[] => {
  const covered = screenCoverage(pkg);
  const seen = new Set<string>();
  return packageOutRefs(pkg).filter((ref) => {
    if (!ref.event || covered(ref.id)) return false;
    const seenKey = `${ref.from.name} ${ref.id}`;
    if (seen.has(seenKey)) return false;
    seen.add(seenKey);
    return true;
  });
};

/** A recusa de um gatilho cujo prefixo ninguém visível emite — a mesma frase no pacote e na instalação. */
export const eventUnresolvedIssue = (ref: PackageRef): PackageValidationIssue => ({
  ref,
  message: EVENT_UNRESOLVED_MESSAGE,
  messageParams: { origin: ref.from.origin, name: ref.from.name, prefix: ref.id },
});

/**
 * Valida a integridade referencial de um pacote — a MESMA checagem no export (dry-run) e no import.
 * Toda referência de saída precisa estar: (1) incluída no pacote, (2) numa coleção fixa do core,
 * (3) coberta por uma dependência declarada (para TELA, pelo nome global da coleção ou pela chave
 * namespaced `<slug-do-plugin>__x`), ou (4) escrita na forma QUALIFICADA `<pluginId>/<sourceId>`,
 * apontando para uma extensão que está em `dependencies`.
 *
 * O que esta porta NÃO consegue conferir, e por quê: se o `sourceId` está mesmo no `exports` da
 * extensão dona. Aqui só existe um pacote, e o manifesto do outro não está em mãos — quem cobra isso
 * é o portão da instalação, que enxerga o que o escritório tem instalado, e o `check` do terminal,
 * que enxerga o retrato do Console.
 */
export const validatePackage = (pkg: MarketplacePlugin): PackageValidationIssue[] => {
  const screenKeys = new Set((pkg.screens ?? []).map((s) => s.key));
  const actionIds = new Set((pkg.actions ?? []).map((a) => a.templateId));
  const workflowIds = new Set(pkg.workflows.map((w) => w.templateId));
  const scriptIds = new Set((pkg.scripts ?? []).map((s) => s.templateId));
  const dependencyIds = new Set(Object.keys(pkg.manifest.dependencies ?? {}));
  const screenCovered = screenCoverage(pkg);
  const lookupCovered = lookupCoverage(pkg);

  const bundled = (ref: PackageRef): boolean => {
    switch (ref.kind) {
      case 'screen': return screenCovered(ref.id);
      case 'lookup': return lookupCovered(ref.id);
      case 'action': return actionIds.has(ref.id);
      case 'workflow': return workflowIds.has(ref.id);
      case 'script': return scriptIds.has(ref.id);
    }
  };

  const refusal = (
    ref: PackageRef,
    message: string,
    extra: Record<string, string> = {},
  ): PackageValidationIssue => ({
    ref,
    message,
    messageParams: {
      origin: ref.from.origin,
      name: ref.from.name,
      ...(ref.from.step ? { step: ref.from.step } : {}),
      kind: REF_KIND_KEYS[ref.kind],
      id: ref.id,
      ...extra,
    },
  });

  /**
   * O veredito de UMA referência. A forma qualificada é decidida primeiro porque os dois espaços de
   * nomes são disjuntos: um id de artefato nunca contém `/`, então quem tem barra só pode estar
   * tentando apontar para fora — e distinguir "apontou para fora" de "digitou errado" é justamente
   * o que a recusa genérica de antes não sabia fazer.
   */
  const refIssue = (ref: PackageRef): PackageValidationIssue | undefined => {
    const qualified = parseArtifactRef(ref.id);
    if (qualified) {
      // A identidade de uma tela é o nome da coleção, e `com.x/produtos` não é um nome de coleção.
      if (ref.kind === 'screen') return refusal(ref, '@core.marketplace/issue.ref.screen-qualified');
      if (ref.kind === 'lookup') return refusal(ref, '@core.marketplace/issue.ref.lookup-qualified');
      if (qualified.pluginId === pkg.manifest.id) return refusal(ref, '@core.marketplace/issue.ref.self');
      if (!dependencyIds.has(qualified.pluginId)) {
        return refusal(ref, '@core.marketplace/issue.ref.undeclared', { plugin: qualified.pluginId });
      }
      return undefined;
    }
    if (hasRefSeparator(ref.id)) return refusal(ref, '@core.marketplace/issue.ref.malformed');
    if (bundled(ref)) return undefined;
    // O gatilho que escuta outra extensão: com dependência declarada, a resposta está no pacote dela
    // e é dada por quem o enxerga; sem nenhuma, não há onde procurar.
    if (ref.event) return dependencyIds.size === 0 ? eventUnresolvedIssue(ref) : undefined;
    return refusal(ref, REF_EXTERNAL_MESSAGE);
  };

  const screenSourceIds = new Set((pkg.screens ?? []).map((s) => s.sourceId ?? s.key));
  const targetIssues = (pkg.screenPatches ?? [])
    .map((patch) => patchTargetIssue(patch, screenKeys, screenSourceIds))
    .filter((issue): issue is PackageValidationIssue => issue !== undefined);

  return [
    ...targetIssues,
    ...eventPrefixIssues(pkg.screens ?? []),
    ...packageOutRefs(pkg)
      .map(refIssue)
      .filter((issue): issue is PackageValidationIssue => issue !== undefined),
  ];
};
