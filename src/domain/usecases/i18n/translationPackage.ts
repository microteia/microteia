import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import {
  I18N_MESSAGES_POINT,
  messageBundleContribution,
} from '../../schema/i18n/extensionPoints';
import type { LocaleCode } from '../../schema/i18n/localeNegotiation';
import { DEFAULT_LOCALE, normalizeLocale } from '../../schema/i18n/localeNegotiation';
import type { MessageBundle } from '../../schema/i18n/messages';
import { localeDisplayName } from '../../schema/i18n/localeFormat';

import type { LocalizedMessage } from '../../schema/i18n/localizedMessage';
/**
 * Traduzir é EMPACOTAR — e o pacote é o que já existe.
 *
 * Não há formato de tradução. O que a tela de Traduções baixa é um `MarketplacePlugin` comum, com
 * uma contribuição `i18n.messages` por namespace e os textos já preenchidos para o tradutor
 * sobrescrever. O que ela importa é o mesmo arquivo, pela mesma porta que importa qualquer extensão.
 *
 * Um formato próprio existiu por uma versão e foi removido: ele obrigava a manter dois arquivos
 * `.json` parecidos e incompatíveis, dois validadores e dois caminhos de importação, para entregar
 * exatamente o que o formato de pacote já entregava. O sintoma foi um usuário perguntando qual dos
 * dois arquivos era qual — e a resposta certa era que não deveria haver dois.
 *
 * Consequência de projeto: quem baixa daqui pode importar em **Extensões**, e quem exporta uma
 * extensão de tradução de lá pode importar **aqui**. Uma porta só, nos dois sentidos.
 */

/** O texto que preenche cada chave: a tradução que já existe, ou o texto-fonte para sobrescrever. */
const seedFor = (
  bundles: MessageBundle[],
  targetLocale: LocaleCode,
  sourceLocale: LocaleCode,
): Map<string, Map<string, string>> => {
  const target = normalizeLocale(targetLocale);
  const source = normalizeLocale(sourceLocale);

  const existing = new Map<string, string>();
  for (const bundle of bundles) {
    if (normalizeLocale(bundle.locale) !== target) continue;
    for (const [key, value] of Object.entries(bundle.messages)) {
      const full = `${bundle.namespace}/${key}`;
      if (!existing.has(full)) existing.set(full, value);
    }
  }

  const byNamespace = new Map<string, Map<string, string>>();
  for (const bundle of bundles) {
    if (normalizeLocale(bundle.locale) !== source) continue;
    const entries = byNamespace.get(bundle.namespace) ?? new Map<string, string>();
    byNamespace.set(bundle.namespace, entries);
    for (const [key, text] of Object.entries(bundle.messages)) {
      if (entries.has(key)) continue;
      entries.set(key, existing.get(`${bundle.namespace}/${key}`) ?? text);
    }
  }
  return byNamespace;
};

/**
 * O nome do idioma escrito nele mesmo, com inicial maiúscula. O `Intl` devolve "português (Brasil)"
 * em minúscula — correto como substantivo dentro de uma frase, errado como TÍTULO de um pacote na
 * lista de extensões, ao lado de "Financeiro" e "Processos".
 */
export const languageTitle = (locale: LocaleCode): string => {
  const name = localeDisplayName(locale);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/**
 * O id sugerido. `locale.<idioma>` e não `com.microteia.*`: o pacote é de quem traduziu, e carimbar
 * o domínio do fabricante seria atribuição falsa — além de colidir com o pacote oficial do idioma.
 */
export const suggestedPluginId = (targetLocale: LocaleCode): string =>
  `locale.${normalizeLocale(targetLocale).toLowerCase()}`;

export interface BuildTranslationPackageInput {
  bundles: MessageBundle[];
  targetLocale: LocaleCode;
  sourceLocale?: LocaleCode;
  pluginId?: string;
  name?: string;
  version?: string;
}

export const buildTranslationPackage = ({
  bundles,
  targetLocale,
  sourceLocale = DEFAULT_LOCALE,
  pluginId,
  name,
  version = '1.0.0',
}: BuildTranslationPackageInput): MarketplacePlugin => {
  const locale = normalizeLocale(targetLocale);
  const title = name ?? languageTitle(locale);

  const contributes = Array.from(seedFor(bundles, locale, sourceLocale))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([namespace, entries]) =>
      messageBundleContribution({
        locale,
        namespace,
        messages: Object.fromEntries(entries),
      }),
    );

  return {
    // Sem parâmetro: o NOME do pacote já diz de que idioma se trata, e `summary`/`description` são
    // campos do contrato de manifest — carregar parâmetro neles obrigaria todo autor de extensão a
    // conhecer um formato que só este gerador usa.
    summary: '@core.i18n/package.summary',
    workflows: [],
    manifest: {
      id: pluginId ?? suggestedPluginId(locale),
      version,
      kernel: '^1.0.0',
      name: title,
      description: '@core.i18n/package.description',
      icon: 'globe',
      contributes,
    },
  };
};

/** Quantos textos um pacote de tradução carrega, somando todos os namespaces. */
export const translationKeyCount = (pkg: MarketplacePlugin): number =>
  (pkg.manifest.contributes ?? [])
    .filter((contribution) => contribution.point === I18N_MESSAGES_POINT)
    .reduce((total, contribution) => {
      const messages = (contribution.metadata as { messages?: Record<string, string> }).messages;
      return total + Object.keys(messages ?? {}).length;
    }, 0);

/**
 * Um pacote SÓ de tradução: tem contribuição, toda contribuição é de mensagens, e não traz nenhum
 * outro artefato. É a definição que a guarda de sobreposição usa — e é deliberadamente estrita:
 * qualquer coisa além de mensagens tira o pacote desta categoria.
 */
export const isTranslationOnlyPackage = (pkg: MarketplacePlugin): boolean => {
  const contributes = pkg.manifest.contributes ?? [];
  if (contributes.length === 0) return false;
  if (!contributes.every((contribution) => contribution.point === I18N_MESSAGES_POINT)) return false;

  const carriesArtifacts =
    (pkg.workflows?.length ?? 0) > 0 ||
    (pkg.screens?.length ?? 0) > 0 ||
    (pkg.screenPatches?.length ?? 0) > 0 ||
    (pkg.actions?.length ?? 0) > 0 ||
    (pkg.scripts?.length ?? 0) > 0 ||
    (pkg.views?.length ?? 0) > 0 ||
    (pkg.lookups?.length ?? 0) > 0 ||
    (pkg.tagLists?.length ?? 0) > 0 ||
    Boolean(pkg.startup);

  return !carriesArtifacts;
};

/**
 * A guarda de sobreposição, e por que ela é SIMÉTRICA.
 *
 * Instalar por cima de um id existente é o comportamento normal de atualização, e não se mexe nele.
 * O que se recusa é a troca de NATUREZA: um arquivo de tradução tomando o lugar de uma extensão que
 * tem telas e automações apagaria o trabalho do escritório; e uma extensão com telas tomando o lugar
 * de um pacote de idioma faria a interface trocar de língua por causa de um arquivo que ninguém
 * associou a idioma nenhum.
 *
 * Recusar só a primeira direção deixaria a segunda aberta — e as duas são o mesmo erro, visto de
 * lados opostos. Devolve a frase do problema, ou `null` quando a substituição é legítima.
 */
export const translationOverwriteIssue = (
  incoming: MarketplacePlugin,
  installed: MarketplacePlugin | undefined,
): LocalizedMessage | null => {
  if (!installed) return null;

  const incomingIsTranslation = isTranslationOnlyPackage(incoming);
  const installedIsTranslation = isTranslationOnlyPackage(installed);
  if (incomingIsTranslation === installedIsTranslation) return null;

  const name = installed.manifest.name || installed.manifest.id;
  return incomingIsTranslation
    ? {
        message: '@core.i18n/package.id-taken-by-extension',
        messageParams: { id: incoming.manifest.id, name },
      }
    : {
        message: '@core.i18n/package.id-taken-by-language',
        messageParams: { id: incoming.manifest.id, name },
      };
};

/** Um pacote de idioma instalado, reduzido ao que decide se ele está valendo. */
export interface LanguagePackUsage {
  id: string;
  locale: string;
  active: boolean;
  /** As chaves plenamente qualificadas (`namespace/chave`) que o pacote publica. */
  keys: string[];
}

export interface LanguageUsage {
  inUse: boolean;
  shadowed: boolean;
}

/**
 * Decide quais pacotes de idioma estão VALENDO, por chave disputada.
 *
 * A regra anterior era "o primeiro do idioma vale, os outros ficam sem efeito". Ela estava certa
 * enquanto dois pacotes do mesmo idioma significassem necessariamente conflito, e passou a estar
 * errada no dia em que um pacote cobriu só a interface e outro só o contrato jurídico: namespaces
 * disjuntos, os dois valendo, nenhum sombreando nada — e a tela dizia "Sem efeito" para um pacote
 * que estava funcionando.
 *
 * Aqui a pergunta é outra e é a certa: alguma chave DESTE pacote sobrevive à fusão? A ordem é a
 * mesma de `buildMessageCatalog` — quem chega primeiro vence a chave disputada.
 */
export const resolveLanguageUsage = (
  packs: LanguagePackUsage[],
  currentLocale: string,
): Record<string, LanguageUsage> => {
  const usage: Record<string, LanguageUsage> = {};
  const taken = new Set<string>();

  for (const pack of packs) {
    usage[pack.id] = { inUse: false, shadowed: false };
    if (!pack.active || normalizeLocale(pack.locale) !== normalizeLocale(currentLocale)) continue;

    const winning = pack.keys.filter((key) => !taken.has(key));
    winning.forEach((key) => taken.add(key));
    usage[pack.id] = { inUse: winning.length > 0, shadowed: winning.length === 0 };
  }

  return usage;
};
