import { describe, expect, it } from 'vitest';
import {
  CARD_ALIGNS,
  CARD_FIELD_VARIANTS,
  CARD_GAPS,
  CARD_JUSTIFIES,
  CARD_TEXT_SIZES,
  CARD_TONES,
} from '../../../domain/schema/ui/cardTemplate';
import {
  DEFAULT_PORTAL_CARD_BODY,
  DEFAULT_PORTAL_DETAIL_BODY,
  PORTAL_DETAIL_ONLY_NODE_TYPES,
  PORTAL_TEMPLATE_NODE_TYPES,
  isPortalContainerType,
} from '../../../domain/schema/ui/portalTemplate';
import { portalTemplateIssues } from '../../../domain/schema/ui/portalTemplateIssues';
import { PORTAL_CARD_DESIGNER_VOCABULARY, PORTAL_DETAIL_DESIGNER_VOCABULARY } from './portalDesignerVocabulary';
import type { TemplateVocabulary } from './templateVocabulary';

/** O que a DSL do portal aceita em cada propriedade de lista. */
const SCHEMA_ENUMS: Record<string, Record<string, readonly string[]>> = {
  row: { gap: CARD_GAPS, align: CARD_ALIGNS, justify: CARD_JUSTIFIES },
  stack: { gap: CARD_GAPS },
  section: { gap: CARD_GAPS },
  title: { size: CARD_TEXT_SIZES },
  field: { variant: CARD_FIELD_VARIANTS, size: CARD_TEXT_SIZES },
  text: { tone: CARD_TONES, size: CARD_TEXT_SIZES },
  icon: { tone: CARD_TONES },
};

const SURFACES: Array<{ name: 'card' | 'detail'; vocabulary: TemplateVocabulary; types: readonly string[] }> = [
  {
    name: 'card',
    vocabulary: PORTAL_CARD_DESIGNER_VOCABULARY,
    types: PORTAL_TEMPLATE_NODE_TYPES.filter((type) => !PORTAL_DETAIL_ONLY_NODE_TYPES.includes(type)),
  },
  { name: 'detail', vocabulary: PORTAL_DETAIL_DESIGNER_VOCABULARY, types: PORTAL_TEMPLATE_NODE_TYPES },
];

const exposed = [{ key: 'status', type: 'select' }];

describe.each(SURFACES)('portalDesignerVocabulary — $name', ({ name, vocabulary, types }) => {
  it('descreve exatamente os nós que esta superfície aceita', () => {
    expect(vocabulary.nodes.map((spec) => spec.type).sort()).toEqual([...types].sort());
  });

  it('marca como contêiner exatamente os contêineres da DSL', () => {
    for (const spec of vocabulary.nodes) expect(!!spec.container, spec.type).toBe(isPortalContainerType(spec.type));
  });

  it('oferece, em cada lista, exatamente as opções que a DSL aceita', () => {
    for (const spec of vocabulary.nodes) {
      const enums = spec.properties.filter((property) => property.kind === 'enum');
      expect(enums.map((property) => property.key).sort(), spec.type).toEqual(Object.keys(SCHEMA_ENUMS[spec.type] ?? {}).sort());
      for (const property of enums) {
        expect(property.options.map((entry) => entry.value), `${spec.type}.${property.key}`).toEqual([...SCHEMA_ENUMS[spec.type][property.key]]);
        expect(property.options.map((entry) => entry.value)).toContain(property.defaultValue);
      }
    }
  });

  it('todo nó da paleta passa no portão do portal — salvo o texto, que só a pessoa escreve', () => {
    for (const spec of vocabulary.nodes) {
      const node = spec.type === 'field' ? vocabulary.fieldNode?.('status') : spec.create();
      const body = spec.container ? [{ ...node, children: [{ type: 'title' }] }] : [node];
      const issues = portalTemplateIssues({ [name]: { body } }, exposed).map((issue) => issue.messageParams.where);
      expect(issues, spec.type).toEqual(spec.type === 'text' ? [`portal.template.${name}.body[0].text`] : []);
    }
  });

  it('aponta os problemas no prefixo que o portão usa para esta superfície', () => {
    expect(vocabulary.issueRoot).toBe(`portal.template.${name}`);
  });
});

describe('portalDesignerVocabulary — pontos de partida', () => {
  it('são os desenhos padrão do portal, como cópias editáveis', () => {
    expect(PORTAL_CARD_DESIGNER_VOCABULARY.defaultBody()).toEqual(DEFAULT_PORTAL_CARD_BODY);
    expect(PORTAL_DETAIL_DESIGNER_VOCABULARY.defaultBody()).toEqual(DEFAULT_PORTAL_DETAIL_BODY);
    expect(PORTAL_DETAIL_DESIGNER_VOCABULARY.defaultBody()).not.toBe(DEFAULT_PORTAL_DETAIL_BODY);
  });
});
