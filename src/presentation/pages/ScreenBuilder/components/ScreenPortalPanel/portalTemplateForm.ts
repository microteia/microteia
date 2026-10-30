import { CARD_LAYOUTS, CARD_WIDTHS, isPlainCardObject } from '../../../../../domain/schema/ui/cardTemplate';
import type { CardLayout, CardWidth } from '../../../../../domain/schema/ui/cardTemplate';
import { DEFAULT_PORTAL_CARD_BODY, DEFAULT_PORTAL_DETAIL_BODY } from '../../../../../domain/schema/ui/portalTemplate';
import { portalTemplateIssues } from '../../../../../domain/schema/ui/portalTemplateIssues';
import type { CardTemplateFieldInfo, CardTemplateIssue } from '../../../../../domain/schema/ui/cardTemplateIssues';

/**
 * O que a seção "Aparência no portal" edita — `portal.template`, desmontado em controles: o arranjo da
 * lista em botões, o desenho do cartão e o do registro aberto em JSON. O JSON fica como TEXTO enquanto
 * se digita, como na aba "Cartão".
 */
export interface PortalTemplateFormState {
  cardLayout: CardLayout;
  cardMinWidth: CardWidth;
  cardCustom: boolean;
  cardSource: string;
  detailCustom: boolean;
  detailSource: string;
}

/** No portal o padrão é um cartão por linha: ele é usado primeiro no celular. */
export const EMPTY_PORTAL_TEMPLATE_FORM: PortalTemplateFormState = {
  cardLayout: 'list',
  cardMinWidth: 'md',
  cardCustom: false,
  cardSource: '',
  detailCustom: false,
  detailSource: '',
};

const ARRANGEMENT_KEYS = new Set(['layout', 'minWidth']);

const cardDesignOf = (card: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(card).filter(([key]) => !ARRANGEMENT_KEYS.has(key)));

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

export const defaultPortalCardSource = (): string => pretty({ body: DEFAULT_PORTAL_CARD_BODY });
export const defaultPortalDetailSource = (): string => pretty({ body: DEFAULT_PORTAL_DETAIL_BODY });

/** A declaração gravada, como a seção a mostra. */
export const toPortalTemplateForm = (stored: unknown): PortalTemplateFormState => {
  if (!isPlainCardObject(stored)) return EMPTY_PORTAL_TEMPLATE_FORM;
  const card = isPlainCardObject(stored.card) ? stored.card : {};
  const design = cardDesignOf(card);
  const detail = isPlainCardObject(stored.detail) ? stored.detail : {};
  return {
    cardLayout: CARD_LAYOUTS.includes(card.layout as CardLayout) ? card.layout as CardLayout : 'list',
    cardMinWidth: CARD_WIDTHS.includes(card.minWidth as CardWidth) ? card.minWidth as CardWidth : 'md',
    cardCustom: Object.keys(design).length > 0,
    cardSource: Object.keys(design).length > 0 ? pretty(design) : '',
    detailCustom: Object.keys(detail).length > 0,
    detailSource: Object.keys(detail).length > 0 ? pretty(detail) : '',
  };
};

type Parsed = { value: Record<string, unknown>; issue: null } | { value: null; issue: CardTemplateIssue };

const parse = (custom: boolean, source: string, where: string): Parsed => {
  if (!custom || !source.trim()) return { value: {}, issue: null };
  try {
    const parsed: unknown = JSON.parse(source);
    return isPlainCardObject(parsed)
      ? { value: parsed, issue: null }
      : { value: null, issue: { message: '@core.records/portal-template.issue.not-object', messageParams: { where } } };
  } catch (caught) {
    return {
      value: null,
      issue: {
        message: '@core.records/portal-template.issue.json',
        messageParams: { where, error: caught instanceof Error ? caught.message : String(caught) },
      },
    };
  }
};

const parseCard = (form: PortalTemplateFormState) => parse(form.cardCustom, form.cardSource, 'portal.template.card');
const parseDetail = (form: PortalTemplateFormState) => parse(form.detailCustom, form.detailSource, 'portal.template.detail');

/**
 * O que gravar em `portal.template`. O arranjo padrão (um por linha, largura média) não é escrito;
 * nada declarado = `null`, e o portal volta ao de sempre. JSON que não parseia não tem o que gravar:
 * quem chama confere `portalTemplateFormIssues` antes.
 */
export const fromPortalTemplateForm = (form: PortalTemplateFormState): Record<string, unknown> | null => {
  const card = {
    ...cardDesignOf(parseCard(form).value ?? {}),
    ...(form.cardLayout !== 'list' ? { layout: form.cardLayout } : {}),
    ...(form.cardMinWidth !== 'md' ? { minWidth: form.cardMinWidth } : {}),
  };
  const detail = parseDetail(form).value ?? {};
  const template = {
    ...(Object.keys(card).length > 0 ? { card } : {}),
    ...(Object.keys(detail).length > 0 ? { detail } : {}),
  };
  return Object.keys(template).length > 0 ? template : null;
};

/** O mesmo portão do `check` do pacote, mais o JSON que ainda não parseia. */
export const portalTemplateFormIssues = (
  form: PortalTemplateFormState,
  exposedFields: readonly CardTemplateFieldInfo[],
): CardTemplateIssue[] => {
  const parseIssues = [parseCard(form).issue, parseDetail(form).issue].filter((one): one is CardTemplateIssue => one !== null);
  return parseIssues.length > 0 ? parseIssues : portalTemplateIssues(fromPortalTemplateForm(form), exposedFields);
};
