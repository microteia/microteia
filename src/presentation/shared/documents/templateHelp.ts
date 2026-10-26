import type { DocumentTemplateFormat } from '../../../domain/schema/document/documentTemplate';

/**
 * A ajuda da gramática como DADO: o exemplo é código (não se traduz), a explicação é uma chave de
 * `core.documents`. Fica fora da View para que a tela só desenhe, e para que um bloco novo da gramática
 * entre aqui uma vez em vez de num JSX.
 */
export interface TemplateHelpEntry {
  code?: string;
  /** Chave em `core.documents`. */
  text: string;
}

export interface TemplateHelpGroup {
  /** Chave em `core.documents`. */
  title: string;
  entries: TemplateHelpEntry[];
  /** Ausente = vale para os dois formatos. */
  formats?: DocumentTemplateFormat[];
  /** O grupo oferece o atalho para a referência completa das funções. */
  linksFunctionReference?: boolean;
}

export const templateHelp = (dateFormat: string): TemplateHelpGroup[] => [
  {
    title: 'help.group.fields',
    entries: [
      { code: '{{name}}', text: 'help.field' },
      { code: '{{ownerId.name}}', text: 'help.path' },
      { code: '{{ownerId}}', text: 'help.reference-alone' },
    ],
  },
  {
    title: 'help.group.functions',
    linksFunctionReference: true,
    entries: [
      { code: `{{formatDate(dueDate, "${dateFormat}")}}`, text: 'help.format-date' },
      { code: '{{formatMoney(amount)}}', text: 'help.format-money' },
      { code: '{{upper(name)}}', text: 'help.upper' },
    ],
  },
  {
    title: 'help.group.blocks',
    entries: [
      { code: '{{#each installments}} … {{/each}}', text: 'help.each' },
      { code: '{{index}}', text: 'help.index' },
      { code: '{{#each tags}}{{item}}{{/each}}', text: 'help.item' },
      { code: '{{#if paid}} … {{/if}}', text: 'help.if' },
      { code: '{{#if not paid}} … {{/if}}', text: 'help.if-not' },
    ],
  },
  {
    title: 'help.group.layout',
    formats: ['markdown'],
    entries: [
      { code: '# …', text: 'help.heading-title' },
      { code: '## …', text: 'help.heading-section' },
      { code: '**…**  *…*', text: 'help.emphasis' },
      { code: '- …', text: 'help.list' },
      { code: '| … | … |', text: 'help.table' },
      { code: '---', text: 'help.rule' },
      { code: '<!-- pagebreak -->', text: 'help.page-break' },
    ],
  },
  {
    title: 'help.group.good-to-know',
    entries: [
      { text: 'help.escaped' },
      { text: 'help.empty-field' },
      { text: 'help.organization-language' },
    ],
  },
  {
    title: 'help.group.word',
    formats: ['docx'],
    entries: [
      { text: 'help.word-fields' },
      { text: 'help.word-layout' },
    ],
  },
];

export const templateHelpFor = (format: DocumentTemplateFormat, dateFormat: string): TemplateHelpGroup[] =>
  templateHelp(dateFormat).filter((group) => !group.formats || group.formats.includes(format));
