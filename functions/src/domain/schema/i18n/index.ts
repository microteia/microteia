// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/i18n/index.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

export type { LocaleCode } from './localeNegotiation';
export {
  DEFAULT_LOCALE,
  isValidLocale,
  localeChain,
  negotiateFromCandidates,
  negotiateLocale,
  normalizeLocale,
  resolutionOrder,
} from './localeNegotiation';

export type { MessageBundle, MessageCatalog, MessageParams, TranslateFn } from './messages';
export {
  asMessageBundle,
  buildMessageCatalog,
  emptyCatalog,
  hasMessage,
  isValidMessageKey,
  localesOf,
  messagesOfNamespace,
  namespacesOf,
  qualifyKey,
  translate,
} from './messages';

export type { ParsedMessageRef } from './messageRef';
export {
  MESSAGE_REF_SIGIL,
  isMessageRef,
  parseMessageRef,
  resolveLabel,
  resolveOptionalLabel,
} from './messageRef';

export {
  compareTextFor,
  currencyForLocale,
  formatDateFor,
  formatDateTimeFor,
  formatLongDateFor,
  formatMoneyFor,
  formatNumberFor,
  localeDisplayName,
} from './localeFormat';

export {
  I18N_API_VERSION,
  I18N_EXTENSION_POINTS,
  I18N_MESSAGES_POINT,
  messageBundleContribution,
  messageBundleOf,
  messageBundlesOf,
} from './extensionPoints';

export {
  ambientCatalog,
  ambientLocale,
  configuredLocale,
  resetAmbientLocale,
  setAmbientCatalog,
  setAmbientLocale,
} from './localeGate';

export type { TimeZoneSettingValues } from './timeZone';
export {
  DEFAULT_TIME_ZONE,
  TIME_ZONE_SETTING,
  automaticTimeZone,
  dayInTimeZone,
  isValidTimeZone,
  resolveTimeZone,
  timeZoneForLocale,
  timeZoneOptions,
} from './timeZone';
