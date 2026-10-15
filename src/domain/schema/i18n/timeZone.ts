// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/i18n/timeZone.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { normalizeLocale } from './localeNegotiation';

/**
 * O FUSO DO ESCRITÓRIO — o que decide a que dia pertence um instante.
 *
 * Um instante (`now()`, um `createdAt`) é o mesmo no mundo inteiro; o DIA em que ele cai, não. Às 22h
 * de 30/03 em Brasília já é 31/03 em UTC, e uma regra como `dueDate < today()` dava respostas
 * diferentes conforme quem perguntava: o servidor respondia em UTC, o navegador também (pelo
 * `toISOString`), e quem lia o resultado estava no fuso do escritório.
 *
 * Este arquivo é compartilhado com `functions/` justamente para que as duas pontas resolvam o fuso
 * pela MESMA regra — a paridade não depende de duas implementações concordarem, porque há uma só.
 */

export const TIME_ZONE_SETTING = 'i18n.timezone';

const LOCALE_SETTING = 'i18n.locale';

/**
 * O fuso quando nada foi configurado e o idioma do escritório não sugere nenhum. É o que `today()`
 * sempre respondeu nas duas pontas, e por isso o escritório que não configura nada não muda de dia.
 */
export const DEFAULT_TIME_ZONE = 'UTC';

/**
 * O fuso sugerido pela REGIÃO do idioma do escritório — o mesmo raciocínio de `currencyForLocale`.
 * Só entra região cujo fuso é inequívoco para quem trabalha nela: o Brasil tem quatro fusos, mas a
 * imensa maioria dos escritórios trabalha no de Brasília, e quem não trabalha configura o seu.
 */
const TIME_ZONE_BY_REGION: Record<string, string> = {
  BR: 'America/Sao_Paulo',
};

/** A forma de um identificador IANA: `UTC`, `America/Sao_Paulo`, `Etc/GMT+3`. Deslocamento solto (`-03:00`) não é fuso. */
const IANA_SHAPE = /^[A-Za-z][A-Za-z_]*(\/[A-Za-z0-9_+-]+)*$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

const dayFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  formatters.set(timeZone, created);
  return created;
};

/**
 * Um fuso é aceito quando tem a forma IANA E o `Intl` da plataforma o reconhece. Só a forma deixaria
 * passar um nome inventado; só o `Intl` deixaria passar deslocamento solto, que não acompanha o
 * horário de verão de lugar nenhum.
 */
export const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const candidate = value.trim();
  if (!IANA_SHAPE.test(candidate)) return false;
  try {
    dayFormatter(candidate);
    return true;
  } catch {
    return false;
  }
};

/**
 * Os fusos que a plataforma conhece, para a lista de escolha. `UTC` entra sempre: o V8 não o lista
 * em `supportedValuesOf`, e ele é o padrão.
 */
export const timeZoneOptions = (): string[] => {
  const listed = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return Array.from(new Set([DEFAULT_TIME_ZONE, ...listed])).sort();
};

/** O fuso que o idioma sugere, pela região dele. Sem região conhecida, o padrão. */
export const timeZoneForLocale = (locale: unknown): string => {
  const parts = normalizeLocale(locale).split('-');
  const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  return TIME_ZONE_BY_REGION[region] ?? DEFAULT_TIME_ZONE;
};

export interface TimeZoneSettingValues {
  user: Record<string, unknown>;
  tenant: Record<string, unknown>;
}

/** O fuso do "automático": o que o idioma gravado do escritório sugere (ou, sem ele, o do usuário). */
export const automaticTimeZone = (values: TimeZoneSettingValues): string =>
  timeZoneForLocale(values.tenant[LOCALE_SETTING] ?? values.user[LOCALE_SETTING]);

/**
 * A resolução: usuário → escritório → o que o idioma do ESCRITÓRIO sugere → UTC.
 *
 * O terceiro nível lê o idioma GRAVADO do escritório, nunca o negociado com o navegador: o servidor
 * não tem navegador, e uma regra que só uma das pontas consegue aplicar é a divergência que este
 * arquivo existe para eliminar. Sem idioma do escritório gravado, vale o do usuário — é o que um
 * escritório que nunca abriu a seção de idioma tem para dizer de onde é.
 *
 * Valor gravado inválido é ignorado, e não erro: um fuso que a plataforma deixou de reconhecer não
 * pode impedir uma automação de rodar.
 */
export const resolveTimeZone = (values: TimeZoneSettingValues): string => {
  for (const scope of [values.user, values.tenant]) {
    const stored = scope[TIME_ZONE_SETTING];
    if (isValidTimeZone(stored)) return stored.trim();
  }
  return automaticTimeZone(values);
};

/**
 * O fuso do ESCRITÓRIO, sem pessoa nenhuma: o que o relógio das automações usa, porque quem dispara é
 * o horário, não um usuário. A tela que mostra quando uma automação vai rodar pergunta por aqui — e não
 * pelo fuso resolvido para quem está olhando —, ou promete um horário que o relógio não cumpre.
 */
export const resolveOfficeTimeZone = (tenant: Record<string, unknown>): string =>
  resolveTimeZone({ user: {}, tenant });

/** O DIA (`YYYY-MM-DD`) em que um instante cai no fuso dado. Fuso inválido cai no padrão. */
export const dayInTimeZone = (instant: Date, timeZone: string): string => {
  const zone = isValidTimeZone(timeZone) ? timeZone.trim() : DEFAULT_TIME_ZONE;
  const parts = dayFormatter(zone).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
