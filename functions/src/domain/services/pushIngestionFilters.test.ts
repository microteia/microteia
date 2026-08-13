import { describe, expect, it } from 'vitest';
import {
  PUSH_ALLOWED_SENDERS_KEY,
  PUSH_ALLOWED_SUBJECTS_KEY,
  resolveIngestionList,
} from './pushIngestionFilters';

describe('filtros da ingestão de pushes', () => {
  it('usa a configuração declarada pela extensão quando ela existe', () => {
    const settings = { [PUSH_ALLOWED_SENDERS_KEY]: ['pje@tjba.jus.br'] };

    expect(resolveIngestionList(settings, PUSH_ALLOWED_SENDERS_KEY, ['antigo@tj.jus.br'])).toEqual([
      'pje@tjba.jus.br',
    ]);
  });

  /**
   * O escritório que nunca abriu a tela nova continua filtrando como filtrava: sem esta queda para
   * o campo antigo do escritório, a primeira execução depois do deploy passaria a aceitar qualquer
   * remetente do Judiciário.
   */
  it('cai para o campo antigo do escritório quando a chave não foi gravada', () => {
    expect(resolveIngestionList({}, PUSH_ALLOWED_SUBJECTS_KEY, ['intimação'])).toEqual(['intimação']);
    expect(resolveIngestionList({}, PUSH_ALLOWED_SUBJECTS_KEY, undefined)).toEqual([]);
  });

  /** Apagar todos os itens é uma ESCOLHA — e não a ausência dela. */
  it('respeita a lista gravada vazia, sem voltar ao campo antigo', () => {
    const settings = { [PUSH_ALLOWED_SENDERS_KEY]: [] };

    expect(resolveIngestionList(settings, PUSH_ALLOWED_SENDERS_KEY, ['antigo@tj.jus.br'])).toEqual([]);
  });

  it('ignora valor gravado que não é lista de textos', () => {
    const settings = { [PUSH_ALLOWED_SENDERS_KEY]: 'pje@tjba.jus.br' };

    expect(resolveIngestionList(settings, PUSH_ALLOWED_SENDERS_KEY, ['antigo@tj.jus.br'])).toEqual([
      'antigo@tj.jus.br',
    ]);
  });
});
