import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '../index';
import { THEME_MARKETPLACE_PLUGINS } from '../marketplace/themes';
import { RESERVED_THEME_IDS, SYSTEM_THEME_PACKAGES } from './systemThemes';
import { baseDarkTheme, baseLightTheme } from '../../shared/styles/theme';
import { THEME_BASES } from '../../shared/styles/theme';
import { themeTokensContribution } from '../../domain/schema/theme';
import type { PluginManifest } from '../../domain/schema/plugin/pluginManifest';
import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import {
  THEME_DEFINITION_POINT,
  THEME_API_VERSION,
  THEME_TOKENS_POINT,
  asThemeSpec,
  composeTheme,
  themeSpecsOf,
  themeTokenBundlesOf,
  resolveThemeTokens,
} from '../../domain/schema/theme';

/**
 * Uma extensão de exemplo que contribui UMA cor de vocabulário. Ela substitui as extensões de domínio
 * que este arquivo usava como fixture e que hoje são mantidas fora deste repositório — e é melhor
 * assim: o que o kernel garante é a MECÂNICA da resolução, não o tom que um negócio escolheu.
 */
const TOKEN_PLUGIN: PluginManifest = {
  id: 'com.example.vocabulario',
  version: '1.0.0',
  kernel: '^2.0.0',
  name: 'Vocabulário de exemplo',
  description: 'Contribui uma cor de vocabulário, com piso por base e ajuste por tema.',
  publisher: { name: 'Example' },
  contributes: [
    themeTokensContribution('vocabulario', {
      dark: { vocabularyDone: '#10b981' },
      light: { vocabularyDone: '#34d399' },
      themes: {
        themis: { vocabularyDone: '#2F6B4F' },
        'themis-night': { vocabularyDone: '#5FA37F' },
      },
    }),
  ],
};

const hostWithCore = () => {
  const host = createPluginHost();
  host.load(CORE_PLUGINS);
  return host;
};

const themeById = (id: string) => {
  const host = hostWithCore();
  const specs = themeSpecsOf(host.contributions.query(THEME_DEFINITION_POINT));
  const bundles = themeTokenBundlesOf(host.contributions.query(THEME_TOKENS_POINT));
  const spec = specs.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`tema ${id} não foi contribuído`);
  return composeTheme(
    THEME_BASES[spec.extends],
    resolveThemeTokens(bundles, spec.extends, spec.id),
    spec,
  );
};

describe('temas do sistema', () => {
  it('o escritório sem nenhuma extensão já tem os dois temas para escolher', () => {
    const specs = themeSpecsOf(hostWithCore().contributions.query(THEME_DEFINITION_POINT));
    expect(specs.map((spec) => spec.id).sort()).toEqual(['dark', 'white']);
  });

  /**
   * Os dois pacotes do sistema declaram ZERO cor: são ponteiros para as bases do kernel. Então a
   * asserção que vale é a identidade com a base, não um hex escrito à mão — que só registraria a
   * paleta do dia em que o teste foi escrito e passaria a pedir edição a cada afinação de cor.
   *
   * O que este teste impede é o Escuro passar a divergir do piso sem ninguém declarar nada: se um dia
   * `com.microteia.theme-dark` ganhar uma paleta própria, ou se a composição deixar de repassar a
   * base intacta, é aqui que aparece.
   */
  it('Escuro é a base escura, sem nada por cima', () => {
    const dark = themeById('dark');
    expect(dark.colors).toEqual(baseDarkTheme.colors);
    expect(dark.base).toBe('dark');
  });

  it('Claro é a base clara, sem nada por cima', () => {
    const white = themeById('white');
    expect(white.colors).toEqual(baseLightTheme.colors);
    expect(white.base).toBe('light');
  });

  /**
   * O ponto inteiro da mudança: o núcleo não conhece o vocabulário de nenhum negócio. Uma cor de
   * vocabulário só existe porque a extensão que traz a palavra a contribui — e o kernel sozinho não a
   * tem. A extensão do exemplo é sintética de propósito: as reais são mantidas fora daqui.
   */
  it('sem a extensão que a contribui, o tema do sistema não tem a cor de vocabulário', () => {
    // A leitura passa por um Record de propósito: o tipo do tema do kernel lista só os tokens DELE,
    // e é isso que impede um erro de digitação em `theme.colors.primry` de passar batido. Token de
    // extensão é lido pelo nome, como `resolveColor` faz.
    const colors: Record<string, string | undefined> = themeById('dark').colors;
    expect(colors.vocabularyDone).toBeUndefined();
  });

  it('com uma extensão que contribui a cor, ela aparece em ambos os temas do sistema', () => {
    const host = createPluginHost();
    host.load([...CORE_PLUGINS, { manifest: TOKEN_PLUGIN }]);

    const bundles = themeTokenBundlesOf(host.contributions.query(THEME_TOKENS_POINT));
    // Cada base recebe o piso DELA: a extensão declara os dois, e é o kernel que escolhe.
    expect(resolveThemeTokens(bundles, 'dark', 'dark').vocabularyDone).toBe('#10b981');
    expect(resolveThemeTokens(bundles, 'light', 'white').vocabularyDone).toBe('#34d399');
  });
});

describe('os temas do sistema não se sobrepõem', () => {
  const intruder = (id: string, pluginId: string): QualifiedContribution => ({
    pluginId,
    point: THEME_DEFINITION_POINT,
    id: `intruso-${id}`,
    apiVersion: THEME_API_VERSION,
    metadata: { id, name: 'Intruso', extends: 'dark', colors: { primary: '#ff0000' } },
  });

  const systemDark: QualifiedContribution = {
    pluginId: 'com.microteia.theme-dark',
    point: THEME_DEFINITION_POINT,
    id: 'dark',
    apiVersion: THEME_API_VERSION,
    metadata: { id: 'dark', name: '@core.theme/theme.dark', extends: 'dark' },
  };

  it('os dois ids do sistema são reservados aos pacotes que os declaram', () => {
    expect(RESERVED_THEME_IDS).toEqual({
      dark: 'com.microteia.theme-dark',
      white: 'com.microteia.theme-white',
    });
  });

  /**
   * O caso que a trava existe para impedir: um pacote com pluginId ALFABETICAMENTE ANTERIOR passaria
   * na frente na ordem do registro e trocaria a aparência de todo mundo por baixo dos panos.
   */
  it('um pacote instalado que reivindique o id "dark" é recusado, mesmo chegando primeiro', () => {
    const specs = themeSpecsOf(
      [intruder('dark', 'com.escritorio.falso'), systemDark],
      RESERVED_THEME_IDS,
    );
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe('@core.theme/theme.dark');
  });

  it('um id próprio entra normalmente, AO LADO dos do sistema', () => {
    const specs = themeSpecsOf(
      [intruder('oceano', 'com.escritorio.oceano'), systemDark],
      RESERVED_THEME_IDS,
    );
    expect(specs.map((spec) => spec.id)).toEqual(['oceano', 'dark']);
  });

  it('id repetido entre dois pacotes quaisquer: vence quem chega primeiro', () => {
    const specs = themeSpecsOf([intruder('oceano', 'a'), intruder('oceano', 'b')]);
    expect(specs).toHaveLength(1);
  });
});

describe('nenhum pacote de tema opina sobre vocabulário alheio', () => {
  const kernelTokens = new Set([
    ...Object.keys(baseDarkTheme.colors),
    ...Object.keys(baseLightTheme.colors),
  ]);

  /**
   * A paleta de um tema pode sobrepor qualquer token — inclusive o de outra extensão —, e essa porta
   * continua aberta para quem instala um tema de fora. Mas para os NOSSOS pacotes ela é o caminho
   * errado: o token tem um dono, e quem declara `caseStatusWon` é Processos, que diz na entrada
   * `themes` do pacote de tokens como aquela cor se lê em cada tema que conhece.
   *
   * Um pacote de tema que carregasse a mesma chave estaria disputando com o dono, e o resultado
   * passaria a depender de quem foi instalado antes. Este teste é o que impede a regressão.
   */
  it.each([...SYSTEM_THEME_PACKAGES, ...THEME_MARKETPLACE_PLUGINS].map((p) => [p.manifest.id, p]))(
    '%s declara apenas token do kernel',
    (_id, themePackage) => {
      for (const contribution of themePackage.manifest.contributes ?? []) {
        if (contribution.point !== THEME_DEFINITION_POINT) continue;
        const declared = Object.keys(asThemeSpec(contribution.metadata)?.colors ?? {});
        expect(declared.filter((token) => !kernelTokens.has(token))).toEqual([]);
      }
    },
  );
});

describe('a cor de vocabulário sob cada tema', () => {
  const hostWithTokens = () => {
    const host = createPluginHost();
    host.load([
      ...CORE_PLUGINS,
      { manifest: TOKEN_PLUGIN },
      ...THEME_MARKETPLACE_PLUGINS.map((plugin) => ({ manifest: plugin.manifest })),
    ]);
    return host;
  };

  const tokensUnder = (themeId: string) => {
    const host = hostWithTokens();
    const specs = themeSpecsOf(host.contributions.query(THEME_DEFINITION_POINT), RESERVED_THEME_IDS);
    const bundles = themeTokenBundlesOf(host.contributions.query(THEME_TOKENS_POINT));
    const spec = specs.find((candidate) => candidate.id === themeId);
    if (!spec) throw new Error(`tema ${themeId} não foi contribuído`);
    return resolveThemeTokens(bundles, spec.extends, spec.id);
  };

  /**
   * A anatomia inteira em três casos. Uma extensão declara um PISO por base (claro e escuro) e,
   * opcionalmente, um ajuste POR TEMA. Quem resolve é o kernel:
   *
   * 1. tema que a extensão afinou → o valor afinado;
   * 2. tema que ela não conhece → o piso da base daquele tema;
   * 3. base oposta → o piso da outra base.
   *
   * Sem o passo 2 uma paleta nova nasceria sem as cores de vocabulário, e é justamente aí que ninguém
   * olha: o tema é do escritório, a cor é da extensão, e nenhum dos dois sabe do outro.
   */
  it('sob um tema que a extensão AFINOU, vale o valor afinado', () => {
    expect(tokensUnder('themis').vocabularyDone).toBe('#2F6B4F');
    expect(tokensUnder('themis-night').vocabularyDone).toBe('#5FA37F');
  });

  it('sob um tema que ela NÃO conhece, vale o piso da base daquele tema', () => {
    // `indigo` estende a base escura; `indigo-light`, a clara. Nenhum dos dois é afinado por ela.
    expect(tokensUnder('indigo').vocabularyDone).toBe('#10b981');
    expect(tokensUnder('indigo-light').vocabularyDone).toBe('#34d399');
  });

  it('e o piso de cada base é o da base, não o da outra', () => {
    expect(tokensUnder('dark').vocabularyDone).toBe('#10b981');
    expect(tokensUnder('white').vocabularyDone).toBe('#34d399');
  });
});

describe('temas do catálogo', () => {
  it('todo pacote de tema declara exatamente um tema válido', () => {
    for (const plugin of THEME_MARKETPLACE_PLUGINS) {
      const contributions = plugin.manifest.contributes ?? [];
      const themes = contributions.filter((c) => c.point === THEME_DEFINITION_POINT);
      expect(themes).toHaveLength(1);
      expect(asThemeSpec(themes[0].metadata)).not.toBeNull();
    }
  });

  /** Baixar, renomear e importar é o caminho de um tema próprio: o `.json` tem de sobreviver a ele. */
  it('o pacote sobrevive à ida e volta por JSON', () => {
    for (const plugin of THEME_MARKETPLACE_PLUGINS) {
      const roundTripped = JSON.parse(JSON.stringify(plugin)) as typeof plugin;
      const themes = (roundTripped.manifest.contributes ?? [])
        .filter((c) => c.point === THEME_DEFINITION_POINT);
      expect(asThemeSpec(themes[0].metadata)).toEqual(
        asThemeSpec((plugin.manifest.contributes ?? [])
          .filter((c) => c.point === THEME_DEFINITION_POINT)[0].metadata),
      );
    }
  });

  it('nenhum id de tema se repete entre os pacotes', () => {
    const ids = THEME_MARKETPLACE_PLUGINS.flatMap((plugin) =>
      (plugin.manifest.contributes ?? [])
        .filter((c) => c.point === THEME_DEFINITION_POINT)
        .map((c) => asThemeSpec(c.metadata)?.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('dark');
    expect(ids).not.toContain('white');
  });
});
