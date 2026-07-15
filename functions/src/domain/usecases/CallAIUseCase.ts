import type { AICredentials } from '../entities/AICredentials';
import type { AICallOptions, IAIProviderService } from '../repositories/IAIProviderService';

export class AIResponseFormatError extends Error {
  readonly raw: string;
  readonly truncated: boolean;
  constructor(raw: string, truncated: boolean) {
    super('A IA retornou uma resposta em formato inválido.');
    this.name = 'AIResponseFormatError';
    this.raw = raw;
    this.truncated = truncated;
  }
}

const countChar = (text: string, char: string): number => {
  let n = 0;
  for (const c of text) if (c === char) n++;
  return n;
};

/**
 * Heurística: a resposta começa como JSON mas não fecha (mais aberturas que fechamentos de
 * chaves/colchetes). Forte indício de que o modelo cortou no limite de tokens de saída.
 */
export const looksTruncated = (raw: string): boolean => {
  const text = raw.trim();
  if (!text) return false;
  const startsAsJson = text.startsWith('{') || text.startsWith('[') || text.startsWith('```');
  if (!startsAsJson) return false;
  return countChar(text, '{') > countChar(text, '}') || countChar(text, '[') > countChar(text, ']');
};

export const extractJsonFromAI = (text: string): string => {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1];
  const jsonArray = text.match(/\[[\s\S]*\]/);
  const jsonObject = text.match(/\{[\s\S]*\}/);
  if (jsonArray && jsonObject) {
    return (jsonArray.index ?? Infinity) < (jsonObject.index ?? Infinity) ? jsonArray[0] : jsonObject[0];
  }
  if (jsonArray) return jsonArray[0];
  if (jsonObject) return jsonObject[0];
  return text;
};

export type CallAIInput = {
  credentials: AICredentials;
  userContent: string;
  options?: AICallOptions;
};

export type CallAIUseCase = {
  execute: (input: CallAIInput) => Promise<string>;
  executeJson: <T>(input: CallAIInput) => Promise<T>;
};

export const makeCallAIUseCase = (aiProviders: IAIProviderService[]): CallAIUseCase => {
  const call = async ({ credentials, userContent, options }: CallAIInput): Promise<string> => {
    const provider = aiProviders.find((p) => p.canHandle(credentials.provider));
    if (!provider) {
      throw new Error(`Provedor de IA não suportado: ${credentials.provider}.`);
    }
    return provider.call(credentials, userContent, options);
  };

  return {
    execute: call,
    executeJson: async <T>(input: CallAIInput): Promise<T> => {
      const raw = await call({ ...input, options: { expectJson: true, ...input.options } });
      const jsonText = extractJsonFromAI(raw.trim());
      try {
        return JSON.parse(jsonText) as T;
      } catch {
        throw new AIResponseFormatError(raw, looksTruncated(raw));
      }
    },
  };
};
