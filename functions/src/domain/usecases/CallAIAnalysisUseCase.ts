import type { AICredentials } from '../entities/AICredentials';
import type { AIAnalysisResult } from '../entities/AIAnalysisResult';
import type { IAIProviderService } from '../repositories/IAIProviderService';

const ANALYSIS_PROMPT = `
TEXTO A SER ANALISADO

{{ANALYSIS_PROMPT}}`;

const extractJSON = (text: string): string => {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1];
  const jsonObj = text.match(/\{[\s\S]*\}/);
  if (jsonObj) return jsonObj[0];
  return text;
};

export type CallAIAnalysisUseCase = {
  execute: (credentials: AICredentials, iaQuestion: string) => Promise<AIAnalysisResult>;
};

export const makeCallAIAnalysisUseCase = (
  aiProviders: IAIProviderService[],
): CallAIAnalysisUseCase => ({
  execute: async (credentials: AICredentials, iaQuestion: string) => {
    const prompt = ANALYSIS_PROMPT.replace('{{ANALYSIS_PROMPT}}', iaQuestion);

    const provider = aiProviders.find((p) => p.canHandle(credentials.provider));
    if (!provider) {
      throw new Error('Provedor de IA não suportado.');
    }

    const rawText = await provider.call(credentials, prompt);
    const jsonText = extractJSON(rawText.trim());

    try {
      return JSON.parse(jsonText) as AIAnalysisResult;
    } catch {
      throw new Error('A IA retornou uma resposta em formato inválido. Tente novamente.');
    }
  },
});
