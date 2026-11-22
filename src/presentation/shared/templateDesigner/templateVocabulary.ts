import type { IconType } from 'react-icons';
import type { TemplateNode } from './templateTree';

/**
 * O contrato entre o designer visual e uma DSL de template. O designer não conhece nenhum tipo de nó:
 * recebe o VOCABULÁRIO — que nós existem, quais são contêineres, o que cada um edita, os tetos e onde
 * o portão de autoria aponta os problemas. O cartão da listagem é o primeiro vocabulário; os desenhos
 * do portal (cartão e registro aberto, com `section` e nós só-de-detalhe) entram com outro, sem
 * reescrever o designer.
 *
 * Todo rótulo é uma referência declarativa (`@ns/chave`), resolvida por `useLabel()` no ponto de render.
 */

export interface TemplateOption {
  value: string;
  label: string;
}

interface PropertyBase {
  /** A chave no nó — com ponto para aninhar (`accent.field`). */
  key: string;
  label: string;
}

export type TemplatePropertySpec =
  /** Lista fechada. Escolher `defaultValue` APAGA a chave: o padrão não se grava. */
  | PropertyBase & { kind: 'enum'; options: readonly TemplateOption[]; defaultValue: string }
  | PropertyBase & { kind: 'boolean' }
  /** Um campo da tela; `fieldTypes` restringe (a faixa colorida só aceita seleção). */
  | PropertyBase & { kind: 'field'; required?: boolean; fieldTypes?: readonly string[] }
  /** Um ícone do catálogo das telas. */
  | PropertyBase & { kind: 'icon'; required?: boolean }
  /** Texto declarativo: referência `@ns/chave` ou o que o escritório escreve. */
  | PropertyBase & { kind: 'text'; required?: boolean }
  /** O rótulo de um campo: nenhum, o do próprio campo (`true`) ou um texto. */
  | PropertyBase & { kind: 'fieldLabel' }
  /** Chaves de ação, escolhidas entre as ações da tela. */
  | PropertyBase & { kind: 'actionKeys' }
  /** Expressão de campo (`hiddenWhen`). */
  | PropertyBase & { kind: 'expression' };

export type TemplatePropertyKind = TemplatePropertySpec['kind'];

export type TemplatePaletteGroup = 'record' | 'structure' | 'content';

/** O que o resumo de um nó no canvas pode perguntar. */
export interface TemplateSummaryContext {
  fieldLabel: (fieldKey: string) => string | undefined;
  /** Texto declarativo resolvido. */
  label: (text: string) => string;
}

export interface TemplateNodeSpec {
  type: string;
  label: string;
  icon: IconType;
  /** `fields` não aparece aqui: o grupo dos campos é montado com os campos da tela (`fieldNode`). */
  group: TemplatePaletteGroup;
  /** Contêiner, e em que direção ele arranja os filhos no canvas. */
  container?: 'row' | 'column';
  create: () => TemplateNode;
  properties: readonly TemplatePropertySpec[];
  /** O detalhe que identifica o nó no canvas — o campo, o texto. Ausente, só o nome do tipo. */
  summary?: (node: TemplateNode, context: TemplateSummaryContext) => string | undefined;
}

export interface TemplateVocabulary {
  nodes: readonly TemplateNodeSpec[];
  /** As propriedades do template inteiro, mostradas quando nenhum nó está escolhido. */
  rootProperties: readonly TemplatePropertySpec[];
  /** O nó que posiciona um campo da tela — a entrada de cada campo na paleta. */
  fieldNode?: (fieldKey: string) => TemplateNode;
  /** O ponto de partida ("começar do padrão") — a DSL escrevendo o desenho de sempre. */
  defaultBody: () => unknown[];
  /** A profundidade de um nó do corpo; o template em si é o nível 1. */
  rootDepth: number;
  maxDepth: number;
  maxNodes: number;
  /** O prefixo do `where` que o portão de autoria aponta (`cardTemplate`) e a chave do corpo. */
  issueRoot: string;
  bodyKey: string;
}

export const vocabularyNode = (vocabulary: TemplateVocabulary, type: unknown): TemplateNodeSpec | undefined =>
  typeof type === 'string' ? vocabulary.nodes.find((spec) => spec.type === type) : undefined;

export const isVocabularyContainer = (vocabulary: TemplateVocabulary) => (type: unknown): boolean =>
  !!vocabularyNode(vocabulary, type)?.container;
