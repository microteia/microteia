import type { Contribution } from '../../schema/plugin/contribution';
import type { MessageBundle } from '../../schema/i18n/messages';
import { messageBundlesOf } from '../../schema/i18n/extensionPoints';
import { DEFAULT_LOCALE } from '../../schema/i18n/localeNegotiation';
import { UI_NAV_GROUP_POINT, UI_NAV_POINT } from '../../schema/ui/uiExtensionPoints';

/**
 * Um grupo da barra lateral como quem AUTORA precisa enxergá-lo: a chave, o nome já resolvido e a
 * posição.
 *
 * A chave de um grupo é universal, e é ela — nunca o nome — que junta dois pacotes num grupo só. O que
 * faltava era o autor ver as chaves que já existem: sem isso, uma extensão que queria entrar em
 * "Agenda" inventava uma chave própria e desenhava um SEGUNDO grupo com o mesmo título.
 *
 * `translations` é o nome em cada idioma que o próprio pacote traz. Um rótulo literal (o escritório
 * escreveu a frase direto) chega com `translations` vazio e o `label` como ele está.
 */
export interface DeclaredNavGroup {
  key: string;
  label: string;
  translations: Record<string, string>;
  order: number;
}

const REFERENCE = /^@([a-z0-9.-]+)\/(.+)$/;

const translationsOf = (label: string, bundles: readonly MessageBundle[]): Record<string, string> => {
  const match = REFERENCE.exec(label);
  if (!match) return {};
  const [, namespace, key] = match;
  const found: Record<string, string> = {};
  for (const bundle of bundles) {
    if (bundle.namespace !== namespace) continue;
    const text = bundle.messages[key];
    if (typeof text === 'string' && text.trim() !== '' && found[bundle.locale] === undefined) {
      found[bundle.locale] = text;
    }
  }
  return found;
};

/**
 * Os grupos que uma lista de contribuições declara, com o nome resolvido pelos `i18n.messages` da
 * MESMA lista — o catálogo para resolver viaja dentro do pacote. `fallback` serve a quem declara o
 * texto em outro lugar, como o núcleo.
 */
export const declaredNavGroupsOf = (
  contributions: readonly Contribution[] | undefined,
  fallback: readonly MessageBundle[] = [],
): DeclaredNavGroup[] => {
  const list = (contributions ?? []).filter((one) => one !== null && typeof one === 'object');
  const bundles = [...messageBundlesOf(list), ...fallback];

  return list
    .filter((one) => one.point === UI_NAV_GROUP_POINT)
    .flatMap((one): DeclaredNavGroup[] => {
      const metadata = one.metadata ?? {};
      const key = typeof metadata.key === 'string' ? metadata.key.trim() : '';
      if (key === '') return [];
      const raw = typeof metadata.label === 'string' && metadata.label.trim() !== '' ? metadata.label : key;
      const translations = translationsOf(raw, bundles);
      return [{
        key,
        label: translations[DEFAULT_LOCALE] ?? Object.values(translations)[0] ?? raw,
        translations,
        order: typeof metadata.order === 'number' ? metadata.order : 0,
      }];
    });
};

/** As chaves de grupo em que os itens de menu de uma lista de contribuições pedem para entrar. */
export const navGroupKeysJoinedBy = (contributions: readonly Contribution[] | undefined): string[] => [
  ...new Set((contributions ?? [])
    .filter((one) => one?.point === UI_NAV_POINT)
    .map((one) => one.metadata?.group)
    .filter((group): group is string => typeof group === 'string' && group.trim() !== '')),
];

/**
 * A forma de comparar NOMES de grupo: sem caixa, sem acento, sem espaço sobrando. "Agenda" e
 * " agenda " são o mesmo título na tela, e é o título repetido que o usuário vê como defeito.
 */
export const navGroupNameKey = (name: string): string =>
  name.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Todos os nomes com que um grupo pode aparecer na tela, já na forma de comparar. */
export const navGroupNames = (group: Pick<DeclaredNavGroup, 'label' | 'translations'>): string[] => [
  ...new Set([group.label, ...Object.values(group.translations)].map(navGroupNameKey).filter((one) => one !== '')),
];
