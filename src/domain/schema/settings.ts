/**
 * O contrato de CONFIGURAÇÃO da plataforma — o que um plugin declara para ganhar uma seção na tela
 * de Configurações, e como um valor declarado é resolvido entre os escopos.
 *
 * É dado puro e serializável: nenhuma propriedade carrega componente, função ou cor. Isso é o que
 * permite a mesma declaração viajar num pacote de extensão até um escritório que não roda este
 * bundle, e é o que torna a edição em JSON tão legítima quanto a visual — as duas escrevem no mesmo
 * lugar, validadas pela mesma regra.
 */

/**
 * Onde um valor é gravado. `tenant` é o padrão do escritório (quem grava é o administrador);
 * `user` é a preferência pessoal, que SEMPRE vence a do escritório quando existe.
 */
export type SettingsScope = 'tenant' | 'user';

export const SETTINGS_SCOPES: SettingsScope[] = ['tenant', 'user'];

/**
 * `widgets` não é um tipo primitivo: é a lista ordenada de widgets de uma superfície (o Painel, por
 * exemplo), com ligado/desligado e largura por item. Vive aqui — e não como tela especial — porque
 * quem a edita é a mesma tela de Configurações, e o valor continua sendo JSON comum.
 */
export type SettingsPropertyType =
  | 'boolean'
  | 'number'
  | 'text'
  | 'select'
  | 'stringList'
  | 'json'
  | 'widgets'
  | 'contributions';

export interface SettingsPropertyOption {
  value: string;
  label: string;
}

export interface SettingsProperty {
  /** Chave COMPLETA, com o namespace de quem declara: `dashboard.widgets`, `agenda.primeiroDia`. */
  key: string;
  label: string;
  description?: string;
  type: SettingsPropertyType;
  /** O valor quando nenhum escopo gravou nada. É o terceiro nível da resolução. */
  default: unknown;
  /** Opções de um `select`. Ignorado nos demais tipos. */
  options?: SettingsPropertyOption[];
  min?: number;
  max?: number;
  /** Texto de apoio dentro do campo de um `stringList`. */
  itemPlaceholder?: string;
  /**
   * Expressão regular que cada item de um `stringList` precisa satisfazer — em texto, para a
   * declaração continuar serializável. Padrão inválido é ignorado: uma extensão com regex quebrada
   * não pode impedir a configuração de ser editada.
   */
  itemPattern?: string;
  /** Escopos que aceitam valor. Sem escopo de usuário, a preferência é só do escritório. */
  scopes: SettingsScope[];
  /** Superfície cujos widgets esta propriedade ordena. Só faz sentido em `type: 'widgets'`. */
  surface?: string;
  /**
   * Ponto de extensão cujas contribuições esta propriedade liga/desliga e ordena. Só faz sentido em
   * `type: 'contributions'` — é o `widgets` generalizado para um ponto qualquer.
   */
  point?: string;
}

export interface SettingsSection {
  /** Namespace da seção, prefixo natural das chaves que ela declara: `dashboard`. */
  key: string;
  title: string;
  description?: string;
  /** Chave do conjunto curado de ícones (`screenIcons`) — nunca um componente. */
  icon?: string;
  order?: number;
  properties: SettingsProperty[];
}

export type SettingsValues = Record<string, unknown>;

export type SettingsValuesByScope = Record<SettingsScope, SettingsValues>;

/** Um item da lista de widgets de uma superfície. `span` é a largura em colunas da grade. */
export interface WidgetLayoutEntry {
  key: string;
  enabled: boolean;
  span: number;
}

/**
 * Um item da lista de contribuições de um ponto. É o `WidgetLayoutEntry` sem a largura: o que se
 * configura aqui é PARTICIPAR e em QUE ORDEM — não onde aparece na grade.
 */
export interface ContributionLayoutEntry {
  key: string;
  enabled: boolean;
}

export const MIN_WIDGET_SPAN = 1;
export const MAX_WIDGET_SPAN = 3;

export interface ResolvedSetting {
  value: unknown;
  /** Escopo de onde o valor veio; `null` quando é o padrão declarado. */
  scope: SettingsScope | null;
}

export const emptySettingsValues = (): SettingsValuesByScope => ({ tenant: {}, user: {} });

export const propertyAcceptsScope = (property: SettingsProperty, scope: SettingsScope): boolean =>
  property.scopes.includes(scope);

export const findSettingsProperty = (
  sections: SettingsSection[],
  key: string,
): SettingsProperty | undefined => {
  for (const section of sections) {
    const found = section.properties.find((property) => property.key === key);
    if (found) return found;
  }
  return undefined;
};

const isWidgetLayoutEntry = (item: unknown): boolean => {
  if (typeof item !== 'object' || item === null) return false;
  const entry = item as Record<string, unknown>;
  if (typeof entry.key !== 'string' || entry.key.length === 0) return false;
  if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') return false;
  if (entry.span === undefined) return true;
  return (
    typeof entry.span === 'number' &&
    Number.isFinite(entry.span) &&
    entry.span >= MIN_WIDGET_SPAN &&
    entry.span <= MAX_WIDGET_SPAN
  );
};

/**
 * O padrão de um `stringList`, compilado com tolerância: regex inválida vira "sem padrão", e não
 * exceção — a declaração vem de uma extensão, e uma expressão quebrada não pode derrubar a tela.
 */
export const stringListPattern = (property: SettingsProperty): RegExp | null => {
  if (!property.itemPattern) return null;
  try {
    return new RegExp(property.itemPattern);
  } catch {
    return null;
  }
};

const isContributionLayoutEntry = (item: unknown): boolean => {
  if (typeof item !== 'object' || item === null) return false;
  const entry = item as Record<string, unknown>;
  if (typeof entry.key !== 'string' || entry.key.length === 0) return false;
  return entry.enabled === undefined || typeof entry.enabled === 'boolean';
};

/**
 * Devolve a mensagem do problema, ou `null` quando o valor serve. Nunca lança: um valor inválido
 * vindo do banco ou de um JSON editado à mão precisa virar aviso na tela, não tela em branco.
 */
export const validateSettingValue = (property: SettingsProperty, value: unknown): string | null => {
  switch (property.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Informe verdadeiro ou falso.';
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Informe um número.';
      if (property.min !== undefined && value < property.min) return `O mínimo é ${property.min}.`;
      if (property.max !== undefined && value > property.max) return `O máximo é ${property.max}.`;
      return null;
    }
    case 'text':
      return typeof value === 'string' ? null : 'Informe um texto.';
    case 'select': {
      if (typeof value !== 'string') return 'Informe uma das opções.';
      const allowed = (property.options ?? []).map((option) => option.value);
      return allowed.includes(value) ? null : 'Informe uma das opções.';
    }
    case 'stringList': {
      if (!Array.isArray(value)) return 'Informe uma lista de textos.';
      if (!value.every((item) => typeof item === 'string' && item.trim() !== '')) {
        return 'Cada item precisa ser um texto não vazio.';
      }
      const pattern = stringListPattern(property);
      if (pattern && !value.every((item) => pattern.test(item as string))) {
        return 'Há item fora do formato esperado.';
      }
      return null;
    }
    case 'widgets': {
      if (!Array.isArray(value)) return 'Informe uma lista de widgets.';
      return value.every(isWidgetLayoutEntry)
        ? null
        : 'Cada item precisa ter uma chave e, se informada, largura entre 1 e 3.';
    }
    case 'contributions': {
      if (!Array.isArray(value)) return 'Informe uma lista de itens.';
      return value.every(isContributionLayoutEntry)
        ? null
        : 'Cada item precisa ter uma chave e, se informado, ligado/desligado.';
    }
    case 'json':
      return value === undefined ? 'Informe um valor.' : null;
    default:
      return null;
  }
};

/**
 * A resolução: usuário vence escritório, que vence o padrão declarado. Um escopo que a propriedade
 * não aceita é ignorado mesmo que haja valor gravado — declaração desligada não volta a valer por
 * causa de um resíduo no banco. Valor gravado inválido cai para o próximo nível, em vez de quebrar
 * quem o consome.
 */
export const resolveSetting = (
  property: SettingsProperty,
  values: SettingsValuesByScope,
): ResolvedSetting => {
  for (const scope of ['user', 'tenant'] as const) {
    if (!propertyAcceptsScope(property, scope)) continue;
    const stored = values[scope][property.key];
    if (stored === undefined) continue;
    if (validateSettingValue(property, stored)) continue;
    return { value: stored, scope };
  }
  return { value: property.default, scope: null };
};

/**
 * Normaliza a lista de widgets gravada contra os widgets REGISTRADOS na superfície: preserva a ordem
 * escolhida, acrescenta ao final o que apareceu depois (extensão instalada agora) e descarta o que
 * não existe mais. Um widget que sumiu não pode deixar buraco na grade nem impedir a tela de abrir.
 */
export interface SurfaceWidgetDefaults {
  key: string;
  defaultEnabled?: boolean;
  defaultSpan?: number;
  order?: number;
}

export const resolveWidgetLayout = (
  stored: unknown,
  available: SurfaceWidgetDefaults[],
): WidgetLayoutEntry[] => {
  const entries = Array.isArray(stored) ? stored.filter(isWidgetLayoutEntry) : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const entry of entries) byKey.set((entry as { key: string }).key, entry as Record<string, unknown>);

  const known = [...available].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const ordered: SurfaceWidgetDefaults[] = [];
  for (const entry of entries) {
    const match = known.find((widget) => widget.key === (entry as { key: string }).key);
    if (match && !ordered.includes(match)) ordered.push(match);
  }
  for (const widget of known) if (!ordered.includes(widget)) ordered.push(widget);

  return ordered.map((widget) => {
    const entry = byKey.get(widget.key);
    const span = typeof entry?.span === 'number' ? entry.span : (widget.defaultSpan ?? 1);
    const enabled = typeof entry?.enabled === 'boolean' ? entry.enabled : (widget.defaultEnabled ?? true);
    return { key: widget.key, enabled, span: Math.min(Math.max(span, MIN_WIDGET_SPAN), MAX_WIDGET_SPAN) };
  });
};

export interface ContributionLayoutDefaults {
  key: string;
  defaultEnabled?: boolean;
  order?: number;
}

/**
 * O mesmo conciliar de `resolveWidgetLayout`, para as contribuições de um ponto: a ordem escolhida
 * é preservada, o que a extensão registrou depois entra no fim, e o que sumiu não deixa buraco.
 */
export const resolveContributionLayout = (
  stored: unknown,
  available: ContributionLayoutDefaults[],
): ContributionLayoutEntry[] => {
  const entries = (Array.isArray(stored) ? stored : []).filter(isContributionLayoutEntry) as Array<{
    key: string;
    enabled?: boolean;
  }>;
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));

  const known = [...available].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const ordered: ContributionLayoutDefaults[] = [];
  for (const entry of entries) {
    const match = known.find((item) => item.key === entry.key);
    if (match && !ordered.includes(match)) ordered.push(match);
  }
  for (const item of known) if (!ordered.includes(item)) ordered.push(item);

  return ordered.map((item) => {
    const entry = byKey.get(item.key);
    return {
      key: item.key,
      enabled: typeof entry?.enabled === 'boolean' ? entry.enabled : (item.defaultEnabled ?? true),
    };
  });
};

export interface SettingsJsonParse {
  values: SettingsValues;
  /** Uma mensagem por chave recusada. O restante do documento é aproveitado. */
  errors: Array<{ key: string; message: string }>;
  /** Erro de sintaxe: nada é aproveitado. */
  syntaxError: string | null;
}

/**
 * Lê o documento de um escopo escrito à mão. Chave desconhecida é PRESERVADA (a extensão que a
 * declara pode estar desativada no momento — apagá-la em silêncio perderia a configuração dela);
 * chave conhecida com valor inválido é recusada, com a mensagem da própria propriedade.
 */
export const parseSettingsJson = (
  sections: SettingsSection[],
  text: string,
  scope: SettingsScope,
): SettingsJsonParse => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim() === '' ? '{}' : text);
  } catch (error) {
    return { values: {}, errors: [], syntaxError: (error as Error).message };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { values: {}, errors: [], syntaxError: 'O documento precisa ser um objeto JSON.' };
  }

  const values: SettingsValues = {};
  const errors: Array<{ key: string; message: string }> = [];
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const property = findSettingsProperty(sections, key);
    if (!property) {
      values[key] = value;
      continue;
    }
    if (!propertyAcceptsScope(property, scope)) {
      errors.push({ key, message: 'Esta configuração não é editável neste escopo.' });
      continue;
    }
    const problem = validateSettingValue(property, value);
    if (problem) {
      errors.push({ key, message: problem });
      continue;
    }
    values[key] = value;
  }
  return { values, errors, syntaxError: null };
};

export const settingsToJson = (values: SettingsValues): string =>
  `${JSON.stringify(values, null, 2)}\n`;

/** Casa a busca da tela contra o que o usuário enxerga: título, descrição e a própria chave. */
export const matchesSettingsQuery = (
  section: SettingsSection,
  property: SettingsProperty,
  query: string,
): boolean => {
  const term = query.trim().toLowerCase();
  if (term === '') return true;
  return [section.title, property.label, property.description ?? '', property.key]
    .join(' ')
    .toLowerCase()
    .includes(term);
};
