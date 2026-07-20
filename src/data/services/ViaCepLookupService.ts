import type { ExternalLookupResult, IExternalLookupService } from '../../domain/services/IExternalLookupService';
import { onlyDigits } from '../../domain/schema/fieldRules';

const VIACEP_URL = 'https://viacep.com.br/ws';
const CEP_LENGTH = 8;
const TIMEOUT_MS = 8000;

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

const EMPTY: ExternalLookupResult = { ok: false, values: {} };

export class ViaCepLookupService implements IExternalLookupService {
  readonly key = 'viacep';
  readonly label = 'Endereço pelo CEP (ViaCEP)';
  readonly outputKeys = ['street', 'neighborhood', 'city', 'state'];

  async lookup(input: string): Promise<ExternalLookupResult> {
    const digits = onlyDigits(input ?? '');
    // CEP incompleto não é erro: o usuário ainda está digitando.
    if (digits.length !== CEP_LENGTH) return EMPTY;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${VIACEP_URL}/${digits}/json/`, { signal: controller.signal });
      if (!response.ok) return { ok: false, values: {}, error: 'Não foi possível consultar o CEP' };

      const data = (await response.json()) as ViaCepResponse;
      if (data.erro) return { ok: false, values: {}, error: 'CEP não encontrado' };

      // Só devolve o que veio preenchido — chave ausente não sobrescreve o que o usuário digitou.
      const values: Record<string, unknown> = {};
      if (data.logradouro) values.street = data.logradouro;
      if (data.bairro) values.neighborhood = data.bairro;
      if (data.localidade) values.city = data.localidade;
      if (data.uf) values.state = data.uf;

      return { ok: true, values };
    } catch {
      return { ok: false, values: {}, error: 'Não foi possível consultar o CEP' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
