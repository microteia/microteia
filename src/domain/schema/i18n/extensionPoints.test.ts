import { describe, it, expect } from 'vitest';
import { KERNEL_VERSION } from '../../schema/plugin/kernelVersion';
import {
  I18N_EXTENSION_POINTS,
  I18N_MESSAGES_POINT,
  messageBundleContribution,
  messageBundleOf,
  messageBundlesOf,
  packageMessageCatalog,
} from './extensionPoints';
import { buildMessageCatalog, catalogWithFallback, translate } from './messages';
import { createPluginHost } from '../../../kernel';
import type { PluginRecord } from '../../../kernel';
import { hasErrors } from '../plugin/diagnostics';

const host = () => createPluginHost({ kernelVersion: KERNEL_VERSION });

const i18nOwner: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.i18n',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Núcleo de Idioma',
    extensionPoints: I18N_EXTENSION_POINTS,
  },
};

describe('o ponto i18n.messages', () => {
  /**
   * A decisão central: sem `allowedImplKinds`, uma tradução é metadata pura — e por isso pode vir de
   * qualquer plugin, sem código para revisar e sem gesto de confiança a exigir.
   */
  it('não aceita implementação de nenhum tipo', () => {
    const point = I18N_EXTENSION_POINTS[0];
    expect(point.id).toBe(I18N_MESSAGES_POINT);
    expect(point.allowedImplKinds).toEqual([]);
    expect(point.implRequired).toBe(false);
    expect(point.multiple).toBe(true);
  });
});

describe('messageBundleContribution', () => {
  it('gera um id estável a partir do idioma e do namespace', () => {
    const contribution = messageBundleContribution({
      locale: 'pt-BR',
      namespace: 'core.ui',
      messages: {},
    });
    expect(contribution.id).toBe('pt-br.core.ui');
    expect(contribution.point).toBe(I18N_MESSAGES_POINT);
  });

  it('faz o caminho de volta', () => {
    const bundle = { locale: 'pt-BR', namespace: 'core.ui', messages: { a: 'b' } };
    expect(messageBundleOf(messageBundleContribution(bundle))).toEqual(bundle);
  });

  it('descarta metadata malformada de terceiro sem lançar', () => {
    expect(messageBundleOf({ point: I18N_MESSAGES_POINT, id: 'x', apiVersion: '1.0.0', metadata: {} }))
      .toBeNull();
  });
});

describe('um pacote SÓ de traduções', () => {
  const translationPack: PluginRecord = {
    manifest: {
      id: 'com.acme.locale-pt-br',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'Português (Brasil)',
      dependencies: { 'core.i18n': '^1.0.0' },
      contributes: [
        messageBundleContribution({
          locale: 'pt-BR',
          namespace: 'core.ui',
          messages: { 'nav.settings': 'Configurações' },
        }),
      ],
    },
  };

  /**
   * A prova do desenho inteiro: um plugin de TERCEIRO (`trusted` ausente), sem telas, sem código e
   * sem workflows, traduz um texto que pertence ao NÚCLEO — e carrega sem um único diagnóstico.
   */
  it('carrega sem erro mesmo não sendo confiável, e traduz texto do núcleo', () => {
    const kernel = host();
    const result = kernel.load([i18nOwner, translationPack]);

    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.loaded).toContain('com.acme.locale-pt-br');

    const bundles = messageBundlesOf(kernel.contributions.query(I18N_MESSAGES_POINT));
    const catalog = buildMessageCatalog(bundles, 'pt-BR');
    expect(translate(catalog, 'core.ui/nav.settings')).toBe('Configurações');
  });

  it('é recusado quando o núcleo de idioma não está instalado', () => {
    const result = host().load([translationPack]);
    expect(result.loaded).not.toContain('com.acme.locale-pt-br');
    expect(hasErrors(result.diagnostics)).toBe(true);
  });

  /**
   * A ordem entre dois pacotes que traduzem a mesma chave é a do registro — prioridade primeiro,
   * depois alfabética por pluginId — e NUNCA a ordem de carga. É o que faz a sobreposição de uma
   * tradução ser previsível entre um boot e outro.
   */
  it('a prioridade decide quem vence a mesma chave, não quem carregou depois', () => {
    const override: PluginRecord = {
      manifest: {
        id: 'com.zzz.override',
        version: '1.0.0',
        kernel: '^2.0.0',
        name: 'Ajuste de termos',
        dependencies: { 'core.i18n': '^1.0.0' },
        contributes: [
          messageBundleContribution(
            { locale: 'pt-BR', namespace: 'core.ui', messages: { 'nav.settings': 'Preferências' } },
            10,
          ),
        ],
      },
    };

    const kernel = host();
    kernel.load([i18nOwner, translationPack, override]);

    const catalog = buildMessageCatalog(
      messageBundlesOf(kernel.contributions.query(I18N_MESSAGES_POINT)),
      'pt-BR',
    );
    expect(translate(catalog, 'core.ui/nav.settings')).toBe('Preferências');
  });
});

/**
 * O pacote listado ANTES de existir no escritório. É o defeito que se via na tela de Extensões: o
 * catálogo global só conhece quem está instalado e ativo, então o nome de uma extensão do catálogo
 * público aparecia como a chave crua.
 */
describe('o catálogo que o próprio pacote traz', () => {
  const packageContributions = [
    messageBundleContribution({
      locale: 'en',
      namespace: 'com.acme.news',
      messages: { 'package.name': 'News', 'package.summary': 'Internal announcements' },
    }),
    messageBundleContribution({
      locale: 'pt-BR',
      namespace: 'com.acme.news',
      messages: { 'package.name': 'Notícias' },
    }),
    {
      point: 'ui.page',
      id: 'news',
      apiVersion: '1.0.0',
      metadata: { title: '@com.acme.news/package.name' },
    },
  ];

  it('lê os textos do manifest, sem passar pelo host', () => {
    const catalog = packageMessageCatalog(packageContributions, 'pt-BR');
    expect(translate(catalog, 'com.acme.news/package.name')).toBe('Notícias');
    // O idioma-fonte continua embaixo: o resumo só existe em `en` e é ele que aparece.
    expect(translate(catalog, 'com.acme.news/package.summary')).toBe('Internal announcements');
  });

  it('ignora contribuição que não é de mensagem', () => {
    const catalog = packageMessageCatalog(packageContributions, 'en');
    expect(Object.keys(catalog.messages)).toEqual([
      'com.acme.news/package.name',
      'com.acme.news/package.summary',
    ]);
  });

  it('não sobrepõe o catálogo do escritório — é fallback dele', () => {
    const installed = buildMessageCatalog(
      [{ locale: 'pt-BR', namespace: 'com.acme.news', messages: { 'package.name': 'Comunicados' } }],
      'pt-BR',
    );
    const merged = catalogWithFallback(installed, packageMessageCatalog(packageContributions, 'pt-BR'));

    expect(translate(merged, 'com.acme.news/package.name')).toBe('Comunicados');
    expect(translate(merged, 'com.acme.news/package.summary')).toBe('Internal announcements');
  });
});
