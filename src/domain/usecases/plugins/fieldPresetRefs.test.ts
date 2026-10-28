import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../entities/MarketplacePlugin';
import { fieldRulePresetContribution } from '../../schema/dataExtensionPoints';
import { brasilPlugin } from '../../../plugins/marketplace/brasil';
import type { FieldPresetOwner } from './fieldPresetRefs';
import { fieldPresetChecks, fieldPresetIssues, fieldPresetOwnerOf } from './fieldPresetRefs';
import { packageIssues } from './pluginReferences';

const BRASIL = brasilPlugin.manifest.id;

const field = (key: string, extra: Partial<TemplateField> = {}): TemplateField =>
  ({ key, label: key, type: 'text', order: 0, required: false, ...extra }) as TemplateField;

const masked = (key: string, mask: string): TemplateField => field(key, { type: 'masked', mask });

const screenWith = (...fields: TemplateField[]): ScreenModuleTemplate => ({
  key: 'contribuintes',
  titleSingular: 'Contribuinte',
  titlePlural: 'Contribuintes',
  icon: 'person',
  titleFieldKey: 'nome',
  fields: [field('nome'), ...fields],
});

const dte = (
  fields: TemplateField[],
  { dependencies = { [BRASIL]: { version: '^1.2.0' } }, contributes = [] }: Partial<MarketplacePlugin['manifest']> = {},
): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.dte-cad', version: '0.1.0', kernel: '^2.80.0', name: 'DTE', dependencies, contributes },
  workflows: [],
  screens: [screenWith(...fields)],
});

const brasil: FieldPresetOwner = fieldPresetOwnerOf(brasilPlugin);

const verdicts = (pkg: MarketplacePlugin, visible: FieldPresetOwner[] = []): string[] =>
  fieldPresetChecks(pkg, visible).map((check) => check.verdict);

describe('o preset que um campo nomeia, conferido na porta única (sem enxergar outra extensão)', () => {
  it('não diz nada sobre a chave que pode morar numa dependência declarada', () => {
    const pkg = dte([masked('documento', 'cpf-cnpj')]);
    expect(verdicts(pkg)).toEqual(['unverifiable']);
    expect(fieldPresetIssues(pkg)).toEqual([]);
  });

  it('não recusa quem usa preset de extensão sem declará-la — instala como instalava', () => {
    const pkg = dte([masked('documento', 'cpf')], { dependencies: {} });
    expect(verdicts(pkg)).toEqual(['no-provider']);
    expect(fieldPresetIssues(pkg)).toEqual([]);
  });

  it('aceita o preset do próprio pacote quando ele tem a parte que o campo usa', () => {
    const placa = fieldRulePresetContribution({
      key: 'com.acme.dte-cad/placa',
      label: 'Placa',
      mask: { templates: ['AAA-0A00'] },
      format: [{ op: 'upper' }],
    });
    const pkg = dte(
      [masked('placa', 'com.acme.dte-cad/placa'), field('placaTexto', { rules: { format: { preset: 'com.acme.dte-cad/placa' } } })],
      { contributes: [placa] },
    );
    expect(verdicts(pkg)).toEqual(['ok', 'ok']);
  });

  it('recusa o preset do kernel que não tem a parte pedida — digits não é máscara', () => {
    const issues = fieldPresetIssues(dte([masked('documento', 'digits')], { dependencies: {} }));
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.package.field.preset.slot',
      messageParams: {
        screen: 'contribuintes',
        field: 'documento',
        preset: 'digits',
        path: 'mask',
        part: 'mask',
        owner: 'core.data',
      },
    }]);
  });

  it('recusa o preset do próprio pacote sem a parte que o campo usa', () => {
    const soFormata = fieldRulePresetContribution({ key: 'com.acme.dte-cad/limpa', label: 'Limpa', format: [{ op: 'trim' }] });
    const pkg = dte([field('nome2', { rules: { validate: { check: 'com.acme.dte-cad/limpa' } } })], { contributes: [soFormata] });
    expect(fieldPresetIssues(pkg).map((issue) => issue.messageParams?.path)).toEqual(['rules.validate.check']);
  });

  it('chega à porta única: packageIssues leva a recusa', () => {
    const messages = packageIssues(dte([masked('documento', 'digits')], { dependencies: {} })).map((issue) => issue.message);
    expect(messages).toContain('@core.marketplace/issue.package.field.preset.slot');
  });

  it('ignora mask fora de campo masked, e o masked sem mask', () => {
    const pkg = dte([field('nota', { mask: 'cpf-cnpj' }), field('documento', { type: 'masked' })], { dependencies: {} });
    expect(fieldPresetChecks(pkg)).toEqual([]);
  });

  it('confere também os campos de um complemento de tela (screenPatches)', () => {
    const pkg: MarketplacePlugin = {
      ...dte([], { dependencies: {} }),
      screenPatches: [{ target: 'pessoas', fields: [masked('documento', 'upper')] }],
    } as MarketplacePlugin;
    expect(fieldPresetChecks(pkg).map((check) => [check.ref.screen, check.verdict])).toEqual([['pessoas', 'wrong-slot']]);
  });
});

describe('o mesmo preset, quando a dependência está à vista (o check do SDK)', () => {
  it('recusa a chave que a dependência lida não tem, e sugere a grafia que ela tem — o caso do DTE-CAD 0.1.x', () => {
    const issues = fieldPresetIssues(dte([masked('documento', 'cpf-cnpj')]), [brasil]);
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.package.field.preset.absent.suggest',
      messageParams: {
        screen: 'contribuintes',
        field: 'documento',
        preset: 'cpf-cnpj',
        path: 'mask',
        part: 'mask',
        dependencies: BRASIL,
        suggestion: 'cpfCnpj',
      },
    }]);
  });

  it('sem grafia parecida, recusa sem sugerir', () => {
    const [issue] = fieldPresetIssues(dte([masked('documento', 'rg')]), [brasil]);
    expect(issue.message).toBe('@core.marketplace/issue.package.field.preset.absent');
  });

  it('aceita a chave certa da dependência, nos três lugares', () => {
    const pkg = dte([
      masked('documento', 'cpfCnpj'),
      field('cep', { rules: { format: { preset: 'cep' } } }),
      field('cpf', { rules: { validate: { check: 'cpf' } } }),
    ]);
    expect(verdicts(pkg, [brasil])).toEqual(['ok', 'ok', 'ok']);
  });

  it('recusa o preset da dependência que não tem a parte pedida', () => {
    const pkg = dte([field('telefone', { rules: { validate: { check: 'phone' } } })]);
    expect(fieldPresetIssues(pkg, [brasil]).map((issue) => issue.messageParams?.owner)).toEqual([BRASIL]);
  });

  it('avisa, sem recusar, quando a chave só existe numa extensão que o pacote não declara', () => {
    const pkg = dte([masked('documento', 'cpf')], { dependencies: {} });
    expect(verdicts(pkg, [brasil])).toEqual(['undeclared']);
    expect(fieldPresetIssues(pkg, [brasil])).toEqual([]);
  });

  it('não recusa enquanto alguma dependência declarada não estiver à vista', () => {
    const pkg = dte([masked('documento', 'cpf-cnpj')], {
      dependencies: { [BRASIL]: { version: '^1.2.0' }, 'com.acme.docs': { version: '^1.0.0' } },
    });
    const [check] = fieldPresetChecks(pkg, [brasil]);
    expect(check.verdict).toBe('unverifiable');
    expect(check.unseen).toEqual(['com.acme.docs']);
    expect(check.suggestion).toBe('cpfCnpj');
  });

  it('a dependência do kernel não conta como fonte que falta ver', () => {
    const pkg = dte([masked('documento', 'cpf-cnpj')], {
      dependencies: { [BRASIL]: { version: '^1.2.0' }, 'core.data': { version: '^1.0.0' } },
    });
    expect(verdicts(pkg, [brasil])).toEqual(['absent']);
  });

  it('o kernel vence a extensão que redeclara a chave, como no catálogo em runtime', () => {
    const impostor: FieldPresetOwner = { pluginId: BRASIL, presets: [{ key: 'digits', slots: ['mask'] }] };
    expect(verdicts(dte([masked('documento', 'digits')]), [impostor])).toEqual(['wrong-slot']);
  });
});
