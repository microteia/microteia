// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/aiSteps.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_GENERATE_STEP_ID = 'ai-generate';
export const AI_CLASSIFY_STEP_ID = 'ai-classify';
export const AI_EXTRACT_STEP_ID = 'ai-extract';

/** O kernel a partir do qual existem os três passos de IA genéricos. */
export const AI_DATA_STEPS_SINCE_KERNEL = '2.117.0';

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

/**
 * A categoria que o modelo devolveu, se ela é UMA das oferecidas — comparada sem caixa nem espaço, e
 * devolvida na grafia da lista. O que não está na lista não vira categoria nova: um classificador que
 * inventa categoria é um campo de texto livre com outro nome.
 */
export const matchAiCategory = (answer: unknown, categories: readonly string[]): string | null => {
  if (typeof answer !== 'string') return null;
  const wanted = answer.trim().toLowerCase();
  return categories.find((category) => category.toLowerCase() === wanted) ?? null;
};

/**
 * Os campos de `ai-extract`: `chave` ou `chave: o que é` — a descrição é o que o modelo lê para saber o
 * que procurar. A chave segue a regra de identificador, para virar `values.<chave>` numa expressão.
 */
export const aiExtractFields = (value: unknown): { key: string; description: string }[] =>
  aiStepList(value)
    .map((item) => {
      const colon = item.indexOf(':');
      const key = (colon < 0 ? item : item.slice(0, colon)).trim();
      return { key, description: colon < 0 ? '' : item.slice(colon + 1).trim() };
    })
    .filter((field) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(field.key));
