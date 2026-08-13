import { describe, it, expect } from 'vitest';
import {
  buildTranslationPackage,
  isTranslationOnlyPackage,
  languageTitle,
  suggestedPluginId,
  translationKeyCount,
  translationOverwriteIssue,
} from './translationPackage';
import type { MessageBundle } from '../../schema/i18n/messages';
import { buildMessageCatalog, translate } from '../../schema/i18n/messages';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../schema/i18n/extensionPoints';
import { parsePackage, serializePackage } from '../plugins/packageSerialization';
import { validatePackage } from '../plugins/pluginReferences';
import { validatePluginManifest } from '../../schema/plugin/pluginManifest';
import { hasErrors } from '../../schema/plugin/diagnostics';
import { KERNEL_VERSION } from '../../schema/plugin/kernelVersion';
import { createPluginHost } from '../../../kernel';
import { CORE_PLUGINS } from '../../../plugins';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

const source: MessageBundle[] = [
  { locale: 'en', namespace: 'core.ui', messages: { 'action.save': 'Save', 'action.cancel': 'Cancel' } },
  { locale: 'en', namespace: 'core.admin', messages: { 'nav.audit-logs': 'Audit Log' } },
];

describe('buildTranslationPackage', () => {
  it('produz uma EXTENSÃO comum, não um formato próprio', () => {
    const pkg = buildTranslationPackage({ bundles: source, targetLocale: 'es' });
    expect(pkg.manifest.id).toBe('locale.es');
    expect(pkg.workflows).toEqual([]);
    expect(pkg.manifest.contributes?.every((c) => c.point === I18N_MESSAGES_POINT)).toBe(true);
    expect(
      hasErrors(
        validatePluginManifest(pkg.manifest, {
          kernelVersion: KERNEL_VERSION,
          validateContributions: false,
        }),
      ),
    ).toBe(false);
    expect(validatePackage(pkg)).toEqual([]);
  });

  /** Um valor por chave, já preenchido — o tradutor sobrescreve por cima, sem campo paralelo. */
  it('preenche com o texto-fonte quando ainda não há tradução', () => {
    const pkg = buildTranslationPackage({ bundles: source, targetLocale: 'es' });
    const ui = messageBundlesOf(pkg.manifest.contributes ?? []).find((b) => b.namespace === 'core.ui');
    expect(ui?.messages).toEqual({ 'action.save': 'Save', 'action.cancel': 'Cancel' });
    expect(translationKeyCount(pkg)).toBe(3);
  });

  it('preenche com a tradução existente quando ela já está instalada', () => {
    const withExisting = [
      ...source,
      { locale: 'es', namespace: 'core.ui', messages: { 'action.save': 'Guardar' } },
    ];
    const pkg = buildTranslationPackage({ bundles: withExisting, targetLocale: 'es' });
    const ui = messageBundlesOf(pkg.manifest.contributes ?? []).find((b) => b.namespace === 'core.ui');
    expect(ui?.messages).toEqual({ 'action.save': 'Guardar', 'action.cancel': 'Cancel' });
  });

  it('carimba o idioma pedido em toda contribuição', () => {
    const pkg = buildTranslationPackage({ bundles: source, targetLocale: 'pt_br' });
    expect(messageBundlesOf(pkg.manifest.contributes ?? []).every((b) => b.locale === 'pt-BR')).toBe(true);
  });
});

describe('languageTitle', () => {
  /** O `Intl` devolve "português (Brasil)" em minúscula — certo na frase, errado como título. */
  it('capitaliza o nome do idioma', () => {
    expect(languageTitle('pt-BR')).toMatch(/^P/);
    expect(languageTitle('es')).toMatch(/^E/);
  });
});

describe('isTranslationOnlyPackage', () => {
  const translationPack = () => buildTranslationPackage({ bundles: source, targetLocale: 'es' });

  it('reconhece o pacote só de mensagens', () => {
    expect(isTranslationOnlyPackage(translationPack())).toBe(true);
  });

  it('recusa quando há qualquer outro artefato junto', () => {
    const withScreen: MarketplacePlugin = {
      ...translationPack(),
      screens: [{ key: 'x' } as never],
    };
    expect(isTranslationOnlyPackage(withScreen)).toBe(false);

    const withStartup: MarketplacePlugin = { ...translationPack(), startup: 'export default () => {};' };
    expect(isTranslationOnlyPackage(withStartup)).toBe(false);
  });

  it('recusa quando há contribuição de outro ponto', () => {
    const pkg = translationPack();
    const mixed: MarketplacePlugin = {
      ...pkg,
      manifest: {
        ...pkg.manifest,
        contributes: [
          ...(pkg.manifest.contributes ?? []),
          { point: 'ui.nav', id: 'x', apiVersion: '1.0.0', metadata: {} },
        ],
      },
    };
    expect(isTranslationOnlyPackage(mixed)).toBe(false);
  });

  it('recusa o pacote sem contribuição nenhuma', () => {
    expect(isTranslationOnlyPackage({ summary: '', workflows: [], manifest: { id: 'a.b', version: '1.0.0', kernel: '^1.0.0', name: 'x' } })).toBe(false);
  });
});

/**
 * A guarda é SIMÉTRICA: as duas direções são o mesmo erro visto de lados opostos. Recusar só uma
 * deixaria a outra aberta — uma extensão com telas trocaria o idioma do escritório sem que ninguém
 * a associasse a idioma nenhum.
 */
describe('translationOverwriteIssue', () => {
  const translation = () => buildTranslationPackage({ bundles: source, targetLocale: 'es' });
  const rich = (): MarketplacePlugin => ({
    summary: 'x',
    workflows: [],
    screens: [{ key: 'processos' } as never],
    manifest: { id: 'locale.es', version: '1.0.0', kernel: '^1.0.0', name: 'Processos' },
  });

  it('deixa passar quando não há nada instalado com o id', () => {
    expect(translationOverwriteIssue(translation(), undefined)).toBeNull();
  });

  it('deixa passar a atualização de um idioma por outro idioma', () => {
    expect(translationOverwriteIssue(translation(), translation())).toBeNull();
  });

  it('recusa tradução tomando o lugar de extensão com telas', () => {
    const issue = translationOverwriteIssue(translation(), rich());
    expect(issue).toContain('não é um pacote de idioma');
  });

  it('recusa extensão com telas tomando o lugar de um idioma', () => {
    const issue = translationOverwriteIssue(rich(), translation());
    expect(issue).toContain('não pode tomar o lugar');
  });
});

/**
 * O ciclo do usuário, sem etapa fingida: baixar → traduzir dentro do arquivo → importar pela mesma
 * porta de qualquer extensão → o Kernel real serve o texto traduzido.
 */
describe('baixar → traduzir → importar', () => {
  it('fecha o ciclo com um formato só', () => {
    const host = createPluginHost({ kernelVersion: KERNEL_VERSION });
    host.load([...CORE_PLUGINS]);
    const installed = messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT));

    const draft = buildTranslationPackage({
      bundles: installed,
      targetLocale: 'es',
      pluginId: suggestedPluginId('es'),
    });

    // O tradutor edita o valor dentro do próprio arquivo de extensão.
    const edited = JSON.parse(serializePackage(draft)) as MarketplacePlugin;
    const adminBundle = (edited.manifest.contributes ?? []).find(
      (c) => (c.metadata as { namespace: string }).namespace === 'core.admin',
    );
    (adminBundle?.metadata as { messages: Record<string, string> }).messages['nav.audit-logs'] =
      'Registro de auditoría';

    const reimported = parsePackage(JSON.stringify(edited));
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(isTranslationOnlyPackage(reimported.package)).toBe(true);

    const withPack = createPluginHost({ kernelVersion: KERNEL_VERSION });
    const result = withPack.load([...CORE_PLUGINS, { manifest: reimported.package.manifest }]);
    expect(hasErrors(result.diagnostics)).toBe(false);

    const catalog = buildMessageCatalog(
      messageBundlesOf(withPack.contributions.query(I18N_MESSAGES_POINT)),
      'es',
    );
    expect(translate(catalog, 'core.admin/nav.audit-logs')).toBe('Registro de auditoría');
    /** O que ficou com o texto-fonte simplesmente aparece no idioma-fonte. */
    expect(translate(catalog, 'core.settings/nav.settings')).toBe('Settings');
  });

  /** O arquivo baixado aqui é importável em Extensões, e vice-versa: uma porta só, nos dois sentidos. */
  it('o arquivo baixado é um pacote que a importação comum aceita', () => {
    const pkg = buildTranslationPackage({ bundles: source, targetLocale: 'es' });
    const parsed = parsePackage(serializePackage(pkg));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.package.manifest.id).toBe('locale.es');
  });
});
