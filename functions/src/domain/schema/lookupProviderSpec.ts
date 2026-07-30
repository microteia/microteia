// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/lookupProviderSpec.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/lookupProviderSpec.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FormatOp } from './fieldRulePresets';

/**
 * Uma busca externa DECLARADA: a requisição inteira é dado, não código. Um único serviço do kernel
 * executa todas — é isso que permite impor `https`, timeout, ausência de credencial e teto de
 * resposta, garantias que código de extensão jamais daria. E, por não haver código, uma busca nova
 * não exige extensão trusted: qualquer tenant declara a sua.
 *
 * Limite consciente: a URL é pública dentro do pacote, então este canal NÃO comporta chave de API.
 * Provedor que exija autenticação depende do tier de servidor (`via`), ainda não implementado.
 */
export interface LookupProviderRequest {
  // `{value}` é substituído pela entrada normalizada, sempre com encodeURIComponent.
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

/** Resposta que chegou com HTTP 200 mas representa "não encontrado" — o `{ erro: true }` do ViaCEP. */
export interface LookupProviderFailure {
  path: string;
  // Ausente: qualquer valor verdadeiro no caminho caracteriza a falha.
  equals?: unknown;
  message: string;
}

export interface LookupProviderSpec {
  // Chave sem `/` é reservada ao núcleo; extensão usa namespace: 'com.acme.dados/cnpj'.
  key: string;
  label: string;
  // Normaliza a entrada antes de montar a URL — mesmos primitivos das regras de campo.
  input?: FormatOp[];
  // Expressão booleana sobre `value`. Ausente dispara sempre; presente e quebrada NÃO dispara.
  when?: string;
  request: LookupProviderRequest;
  // Chave de saída → caminho no JSON da resposta ('logradouro', 'endereco.rua').
  map: Record<string, string>;
  failWhen?: LookupProviderFailure;
  errorMessage?: string;
}

export type LookupProviderCatalog = ReadonlyMap<string, LookupProviderSpec>;

export const DEFAULT_LOOKUP_TIMEOUT_MS = 8000;

/** Teto do kernel: uma declaração não pode segurar o formulário do usuário indefinidamente. */
export const MAX_LOOKUP_TIMEOUT_MS = 15000;

/** Teto de corpo lido antes do parse — resposta gigante não pode travar a aba. */
export const MAX_LOOKUP_RESPONSE_BYTES = 512 * 1024;

export const DEFAULT_LOOKUP_ERROR = 'Não foi possível consultar os dados';

export const lookupTimeoutOf = (request: LookupProviderRequest): number => {
  const declared = request.timeoutMs ?? DEFAULT_LOOKUP_TIMEOUT_MS;
  if (!Number.isFinite(declared) || declared <= 0) return DEFAULT_LOOKUP_TIMEOUT_MS;
  return Math.min(declared, MAX_LOOKUP_TIMEOUT_MS);
};

/**
 * Só `https` sai daqui. `http` vazaria o valor digitado em texto claro; `data:`/`javascript:`/`blob:`
 * transformariam uma declaração de dados num vetor de execução.
 */
export const isAllowedLookupUrl = (url: string): boolean => {
  try {
    return new URL(url.replace('{value}', 'x')).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Host de destino, para que a autoria mostre a quem o valor digitado será enviado. */
export const lookupRequestHost = (request: LookupProviderRequest): string | null => {
  try {
    return new URL(request.url.replace('{value}', 'x')).host;
  } catch {
    return null;
  }
};

export const buildLookupUrl = (template: string, value: string): string =>
  template.split('{value}').join(encodeURIComponent(value));

export const isValidLookupProvider = (spec: LookupProviderSpec | undefined): spec is LookupProviderSpec =>
  !!spec &&
  typeof spec.key === 'string' &&
  spec.key.trim() !== '' &&
  typeof spec.label === 'string' &&
  spec.label.trim() !== '' &&
  !!spec.request &&
  typeof spec.request.url === 'string' &&
  isAllowedLookupUrl(spec.request.url) &&
  !!spec.map &&
  Object.keys(spec.map).length > 0;

export interface LookupProviderConflict {
  key: string;
  ignored: LookupProviderSpec;
}

// ─── Catálogo do núcleo ───────────────────────────────────────────────────────

/**
 * O ViaCEP deixou de ser uma classe do kernel e virou DECLARAÇÃO. A chave segue `viacep`, então o
 * campo `address.zipCode` de Pessoa (`entityRegistry`) continua valendo sem migração.
 */
export const CORE_LOOKUP_PROVIDERS: LookupProviderSpec[] = [
  {
    key: 'viacep',
    label: 'Endereço pelo CEP (ViaCEP)',
    input: [{ op: 'digits' }],
    when: 'length(value) == 8',
    request: { url: 'https://viacep.com.br/ws/{value}/json/' },
    map: {
      street: 'logradouro',
      neighborhood: 'bairro',
      city: 'localidade',
      state: 'uf',
    },
    failWhen: { path: 'erro', message: 'CEP não encontrado' },
    errorMessage: 'Não foi possível consultar o CEP',
  },
];

/** Chave já ocupada não é sobrescrita — espelha a política do catálogo de regras de campo. */
export const buildLookupProviderCatalog = (
  providers: Iterable<LookupProviderSpec> = [],
  conflicts?: LookupProviderConflict[],
): LookupProviderCatalog => {
  const catalog = new Map<string, LookupProviderSpec>();
  for (const provider of [...CORE_LOOKUP_PROVIDERS, ...providers]) {
    if (!isValidLookupProvider(provider)) continue;
    if (catalog.has(provider.key)) {
      conflicts?.push({ key: provider.key, ignored: provider });
      continue;
    }
    catalog.set(provider.key, provider);
  }
  return catalog;
};
