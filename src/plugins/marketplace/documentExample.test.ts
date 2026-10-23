import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { InputMapping } from '../../domain/entities/Workflow';
import { validatePluginPackage } from '../../sdk/validate';
import { documentExamplePlugin } from './examples/document-example/plugin';

/**
 * O passo do recibo (`wf-installment-receipt`) com UMA troca, validado pela mesma porta que o `check`,
 * o `validate_plugin` e a instalação usam. Cada troca aqui passava sem aviso, e só aparecia no
 * escritório: com o campo do documento em branco, ou com a recusa no clique.
 */
const comPasso = (troca: (configuration: Record<string, InputMapping>) => Record<string, InputMapping>): MarketplacePlugin => ({
  ...documentExamplePlugin,
  workflows: documentExamplePlugin.workflows.map((workflow) => ({
    ...workflow,
    steps: workflow.steps.map((step) => ({ ...step, configuration: troca({ ...(step.configuration ?? {}) }) })),
  })),
});

const recusas = (pkg: MarketplacePlugin): string[] =>
  validatePluginPackage(pkg)
    .map((issue) => issue.message)
    .filter((message) => message.startsWith('@core.marketplace/issue.step.document.'))
    .map((message) => message.replace('@core.marketplace/issue.step.document.', ''));

const literal = (value: string): InputMapping => ({ kind: 'Literal', value });

describe('o exemplo de documentos, conferido contra os próprios modelos', () => {
  it('como está, o exemplo passa', () => {
    expect(validatePluginPackage(documentExamplePlugin)).toEqual([]);
  });

  it('(1) recusa o param.<chave> que o modelo não declara', () => {
    expect(recusas(comPasso((config) => {
      const { 'param.note': note, ...rest } = config;
      return { ...rest, 'param.nota': note };
    }))).toEqual(['unknown-parameter']);
  });

  it('(2) recusa recordId num modelo de dados, como o editor do passo', () => {
    expect(recusas(comPasso((config) => ({ ...config, recordId: { kind: 'Event', path: 'agreementId' } }))))
      .toEqual(['record-only']);
  });

  it('(3) recusa o belongsTo que aponta para um parâmetro que não é de registro único', () => {
    expect(recusas(comPasso((config) => ({ ...config, belongsTo: literal('note') })))).toEqual(['belongs-to-invalid']);
  });

  it('(4) recusa o parâmetro obrigatório que ficou sem valor', () => {
    expect(recusas(comPasso((config) => {
      const { 'param.paidOn': _paidOn, ...rest } = config;
      expect(_paidOn).toBeDefined();
      return rest;
    }))).toEqual(['parameter-required']);
  });

  it('o modelo de registro (payment-plan) não recebe os dados do payload', () => {
    expect(recusas(comPasso((config) => ({ ...config, templateKey: literal('payment-plan') }))))
      .toEqual(expect.arrayContaining(['payload-only', 'input-required']));
  });

  /**
   * A chave que nenhum pacote declara NÃO é recusa: o escritório pode ter um modelo seu nela. Quem diz
   * que não dá para conferir — e recusa quando o modelo é de uma irmã do diretório — é o relatório das
   * ferramentas de autoria (`documentSteps.test.ts`).
   */
  it('a chave que o pacote não declara não é recusada pela porta do pacote', () => {
    expect(recusas(comPasso((config) => ({ ...config, templateKey: literal('nao-existe'), 'param.x': literal('x') })))).toEqual([]);
  });
});
