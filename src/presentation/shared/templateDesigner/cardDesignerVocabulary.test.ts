import { describe, expect, it } from 'vitest';
import {
  CARD_ACTIONS_PLACEMENTS,
  CARD_ALIGNS,
  CARD_FIELD_VARIANTS,
  CARD_GAPS,
  CARD_JUSTIFIES,
  CARD_NODE_TYPES,
  CARD_TEXT_SIZES,
  CARD_TONES,
  CARD_WIDTHS,
  DEFAULT_CARD_BODY,
  isCardContainerType,
} from '../../../domain/schema/ui/cardTemplate';
import { cardTemplateIssues } from '../../../domain/schema/ui/cardTemplateIssues';
import { CARD_DESIGNER_VOCABULARY } from './cardDesignerVocabulary';
import { vocabularyNode } from './templateVocabulary';

/** O que a DSL aceita em cada propriedade de lista — a fonte que o vocabulário não pode contradizer. */
const SCHEMA_ENUMS: Record<string, Record<string, readonly string[]>> = {
  row: { gap: CARD_GAPS, align: CARD_ALIGNS, justify: CARD_JUSTIFIES },
  stack: { gap: CARD_GAPS },
  avatar: { size: CARD_WIDTHS },
  title: { size: CARD_TEXT_SIZES },
  field: { variant: CARD_FIELD_VARIANTS, size: CARD_TEXT_SIZES },
  actions: { placement: CARD_ACTIONS_PLACEMENTS },
  text: { tone: CARD_TONES, size: CARD_TEXT_SIZES },
  icon: { tone: CARD_TONES },
};

describe('cardDesignerVocabulary', () => {
  it('descreve todo tipo de nó da DSL do cartão, e nenhum além deles', () => {
    expect(CARD_DESIGNER_VOCABULARY.nodes.map((spec) => spec.type).sort()).toEqual([...CARD_NODE_TYPES].sort());
  });

  it('marca como contêiner exatamente os contêineres da DSL', () => {
    for (const spec of CARD_DESIGNER_VOCABULARY.nodes) {
      expect(!!spec.container, spec.type).toBe(isCardContainerType(spec.type));
    }
  });

  it('oferece, em cada lista, exatamente as opções que a DSL aceita — e um padrão entre elas', () => {
    for (const spec of CARD_DESIGNER_VOCABULARY.nodes) {
      const enums = spec.properties.filter((property) => property.kind === 'enum');
      expect(Object.keys(SCHEMA_ENUMS[spec.type] ?? {}).sort(), spec.type).toEqual(enums.map((property) => property.key).sort());
      for (const property of enums) {
        expect(property.options.map((entry) => entry.value), `${spec.type}.${property.key}`).toEqual([...SCHEMA_ENUMS[spec.type][property.key]]);
        expect(property.options.map((entry) => entry.value)).toContain(property.defaultValue);
      }
    }
  });

  it('todo nó criado pela paleta passa no portão — salvo o que só a pessoa pode preencher, apontado na propriedade', () => {
    const fields = [{ key: 'status', type: 'select' }];
    for (const spec of CARD_DESIGNER_VOCABULARY.nodes) {
      const node = spec.type === 'field' ? CARD_DESIGNER_VOCABULARY.fieldNode?.('status') : spec.create();
      const body = spec.container ? [{ ...node, children: [{ type: 'title' }] }] : [node];
      const wheres = cardTemplateIssues({ body }, fields).map((issue) => issue.messageParams.where);
      // O texto nasce vazio: uma frase pronta seria texto do produto gravado como dado do escritório.
      expect(wheres, spec.type).toEqual(spec.type === 'text' ? ['cardTemplate.body[0].text'] : []);
    }
  });

  it('o ponto de partida é o cartão padrão, como cópia que pode ser editada', () => {
    const body = CARD_DESIGNER_VOCABULARY.defaultBody();
    expect(body).toEqual(DEFAULT_CARD_BODY);
    expect(body).not.toBe(DEFAULT_CARD_BODY);
  });

  it('acha o nó pelo tipo e ignora o que não conhece', () => {
    expect(vocabularyNode(CARD_DESIGNER_VOCABULARY, 'title')?.type).toBe('title');
    expect(vocabularyNode(CARD_DESIGNER_VOCABULARY, 'unknown')).toBeUndefined();
  });
});
