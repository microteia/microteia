import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { UI_API_VERSION, UI_SETTINGS_POINT } from '../../schema/ui/uiExtensionPoints';
import { packageSettingsIssues, settingsOutRefs } from './pluginSettings';
import { REF_EXTERNAL_MESSAGE, validatePackage } from './pluginReferences';

const withProperties = (
  properties: Array<Record<string, unknown>>,
  extra: Partial<MarketplacePlugin> = {},
  dependencies: MarketplacePlugin['manifest']['dependencies'] = undefined,
): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.processo',
    version: '1.0.0',
    kernel: '^2.22.0',
    name: 'Processos',
    ...(dependencies ? { dependencies } : {}),
    contributes: [{
      point: UI_SETTINGS_POINT,
      id: 'processo',
      apiVersion: UI_API_VERSION,
      metadata: { key: 'processo', title: 'Processos', properties },
    }],
  },
  workflows: [],
  ...extra,
});

const status = {
  key: 'processo.recentes.status',
  label: 'Status',
  type: 'select' as const,
  multi: true,
  optionsFrom: { kind: 'lookup' as const, collection: 'caseStatuses' },
  default: ['Em Andamento'],
  scopes: ['user' as const, 'tenant' as const],
};

const OWN_LOOKUP = { lookups: [{ collection: 'caseStatuses', label: 'Status' }] };

describe('a declaração de uma propriedade com optionsFrom', () => {
  it('aceita a lista de opções que o pacote declara', () => {
    const pkg = withProperties([status], OWN_LOOKUP);
    expect(packageSettingsIssues(pkg)).toEqual([]);
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('recusa options e optionsFrom juntas, apontando o caminho', () => {
    const pkg = withProperties([{ ...status, options: [{ value: 'a', label: 'A' }] }], OWN_LOOKUP);
    expect(packageSettingsIssues(pkg)).toEqual([{
      message: '@core.marketplace/issue.package.settings.options-conflict',
      messageParams: {
        id: 'processo',
        key: status.key,
        where: 'contributes[0].metadata.properties[0].optionsFrom',
      },
    }]);
  });

  it('recusa optionsFrom e multi fora de um select', () => {
    const pkg = withProperties([{ ...status, type: 'text' }], OWN_LOOKUP);
    expect(packageSettingsIssues(pkg).map((issue) => issue.message)).toEqual([
      '@core.marketplace/issue.package.settings.options-from-type',
      '@core.marketplace/issue.package.settings.multi-type',
    ]);
  });

  it('recusa a fonte que não diz de onde', () => {
    const pkg = withProperties([{ ...status, optionsFrom: { kind: 'tabela', collection: '' } }]);
    expect(packageSettingsIssues(pkg).map((issue) => issue.message))
      .toEqual(['@core.marketplace/issue.package.settings.options-from-invalid']);
  });

  it('recusa o default na forma errada para multi', () => {
    const pkg = withProperties([{ ...status, default: 'Em Andamento' }], OWN_LOOKUP);
    const [issue] = packageSettingsIssues(pkg);
    expect(issue.message).toBe('@core.marketplace/issue.package.settings.default');
    expect(issue.messageParams?.detail).toBe('@core.settings/setting.select.multi');
  });

  it('aceita o texto vazio como "nada escolhido" no select simples de coleção', () => {
    const owner = { ...status, multi: undefined, optionsFrom: { kind: 'lookup' as const, collection: 'caseStatuses' }, default: '' };
    expect(packageSettingsIssues(withProperties([owner], OWN_LOOKUP))).toEqual([]);
  });

  /** O select de opções fechadas sem `multi` já instalava: a checagem nova não muda a regra dele. */
  it('não confere o default do select fechado de antes', () => {
    const legacy = { key: 'x.modo', label: 'Modo', type: 'select', options: [{ value: 'a', label: 'A' }], default: '', scopes: ['tenant'] };
    expect(packageSettingsIssues(withProperties([legacy]))).toEqual([]);
  });
});

describe('a coleção de optionsFrom é uma referência como as outras', () => {
  it('a lista fora do pacote e das dependências é recusada com a frase das referências', () => {
    const pkg = withProperties([status]);
    expect(validatePackage(pkg)).toEqual([expect.objectContaining({
      message: REF_EXTERNAL_MESSAGE,
      ref: { kind: 'lookup', id: 'caseStatuses', from: { origin: '@core.marketplace/ref.origin.setting', name: status.key } },
    })]);
  });

  it('a lista que uma dependência declara trazer é aceita', () => {
    const pkg = withProperties([status], {}, { 'com.acme.base': { version: '^1.0.0', collections: ['caseStatuses'] } });
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('a tela fora do pacote é recusada; a do pacote e a de uma dependência, não', () => {
    const entity = { ...status, key: 'processo.responsavel', multi: undefined, default: '', optionsFrom: { kind: 'entity' as const, collection: 'persons' } };
    expect(validatePackage(withProperties([entity]))).toEqual([expect.objectContaining({
      message: REF_EXTERNAL_MESSAGE,
      ref: expect.objectContaining({ kind: 'screen', id: 'persons' }),
    })]);
    expect(validatePackage(withProperties([entity], {}, { 'com.acme.pessoas': { version: '^1.0.0', collections: ['persons'] } })))
      .toEqual([]);
  });

  it('a forma qualificada não nomeia uma lista', () => {
    const pkg = withProperties([{ ...status, optionsFrom: { kind: 'lookup', collection: 'com.acme.base/case-statuses' } }],
      {}, { 'com.acme.base': '^1.0.0' });
    expect(validatePackage(pkg).map((issue) => issue.message)).toEqual(['@core.marketplace/issue.ref.lookup-qualified']);
  });

  it('a propriedade malformada não vira referência — a recusa é da declaração', () => {
    expect(settingsOutRefs(withProperties([{ ...status, optionsFrom: { kind: 'lookup' } }]))).toEqual([]);
  });
});
