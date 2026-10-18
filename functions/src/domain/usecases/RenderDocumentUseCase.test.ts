import { describe, it, expect, vi } from 'vitest';
import { makeRenderDocumentUseCase } from './RenderDocumentUseCase';
import type { RenderDocumentDeps, RenderDocumentRequest } from './RenderDocumentUseCase';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import type { SchemaScreen } from '../schema/pathResolver';
import type { ResolvedDocumentTemplate } from '../schema/document/documentTemplate';
import type { DocumentRenderInput, IDocumentRenderer } from '../repositories/IDocumentRenderer';
import { DocumentRenderError } from '../repositories/IDocumentRenderer';
import type { IDocumentRecordReader } from '../repositories/IDocumentGenerationPorts';
import type { IRecordDocumentWriter, RecordDocumentFile } from '../repositories/IRecordDocumentWriter';
import type { DownloadFileInput, IDownloadWriter } from '../repositories/IDownloadWriter';
import type { DownloadPolicy } from '../schema/document/documentDownloads';

const NOW = new Date('2026-10-17T12:00:00Z');

const fakeDownloads = (saved: DownloadFileInput[]): IDownloadWriter => ({
  save: vi.fn(async (file: DownloadFileInput) => {
    saved.push(file);
    return { id: 'dl1', name: file.name, url: 'https://dl', storagePath: 'p', contentType: file.contentType, size: 1, expiresAt: file.expiresAt };
  }),
});

const SCREENS: SchemaScreen[] = [
  {
    id: 'contracts',
    titleSingular: 'Contract',
    titleFieldKey: 'name',
    hasDocuments: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'custom' },
      { key: 'fee', label: 'Fee', type: 'number', required: false, order: 1, origin: 'custom' },
    ],
  },
  {
    id: 'installments',
    titleSingular: 'Installment',
    titleFieldKey: 'amount',
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', required: false, order: 0, origin: 'custom' },
      { key: 'contractId', label: 'Contract', type: 'reference', refEntity: 'contracts', required: false, order: 1, origin: 'custom' },
    ],
  },
  {
    id: 'notes',
    titleSingular: 'Note',
    titleFieldKey: 'name',
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'custom' }],
  },
] as unknown as SchemaScreen[];

const template = (overrides: Partial<ResolvedDocumentTemplate> = {}): ResolvedDocumentTemplate => ({
  key: 'receipt',
  title: 'Receipt',
  collection: 'contracts',
  format: 'markdown',
  body: '{{name}} {{formatMoney(fee)}}{{#each installments}}{{amount}}{{/each}}',
  fileName: 'Receipt {{name}}',
  datasets: [{ name: 'installments', from: 'installments', via: 'contractId' }],
  origin: 'tenant',
  ...overrides,
});

const setup = (
  templates: ResolvedDocumentTemplate[] = [template()],
  screens: SchemaScreen[] = SCREENS,
  policy: DownloadPolicy = { retentionDays: 7, automationVisibility: 'managers' },
) => {
  const rendered: DocumentRenderInput[] = [];
  const attached: RecordDocumentFile[] = [];
  const saved: DownloadFileInput[] = [];
  const downloads = fakeDownloads(saved);
  const childrenPaths: string[][] = [];

  const renderer: IDocumentRenderer = {
    templateText: (one) => one.body ?? '',
    render: async (input) => {
      rendered.push(input);
      return { data: Buffer.from('%PDF'), contentType: 'application/pdf', extension: 'pdf', issues: [] };
    },
  };
  const records: IDocumentRecordReader = {
    record: async (_tenantId, _collection, recordId) =>
      ({ ok: true, value: recordId === 'c1' ? { id: 'c1', name: 'Ana/Bia', fee: 1500 } : null }),
    children: async (_tenantId, _dataset, _parentId, paths) => {
      childrenPaths.push([...paths]);
      return { ok: true, value: [{ id: 'i1', amount: 10 }] };
    },
  };
  const writer: IRecordDocumentWriter = {
    attach: vi.fn(async (file: RecordDocumentFile) => {
      attached.push(file);
      return { id: 'doc1', name: file.name, url: 'https://x', storagePath: 'p', contentType: file.contentType, size: file.data.length };
    }),
  };
  const deps: RenderDocumentDeps = {
    templates: { resolve: async () => templates, resolveDraft: async (_tenantId, draft) => ({ ...draft, origin: 'tenant' }) },
    screens: fakeScreenProvider(screens),
    records,
    renderer,
    writer,
    downloads,
    downloadPolicyOf: async () => policy,
    now: () => NOW,
    localeOf: async () => 'pt-BR',
    timeZoneOf: async () => 'America/Sao_Paulo',
  };
  return { useCase: makeRenderDocumentUseCase(deps), rendered, attached, childrenPaths, writer, saved, downloads };
};

const request = (overrides: Partial<RenderDocumentRequest> = {}): RenderDocumentRequest => ({
  tenantId: 't1',
  templateKey: 'receipt',
  recordId: 'c1',
  author: { uid: 'u1', name: 'Ana', via: 'ui' },
  ...overrides,
});

describe('RenderDocumentUseCase', () => {
  it('gera, anexa na coleção física do registro, e o nome sai do modelo sem barra', async () => {
    const { useCase, attached } = setup();

    const result = await useCase.execute(request());

    expect(result.ok).toBe(true);
    expect(attached[0]).toMatchObject({ physicalCollection: 'contracts', recordId: 'c1', name: 'Receipt Ana-Bia.pdf' });
  });

  it('o escopo traz o registro e as listas, e os caminhos do laço vão para a consulta dos filhos', async () => {
    const { useCase, rendered, childrenPaths } = setup();

    await useCase.execute(request());

    expect(rendered[0].scope).toMatchObject({ name: 'Ana/Bia', installments: [{ amount: 10 }] });
    expect(childrenPaths[0]).toEqual(['amount']);
  });

  it('a função de formatação fala o idioma do ESCRITÓRIO', async () => {
    const { useCase, rendered } = setup();

    await useCase.execute(request());

    expect(String(rendered[0].evaluate('formatMoney(fee)', rendered[0].scope))).toContain('R$');
  });

  it('recusa a chave que não existe, o formato que o modelo não produz e a tela errada', async () => {
    const { useCase, writer } = setup([template({ format: 'docx', body: undefined, content: 'UEsDBA==' })]);

    expect(await useCase.execute(request({ templateKey: 'nope' })))
      .toMatchObject({ ok: false, error: '@core.documents/render.template-not-found' });
    expect(await useCase.execute(request({ output: 'pdf' })))
      .toMatchObject({ ok: false, error: '@core.documents/render.output-unsupported' });
    expect(await useCase.execute(request({ collection: 'notes' })))
      .toMatchObject({ ok: false, error: '@core.documents/render.collection-mismatch' });
    expect(writer.attach).not.toHaveBeenCalled();
  });

  it('recusa a tela sem aba Documentos — não há onde anexar', async () => {
    const { useCase } = setup([template({ collection: 'notes', datasets: [] })]);

    expect(await useCase.execute(request()))
      .toMatchObject({ ok: false, error: '@core.documents/render.documents-disabled' });
  });

  it('registro que não existe não vira documento vazio', async () => {
    const { useCase, writer } = setup();

    expect(await useCase.execute(request({ recordId: 'ghost' })))
      .toMatchObject({ ok: false, error: '@core.records/record.not-found' });
    expect(writer.attach).not.toHaveBeenCalled();
  });

  it('o modelo ilegível volta como recusa com o motivo, e nada é anexado', async () => {
    const { writer } = setup();
    const broken = makeRenderDocumentUseCase({
      templates: { resolve: async () => [template()], resolveDraft: async () => null },
      screens: fakeScreenProvider(SCREENS),
      records: { record: async () => ({ ok: true, value: { id: 'c1' } }), children: async () => ({ ok: true, value: [] }) },
      renderer: {
        templateText: () => '',
        render: async () => { throw new DocumentRenderError('@core.documents/render.docx-template', { detail: 'x' }); },
      },
      writer,
      downloads: fakeDownloads([]),
      downloadPolicyOf: async () => ({ retentionDays: 7, automationVisibility: 'managers' }),
      localeOf: async () => 'en',
      timeZoneOf: async () => 'UTC',
    });

    expect(await broken.execute(request()))
      .toEqual({ ok: false, error: '@core.documents/render.docx-template', errorParams: { detail: 'x' } });
    expect(writer.attach).not.toHaveBeenCalled();
  });

  /**
   * A entidade que saiu do kernel tem DUAS telas sobre a mesma coleção: a âncora `cases`, que só existe
   * para as rules e nasce sem aba nenhuma, e a tela da extensão que o escritório usa. O modelo aponta
   * a coleção física desde que o `screenSourceId` passou a resolver para ela — e a âncora não pode
   * responder pela aba que a outra mostra.
   */
  it('gera na coleção descrita por uma tela de extensão, mesmo com a âncora das rules ao lado', async () => {
    const anchor = {
      id: 'cases',
      origin: 'builtin',
      titleSingular: 'cases',
      titleFieldKey: 'name',
      hasDocuments: false,
      fields: [],
    } as unknown as SchemaScreen;
    const extension = { ...SCREENS[0], id: 'processos', collection: 'cases', origin: 'plugin' } as SchemaScreen;
    const casesTemplate = template({ collection: 'cases', datasets: [] });

    for (const screens of [[anchor, extension], [extension, anchor]]) {
      const { useCase, attached } = setup([casesTemplate], screens);

      expect(await useCase.execute(request())).toMatchObject({ ok: true });
      expect(attached.at(-1)).toMatchObject({ physicalCollection: 'cases', recordId: 'c1' });
    }
  });

  it('a pré-visualização mescla o texto pela mesma preparação, sem montar arquivo nem anexar', async () => {
    const { useCase, rendered, attached } = setup([template({ body: '**{{name}}** {{#each installments}}{{amount}};{{/each}}{{missing.deep()}}' })]);

    const result = await useCase.preview(request());

    expect(result).toMatchObject({ ok: true, fileName: 'Receipt Ana-Bia', output: 'pdf' });
    if (!result.ok) return;
    expect(result.text).toContain('Ana/Bia');
    expect(result.text).toContain('10;');
    expect(rendered).toHaveLength(0);
    expect(attached).toHaveLength(0);
  });

  it('a pré-visualização recusa como a geração recusa', async () => {
    const { useCase } = setup();

    expect(await useCase.preview(request({ recordId: 'ghost' })))
      .toEqual({ ok: false, error: '@core.records/record.not-found' });
  });

  describe('destino Downloads', () => {
    const SCREENS_WITHOUT_TAB = SCREENS.map((one) => ({ ...one, hasDocuments: false }));

    it('vai para Downloads sem exigir a aba Documentos, com o dono e o vencimento do escritório', async () => {
      const { useCase, attached, saved } = setup([template()], SCREENS_WITHOUT_TAB);

      const result = await useCase.execute(request({ destination: 'downloads' }));

      expect(result).toMatchObject({ ok: true, destination: 'downloads', document: { id: 'dl1' } });
      expect(attached).toHaveLength(0);
      expect(saved[0]).toMatchObject({
        ownerId: 'u1',
        visibility: 'owner',
        templateKey: 'receipt',
        origin: { collection: 'contracts', recordId: 'c1' },
        expiresAt: new Date('2026-10-24T12:00:00Z'),
      });
    });

    it('o destino do modelo vale quando quem pede não diz, e o pedido vence o modelo', async () => {
      const { useCase, attached, saved } = setup([template({ destination: 'downloads' })]);

      await useCase.execute(request());
      expect(saved).toHaveLength(1);

      await useCase.execute(request({ destination: 'record' }));
      expect(attached).toHaveLength(1);
    });

    it('a retenção é a do pedido, depois a do modelo, depois a do escritório — e 0 não expira', async () => {
      const { useCase, saved } = setup([template({ retentionDays: 30 })]);

      await useCase.execute(request({ destination: 'downloads' }));
      await useCase.execute(request({ destination: 'downloads', expiresInDays: 0 }));

      expect(saved[0].expiresAt).toEqual(new Date('2026-11-16T12:00:00Z'));
      expect(saved[1].expiresAt).toBeNull();
    });

    it('a automação sem pessoa não tem dono, e a visibilidade é a configurada pelo escritório', async () => {
      const { useCase, saved } = setup([template()], SCREENS, { retentionDays: 7, automationVisibility: 'everyone' });

      await useCase.execute(request({ destination: 'downloads', author: { uid: 'workflow-engine', name: null, via: 'automation' } }));

      expect(saved[0]).toMatchObject({ ownerId: null, visibility: 'everyone' });
    });

    it('anexar ao registro sem a aba continua sendo recusa — o motor não troca o destino sozinho', async () => {
      const { useCase, saved } = setup([template()], SCREENS_WITHOUT_TAB);

      expect(await useCase.execute(request({ destination: 'record' })))
        .toMatchObject({ ok: false, error: '@core.documents/render.documents-disabled' });
      expect(saved).toHaveLength(0);
    });

    it('cobrando permissão, Downloads pede a leitura e o registro pede a edição', async () => {
      const { useCase } = setup();
      const charged = { chargePermissions: true, permissions: ['contracts.read'] };

      expect(await useCase.execute(request({ ...charged, destination: 'downloads' })))
        .toMatchObject({ ok: true });
      expect(await useCase.execute(request({ ...charged, destination: 'record' })))
        .toMatchObject({ ok: false, error: '@core.access/permission.denied', errorParams: { permission: 'contracts.update' } });
    });
  });

  describe('modelo de dados (payload)', () => {
    const receipt = (overrides: Partial<ResolvedDocumentTemplate> = {}) => template({
      key: 'payment-receipt',
      source: 'payload',
      collection: '',
      datasets: undefined,
      body: '{{payer}} {{formatMoney(amount)}} {{contract.name}}{{#each items}}{{description}}{{/each}}',
      fileName: 'Receipt {{payer}}',
      parameters: [
        { key: 'payer', label: 'Payer', type: 'String', required: true },
        { key: 'amount', label: 'Amount', type: 'Number' },
        { key: 'contract', label: 'Contract', type: 'EntityReference', entityType: 'contracts' },
        { key: 'items', label: 'Items', type: 'Object', list: true, fields: [{ key: 'description', label: 'Description', type: 'String' }] },
      ],
      sample: { payer: 'Sample', amount: 1 },
      ...overrides,
    });
    const payload = { payer: 'Ana', amount: 10, contract: 'c1', items: [{ description: 'Fee' }] };

    it('gera em Downloads com o payload no escopo, sem registro de origem', async () => {
      const { useCase, rendered, saved } = setup([receipt()]);

      const result = await useCase.execute(request({ templateKey: 'payment-receipt', recordId: undefined, payload }));

      expect(result).toMatchObject({ ok: true, destination: 'downloads' });
      expect(rendered[0].scope).toMatchObject({ payer: 'Ana', amount: 10, items: [{ description: 'Fee' }] });
      expect(saved[0]).toMatchObject({ name: 'Receipt Ana.pdf', templateKey: 'payment-receipt' });
      expect(saved[0].origin).toBeUndefined();
    });

    it('a referência é hidratada: o payload traz o id e o modelo lê o registro apontado', async () => {
      const { useCase, rendered } = setup([receipt()]);

      await useCase.execute(request({ templateKey: 'payment-receipt', recordId: undefined, payload }));

      expect(rendered[0].scope.contract).toMatchObject({ id: 'c1', name: 'Ana/Bia' });
    });

    it('a referência que não existe é recusa, e não um campo vazio', async () => {
      const { useCase, saved } = setup([receipt()]);

      expect(await useCase.execute(request({ templateKey: 'payment-receipt', recordId: undefined, payload: { ...payload, contract: 'ghost' } })))
        .toMatchObject({ ok: false, error: '@core.documents/render.payload-reference-not-found', errorParams: { key: 'contract', id: 'ghost' } });
      expect(saved).toHaveLength(0);
    });

    it('o contrato é cobrado: o parâmetro obrigatório ausente recusa', async () => {
      const { useCase } = setup([receipt()]);

      expect(await useCase.execute(request({ templateKey: 'payment-receipt', recordId: undefined, payload: { amount: 1 } })))
        .toMatchObject({ ok: false, error: '@core.automation/parameter.required' });
    });

    it('registro no lugar do payload, payload ausente e destino no registro são recusas', async () => {
      const { useCase } = setup([receipt()]);
      const asked = { templateKey: 'payment-receipt' };

      expect(await useCase.execute(request({ ...asked, payload })))
        .toMatchObject({ ok: false, error: '@core.documents/render.payload-template-record' });
      expect(await useCase.execute(request({ ...asked, recordId: undefined })))
        .toMatchObject({ ok: false, error: '@core.documents/render.payload-missing' });
      expect(await useCase.execute(request({ ...asked, recordId: undefined, payload, destination: 'record' })))
        .toMatchObject({ ok: false, error: '@core.documents/render.payload-destination' });
    });

    it('cobrando permissão: gerar de dados pede documents.generate, e ler a referência pede a leitura dela', async () => {
      const { useCase } = setup([receipt()]);
      const asked = { templateKey: 'payment-receipt', recordId: undefined, payload, chargePermissions: true };

      expect(await useCase.execute(request({ ...asked, permissions: ['contracts.read'] })))
        .toMatchObject({ ok: false, errorParams: { permission: 'documents.generate' } });
      expect(await useCase.execute(request({ ...asked, permissions: ['documents.generate'] })))
        .toMatchObject({ ok: false, errorParams: { permission: 'contracts.read' } });
      expect(await useCase.execute(request({ ...asked, permissions: ['documents.generate', 'contracts.read'] })))
        .toMatchObject({ ok: true });
    });

    it('a pré-visualização sem payload mescla o exemplo do modelo', async () => {
      const { useCase } = setup([receipt({ body: '{{payer}}', parameters: [] })]);

      expect(await useCase.preview({ tenantId: 't1', templateKey: 'payment-receipt' }))
        .toMatchObject({ ok: true, text: 'Sample' });
    });
  });

  describe('pré-visualização do rascunho', () => {
    it('mescla o modelo como está no editor, sem precisar gravá-lo', async () => {
      const { useCase } = setup([template()]);

      expect(await useCase.preview({ tenantId: 't1', templateKey: '', recordId: 'c1', draft: template({ body: 'Draft {{name}}', datasets: [] }) }))
        .toMatchObject({ ok: true, text: 'Draft Ana/Bia' });
    });

    it('gerar ignora o rascunho: arquivo é sempre de um modelo gravado', async () => {
      const { useCase, rendered } = setup([template()]);

      await useCase.execute(request({ draft: template({ body: 'Draft' }) }));

      expect(rendered[0].template.body).not.toBe('Draft');
    });

    it('pré-visualizar dados não cobra a permissão de gerar, mas cobra a leitura do registro apontado', async () => {
      const draft = template({
        key: 'x',
        source: 'payload',
        collection: '',
        datasets: undefined,
        body: '{{contract.name}}',
        parameters: [{ key: 'contract', label: 'Contract', type: 'EntityReference', entityType: 'contracts' }],
      });
      const { useCase } = setup([]);
      const asked = { tenantId: 't1', templateKey: '', draft, payload: { contract: 'c1' }, chargePermissions: true };

      expect(await useCase.preview({ ...asked, permissions: ['contracts.read'] })).toMatchObject({ ok: true, text: 'Ana/Bia' });
      expect(await useCase.preview({ ...asked, permissions: [] }))
        .toMatchObject({ ok: false, errorParams: { permission: 'contracts.read' } });
    });
  });
});
