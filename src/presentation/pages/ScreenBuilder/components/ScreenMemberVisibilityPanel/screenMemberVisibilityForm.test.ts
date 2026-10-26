import { describe, expect, it } from 'vitest';
import {
  EMPTY_MEMBER_VISIBILITY_FORM,
  fromMemberVisibilityForm,
  memberVisibilityFormIssue,
  toMemberVisibilityForm,
} from './screenMemberVisibilityForm';

describe('a aba "Visibilidade dos registros" do Form Design', () => {
  it('lê a declaração gravada, e a ausente como desligada', () => {
    expect(toMemberVisibilityForm(null)).toEqual(EMPTY_MEMBER_VISIBILITY_FORM);
    expect(toMemberVisibilityForm({ userFields: ['emissor'], bypassPermission: 'x.supervise' }))
      .toEqual({ enabled: true, userFields: ['emissor'], bypassPermission: 'x.supervise' });
  });

  it('grava `null` ao desligar, e omite a supervisão quando é a derivada', () => {
    expect(fromMemberVisibilityForm({ enabled: false, userFields: ['emissor'], bypassPermission: '' })).toBeNull();
    expect(fromMemberVisibilityForm({ enabled: true, userFields: ['emissor'], bypassPermission: '' }))
      .toEqual({ userFields: ['emissor'] });
  });

  it('recusa ligar sem campo, e com mais campos do que a regra lê', () => {
    expect(memberVisibilityFormIssue({ enabled: true, userFields: [], bypassPermission: '' })).toBe('fields-required');
    expect(memberVisibilityFormIssue({ enabled: true, userFields: ['a', 'b', 'c', 'd', 'e'], bypassPermission: '' }))
      .toBe('fields-too-many');
    expect(memberVisibilityFormIssue({ enabled: false, userFields: [], bypassPermission: '' })).toBeNull();
  });
});
