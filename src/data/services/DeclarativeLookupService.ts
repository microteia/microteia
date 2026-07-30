import type { ExternalLookupResult, IExternalLookupService } from '../../domain/services/IExternalLookupService';
import type { LookupProviderSpec } from '../../domain/schema/lookupProviderSpec';
import {
  buildLookupUrl,
  DEFAULT_LOOKUP_ERROR,
  lookupTimeoutOf,
  MAX_LOOKUP_RESPONSE_BYTES,
} from '../../domain/schema/lookupProviderSpec';
import { applyFormatOps } from '../../domain/schema/fieldRulePresets';
import { evaluateFieldBoolean } from '../../domain/schema/fieldExpression';
import { getValueAtPath, parsePath } from '../../domain/schema/pathResolver';

const EMPTY: ExternalLookupResult = { ok: false, values: {} };

const isEmptyValue = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * Executa uma busca externa DECLARADA. É o único lugar do app que faz requisição em nome de uma
 * extensão — e por ser único, é onde as garantias cabem: sem credencial, com timeout, com teto de
 * resposta, e devolvendo ao formulário apenas as chaves declaradas em `map` (a resposta bruta nunca
 * chega a quem declarou).
 *
 * Nunca lança: erro vira `ok: false` com mensagem, para não travar o preenchimento manual.
 */
export const makeDeclarativeLookupService = (spec: LookupProviderSpec): IExternalLookupService => ({
  key: spec.key,
  label: spec.label,
  outputKeys: Object.keys(spec.map),

  async lookup(input: string): Promise<ExternalLookupResult> {
    const value = applyFormatOps(input ?? '', spec.input);

    // Entrada ainda incompleta não é erro — o usuário está digitando. Guarda quebrada não dispara:
    // não se bombardeia um serviço de terceiro por causa de uma expressão mal escrita.
    if (spec.when && !evaluateFieldBoolean(spec.when, { value, data: {} }, false)) return EMPTY;

    const failure = { ok: false, values: {}, error: spec.errorMessage ?? DEFAULT_LOOKUP_ERROR };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), lookupTimeoutOf(spec.request));

    try {
      const response = await fetch(buildLookupUrl(spec.request.url, value), {
        method: spec.request.method ?? 'GET',
        headers: spec.request.headers,
        body: spec.request.body,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) return failure;

      const text = await response.text();
      if (text.length > MAX_LOOKUP_RESPONSE_BYTES) return failure;

      const data = JSON.parse(text) as unknown;

      const declaredFailure = spec.failWhen;
      if (declaredFailure) {
        const flag = getValueAtPath(data, parsePath(declaredFailure.path));
        const failed = 'equals' in declaredFailure ? flag === declaredFailure.equals : Boolean(flag);
        if (failed) return { ok: false, values: {}, error: declaredFailure.message };
      }

      // Chave ausente não sobrescreve o que o usuário já digitou.
      const values: Record<string, unknown> = {};
      for (const [outputKey, path] of Object.entries(spec.map)) {
        const resolved = getValueAtPath(data, parsePath(path));
        if (!isEmptyValue(resolved)) values[outputKey] = resolved;
      }

      return { ok: true, values };
    } catch {
      return failure;
    } finally {
      clearTimeout(timeout);
    }
  },
});
