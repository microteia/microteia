import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { I18N_MESSAGES_POINT } from '../../schema/i18n/extensionPoints';
import { isMessageRef } from '../../schema/i18n/messageRef';
import { isValidMessageKey } from '../../schema/i18n/messages';
import type { LocalizedIssue } from './pluginReferences';

/**
 * O texto que tem a CARA de uma referência — `@`, um nome, `/`, outro nome, sem espaço — mas que o
 * reconhecedor (`isMessageRef`) não aceita. O caso que trouxe esta régua é o sublinhado
 * (`@com.acme.office/option.nao_habilitado`): a plataforma só reconhece letra, dígito, ponto e hífen,
 * e o que ela não reconhece como referência é rótulo literal — a tela mostrava o código cru.
 *
 * A régua é estreita de propósito: frase com espaço, e-mail no meio do texto e fonte de view nunca
 * casam com ela, e por isso nada que o pacote escreve como texto comum vira recusa.
 */
const LOOKS_LIKE_REFERENCE = /^@[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const collectBrokenReferences = (value: unknown, where: string, found: Map<string, string>): void => {
  if (typeof value === 'string') {
    if (LOOKS_LIKE_REFERENCE.test(value) && !isMessageRef(value) && !found.has(value)) found.set(value, where);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectBrokenReferences(item, `${where}[${index}]`, found));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    collectBrokenReferences(item, where === '' ? key : `${where}.${key}`, found);
  }
};

/**
 * As chaves de um `i18n.messages` que o catálogo DESCARTA. `asMessageBundle` as pula em silêncio —
 * é a tolerância certa para o pacote de terceiro já instalado, mas no portão ela escondia o defeito:
 * a tradução viajava no pacote e nunca chegava à tela.
 */
const invalidDeclaredKeys = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.manifest?.contributes ?? []).flatMap((contribution, index): LocalizedIssue[] => {
    if (contribution?.point !== I18N_MESSAGES_POINT) return [];
    const messages = contribution.metadata?.messages;
    if (!isPlainObject(messages)) return [];
    return Object.keys(messages)
      .filter((key) => !isValidMessageKey(key))
      .map((key) => ({
        message: '@core.marketplace/issue.package.message.key',
        messageParams: { key, where: `contributes[${index}].metadata.messages` },
      }));
  });

/**
 * As duas pontas do mesmo defeito: a chave declarada que o catálogo não aceita, e a referência
 * escrita que a tela não reconhece. Basta uma delas para o rótulo aparecer cru, e o autor pode ter
 * acertado uma e errado a outra.
 */
export const messageRefIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const broken = new Map<string, string>();
  collectBrokenReferences(pkg, '', broken);
  return [
    ...invalidDeclaredKeys(pkg),
    ...Array.from(broken, ([reference, where]) => ({
      message: '@core.marketplace/issue.package.message.reference',
      messageParams: { reference, where },
    })),
  ];
};
