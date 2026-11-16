// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/invocationSource.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/invocationSource.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { LocalizedMessage } from './i18n/localizedMessage';
import { WORKFLOW_CALLED_EVENT } from './eventCatalog';

/**
 * O CONTEÚDO sobre o qual uma execução foi pedida — o texto colado ou lido de um PDF no Processador, o
 * `text` do passo "Extrair parâmetros" — entregue a um parâmetro tal como chegou, sem passar pelo modelo.
 *
 * O papel é da INVOCAÇÃO, não de uma tela: a mesma automação recebe o texto igual pela tela e por um
 * passo disparado por e-mail. Foi por isso que a forma pedida (`source: "processorText"`) não entrou —
 * ela amarraria o contrato da automação a uma tela, e o caminho sem ninguém olhando ficaria de fora.
 *
 * O motivo de existir: um leitor determinístico de layout conhecido (conta de luz, extrato, nota) não
 * pode depender de um modelo copiando milhares de caracteres, nem trocando um dígito de uma tarifa com
 * oito casas sem que nada acuse.
 */
export const PARAMETER_FILL_FROM = ['sourceText', 'sourceName'] as const;
export type ParameterFillFrom = (typeof PARAMETER_FILL_FROM)[number];

/**
 * O kernel a partir do qual `fillFrom` é entendido. Antes dele a propriedade é ignorada — e a IA
 * tentaria copiar o texto num parâmetro `String` comum, que é justamente o que ela veio evitar.
 */
export const PARAMETER_FILL_FROM_SINCE_KERNEL = '2.134.0';

/**
 * O teto do texto entregue. Ele viaja no payload do evento e volta no histórico da execução — dois
 * documentos de 1 MB —, e cortá-lo calado entregaria a um leitor determinístico um documento que não
 * existe. Acima dele, recusa.
 */
export const MAX_SOURCE_TEXT_CHARACTERS = 100_000;

export const isParameterFillFrom = (value: unknown): value is ParameterFillFrom =>
  typeof value === 'string' && (PARAMETER_FILL_FROM as readonly string[]).includes(value);

interface FillableParameter {
  key: string;
  type: string;
  list?: boolean;
  fillFrom?: unknown;
  fields?: FillableParameter[];
}

export interface InvocationSource {
  text: string;
  /** O nome do arquivo de onde o texto saiu — ausente para texto colado. */
  name?: string;
}

/** Os parâmetros que o MODELO preenche: todos, menos os que recebem o conteúdo da invocação. */
export const parametersForAI = <T extends FillableParameter>(parameters: T[]): T[] =>
  parameters.filter((parameter) => !isParameterFillFrom(parameter.fillFrom));

/**
 * Os valores que vêm da invocação, por chave. Só a raiz conta: o papel é da execução inteira, e dentro de
 * um `Object` ele seria um pedaço de texto repetido em cada item.
 */
export const sourceFilledValues = (
  parameters: FillableParameter[],
  source: InvocationSource,
): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const parameter of parameters) {
    if (parameter.fillFrom === 'sourceText') values[parameter.key] = source.text;
    if (parameter.fillFrom === 'sourceName') values[parameter.key] = source.name ?? '';
  }
  return values;
};

export interface FillFromIssue extends LocalizedMessage {
  parameter: string;
}

/**
 * O que torna um `fillFrom` impossível de cumprir. Vale para a autoria (no salvar) e para o pacote, e
 * cada recusa é de falso-positivo zero: o valor nunca chegaria ao parâmetro que o declara.
 */
export const fillFromIssues = (
  parameters: FillableParameter[] | undefined,
  eventName: string,
): FillFromIssue[] => {
  const issues: FillFromIssue[] = [];
  const seen = new Set<string>();
  const walk = (list: FillableParameter[], nested: boolean): void => {
    for (const parameter of list) {
      if (parameter.fields) walk(parameter.fields, true);
      if (parameter.fillFrom === undefined) continue;
      const params = { parameter: parameter.key, fillFrom: String(parameter.fillFrom) };
      if (!isParameterFillFrom(parameter.fillFrom)) {
        issues.push({ parameter: parameter.key, message: '@core.automation/parameter.fill-from.unknown', messageParams: params });
        continue;
      }
      if (eventName !== WORKFLOW_CALLED_EVENT) {
        issues.push({ parameter: parameter.key, message: '@core.automation/parameter.fill-from.not-callable', messageParams: params });
      } else if (nested) {
        issues.push({ parameter: parameter.key, message: '@core.automation/parameter.fill-from.nested', messageParams: params });
      } else if (parameter.type !== 'String' || parameter.list) {
        issues.push({ parameter: parameter.key, message: '@core.automation/parameter.fill-from.not-string', messageParams: params });
      } else if (seen.has(parameter.fillFrom)) {
        issues.push({ parameter: parameter.key, message: '@core.automation/parameter.fill-from.duplicate', messageParams: params });
      } else {
        seen.add(parameter.fillFrom);
      }
    }
  };
  walk(parameters ?? [], false);
  return issues;
};

/** Se algum parâmetro, em qualquer nível, declara o papel — é o que exige o kernel novo no pacote. */
export const declaresFillFrom = (parameters: FillableParameter[] | undefined): boolean =>
  (parameters ?? []).some((parameter) =>
    parameter.fillFrom !== undefined || declaresFillFrom(parameter.fields));
