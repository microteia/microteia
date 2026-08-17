import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import { CORE_PLUGINS } from '../index';
import { THEME_MARKETPLACE_PLUGINS } from '../marketplace/themes';
import { RESERVED_THEME_IDS, SYSTEM_THEME_PACKAGES } from './systemThemes';
import { baseDarkTheme, baseLightTheme } from '../../shared/styles/theme';
import { brasilPlugin } from '../marketplace/brasil';
import { pessoaPlugin } from '../marketplace/pessoa';
import { contratoPlugin } from '../marketplace/contrato';
import { processoPlugin } from '../marketplace/processo';
import { THEME_BASES } from '../../shared/styles/theme';
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
   * O ponto inteiro da mudança: o núcleo não conhece "processo procedente". A cor só existe porque
   * a extensão de Processos a contribui — e o kernel sozinho não a tem.
   */
  it('sem a extensão de Processos, o tema do sistema não tem cor de status de processo', () => {
    // A leitura passa por um Record de propósito: o tipo do tema do kernel lista só os tokens DELE,
    // e é isso que impede um erro de digitação em `theme.colors.primry` de passar batido. Token de
    // extensão é lido pelo nome, como `resolveColor` faz.
    const colors: Record<string, string | undefined> = themeById('dark').colors;
    expect(colors.caseStatusWon).toBeUndefined();
  });

  it('com Processos carregado, a cor aparece em ambos os temas do sistema', () => {
    const host = createPluginHost();
    host.load([
      ...CORE_PLUGINS,
      ...[brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin]
        .map((plugin) => ({ manifest: plugin.manifest })),
    ]);
    const bundles = themeTokenBundlesOf(host.contributions.query(THEME_TOKENS_POINT));
    expect(resolveThemeTokens(bundles, 'dark', 'dark').caseStatusWon).toBe('#10b981');
    expect(resolveThemeTokens(bundles, 'light', 'white').caseStatusWon).toBe('#10b981');
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

describe('as cores de domínio sob cada tema', () => {
  const hostWithDomains = () => {
    const host = createPluginHost();
    host.load([
      ...CORE_PLUGINS,
      ...[brasilPlugin, pessoaPlugin, contratoPlugin, processoPlugin, ...THEME_MARKETPLACE_PLUGINS]
        .map((plugin) => ({ manifest: plugin.manifest })),
    ]);
    return host;
  };

  const tokensUnder = (themeId: string) => {
    const host = hostWithDomains();
    const specs = themeSpecsOf(host.contributions.query(THEME_DEFINITION_POINT), RESERVED_THEME_IDS);
    const bundles = themeTokenBundlesOf(host.contributions.query(THEME_TOKENS_POINT));
    const spec = specs.find((candidate) => candidate.id === themeId);
    if (!spec) throw new Error(`tema ${themeId} não foi contribuído`);
    return resolveThemeTokens(bundles, spec.extends, spec.id);
  };

  /**
   * A prova de que tirar as cores de dentro dos pacotes de tema não mudou a tela: estes são os tons
   * que cada paleta mostrava quando os declarava por conta própria.
   */
  it.each([
    ['dark', 'casePhaseSentence', '#F56B3A'],
    ['white', 'casePhaseSentence', '#5B7ED6'],
    ['claude', 'casePhaseSentence', '#DA7756'],
    ['teams', 'casePhaseSentence', '#6264A7'],
    ['kindle', 'casePhaseSentence', '#8B6040'],
    ['themis', 'casePhaseSentence', '#6D2233'],
    ['themis', 'caseStatusWon', '#2F6B4F'],
    ['themis', 'contractStatusTerminated', '#96382B'],
    ['themis', 'relationshipSocio', '#6D2233'],
    ['themis-night', 'casePhaseSentence', '#B85C6E'],
    ['themis-night', 'caseStatusWon', '#5FA37F'],
    ['themis-night', 'contractStatusTerminated', '#C25445'],
    ['themis-night', 'relationshipSocio', '#B85C6E'],
  ])('sob %s, %s é %s', (themeId, token, expected) => {
    expect(tokensUnder(themeId)[token]).toBe(expected);
  });

  /** Um tema que ninguém afinou recebe o piso — e o piso é o mesmo dos dois lados nestas cores. */
  it('Indigo, que nenhum plugin conhece pelo nome, recebe o piso', () => {
    expect(tokensUnder('indigo').casePhaseSentence).toBe('#6c63ff');
    expect(tokensUnder('indigo-light').caseStatusWon).toBe('#10b981');
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
