// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/document/starterTemplate.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from '../../entities/entitySchemas';
import type { DocumentTemplateDataset } from './documentTemplate';

/**
 * O MODELO INICIAL de uma tela — escrito a partir dos campos DELA, e não de um exemplo genérico.
 *
 * Quem abre um editor vazio não sabe como se chama o campo do vínculo nem como uma data vira texto; um
 * exemplo sobre "parcelas" ensinaria a gramática e deixaria a pessoa traduzindo para o próprio
 * cadastro. Aqui cada linha já é verdadeira no escritório dela: o rótulo é o da tela, a data passa por
 * `formatDate`, o valor por `formatMoney`, o vínculo segue até o título do registro apontado, e cada
 * tela que aponta para esta vira uma lista com a tabela pronta.
 *
 * O que não tem tradução fiel para texto fica de fora em vez de sair errado: o arquivo, e a opção de
 * lista que mora numa lista do escritório — o documento guarda a CHAVE da opção, e imprimi-la seria
 * mostrar ao cliente um identificador.
 */

export interface StarterTexts {
  /** Comentários que orientam quem edita; o comentário HTML não aparece no documento. */
  fieldsComment: string;
  listComment: string;
  /** O padrão de data do idioma (`DD/MM/YYYY`). */
  dateFormat: string;
  yes: string;
  no: string;
  generatedOn: string;
}

/**
 * A tela como o modelo inicial a lê. É estrutural de propósito: a tela de modelos passa a
 * `ScreenDefinition` e o agente de IA passa a `SchemaScreen` do backend — o mesmo modelo nas duas pontas.
 */
export interface StarterScreen {
  id: string;
  /** A coleção que a tela descreve, quando não é o `id`: `collection` no backend, `dataCollection` na tela. */
  collection?: string | null;
  dataCollection?: string | null;
  titleSingular: string;
  titlePlural?: string;
  titleFieldKey?: string | null;
  fields: readonly FieldDefinition[];
}

export interface StarterInput {
  screen: StarterScreen;
  /** Todas as telas do escritório: de onde saem os vínculos navegados e as listas filhas. */
  screens: readonly StarterScreen[];
  /** Resolve o rótulo (referência de mensagem ou texto do escritório). */
  label: (value: string) => string;
  texts: StarterTexts;
}

export interface StarterTemplate {
  body: string;
  fileName: string;
  datasets: DocumentTemplateDataset[];
}

/** Acima disso a cadeia de `#if` deixa de ensinar e passa a poluir. */
const MAX_INLINE_OPTIONS = 6;

/** Colunas de uma lista: o bastante para uma tabela legível numa página A4. */
const MAX_LIST_COLUMNS = 4;

const identifier = (raw: string): string => {
  const clean = raw.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(clean) ? clean : `list_${clean}`;
};

/**
 * Uma referência aponta para a COLEÇÃO, não para a chave da tela: `refEntity: 'cases'` é atendido pela
 * tela `processos` ligada a `cases`, e a âncora `cases` (sem campos) não serve de alvo.
 */
const starterCollection = (screen: StarterScreen): string =>
  screen.collection?.trim() || screen.dataCollection?.trim() || screen.id;

const screenOfCollection = (screens: readonly StarterScreen[], collection: string): StarterScreen | undefined => {
  const serving = screens.filter((screen) => starterCollection(screen) === collection);
  return serving.find((screen) => !!screen.titleFieldKey) ?? serving[0];
};

/**
 * A expressão que imprime o campo como TEXTO de documento, ou `null` quando não há tradução fiel. É
 * a mesma que o modelo inicial escreve, e a que o guia do agente de IA mostra campo a campo.
 */
export const starterFieldExpression = (
  field: FieldDefinition,
  screens: readonly StarterScreen[],
  texts: StarterTexts,
  label: (value: string) => string,
): string | null => {
  switch (field.type) {
    case 'file':
      return null;
    case 'date':
      return `{{formatDate(${field.key}, "${texts.dateFormat}")}}`;
    case 'currency':
      return `{{formatMoney(${field.key})}}`;
    case 'checkbox':
      return `{{#if ${field.key}}}${texts.yes}{{/if}}{{#if not ${field.key}}}${texts.no}{{/if}}`;
    case 'reference': {
      const target = field.refEntity ? screenOfCollection(screens, field.refEntity) : undefined;
      return target?.titleFieldKey ? `{{${field.key}.${target.titleFieldKey}}}` : null;
    }
    case 'select': {
      const options = field.options ?? [];
      if (field.lookupCollection || options.length === 0 || options.length > MAX_INLINE_OPTIONS) return null;
      return options.map((option) => `{{#if ${field.key} == "${option.key}"}}${label(option.label)}{{/if}}`).join('');
    }
    default:
      return `{{${field.key}}}`;
  }
};

const ordered = (fields: readonly FieldDefinition[]): FieldDefinition[] =>
  [...fields].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

export const buildStarterTemplate = ({ screen, screens, label, texts }: StarterInput): StarterTemplate => {
  const lines: string[] = [`# ${label(screen.titleSingular)}`, '', `<!-- ${texts.fieldsComment} -->`, ''];

  for (const field of ordered(screen.fields)) {
    const value = starterFieldExpression(field, screens, texts, label);
    if (value !== null) lines.push(`**${label(field.label)}:** ${value}  `);
  }

  const datasets: DocumentTemplateDataset[] = [];
  const collection = starterCollection(screen);
  for (const child of screens) {
    if (child.id === screen.id) continue;
    const via = child.fields.find((field) => field.type === 'reference' && field.refEntity === collection);
    if (!via) continue;

    const columns = ordered(child.fields)
      .filter((field) => field.key !== via.key)
      .map((field) => ({ field, value: starterFieldExpression(field, screens, texts, label) }))
      .filter((column): column is { field: FieldDefinition; value: string } => column.value !== null)
      .slice(0, MAX_LIST_COLUMNS);
    if (columns.length === 0) continue;

    const name = identifier(child.id);
    const orderBy = child.fields.find((field) => field.type === 'date')?.key;
    datasets.push({ name, from: child.id, via: via.key, ...(orderBy ? { orderBy } : {}) });

    lines.push(
      '',
      `## ${label(child.titlePlural ?? child.titleSingular)}`,
      '',
      `<!-- ${texts.listComment} -->`,
      '',
      `| # | ${columns.map((column) => label(column.field.label)).join(' | ')} |`,
      `|---|${columns.map(() => '---').join('|')}|`,
      `{{#each ${name}}}| {{index}} | ${columns.map((column) => column.value).join(' | ')} |`,
      '{{/each}}',
    );
  }

  lines.push('', '---', '', `${texts.generatedOn} {{formatDate(today(), "${texts.dateFormat}")}}`, '');

  return {
    body: lines.join('\n'),
    fileName: screen.titleFieldKey ? `${label(screen.titleSingular)} - {{${screen.titleFieldKey}}}` : '',
    datasets,
  };
};
