/**
 * De onde a ingestão tira os remetentes e os assuntos que aceita.
 *
 * As duas listas são CONFIGURAÇÃO declarada pela extensão de Pushes (`ui.settings`), gravada no
 * documento de configurações do escritório. Antes eram campos do próprio escritório — o kernel
 * sabendo o que é um remetente de tribunal —, e é por isso que a leitura tem dois níveis: a chave
 * declarada primeiro, o campo antigo depois. Escritório que nunca abriu a tela nova continua
 * filtrando exatamente como filtrava.
 *
 * Lista gravada VAZIA não cai para o campo antigo: apagar todos os remetentes é uma escolha (aceita
 * qualquer remetente do Judiciário), e não ausência de escolha.
 */
export const PUSH_ALLOWED_SENDERS_KEY = 'push.allowedSenders';
export const PUSH_ALLOWED_SUBJECTS_KEY = 'push.allowedSubjects';

const asStringList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === 'string')) return null;
  return value as string[];
};

export const resolveIngestionList = (
  settings: Record<string, unknown>,
  key: string,
  legacy: string[] | undefined,
): string[] => asStringList(settings[key]) ?? legacy ?? [];
