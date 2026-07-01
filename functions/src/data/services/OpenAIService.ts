import type { IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';

export class OpenAIService implements IAIProviderService {
  canHandle(provider: string): boolean {
    return provider === 'openai';
  }

  async call(credentials: AICredentials, prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${credentials.apiKey}`,
  },
  body: JSON.stringify({
    model: credentials.model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: credentials.temperature,
    max_tokens: credentials.maxTokens,

    response_format: {
      type: "json_schema",
      json_schema: {
        name: "judicial_processes",
        strict: true,
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              processNumber: { type: ["string", "null"] },
              court: { type: ["string", "null"] },
              activeParty: { type: ["string", "null"] },
              passiveParty: { type: ["string", "null"] },
              legalClass: { type: ["string", "null"] },
              filingDate: { type: ["string", "null"] },
              distributionType: { type: ["string", "null"] },
              processSubject: { type: ["string", "null"] },
              movements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    date: { type: ["string", "null"] },
                    type: { type: ["string", "null"] },
                    description: { type: ["string", "null"] },
                    documentUrl: { type: ["string", "null"] }
                  },
                  required: [
                    "date",
                    "type",
                    "description",
                    "documentUrl"
                  ],
                  additionalProperties: false
                }
              }
            },
            required: [
              "processNumber",
              "court",
              "activeParty",
              "passiveParty",
              "legalClass",
              "filingDate",
              "distributionType",
              "processSubject",
              "movements"
            ],
            additionalProperties: false
          }
        }
      }
    }
  }),
});

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
      throw new Error(msg ?? `Erro ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
  }
}
