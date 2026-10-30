import { CARD_LAYOUTS, CARD_WIDTHS, DEFAULT_CARD_BODY, isPlainCardObject, readCardTemplate } from '../../../../../domain/schema/ui/cardTemplate';
import type { CardLayout, CardWidth } from '../../../../../domain/schema/ui/cardTemplate';
import { cardTemplateIssues } from '../../../../../domain/schema/ui/cardTemplateIssues';
import type { CardTemplateFieldInfo, CardTemplateIssue } from '../../../../../domain/schema/ui/cardTemplateIssues';

/**
 * O que a aba "Cartão" do Form Design edita — `cardTemplate`, desmontado em controles: o arranjo e a
 * largura em botões, o desenho (`accent` e `body`) em JSON. O JSON fica como TEXTO enquanto se
 * digita: um texto que ainda não parseia é o estado normal de quem está escrevendo.
 */
export interface CardTemplateFormState {
  layout: CardLayout;
  minWidth: CardWidth;
  custom: boolean;
  source: string;
}

export const EMPTY_CARD_TEMPLATE_FORM: CardTemplateFormState = { layout: 'grid', minWidth: 'md', custom: false, source: '' };

const ARRANGEMENT_KEYS = new Set(['layout', 'minWidth']);

const designOf = (stored: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(stored).filter(([key]) => !ARRANGEMENT_KEYS.has(key)));

/** O cartão padrão em JSON — o ponto de partida de quem liga o cartão personalizado. */
export const defaultCardTemplateSource = (): string => JSON.stringify({ body: DEFAULT_CARD_BODY }, null, 2);

/** A declaração gravada, como a aba a mostra. */
export const toCardTemplateForm = (stored: unknown): CardTemplateFormState => {
  if (!isPlainCardObject(stored)) return EMPTY_CARD_TEMPLATE_FORM;
  const design = designOf(stored);
  return {
    layout: CARD_LAYOUTS.includes(stored.layout as CardLayout) ? stored.layout as CardLayout : 'grid',
    minWidth: CARD_WIDTHS.includes(stored.minWidth as CardWidth) ? stored.minWidth as CardWidth : 'md',
    custom: Object.keys(design).length > 0,
    source: Object.keys(design).length > 0 ? JSON.stringify(design, null, 2) : '',
  };
};

type Parsed = { design: Record<string, unknown>; issue: null } | { design: null; issue: CardTemplateIssue };

const parseDesign = (form: CardTemplateFormState): Parsed => {
  if (!form.custom || !form.source.trim()) return { design: {}, issue: null };
  try {
    const parsed: unknown = JSON.parse(form.source);
    if (!isPlainCardObject(parsed)) {
      return { design: null, issue: { message: '@core.records/card-template.issue.not-object', messageParams: { where: 'cardTemplate' } } };
    }
    return { design: designOf(parsed), issue: null };
  } catch (caught) {
    return {
      design: null,
      issue: { message: '@core.records/card-template.issue.json', messageParams: { error: caught instanceof Error ? caught.message : String(caught) } },
    };
  }
};

/**
 * O que gravar. O arranjo padrão (grade, largura média) não é escrito; nada além dele = `null`, que
 * apaga a declaração e devolve o cartão de sempre. JSON que não parseia não tem o que gravar: quem
 * chama confere `cardTemplateFormIssues` antes.
 */
export const fromCardTemplateForm = (form: CardTemplateFormState): Record<string, unknown> | null => {
  const { design } = parseDesign(form);
  const value = {
    ...(design ?? {}),
    ...(form.layout !== 'grid' ? { layout: form.layout } : {}),
    ...(form.minWidth !== 'md' ? { minWidth: form.minWidth } : {}),
  };
  return Object.keys(value).length > 0 ? value : null;
};

/** O mesmo portão do `check` do pacote, mais o JSON que ainda não parseia. */
export const cardTemplateFormIssues = (
  form: CardTemplateFormState,
  fields: readonly CardTemplateFieldInfo[],
): CardTemplateIssue[] => {
  const parsed = parseDesign(form);
  if (parsed.issue) return [parsed.issue];
  return cardTemplateIssues(fromCardTemplateForm(form), fields);
};

/** O cartão que a pré-visualização desenha — o padrão enquanto não há desenho próprio válido. */
export const previewCardTemplate = (form: CardTemplateFormState) =>
  readCardTemplate(fromCardTemplateForm(form));
