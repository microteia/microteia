import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import {
  PORTAL_ACTIONS_SINCE_KERNEL,
  PORTAL_DOCUMENT_LINKS_SINCE_KERNEL,
  PORTAL_DOCUMENT_LINK_MAX_MINUTES,
  PORTAL_PUBLIC_SUBJECT_SINCE_KERNEL,
  PORTAL_REFERENCE_TITLES_SINCE_KERNEL,
  PORTAL_TRACK_VIEWS_SINCE_KERNEL,
  PORTAL_VISIBLE_WHEN_SINCE_KERNEL,
  type PortalDeclaration,
} from '../../schema/portal';
import type { PortalTemplate } from '../../schema/ui/portalTemplate';
import { PORTAL_ROLES_SINCE_KERNEL } from '../../schema/portalRole';
import { packagePortalIssues } from './pluginPortal';
import { packageIssues } from './pluginReferences';

const field = (key: string): TemplateField => ({ key, label: key, type: 'text', required: false, order: 0 });

const pkg = (visibleWhen: string | undefined, kernel = `^${PORTAL_VISIBLE_WHEN_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.ledger', version: '1.0.0', kernel, name: 'Ledger', contributes: [] },
  workflows: [],
  screens: [{
    key: 'entries',
    titleSingular: 'Entry',
    titlePlural: 'Entries',
    icon: 'list',
    titleFieldKey: 'description',
    fields: [field('description'), field('type')],
    portal: { subject: 'self', fields: ['description'], ...(visibleWhen ? { visibleWhen } : {}) },
  }],
  screenPatches: [{ target: 'entries', fields: [field('channel')] }],
});

describe('visibleWhen no pacote', () => {
  it('a condição certa, com o kernel que a entende, passa — inclusive campo de patch do próprio pacote', () => {
    expect(packagePortalIssues(pkg('type == "revenue" and channel != "internal"'))).toEqual([]);
    expect(packagePortalIssues(pkg(undefined, '^2.0.0'))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele ignoraria a condição e mostraria todos os registros', () => {
    expect(packageIssues(pkg('type == "revenue"', '^2.60.0'))).toContainEqual({
      message: '@core.marketplace/issue.portal.visible-when.kernel',
      messageParams: { screen: 'entries', minimum: PORTAL_VISIBLE_WHEN_SINCE_KERNEL },
    });
  });

  it('confere a sintaxe e os campos citados', () => {
    expect(packagePortalIssues(pkg('type =='))).toEqual([
      { message: '@core.marketplace/issue.portal.visible-when.invalid', messageParams: { screen: 'entries' } },
    ]);
    expect(packagePortalIssues(pkg('kind == "revenue"'))).toEqual([
      { message: '@core.marketplace/issue.portal.visible-when.unknown', messageParams: { screen: 'entries', field: 'kind' } },
    ]);
  });
});

describe('create.when no pacote (EV-38)', () => {
  const requesting = (when: string, kernel: string): MarketplacePlugin => ({
    summary: 'x',
    manifest: { id: 'com.acme.requests', version: '1.0.0', kernel, name: 'Requests', contributes: [] },
    workflows: [],
    screens: [{
      key: 'requests',
      titleSingular: 'Request',
      titlePlural: 'Requests',
      icon: 'list',
      titleFieldKey: 'title',
      fields: [field('title'), { ...field('companyId'), type: 'reference', refEntity: 'companies' }],
      portal: { subject: { field: 'companyId' }, fields: ['title'], create: { fields: ['title'], when } },
    }],
  });

  it('com o kernel que a lê, passa', () => {
    expect(packagePortalIssues(requesting('"socio" in actor.portalRoles', `^${PORTAL_ROLES_SINCE_KERNEL}`))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele ignoraria a condição e deixaria todo convidado criar', () => {
    expect(packagePortalIssues(requesting('"socio" in actor.portalRoles', '^2.88.0'))).toEqual([{
      message: '@core.marketplace/issue.portal.create-when.kernel',
      messageParams: { screen: 'requests', minimum: PORTAL_ROLES_SINCE_KERNEL },
    }]);
  });

  it('a condição que não é expressão é recusa — nenhum convidado criaria', () => {
    expect(packagePortalIssues(requesting('"socio" in (', `^${PORTAL_ROLES_SINCE_KERNEL}`))).toEqual([
      { message: '@core.marketplace/issue.portal.create-when.invalid', messageParams: { screen: 'requests' } },
    ]);
  });
});

describe('campo derivado no portal do pacote', () => {
  it('é recusa: o convidado o veria sempre vazio, e o pacote não passa pela aba Portal', () => {
    const base = pkg(undefined);
    const derived = {
      ...base,
      screens: base.screens!.map((screen) => ({
        ...screen,
        fields: [...screen.fields, { ...field('age'), logic: { derive: 'daysBetween(createdAt, today())' } }],
        portal: { ...screen.portal!, fields: ['description', 'age'] },
      })),
    };
    expect(packagePortalIssues(base)).toEqual([]);
    expect(packageIssues(derived)).toContainEqual({
      message: '@core.marketplace/issue.portal.field.derived',
      messageParams: { screen: 'entries', field: 'age' },
    });
  });
});

describe('documentLinks no pacote', () => {
  const withLinks = (documentLinks: { expiresInMinutes: number }, kernel = `^${PORTAL_DOCUMENT_LINKS_SINCE_KERNEL}`): MarketplacePlugin => {
    const base = pkg(undefined, kernel);
    return { ...base, screens: base.screens!.map((screen) => ({ ...screen, portal: { ...screen.portal!, documents: true, documentLinks } })) };
  };

  it('com o kernel que a entende e a validade no intervalo, passa', () => {
    expect(packagePortalIssues(withLinks({ expiresInMinutes: 15 }))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele ignoraria a declaração e entregaria o link permanente', () => {
    expect(packageIssues(withLinks({ expiresInMinutes: 15 }, '^2.76.0'))).toContainEqual({
      message: '@core.marketplace/issue.portal.document-links.kernel',
      messageParams: { screen: 'entries', minimum: PORTAL_DOCUMENT_LINKS_SINCE_KERNEL },
    });
  });

  it('a validade fora de 1 a 60 minutos, ou não inteira, é recusa', () => {
    const issue = {
      message: '@core.marketplace/issue.portal.document-links.minutes',
      messageParams: { screen: 'entries', maximum: String(PORTAL_DOCUMENT_LINK_MAX_MINUTES) },
    };
    expect(packagePortalIssues(withLinks({ expiresInMinutes: 0 }))).toEqual([issue]);
    expect(packagePortalIssues(withLinks({ expiresInMinutes: 61 }))).toEqual([issue]);
    expect(packagePortalIssues(withLinks({ expiresInMinutes: 2.5 }))).toEqual([issue]);
  });
});

describe('trackViews no pacote', () => {
  const tracked = (kernel: string): MarketplacePlugin => {
    const base = pkg(undefined, kernel);
    return { ...base, screens: base.screens!.map((screen) => ({ ...screen, portal: { ...screen.portal!, trackViews: true } })) };
  };

  it('com o kernel que a lê, passa', () => {
    expect(packagePortalIssues(tracked(`^${PORTAL_TRACK_VIEWS_SINCE_KERNEL}`))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele descartaria a chave e nada seria registrado, calado', () => {
    expect(packagePortalIssues(tracked('^2.78.0'))).toEqual([{
      message: '@core.marketplace/issue.portal.track-views.kernel',
      messageParams: { screen: 'entries', minimum: PORTAL_TRACK_VIEWS_SINCE_KERNEL },
    }]);
  });

  it('sem a declaração, nenhum kernel é exigido', () => {
    expect(packagePortalIssues(pkg(undefined, '^2.0.0'))).toEqual([]);
  });
});

describe('ações no portal do pacote', () => {
  const offering = (actions: string[], kernel = `^${PORTAL_ACTIONS_SINCE_KERNEL}`): MarketplacePlugin => {
    const base = pkg(undefined, kernel);
    return {
      ...base,
      actions: [
        { templateId: 'act-confirm', key: 'confirm', title: 'Confirm', icon: 'check', workflowId: 'wf-confirm', danger: false, enabled: true, order: 0 },
        { templateId: 'act-copy', key: 'copy', title: 'Copy', icon: 'link', command: 'copyLink', danger: false, enabled: true, order: 1 },
        {
          templateId: 'act-ask', key: 'ask', title: 'Ask', icon: 'help', workflowId: 'wf-ask', promptParameters: true,
          danger: false, enabled: true, order: 2,
        },
        { templateId: 'act-loose', key: 'loose', title: 'Loose', icon: 'help', workflowId: 'wf-loose', danger: false, enabled: true, order: 3 },
      ],
      screens: base.screens!.map((screen) => ({
        ...screen,
        viewActionIds: ['act-confirm', 'act-copy', 'act-ask'],
        portal: { ...screen.portal!, actions },
      })),
    };
  };

  it('a chave de uma ação do cabeçalho que roda uma automação, com o kernel que a lê, passa', () => {
    expect(packagePortalIssues(offering(['confirm']))).toEqual([]);
  });

  it('a chave que não está no cabeçalho do registro, o comando e a que pergunta são recusa, cada uma com o motivo', () => {
    expect(packagePortalIssues(offering(['loose', 'copy', 'ask']))).toEqual([
      { message: '@core.marketplace/issue.portal.action.unknown', messageParams: { screen: 'entries', action: 'loose' } },
      { message: '@core.marketplace/issue.portal.action.not-runnable', messageParams: { screen: 'entries', action: 'copy' } },
      { message: '@core.marketplace/issue.portal.action.prompts', messageParams: { screen: 'entries', action: 'ask' } },
    ]);
  });

  it('o kernel anterior é recusa: ele descartaria a chave e os botões não apareceriam', () => {
    expect(packageIssues(offering(['confirm'], '^2.80.0'))).toContainEqual({
      message: '@core.marketplace/issue.portal.actions.kernel',
      messageParams: { screen: 'entries', minimum: PORTAL_ACTIONS_SINCE_KERNEL },
    });
  });
});

describe('referenceTitles no pacote', () => {
  const named = (referenceTitles: string[], kernel = `^${PORTAL_REFERENCE_TITLES_SINCE_KERNEL}`, exposed = ['description', 'holder']): MarketplacePlugin => {
    const base = pkg(undefined, kernel);
    return {
      ...base,
      screens: base.screens!.map((screen) => ({
        ...screen,
        fields: [...screen.fields, { ...field('holder'), type: 'reference', refEntity: 'taxpayers' }],
        portal: { ...screen.portal!, fields: exposed, referenceTitles },
      })),
    };
  };

  it('um vínculo exposto, com o kernel que a lê, passa', () => {
    expect(packagePortalIssues(named(['holder']))).toEqual([]);
  });

  it('o campo que não é vínculo, ou não está exposto, é recusa', () => {
    expect(packagePortalIssues(named(['description']))).toEqual([{
      message: '@core.marketplace/issue.portal.reference-titles.field',
      messageParams: { screen: 'entries', field: 'description' },
    }]);
    expect(packagePortalIssues(named(['holder'], undefined, ['description']))).toEqual([{
      message: '@core.marketplace/issue.portal.reference-titles.field',
      messageParams: { screen: 'entries', field: 'holder' },
    }]);
  });

  it('o kernel anterior é recusa: ele descartaria a chave e o vínculo chegaria sem nome', () => {
    expect(packagePortalIssues(named(['holder'], '^2.83.0'))).toEqual([{
      message: '@core.marketplace/issue.portal.reference-titles.kernel',
      messageParams: { screen: 'entries', minimum: PORTAL_REFERENCE_TITLES_SINCE_KERNEL },
    }]);
  });
});

describe('desenho do portal no pacote (`portal.template`)', () => {
  const withTemplate = (template: unknown, exposed = ['description']): MarketplacePlugin => {
    const base = pkg(undefined, '^2.0.0');
    return {
      ...base,
      screens: base.screens!.map((screen) => ({ ...screen, portal: { subject: 'self' as const, fields: exposed, template: template as PortalTemplate } })),
    };
  };

  it('o desenho que só usa o exposto passa, sem exigir kernel — o anterior mostra o padrão', () => {
    expect(packagePortalIssues(withTemplate({
      card: { layout: 'grid', body: [{ type: 'field', field: 'description', variant: 'strong' }] },
      detail: { body: [{ type: 'field', field: 'channel', size: 'xl' }, { type: 'fields', exclude: ['channel'] }] },
    }, ['description', 'channel']))).toEqual([]);
  });

  it('campo fora do portal, inclusive lido numa condição, é recusa — com o caminho no pacote', () => {
    expect(packageIssues(withTemplate({
      detail: { body: [{ type: 'field', field: 'type' }, { type: 'title', hiddenWhen: 'type == "internal"' }] },
    }))).toEqual(expect.arrayContaining([
      {
        message: '@core.records/portal-template.issue.field-unexposed',
        messageParams: { where: 'screens[0].portal.template.detail.body[0].field', field: 'type' },
      },
      {
        message: '@core.records/portal-template.issue.expression-unexposed',
        messageParams: { where: 'screens[0].portal.template.detail.body[1].hiddenWhen', field: 'type' },
      },
    ]));
  });
});

describe('tela pública no pacote (EV-43)', () => {
  const published = (portal: Record<string, unknown>, kernel = `^${PORTAL_PUBLIC_SUBJECT_SINCE_KERNEL}`): MarketplacePlugin => {
    const base = pkg(undefined, kernel);
    return {
      ...base,
      screens: base.screens!.map((screen) => ({
        ...screen,
        portal: { subject: 'public', fields: ['description'], ...portal } as PortalDeclaration,
      })),
    };
  };

  it('só leitura, com filtro e o kernel que lê o sujeito, passa', () => {
    expect(packagePortalIssues(published({ visibleWhen: 'type == "outage"' }))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele descartaria a declaração e a tela sairia do portal, calada', () => {
    expect(packageIssues(published({}, '^2.93.0'))).toContainEqual({
      message: '@core.marketplace/issue.portal.public.kernel',
      messageParams: { screen: 'entries', minimum: PORTAL_PUBLIC_SUBJECT_SINCE_KERNEL },
    });
  });

  it('o que pressupõe um dono entre os convidados é recusa, um por opção', () => {
    const issues = packagePortalIssues(published({
      create: { fields: ['description'] },
      edit: { fields: ['description'] },
      documents: true,
      uploads: { types: [] },
      actions: ['accept'],
      trackViews: true,
      documentLinks: { expiresInMinutes: 10 },
      invites: { automation: true },
    }));
    expect(issues.map((issue) => issue.messageParams?.option)).toEqual([
      'create', 'edit', 'uploads', 'actions', 'documents', 'documentLinks', 'trackViews', 'invites',
    ]);
    expect(issues.every((issue) => issue.message === '@core.marketplace/issue.portal.public.unsupported')).toBe(true);
  });
});
