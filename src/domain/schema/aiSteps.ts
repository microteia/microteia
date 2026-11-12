// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/aiSteps.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_GENERATE_STEP_ID = 'ai-generate';
export const AI_EXTRACT_PARAMETERS_STEP_ID = 'ai-extract-parameters';

/** O kernel a partir do qual existe o passo `ai-generate`. */
export const AI_DATA_STEPS_SINCE_KERNEL = '2.117.0';

/**
 * O kernel a partir do qual "Extrair parâmetros" aceita os campos declarados no próprio passo
 * (`fields`) em vez de uma automação-alvo. Antes dele, o passo sem alvo reprova.
 */
export const AI_EXTRACT_FIELDS_SINCE_KERNEL = '2.118.0';

/**
 * O teto padrão do texto gerado. O texto vai para as saídas do passo — e as saídas, para o histórico da
 * execução, que é UM documento.
 */
export const AI_GENERATE_DEFAULT_CHARACTERS = 2000;
export const AI_GENERATE_MAX_CHARACTERS = 20000;

/**
 * Uma lista que a pessoa escreve — uma por linha, ou `a, b, c` numa linha só — ou que chega pronta de
 * uma expressão. Com quebra de linha, a vírgula fica no item: é o que deixa a descrição de um campo ter
 * vírgula. Vazios e repetidos saem; a ordem fica.
 */
export const aiStepList = (value: unknown): string[] => {
  const items = Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : String(item ?? '')))
    : typeof value === 'string' ? value.split(value.includes('\n') ? '\n' : ',') : [];
  return [...new Set(items.map((item) => item.trim()).filter((item) => item !== ''))];
};

export interface AiExtractField {
  key: string;
  description: string;
  /** A lista FECHADA de valores aceitos (`[a|b|c]` no fim da linha) — ausente = texto livre. */
  options?: string[];
}

const CLOSED_LIST = /\[([^\]]*)\]\s*$/;

/**
 * Os campos declarados no passo: `chave`, `chave: o que é` ou `chave: o que é [a|b|c]`. A lista entre
 * colchetes é a CLASSIFICAÇÃO: a resposta é conferida contra ela e sai na grafia dela — ou vazia, quando
 * o modelo responde outra coisa. A chave segue a regra de identificador, para virar `params.<chave>`.
 */
export const aiExtractFields = (value: unknown): AiExtractField[] =>
  aiStepList(value)
    .map((item): AiExtractField => {
      const colon = item.indexOf(':');
      const key = (colon < 0 ? item : item.slice(0, colon)).trim();
      const rest = colon < 0 ? '' : item.slice(colon + 1).trim();
      const list = CLOSED_LIST.exec(rest);
      const options = list ? [...new Set(list[1].split('|').map((option) => option.trim()).filter((option) => option !== ''))] : [];
      return {
        key,
        description: (list ? rest.slice(0, list.index) : rest).trim(),
        ...(options.length > 0 ? { options } : {}),
      };
    })
    .filter((field) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(field.key));
