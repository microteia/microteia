import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { InputMapping } from '../../domain/entities/Workflow';
import type { DocumentTemplateContract } from '../../domain/usecases/plugins/documentStepIntegrity';
import { declaredDocumentTemplates } from '../../domain/usecases/plugins/documentStepIntegrity';
import { documentExamplePlugin } from '../../plugins/marketplace/examples/document-example/plugin';
import { documentStepFindings, pendingDocumentSteps } from './documentSteps';
import type { WorkspaceCatalog } from './workspaceCatalog';

const literal = (value: string): InputMapping => ({ kind: 'Literal', value });

const contratos = (configuration: Record<string, InputMapping>): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.contratos', version: '1.0.0', kernel: '^2.58.0', name: 'Contratos', dependencies: {} },
  workflows: [{
    templateId: 'gerar-procuracao', name: 'Gerar procuração', eventName: 'workflow.called', version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [{
      id: 'gerar', stepDefinitionId: 'render-document', type: 'Action', order: 0, enabled: true,
      configuration: { templateKey: literal('procuracao'), ...configuration },
    }],
  }],
});

const PROCURACAO = (owner = 'outorgante'): DocumentTemplateContract => ({
  key: 'procuracao',
  source: 'payload',
  parameters: [
    { key: owner, type: 'EntityReference', entityType: 'pessoas', required: true },
    { key: 'finalidade', type: 'String' },
  ],
});

const leitura = (
  authored: { pluginId: string; documentTemplates?: DocumentTemplateContract[] }[],
  extensions: { id: string; documentTemplates?: DocumentTemplateContract[] }[] | null,
): WorkspaceCatalog => ({
  authored,
  installed: extensions === null ? null : { tenantId: 't1', tenantName: 'Escritório', ageDays: 3, extensions },
}) as unknown as WorkspaceCatalog;

const CERTO = { 'param.outorgante': literal('p1'), belongsTo: literal('outorgante') };

describe('o passo que gera o modelo de OUTRO pacote, no check', () => {
  it('confere pelo retrato da instalação, e diz de onde leu', () => {
    const [achado] = documentStepFindings(contratos(CERTO), leitura([], [{ id: 'com.acme.pessoas', documentTemplates: [PROCURACAO()] }]));
    expect(achado.status).toBe('ok');
    expect(achado.detail).toContain('installed-catalog.json');
  });

  it('recusa o que o modelo instalado não aceita, nomeando o defeito', () => {
    const [achado] = documentStepFindings(
      contratos({ ...CERTO, 'param.finalidad': literal('x'), belongsTo: literal('finalidade') }),
      leitura([], [{ id: 'com.acme.pessoas', documentTemplates: [PROCURACAO()] }]),
    );
    expect(achado.status).toBe('refused');
    expect(achado.detail).toContain('"finalidad"');
    expect(achado.detail).toContain('"finalidade"');
  });

  it('o plugin.ts do diretório vence o retrato — é dele que sai a próxima versão', () => {
    const read = leitura(
      [{ pluginId: 'com.acme.pessoas', documentTemplates: [PROCURACAO('mandante')] }],
      [{ id: 'com.acme.pessoas', documentTemplates: [PROCURACAO()] }],
    );
    const [achado] = documentStepFindings(contratos(CERTO), read);
    expect(achado.status).toBe('refused');
    expect(achado.detail).toContain('plugin.ts of com.acme.pessoas');
  });

  it('o modelo que ninguém visível declara é aviso, e o retrato de um Console antigo é dito', () => {
    expect(documentStepFindings(contratos(CERTO), leitura([], null)).map((one) => one.status)).toEqual(['unverifiable']);

    const [antigo] = documentStepFindings(contratos(CERTO), leitura([], [{ id: 'com.acme.pessoas' }]));
    expect(antigo.status).toBe('unverifiable');
    expect(antigo.detail).toContain('older than that field');
  });

  it('o modelo do próprio pacote não entra aqui: a porta única já o confere', () => {
    const proprio = {
      ...contratos(CERTO),
      manifest: {
        ...contratos(CERTO).manifest,
        contributes: [{ point: 'document.template', id: 'procuracao', apiVersion: '1.0.0', metadata: { key: 'procuracao' } }],
      },
    } as MarketplacePlugin;
    expect(pendingDocumentSteps(proprio)).toEqual([]);
    expect(pendingDocumentSteps(contratos(CERTO)).map((one) => one.templateKey)).toEqual(['procuracao']);
  });
});

/**
 * O recibo do `document-example` gerado por OUTRO pacote: a chave que ninguém visível declara é aviso, e
 * o modelo de uma irmã escrita neste diretório é conferido — e recusa.
 */
describe('o recibo do document-example citado de fora', () => {
  const recibo = declaredDocumentTemplates(documentExamplePlugin.manifest.contributes)
    .filter((template) => template.key === 'installment-receipt')
    .map((template) => ({ ...template, key: 'recibo-de-fora' }));

  const comPasso = (extra: Record<string, InputMapping>): MarketplacePlugin => ({
    ...documentExamplePlugin,
    workflows: documentExamplePlugin.workflows.map((workflow) => ({
      ...workflow,
      steps: workflow.steps.map((step) => ({
        ...step,
        configuration: { ...(step.configuration ?? {}), templateKey: literal('recibo-de-fora'), ...extra },
      })),
    })),
  });

  it('ninguém visível declara: não dá para conferir daqui', () => {
    expect(documentStepFindings(comPasso({}), leitura([], null)).map((one) => one.status)).toEqual(['unverifiable']);
  });

  it('uma irmã do diretório declara: o passo é conferido contra ela', () => {
    const irma = leitura([{ pluginId: 'com.example.templates', documentTemplates: recibo }], null);
    expect(documentStepFindings(comPasso({}), irma).map((one) => one.status)).toEqual(['ok']);

    const [achado] = documentStepFindings(comPasso({ belongsTo: literal('note') }), irma);
    expect(achado.status).toBe('refused');
    expect(achado.detail).toContain('com.example.templates');
    expect(achado.detail).toContain('"note"');
  });
});
