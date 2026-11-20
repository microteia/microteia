// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/fieldVisibility.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/fieldVisibility.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition, FieldSurface } from '../entities/entitySchemas';

/**
 * ONDE um campo é desenhado (issue #12) — uma declaração só, lida por quem desenha e por quem descreve.
 *
 * "Onde este campo aparece?" tinha quatro respostas com regras próprias: `hiddenInForm` no formulário,
 * `showInList`/`listIcon` no cartão, `logic.hiddenWhen` (expressão) e o `hiddenWhen` do `cardTemplate`.
 * A expressão `'true'` esconde, mas só quem a avalia sabe disso; uma lista estática é lida por todos.
 *
 * `visibleIn` AUSENTE é o comportamento de sempre, e `hiddenInForm`/`showInList` continuam valendo como
 * atalhos. Presente, ele VENCE: `[]` é o campo guardado no registro e desenhado em lugar nenhum.
 */
export const FIELD_SURFACES: readonly FieldSurface[] = ['form', 'card', 'portal'];

/** O kernel a partir do qual `visibleIn` é obedecido. */
export const FIELD_VISIBLE_IN_SINCE_KERNEL = '2.141.0';

type VisibilityFields = Pick<FieldDefinition, 'visibleIn' | 'hiddenInForm' | 'showInList' | 'listIcon'>;

const declared = (field: VisibilityFields): readonly FieldSurface[] | null =>
  Array.isArray(field.visibleIn) ? field.visibleIn : null;

/**
 * O campo vai a esta superfície? No cartão, é o "exibir na listagem" (o bloco de campos adicionais) —
 * a meta-linha com ícone é `fieldListedOnCard`.
 *
 * No PORTAL, é o desenho padrão — a grade de campos e o resumo do cartão — entre os campos que
 * `portal.fields` já expõe: `visibleIn` nunca alarga o que sai do escritório. O nó `field` de um
 * `portal.template` que nomeia o campo continua o desenhando: ali a escolha é explícita. Sem `visibleIn`,
 * todo campo exposto é desenhado, como sempre foi.
 */
export const fieldShownIn = (field: Partial<VisibilityFields>, surface: FieldSurface): boolean => {
  const surfaces = declared(field as VisibilityFields);
  if (surfaces) return surfaces.includes(surface);
  if (surface === 'form') return field.hiddenInForm !== true;
  if (surface === 'card') return field.showInList === true;
  return true;
};

/**
 * O campo chega ao cartão por QUALQUER caminho — o bloco de adicionais ou a meta-linha do `listIcon`. Sem
 * `visibleIn`, o ícone basta (é o que `listIcon` promete); com ele, `card` fora tira as duas.
 */
export const fieldListedOnCard = (field: VisibilityFields): boolean => {
  const surfaces = declared(field);
  if (surfaces) return surfaces.includes('card');
  return field.showInList === true || (typeof field.listIcon === 'string' && field.listIcon !== '');
};

export type FieldVisibilityIssue =
  | { kind: 'shape' }
  | { kind: 'surface'; surface: string }
  | { kind: 'contradicts'; flag: 'hiddenInForm' | 'showInList' };

/**
 * A declaração conferida: lista de superfícies conhecidas, sem contradizer os atalhos declarados ao lado.
 * O atalho que CONCORDA é aceito — é o pacote antigo que ganhou `visibleIn` sem apagar o que tinha.
 */
export const fieldVisibilityIssues = (field: Partial<VisibilityFields> & { visibleIn?: unknown }): FieldVisibilityIssue[] => {
  const value = field.visibleIn;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return [{ kind: 'shape' }];
  const issues: FieldVisibilityIssue[] = [];
  for (const surface of value as string[]) {
    if (!FIELD_SURFACES.includes(surface as FieldSurface)) issues.push({ kind: 'surface', surface });
  }
  const surfaces = value as string[];
  if (field.hiddenInForm === true && surfaces.includes('form')) issues.push({ kind: 'contradicts', flag: 'hiddenInForm' });
  if (field.showInList === true && !surfaces.includes('card')) issues.push({ kind: 'contradicts', flag: 'showInList' });
  return issues;
};

export interface FieldVisibilityChoice {
  form: boolean;
  card: boolean;
  portal: boolean;
}

/**
 * O que o Form Design grava a partir das caixas "onde aparece". Os atalhos dizem formulário e cartão; só o
 * PORTAL desmarcado precisa da lista — e por isso ela só é escrita então, ou quando o campo já a tinha.
 * Gravar `visibleIn` em todo campo salvo faria toda extensão exportada pelo escritório exigir o kernel que
 * o lê, por uma caixa que ninguém tocou. Os atalhos vão sempre coerentes com a lista: nunca a contradizem.
 */
export const fieldVisibilityDeclaration = (
  choice: FieldVisibilityChoice,
  keepList: boolean,
): Pick<FieldDefinition, 'visibleIn' | 'hiddenInForm' | 'showInList'> => ({
  visibleIn: keepList || !choice.portal ? FIELD_SURFACES.filter((surface) => choice[surface]) : null,
  hiddenInForm: choice.form ? null : true,
  showInList: choice.card,
});
