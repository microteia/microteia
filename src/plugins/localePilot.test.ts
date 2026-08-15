import { describe, it, expect } from 'vitest';
import { CORE_PLUGINS } from './index';
import { localePtBrPlugin } from './marketplace/localePtBr';
import { ptBrLicensePlugin } from './bundledLocales/ptBrLicense';
import { createPluginHost } from '../kernel';
import type { PluginRecord } from '../kernel';
import { hasErrors } from '../domain/schema/plugin/diagnostics';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../domain/schema/i18n/extensionPoints';
import { buildMessageCatalog } from '../domain/schema/i18n/messages';
import { resolveLabel } from '../domain/schema/i18n/messageRef';
import { UI_NAV_POINT, UI_PAGE_POINT } from '../presentation/shared/uiExtensionPoints';

const asRecord = (): PluginRecord => ({ manifest: localePtBrPlugin.manifest });

const hostWith = (extra: PluginRecord[] = []) => {
  const host = createPluginHost({ kernelVersion: KERNEL_VERSION });
  const result = host.load([...CORE_PLUGINS, ...extra]);
  return { host, result };
};

const catalogFor = (host: ReturnType<typeof hostWith>['host'], locale: string) =>
  buildMessageCatalog(messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT)), locale);

const navLabel = (host: ReturnType<typeof hostWith>['host'], key: string): string =>
  host.contributions
    .query(UI_NAV_POINT)
    .map((contribution) => contribution.metadata as { key: string; label: string })
    .find((metadata) => metadata.key === key)?.label ?? '';

const pageTitle = (host: ReturnType<typeof hostWith>['host'], key: string): string =>
  host.contributions
    .query(UI_PAGE_POINT)
    .map((contribution) => contribution.metadata as { key?: string; title: string })
    .find((metadata) => metadata.key === key)?.title ?? '';

describe('os plugins do núcleo', () => {
  it('carregam sem diagnóstico de erro com o ponto de idioma no ar', () => {
    const { result } = hostWith();
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.loaded).toContain('core.i18n');
  });

  /**
   * O rótulo declarado deixou de ser texto e virou REFERÊNCIA. É essa troca que permite traduzi-lo
   * sem que o plugin que o declara saiba que existem idiomas.
   */
  it('declaram rótulo como referência, não como frase', () => {
    const { host } = hostWith();
    expect(navLabel(host, 'audit-logs')).toBe('@core.admin/nav.audit-logs');
    expect(pageTitle(host, 'settings')).toBe('@core.settings/page.settings');
  });

  it('publicam o catálogo do idioma-fonte', () => {
    const { host } = hostWith();
    const catalog = catalogFor(host, 'en');
    expect(resolveLabel(catalog, navLabel(host, 'audit-logs'))).toBe('Audit Log');
    expect(resolveLabel(catalog, pageTitle(host, 'settings'))).toBe('Settings');
  });
});

describe('o pacote Português (Brasil)', () => {
  it('não traz tela, workflow nem código — só contribuições', () => {
    expect(localePtBrPlugin.workflows).toEqual([]);
    expect(localePtBrPlugin.screens).toBeUndefined();
    expect(localePtBrPlugin.views).toBeUndefined();
    expect(localePtBrPlugin.startup).toBeUndefined();
    expect(localePtBrPlugin.manifest.contributes?.length).toBeGreaterThan(0);
  });

  it('instalado, devolve a interface ao português', () => {
    const { host, result } = hostWith([asRecord()]);
    expect(hasErrors(result.diagnostics)).toBe(false);

    const catalog = catalogFor(host, 'pt-BR');
    expect(resolveLabel(catalog, navLabel(host, 'audit-logs'))).toBe('Auditoria');
    expect(resolveLabel(catalog, pageTitle(host, 'settings'))).toBe('Configurações');
    expect(resolveLabel(catalog, pageTitle(host, 'tenant-settings'))).toBe('Escritório');
  });

  /**
   * O teste que define "agnóstico": desinstalar o português não deixa buraco nenhum — a interface
   * volta ao idioma-fonte. Se alguma chave sumisse aqui, seria sinal de que o português ainda estava
   * escrito no núcleo em algum lugar.
   */
  it('desinstalado, a interface volta inteira ao inglês', () => {
    const { host } = hostWith();
    const catalog = catalogFor(host, 'pt-BR');
    expect(resolveLabel(catalog, navLabel(host, 'audit-logs'))).toBe('Audit Log');
    expect(resolveLabel(catalog, pageTitle(host, 'tenant-settings'))).toBe('Organization');
  });

  /**
   * O que define a separação: o pacote do SISTEMA não pode carregar o contrato jurídico. Se um dia
   * uma chave de `core.license` vazar para cá, quem só quer a interface em português volta a baixar
   * páginas de texto legal — que é exatamente o que a divisão em dois desfez.
   */
  it('não carrega o contrato jurídico junto do idioma do sistema', () => {
    const namespaces = (localePtBrPlugin.manifest.contributes ?? [])
      .map((contribution) => (contribution.metadata as { namespace?: string }).namespace);
    expect(namespaces).not.toContain('core.license');

    const licenseNamespaces = (ptBrLicensePlugin.manifest.contributes ?? [])
      .map((contribution) => (contribution.metadata as { namespace?: string }).namespace);
    expect(licenseNamespaces).toEqual(['core.license']);
  });

  /**
   * O contrato traduz na tela PÚBLICA, e é isso que exige que ele seja embutido: `/license` é
   * servida pelo `LocaleProvider` de cima, que só enxerga `CORE_PLUGINS`. Este teste falha no dia em
   * que alguém o transformar de volta em extensão instalável — que foi o erro que o quebrou.
   */
  it('traduz o contrato sem nenhuma extensão instalada', () => {
    const { host } = hostWith();
    const catalog = catalogFor(host, 'pt-BR');
    expect(resolveLabel(catalog, '@core.license/page.title')).toBe('Termos de Uso e Política de Privacidade');
  });

  /**
   * Toda chave que o núcleo declara precisa existir em ALGUM pacote pt-BR — senão a tradução tem
   * furo. São dois pacotes porque o contrato jurídico é distribuído à parte, e é a soma deles que
   * tem de cobrir o núcleo.
   */
  it('cobre todas as chaves publicadas pelo núcleo', () => {
    const { host } = hostWith([asRecord()]);
    const bundles = messageBundlesOf(host.contributions.query(I18N_MESSAGES_POINT));

    const keysOf = (locale: string) =>
      new Set(
        bundles
          .filter((bundle) => bundle.locale === locale)
          .flatMap((bundle) => Object.keys(bundle.messages).map((key) => `${bundle.namespace}/${key}`)),
      );

    // Os dois conjuntos são montados UMA vez: com `keysOf('pt-BR')` dentro do filtro, o teste
    // remontava o catálogo inteiro a cada chave e passou a estourar o tempo quando ele cresceu.
    const source = keysOf('en');
    const translated = keysOf('pt-BR');
    const missing = Array.from(source).filter((key) => !translated.has(key));
    expect(missing).toEqual([]);
  });
});
