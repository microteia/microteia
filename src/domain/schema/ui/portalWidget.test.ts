import { describe, expect, it } from 'vitest';
import {
  PORTAL_WIDGET_RECORDS_MAX_LIMIT,
  guestPortalWidgetSpec,
  portalWidgetCollections,
  portalWidgetMarkdownRefs,
  readPortalWidgetSpec,
} from './portalWidget';
import { portalWidgetSpecIssues } from './portalWidgetIssues';

const EXPOSED: Record<string, ReadonlySet<string>> = {
  notices: new Set(['subject', 'status', 'deadline', 'companyId']),
  companies: new Set(['name']),
};
const exposedOf = (collection: string) => EXPOSED[collection] ?? null;
const upper = (text: string) => text.toUpperCase();

describe('widget declarado do portal — leitura tolerante', () => {
  it('nó de registro e condição fora do cartão de `records` não têm sobre o que responder: somem', () => {
    expect(readPortalWidgetSpec({
      body: [
        { type: 'title' },
        { type: 'field', field: 'subject' },
        { type: 'text', text: '@acme/hello', hiddenWhen: 'status == "open"' },
        { type: 'count', collection: 'notices', scope: 'record' },
      ],
    })).toEqual({ body: [{ type: 'text', text: '@acme/hello' }, { type: 'count', collection: 'notices' }] });
  });

  it('dentro do cartão vale o vocabulário do registro, o `count` por registro — e `records` dentro de outro some', () => {
    const spec = readPortalWidgetSpec({
      body: [{
        type: 'records',
        collection: 'companies',
        limit: 500,
        orderBy: { field: 'name', direction: 'sideways' },
        layout: 'carousel',
        card: [
          { type: 'title', hiddenWhen: 'name == ""' },
          { type: 'count', collection: 'notices', when: 'status == "open"', scope: 'record' },
          { type: 'records', collection: 'notices' },
        ],
      }],
    });
    expect(spec).toEqual({
      body: [{
        type: 'records',
        collection: 'companies',
        limit: PORTAL_WIDGET_RECORDS_MAX_LIMIT,
        orderBy: { field: 'name' },
        card: [
          { type: 'title', hiddenWhen: 'name == ""' },
          { type: 'count', collection: 'notices', when: 'status == "open"', scope: 'record' },
        ],
      }],
    });
  });

  it('sem nada aproveitável não há widget', () => {
    expect(readPortalWidgetSpec(null)).toBeNull();
    expect(readPortalWidgetSpec({ body: [{ type: 'summary' }, { type: 'records' }] })).toBeNull();
  });

  it('as coleções que o widget lê, inclusive as do cartão', () => {
    const spec = readPortalWidgetSpec({
      body: [{ type: 'row', children: [{ type: 'count', collection: 'notices' }] }, {
        type: 'records', collection: 'companies', card: [{ type: 'count', collection: 'protocols', scope: 'record' }],
      }],
    });
    expect(portalWidgetCollections(spec?.body ?? [])).toEqual(['notices', 'companies', 'protocols']);
  });
});

describe('widget declarado do portal — o que sai para o convidado', () => {
  it('só o exposto, com o texto no idioma dele', () => {
    const spec = readPortalWidgetSpec({
      body: [
        { type: 'section', title: '@acme/attention', children: [{ type: 'count', collection: 'notices', when: 'status == "open"' }] },
        {
          type: 'records',
          collection: 'notices',
          when: 'status == "open"',
          orderBy: { field: 'deadline' },
          empty: '@acme/nothing',
          card: [
            { type: 'field', field: 'subject', label: '@acme/subject' },
            { type: 'field', field: 'auditScore' },
            { type: 'text', text: '@acme/late', hiddenWhen: 'deadline < today()' },
            { type: 'text', text: '@acme/risky', hiddenWhen: 'auditScore < 300' },
            { type: 'fields', exclude: ['subject', 'auditScore'] },
          ],
        },
      ],
    });

    expect(guestPortalWidgetSpec(spec, exposedOf, upper)).toEqual({
      body: [
        { type: 'section', title: '@ACME/ATTENTION', children: [{ type: 'count', collection: 'notices', when: 'status == "open"' }] },
        {
          type: 'records',
          collection: 'notices',
          when: 'status == "open"',
          orderBy: { field: 'deadline' },
          empty: '@ACME/NOTHING',
          card: [
            { type: 'field', field: 'subject', label: '@ACME/SUBJECT' },
            { type: 'text', text: '@ACME/LATE', hiddenWhen: 'deadline < today()' },
            { type: 'fields', exclude: ['subject'] },
          ],
        },
      ],
    });
  });

  it('o filtro que lê o que não saiu derruba o nó INTEIRO — sem ele, sairiam registros que o autor deixou de fora', () => {
    const spec = readPortalWidgetSpec({
      body: [
        { type: 'count', collection: 'notices', when: 'auditScore < 300' },
        { type: 'records', collection: 'notices', when: 'status ==' },
        { type: 'records', collection: 'notices', orderBy: { field: 'auditScore' } },
        { type: 'records', collection: 'inspections' },
        { type: 'count', collection: 'notices' },
      ],
    });
    expect(guestPortalWidgetSpec(spec, exposedOf, upper)).toEqual({ body: [{ type: 'count', collection: 'notices' }] });
    expect(JSON.stringify(guestPortalWidgetSpec(spec, exposedOf, upper))).not.toContain('auditScore');
  });

  it('o widget que lia dados e perdeu todos não sai só com a moldura de texto', () => {
    const spec = readPortalWidgetSpec({
      body: [{ type: 'text', text: '@acme/due' }, { type: 'records', collection: 'inspections' }],
    });
    expect(guestPortalWidgetSpec(spec, exposedOf, upper)).toBeNull();
  });

  it('o widget só de texto continua sendo um aviso', () => {
    expect(guestPortalWidgetSpec(readPortalWidgetSpec({ body: [{ type: 'text', text: '@acme/hours' }] }), exposedOf, upper))
      .toEqual({ body: [{ type: 'text', text: '@ACME/HOURS' }] });
  });

  it('a contagem por registro no cartão responde aos campos da tela que ela conta', () => {
    const spec = readPortalWidgetSpec({
      body: [{
        type: 'records',
        collection: 'companies',
        card: [
          { type: 'title' },
          { type: 'count', collection: 'notices', when: 'status == "open"', scope: 'record' },
          { type: 'count', collection: 'notices', when: 'auditScore > 1', scope: 'record' },
        ],
      }],
    });
    expect(guestPortalWidgetSpec(spec, exposedOf, upper)?.body[0]).toEqual({
      type: 'records',
      collection: 'companies',
      card: [{ type: 'title' }, { type: 'count', collection: 'notices', when: 'status == "open"', scope: 'record' }],
    });
  });
});

describe('widget declarado do portal — o portão de autoria', () => {
  const fields = (keys: string[]) => keys.map((key) => ({ key, type: 'text' }));
  const fieldsOf = (collection: string) => {
    if (collection === 'notices') return fields(['subject', 'status', 'deadline']);
    if (collection === 'inspections') return null;
    return undefined;
  };
  const codes = (raw: unknown) => portalWidgetSpecIssues(raw, fieldsOf).map((issue) => [issue.message.split('/')[1], issue.messageParams?.where]);

  it('o widget certo passa', () => {
    expect(portalWidgetSpecIssues({
      body: [
        { type: 'row', children: [{ type: 'count', collection: 'notices', when: 'status == "open"', size: 'xl', tone: 'danger' }] },
        {
          type: 'records',
          collection: 'notices',
          when: 'deadline >= today()',
          orderBy: { field: 'deadline', direction: 'asc' },
          limit: 5,
          empty: '@acme/nothing',
          card: [{ type: 'title' }, { type: 'field', field: 'status', variant: 'badge', hiddenWhen: 'status == "closed"' }],
        },
      ],
    }, fieldsOf)).toEqual([]);
  });

  it('o escopo: nó de registro fora do cartão, `records` dentro de outro, condição sem registro, contagem por registro sem registro', () => {
    expect(codes({
      body: [
        { type: 'title' },
        { type: 'text', text: 'x', hiddenWhen: 'status == "open"' },
        { type: 'count', collection: 'notices', scope: 'record' },
        { type: 'records', collection: 'notices', card: [{ type: 'records', collection: 'notices' }] },
      ],
    })).toEqual([
      ['portal-widget.issue.record-only', 'spec.body[0].type'],
      ['portal-widget.issue.condition-outside', 'spec.body[1].hiddenWhen'],
      ['portal-widget.issue.scope', 'spec.body[2].scope'],
      ['portal-widget.issue.nested-records', 'spec.body[3].card[0].type'],
    ]);
  });

  it('só o que o convidado tem: coleção fora do portal, campo não exposto no filtro, na ordem e no cartão', () => {
    expect(codes({
      body: [
        { type: 'count', collection: 'inspections' },
        { type: 'count' },
        {
          type: 'records',
          collection: 'notices',
          when: 'auditScore < 3',
          orderBy: { field: 'auditScore', direction: 'up' },
          limit: 50,
          card: [{ type: 'field', field: 'auditScore' }],
        },
      ],
    })).toEqual([
      ['portal-widget.issue.collection-unexposed', 'spec.body[0].collection'],
      ['portal-widget.issue.collection-missing', 'spec.body[1].collection'],
      ['portal-template.issue.expression-unexposed', 'spec.body[2].when'],
      ['portal-widget.issue.limit', 'spec.body[2].limit'],
      ['portal-template.issue.field-unexposed', 'spec.body[2].orderBy.field'],
      ['card-template.issue.option', 'spec.body[2].orderBy.direction'],
      ['portal-template.issue.field-unexposed', 'spec.body[2].card[0].field'],
    ]);
  });

  it('a tela de outro pacote é conferida só pela forma — quem descarta o que não sai é o servidor', () => {
    expect(portalWidgetSpecIssues({
      body: [{ type: 'records', collection: 'protocols', when: 'anything == 1', card: [{ type: 'field', field: 'whatever' }] }],
    }, fieldsOf)).toEqual([]);
    expect(codes({ body: [{ type: 'count', collection: 'protocols', when: 'status ==' }] }))
      .toEqual([['card-template.issue.expression', 'spec.body[0].when']]);
  });

  it('sem corpo não há widget', () => {
    expect(codes([])).toEqual([['portal-widget.issue.not-object', 'spec']]);
    expect(codes({ body: [] })).toEqual([['portal-widget.issue.body', 'spec.body']]);
  });
});

describe('o nó markdown — páginas e cartões', () => {
  const LAW = '@br.gov.dte.legislacao/portal.legislacao';
  const contentOf = (ref: string) => (ref === LAW ? '# Lei\n\nArt. 1º  \nlinha' : null);

  it('vale no corpo, e nunca no cartão de um registro — o cartão inteiro é um botão', () => {
    expect(readPortalWidgetSpec({
      body: [
        { type: 'markdown', content: LAW },
        { type: 'markdown', content: '   ' },
        { type: 'records', collection: 'notices', card: [{ type: 'title' }, { type: 'markdown', content: LAW }] },
      ],
    })).toEqual({
      body: [
        { type: 'markdown', content: LAW },
        { type: 'records', collection: 'notices', card: [{ type: 'title' }] },
      ],
    });
    expect(portalWidgetMarkdownRefs([{ type: 'stack', children: [{ type: 'markdown', content: LAW }] }])).toEqual([LAW]);
  });

  it('sai para o convidado com o TEXTO no lugar da referência, sem aparar o espaço que é quebra de linha', () => {
    expect(guestPortalWidgetSpec({ body: [{ type: 'markdown', content: LAW }] }, exposedOf, upper, contentOf))
      .toEqual({ body: [{ type: 'markdown', content: '# Lei\n\nArt. 1º  \nlinha' }] });
  });

  it('sem texto, ou com conteúdo que não é referência, o nó some — e a página que só tinha ele também', () => {
    expect(guestPortalWidgetSpec({
      body: [{ type: 'text', text: 'Legislação' }, { type: 'markdown', content: '@outro.pacote/ausente' }],
    }, exposedOf, upper, contentOf)).toBeNull();
    expect(guestPortalWidgetSpec({ body: [{ type: 'markdown', content: '**literal**' }] }, exposedOf, upper, contentOf)).toBeNull();
    expect(guestPortalWidgetSpec({ body: [{ type: 'markdown', content: LAW }] }, exposedOf, upper)).toBeNull();
  });

  it('perder o texto não derruba a página que ainda tem dados', () => {
    expect(guestPortalWidgetSpec({
      body: [{ type: 'markdown', content: '@outro.pacote/ausente' }, { type: 'count', collection: 'notices' }],
    }, exposedOf, upper, contentOf)).toEqual({ body: [{ type: 'count', collection: 'notices' }] });
  });

  it('no portão: o conteúdo é referência, e o markdown não entra no cartão de `records`', () => {
    const issues = portalWidgetSpecIssues({
      body: [
        { type: 'markdown', content: LAW },
        { type: 'markdown', content: '# texto solto' },
        { type: 'records', collection: 'notices', card: [{ type: 'markdown', content: LAW }] },
      ],
    }, () => undefined).map((issue) => [issue.message.split('/')[1], issue.messageParams?.where]);
    expect(issues).toEqual([
      ['portal-widget.issue.markdown-content', 'spec.body[1].content'],
      ['portal-widget.issue.markdown-in-card', 'spec.body[2].card[0].type'],
    ]);
  });
});
