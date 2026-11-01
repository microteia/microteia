import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import {
  PORTAL_ACTIONS_SINCE_KERNEL,
  PORTAL_DOCUMENT_LINKS_SINCE_KERNEL,
  PORTAL_DOCUMENT_LINK_MAX_MINUTES,
  PORTAL_PUBLIC_SUBJECT_SINCE_KERNEL,
  PORTAL_REFERENCE_TITLES_SINCE_KERNEL,
  PORTAL_TRACK_VIEWS_SINCE_KERNEL,
  PORTAL_VISIBLE_WHEN_SINCE_KERNEL,
  asPortalDeclaration,
  portalActionIssues,
  portalCreateConditionIssues,
  portalDerivedFieldKeys,
  portalPublicConflicts,
  portalReferenceTitleIssues,
  portalVisibilityIssues,
} from '../../schema/portal';
import { rangeExcludesBelow } from '../../schema/plugin/semver';
import { PORTAL_ROLES_SINCE_KERNEL } from '../../schema/portalRole';
import { portalTemplateIssues } from '../../schema/ui/portalTemplateIssues';
import {
  PORTAL_PAGE_SPEC_SINCE_KERNEL,
  PORTAL_WIDGET_SPEC_SINCE_KERNEL,
  portalWidgetMarkdownRefs,
  readPortalWidgetSpec,
} from '../../schema/ui/portalWidget';
import { portalWidgetSpecIssues } from '../../schema/ui/portalWidgetIssues';
import { PORTAL_DECLARED_SURFACES, PORTAL_VIEW_POINT, asPortalViewMetadata } from '../../schema/portalExtensionPoints';
import type { LocalizedIssue } from './pluginReferences';

const fieldsOf = (pkg: MarketplacePlugin, screen: ScreenModuleTemplate) => [
  ...screen.fields,
  ...(pkg.screenPatches ?? [])
    .filter((patch) => patch.target === screen.key || (screen.sourceId !== undefined && patch.target === screen.sourceId))
    .flatMap((patch) => patch.fields),
];

/**
 * O `visibleWhen` das telas do pacote: a sintaxe, os campos citados e o `kernel`.
 *
 * A checagem do `kernel` não é de forma, é de EXPOSIÇÃO: um kernel anterior descarta a chave ao ler a
 * declaração e projeta todos os registros da tela — inclusive os que a extensão quis manter dentro do
 * escritório. Exigir o kernel faz o antigo recusar o pacote em vez de abrir o que não devia.
 */
const visibleWhenIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const filtered = (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    return portal?.visibleWhen ? [{ screen, portal }] : [];
  });

  const condition = filtered.flatMap(({ screen, portal }) =>
    portalVisibilityIssues({ id: screen.key, collection: screen.key, fields: fieldsOf(pkg, screen), portal })
      .map((issue): LocalizedIssue => issue.messageParams?.field
        ? {
          message: '@core.marketplace/issue.portal.visible-when.unknown',
          messageParams: { screen: screen.key, field: issue.messageParams.field },
        }
        : { message: '@core.marketplace/issue.portal.visible-when.invalid', messageParams: { screen: screen.key } }));

  const kernel = filtered.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_VISIBLE_WHEN_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.visible-when.kernel',
      messageParams: { screen: filtered[0].screen.key, minimum: PORTAL_VISIBLE_WHEN_SINCE_KERNEL },
    }]
    : [];

  return [...condition, ...kernel];
};

/**
 * O `documentLinks` das telas do pacote: a validade e o `kernel`. Pela mesma razão do `visibleWhen`, o
 * `kernel` é de exposição — o anterior descarta a chave e entrega ao convidado o link permanente.
 */
const documentLinkIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const signed = (pkg.screens ?? []).flatMap((screen) => {
    const links = asPortalDeclaration(screen.portal)?.documentLinks;
    return links ? [{ screen, links }] : [];
  });

  const minutes = signed
    .filter(({ links }) => !Number.isInteger(links.expiresInMinutes)
      || links.expiresInMinutes < 1
      || links.expiresInMinutes > PORTAL_DOCUMENT_LINK_MAX_MINUTES)
    .map(({ screen }): LocalizedIssue => ({
      message: '@core.marketplace/issue.portal.document-links.minutes',
      messageParams: { screen: screen.key, maximum: String(PORTAL_DOCUMENT_LINK_MAX_MINUTES) },
    }));

  const kernel = signed.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_DOCUMENT_LINKS_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.document-links.kernel',
      messageParams: { screen: signed[0].screen.key, minimum: PORTAL_DOCUMENT_LINKS_SINCE_KERNEL },
    }]
    : [];

  return [...minutes, ...kernel];
};

/**
 * O `trackViews` das telas do pacote num kernel que o descarta: nenhuma abertura seria registrada, e a
 * automação que escuta `<prefixo>.portalViewed` nunca rodaria — calada, que é o pior jeito de falhar
 * para quem declarou justamente para ter prova.
 */
const trackViewsIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const tracked = (pkg.screens ?? []).find((screen) => asPortalDeclaration(screen.portal)?.trackViews === true);
  return tracked && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_TRACK_VIEWS_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.track-views.kernel',
      messageParams: { screen: tracked.key, minimum: PORTAL_TRACK_VIEWS_SINCE_KERNEL },
    }]
    : [];
};

/**
 * As telas do pacote lidas por TODO convidado (`subject: 'public'`): o que pressupõe um dono não vale
 * nelas — a leitura o descarta, e por isso a recusa mora aqui, onde o autor ainda pode tirá-lo —, e o
 * `kernel` que lê o sujeito. O anterior descarta a declaração inteira, e a tela sairia do portal calada.
 */
const publicSubjectIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declaring = (pkg.screens ?? []).filter((screen) => asPortalDeclaration(screen.portal)?.subject === 'public');

  const conflicts = declaring.flatMap((screen) => portalPublicConflicts(screen.portal).map((option): LocalizedIssue => ({
    message: '@core.marketplace/issue.portal.public.unsupported',
    messageParams: { screen: screen.key, option },
  })));

  const kernel = declaring.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_PUBLIC_SUBJECT_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.public.kernel',
      messageParams: { screen: declaring[0].key, minimum: PORTAL_PUBLIC_SUBJECT_SINCE_KERNEL },
    }]
    : [];

  return [...conflicts, ...kernel];
};

/**
 * O campo derivado levado ao portal: ele nunca é gravado, e o convidado o veria sempre vazio. O pacote
 * não passa pela aba Portal do Form Design, e por isso a mesma conferência é recusa aqui.
 */
const derivedFieldIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    if (!portal) return [];
    return portalDerivedFieldKeys({ id: screen.key, collection: screen.key, fields: fieldsOf(pkg, screen), portal })
      .map((field): LocalizedIssue => ({
        message: '@core.marketplace/issue.portal.field.derived',
        messageParams: { screen: screen.key, field },
      }));
  });

const PORTAL_ACTION_PACKAGE_MESSAGES: Record<string, string> = {
  '@core.records/portal.issue.action.unknown': '@core.marketplace/issue.portal.action.unknown',
  '@core.records/portal.issue.action.disabled': '@core.marketplace/issue.portal.action.disabled',
  '@core.records/portal.issue.action.not-runnable': '@core.marketplace/issue.portal.action.not-runnable',
  '@core.records/portal.issue.action.prompts': '@core.marketplace/issue.portal.action.prompts',
};

/**
 * As `actions` das telas do pacote: cada chave aponta para uma ação DO PACOTE que a tela põe no
 * cabeçalho do registro (`viewActionIds`, que no pacote são `templateId`), ligada, que roda uma
 * automação e não pergunta nada — e o `kernel` que lê a chave. A chave, e não o id, porque a `key`
 * atravessa a instalação intacta, enquanto o id é remapeado: a declaração não precisa de reescrita.
 */
const actionIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declaring = (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    return portal?.actions?.length ? [{ screen, portal }] : [];
  });
  const actions = (pkg.actions ?? []).map((action) => ({ ...action, id: action.templateId }));

  const keys = declaring.flatMap(({ screen, portal }) =>
    portalActionIssues(
      { id: screen.key, collection: screen.key, fields: screen.fields, viewActionIds: screen.viewActionIds, portal },
      actions,
    ).map((issue): LocalizedIssue => ({
      message: PORTAL_ACTION_PACKAGE_MESSAGES[issue.message] ?? issue.message,
      messageParams: { screen: screen.key, action: issue.messageParams?.action ?? '' },
    })));

  const kernel = declaring.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_ACTIONS_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.actions.kernel',
      messageParams: { screen: declaring[0].screen.key, minimum: PORTAL_ACTIONS_SINCE_KERNEL },
    }]
    : [];

  return [...keys, ...kernel];
};

/**
 * O `referenceTitles` das telas do pacote: cada chave é um campo `reference` exposto, e o `kernel` lê a
 * chave. Um kernel anterior a descarta e o vínculo chega ao convidado sem nome — fechado, mas calado
 * para quem declarou justamente para ter o nome à vista.
 */
const referenceTitleIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declaring = (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    return portal?.referenceTitles?.length ? [{ screen, portal }] : [];
  });

  const fields = declaring.flatMap(({ screen, portal }) =>
    portalReferenceTitleIssues({ id: screen.key, collection: screen.key, fields: fieldsOf(pkg, screen), portal })
      .map((issue): LocalizedIssue => ({
        message: '@core.marketplace/issue.portal.reference-titles.field',
        messageParams: { screen: screen.key, field: issue.messageParams?.field ?? '' },
      })));

  const kernel = declaring.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_REFERENCE_TITLES_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.reference-titles.kernel',
      messageParams: { screen: declaring[0].screen.key, minimum: PORTAL_REFERENCE_TITLES_SINCE_KERNEL },
    }]
    : [];

  return [...fields, ...kernel];
};

/**
 * A condição de criar (`create.when`) das telas do pacote: a sintaxe e o `kernel`. O `kernel` é de
 * EXPOSIÇÃO, como o do `visibleWhen`: um kernel anterior descarta a condição e deixa TODO convidado
 * criar — o procurador pedindo o que só o sócio pede. Os campos citados são os do pai, que pode ser de
 * uma dependência: quem os confere é a aba Portal, onde todas as telas estão.
 */
const createWhenIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declaring = (pkg.screens ?? []).flatMap((screen) => {
    const portal = asPortalDeclaration(screen.portal);
    return portal?.create?.when ? [{ screen, portal }] : [];
  });

  const syntax = declaring
    .filter(({ screen, portal }) => portalCreateConditionIssues({ id: screen.key, collection: screen.key, fields: [], portal }, undefined).length > 0)
    .map(({ screen }): LocalizedIssue => ({
      message: '@core.marketplace/issue.portal.create-when.invalid',
      messageParams: { screen: screen.key },
    }));

  const kernel = declaring.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', PORTAL_ROLES_SINCE_KERNEL)
    ? [{
      message: '@core.marketplace/issue.portal.create-when.kernel',
      messageParams: { screen: declaring[0].screen.key, minimum: PORTAL_ROLES_SINCE_KERNEL },
    }]
    : [];

  return [...syntax, ...kernel];
};

/**
 * O desenho do portal (`portal.template`) das telas do pacote, pela régua da aba Portal: forma, ícone,
 * expressão e — o que é do portal — só campo EXPOSTO. Na tela instalada o defeito não quebraria nada
 * (o servidor descarta o nó), e por isso a recusa mora aqui: descartado em silêncio, o destaque só
 * faltaria no portal de quem instalou. Não exige `kernel`: o anterior descarta a chave e mostra o padrão.
 */
const templateIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.screens ?? []).flatMap((screen, index) => {
    const portal = asPortalDeclaration(screen.portal);
    const raw = (screen.portal as { template?: unknown } | null | undefined)?.template;
    if (!portal || raw === undefined || raw === null) return [];
    const exposed = new Set(portal.fields);
    return portalTemplateIssues(
      raw,
      fieldsOf(pkg, screen).filter((field) => exposed.has(field.key)).map((field) => ({ key: field.key, type: field.type })),
      `screens[${index}].portal.template`,
    );
  });

/**
 * Os cartões da home e as páginas do menu DECLARADOS (`portalWidgetSpec`, `portalPageSpec`): a
 * superfície, a árvore pela régua de `portalWidgetSpecIssues` e o `kernel`.
 *
 * A coleção de uma tela DESTE pacote é conferida por inteiro — está no portal, e os campos lidos saem.
 * A de outra (uma dependência: o pacote do portal sobre as telas de outro) só pela forma: as telas dela
 * não estão aqui, e o servidor descarta o nó que ler o que não sai.
 *
 * O `content` de um `markdown` não é conferido contra os bundles do pacote: a referência pode ser de
 * OUTRO namespace, trazida por quem instala o texto. Sem texto no escritório, a página não aparece.
 *
 * O `kernel` é cobrado porque o anterior descarta a contribuição — calado, e o cartão ou a página só
 * faltariam no portal de quem instalou. A página e o `markdown` pedem o kernel que os desenha.
 */
const widgetSpecIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const declaring = (pkg.manifest.contributes ?? [])
    .map((contribution, index) => ({ contribution, index }))
    .filter(({ contribution }) => contribution?.point === PORTAL_VIEW_POINT && contribution.impl?.kind === 'widget');

  const exposedFieldsOf = (collection: string) => {
    const screen = (pkg.screens ?? []).find((candidate) => (candidate.dataCollection ?? candidate.key) === collection);
    if (!screen) return undefined;
    const portal = asPortalDeclaration(screen.portal);
    if (!portal) return null;
    const exposed = new Set(portal.fields);
    return fieldsOf(pkg, screen).filter((field) => exposed.has(field.key)).map((field) => ({ key: field.key, type: field.type }));
  };

  const shape = declaring.flatMap(({ contribution, index }): LocalizedIssue[] => {
    const surface = asPortalViewMetadata(contribution.metadata)?.surface;
    if (!surface || !PORTAL_DECLARED_SURFACES.includes(surface)) {
      return [{ message: '@core.marketplace/issue.portal.widget.surface', messageParams: { id: contribution.id } }];
    }
    const spec = contribution.impl?.kind === 'widget' ? contribution.impl.spec : undefined;
    return portalWidgetSpecIssues(spec, exposedFieldsOf, `manifest.contributes[${index}].impl.spec`);
  });

  const needsPage = declaring.find(({ contribution }) => {
    if (asPortalViewMetadata(contribution.metadata)?.surface === 'page') return true;
    const spec = readPortalWidgetSpec(contribution.impl?.kind === 'widget' ? contribution.impl.spec : undefined);
    return !!spec && portalWidgetMarkdownRefs(spec.body).length > 0;
  });
  const minimum = needsPage ? PORTAL_PAGE_SPEC_SINCE_KERNEL : PORTAL_WIDGET_SPEC_SINCE_KERNEL;
  const kernel = declaring.length > 0 && !rangeExcludesBelow(pkg.manifest.kernel ?? '', minimum)
    ? [{
      message: '@core.marketplace/issue.portal.widget.kernel',
      messageParams: { id: (needsPage ?? declaring[0]).contribution.id, minimum },
    }]
    : [];

  return [...shape, ...kernel];
};

/** O que o portal das telas do pacote declara e o kernel exigido não sustenta — cada um, uma recusa. */
export const packagePortalIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => [
  ...publicSubjectIssues(pkg),
  ...derivedFieldIssues(pkg),
  ...visibleWhenIssues(pkg),
  ...createWhenIssues(pkg),
  ...documentLinkIssues(pkg),
  ...trackViewsIssues(pkg),
  ...actionIssues(pkg),
  ...referenceTitleIssues(pkg),
  ...templateIssues(pkg),
  ...widgetSpecIssues(pkg),
];
