import { describe, expect, it } from 'vitest';
import { fieldListedOnCard, fieldShownIn, fieldVisibilityDeclaration, fieldVisibilityIssues } from './fieldVisibility';
import { fieldDefinitionToNativeSpec } from './screenEntity';
import type { FieldDefinition } from '../entities/entitySchemas';

const field = (extra: Partial<FieldDefinition> = {}): FieldDefinition =>
  ({ key: 'code', label: 'Code', type: 'text', required: false, order: 0, origin: 'plugin', ...extra }) as FieldDefinition;

describe('visibleIn — onde o campo é desenhado (#12)', () => {
  it('ausente, valem os atalhos de sempre', () => {
    expect(fieldShownIn(field(), 'form')).toBe(true);
    expect(fieldShownIn(field(), 'card')).toBe(false);
    expect(fieldShownIn(field({ hiddenInForm: true }), 'form')).toBe(false);
    expect(fieldShownIn(field({ showInList: true }), 'card')).toBe(true);
    expect(fieldListedOnCard(field({ listIcon: 'calendar' }))).toBe(true);
  });

  it('presente, vence os atalhos — e [] não desenha em lugar nenhum', () => {
    const cardOnly = field({ visibleIn: ['card'] });
    expect(fieldShownIn(cardOnly, 'form')).toBe(false);
    expect(fieldShownIn(cardOnly, 'card')).toBe(true);

    const nowhere = field({ visibleIn: [], listIcon: 'calendar' });
    expect(fieldShownIn(nowhere, 'form')).toBe(false);
    expect(fieldListedOnCard(nowhere)).toBe(false);
  });

  it('a forma canônica leva o mesmo sinal: ui.form false e sem ui.list', () => {
    const spec = fieldDefinitionToNativeSpec(field({ visibleIn: [], listIcon: 'calendar' }));
    expect(spec.ui?.form).toBe(false);
    expect(spec.ui?.list).toBeUndefined();

    const both = fieldDefinitionToNativeSpec(field({ visibleIn: ['form', 'card'] }));
    expect(both.ui?.form).toBeUndefined();
    expect(both.ui?.list).toBeDefined();
  });

  it('confere a forma, a superfície e a contradição com o atalho; o atalho que concorda passa', () => {
    expect(fieldVisibilityIssues({ visibleIn: 'card' as never })).toEqual([{ kind: 'shape' }]);
    expect(fieldVisibilityIssues({ visibleIn: ['form', 'grid'] as never })).toEqual([{ kind: 'surface', surface: 'grid' }]);
    expect(fieldVisibilityIssues({ visibleIn: ['form'], hiddenInForm: true }))
      .toEqual([{ kind: 'contradicts', flag: 'hiddenInForm' }]);
    expect(fieldVisibilityIssues({ visibleIn: ['form'], showInList: true }))
      .toEqual([{ kind: 'contradicts', flag: 'showInList' }]);
    expect(fieldVisibilityIssues({ visibleIn: ['card'], hiddenInForm: true, showInList: true })).toEqual([]);
    expect(fieldVisibilityIssues({})).toEqual([]);
  });

  it('no portal, sem visibleIn tudo o que está exposto é desenhado; com ele, só se a lista disser', () => {
    expect(fieldShownIn(field({ hiddenInForm: true }), 'portal')).toBe(true);
    expect(fieldShownIn(field({ visibleIn: ['form', 'card'] }), 'portal')).toBe(false);
    expect(fieldShownIn(field({ visibleIn: ['portal'] }), 'portal')).toBe(true);
  });

  it('o Form Design só grava a lista quando os atalhos não bastam — ou quando ela já existia', () => {
    expect(fieldVisibilityDeclaration({ form: false, card: true, portal: true }, false))
      .toEqual({ visibleIn: null, hiddenInForm: true, showInList: true });
    expect(fieldVisibilityDeclaration({ form: true, card: false, portal: false }, false))
      .toEqual({ visibleIn: ['form'], hiddenInForm: null, showInList: false });
    expect(fieldVisibilityDeclaration({ form: true, card: true, portal: true }, true))
      .toEqual({ visibleIn: ['form', 'card', 'portal'], hiddenInForm: null, showInList: true });
    // O que se grava nunca contradiz a si mesmo.
    for (const form of [true, false]) for (const card of [true, false]) for (const portal of [true, false]) {
      expect(fieldVisibilityIssues(fieldVisibilityDeclaration({ form, card, portal }, true))).toEqual([]);
    }
  });
});

