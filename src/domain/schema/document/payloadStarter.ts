import type { WorkflowParameter } from '../../entities/Workflow';

/**
 * O primeiro texto de um modelo de DADOS, escrito a partir dos parâmetros dele — o par de
 * `buildStarterTemplate`, que escreve a partir dos campos de uma tela. A mesma razão: um exemplo
 * genérico ensinaria a gramática e deixaria a pessoa traduzindo-o para o próprio contrato; este já
 * lê o que o payload traz.
 *
 * Só do front: o agente aprende o modelo de dados pelo guia, e o servidor não escreve texto.
 */
export interface PayloadStarterInput {
  title: string;
  parameters: readonly WorkflowParameter[];
  /** O campo-título da tela de uma coleção — o que imprimir de um `EntityReference`. */
  titleFieldOf: (collection: string) => string | undefined;
  /** O rótulo como se lê (o de um parâmetro pode ser uma referência de mensagem). */
  label: (text: string) => string;
  texts: {
    comment: string;
    dateFormat: string;
    yes: string;
    no: string;
  };
}

const MAX_DEPTH = 3;

const scalarTag = (parameter: WorkflowParameter, path: string, input: PayloadStarterInput): string => {
  switch (parameter.type) {
    case 'Date':
      return `{{formatDate(${path}, "${input.texts.dateFormat}")}}`;
    case 'Boolean':
      return `{{#if ${path}}}${input.texts.yes}{{/if}}{{#if not ${path}}}${input.texts.no}{{/if}}`;
    case 'EntityReference':
      // Uma referência sozinha não imprime nada: é um registro inteiro. Vai até o campo-título dele.
      return `{{${path}.${input.titleFieldOf(parameter.entityType ?? '') ?? 'id'}}}`;
    default:
      return `{{${path}}}`;
  }
};

const nameOf = (parameter: WorkflowParameter, input: PayloadStarterInput): string =>
  input.label(parameter.label || parameter.key);

/** Uma lista de grupos vira tabela: uma coluna por campo simples, uma linha por item. */
const tableOf = (parameter: WorkflowParameter, input: PayloadStarterInput): string[] => {
  const columns = (parameter.fields ?? []).filter((field) => field.type !== 'Object' && !field.list);
  if (columns.length === 0) return [];
  return [
    `| ${columns.map((field) => nameOf(field, input)).join(' | ')} |`,
    `|${columns.map(() => '---').join('|')}|`,
    `{{#each ${parameter.key}}}| ${columns.map((field) => scalarTag(field, field.key, input)).join(' | ')} |`,
    '{{/each}}',
  ];
};

const linesOf = (
  parameters: readonly WorkflowParameter[],
  prefix: string,
  depth: number,
  input: PayloadStarterInput,
): string[] => {
  const lines: string[] = [];
  for (const parameter of parameters) {
    const path = prefix ? `${prefix}.${parameter.key}` : parameter.key;
    const name = nameOf(parameter, input);

    if (parameter.list) {
      // Dentro de uma lista o item está na raiz: o laço só funciona sobre um caminho do primeiro nível.
      if (prefix) continue;
      lines.push('', `## ${name}`, '');
      if (parameter.type === 'Object') {
        lines.push(...tableOf(parameter, input));
      } else {
        const tag = parameter.type === 'EntityReference'
          ? `{{${input.titleFieldOf(parameter.entityType ?? '') ?? 'id'}}}`
          : '{{item}}';
        lines.push(`{{#each ${parameter.key}}}- ${tag}`, '{{/each}}');
      }
      continue;
    }

    if (parameter.type === 'Object') {
      if (depth >= MAX_DEPTH) continue;
      lines.push('', `## ${name}`, '');
      lines.push(...linesOf(parameter.fields ?? [], path, depth + 1, input));
      continue;
    }

    lines.push(`**${name}:** ${scalarTag(parameter, path, input)}  `);
  }
  return lines;
};

export const buildPayloadStarterTemplate = (input: PayloadStarterInput): string =>
  [
    `# ${input.title.trim() || '{{title}}'}`,
    '',
    `<!-- ${input.texts.comment} -->`,
    '',
    ...linesOf(input.parameters, '', 0, input),
    '',
  ].join('\n').replace(/\n{3,}/g, '\n\n');

const sampleValueOf = (parameter: WorkflowParameter, depth: number): unknown => {
  const one = ((): unknown => {
    switch (parameter.type) {
      case 'Number':
        return 0;
      case 'Boolean':
        return false;
      case 'Date':
        return '2026-01-31';
      case 'Object':
        return depth >= MAX_DEPTH ? {} : samplePayloadFrom(parameter.fields ?? [], depth + 1);
      default:
        return parameter.defaultValue ?? '';
    }
  })();
  return parameter.list ? [one] : one;
};

/**
 * Um payload no formato que os parâmetros pedem — o esqueleto que a pessoa preenche para ter uma
 * pré-visualização. Um item por lista, para a tabela aparecer.
 */
export const samplePayloadFrom = (parameters: readonly WorkflowParameter[], depth = 0): Record<string, unknown> =>
  Object.fromEntries(parameters.map((parameter) => [parameter.key, sampleValueOf(parameter, depth)]));
