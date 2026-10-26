import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { MEMBER_VISIBILITY_SINCE_KERNEL } from '../../schema/memberVisibility';
import { packageMemberVisibilityIssues } from './pluginMemberVisibility';
import { packageIssues } from './pluginReferences';

const pkg = (memberVisibility: unknown, kernel = `^${MEMBER_VISIBILITY_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.desk', version: '1.0.0', kernel, name: 'Desk', contributes: [] },
  workflows: [],
  screens: [{
    key: 'replies',
    titleSingular: 'Reply',
    titlePlural: 'Replies',
    icon: 'message',
    titleFieldKey: 'text',
    fields: [
      { key: 'text', label: 'text', type: 'textarea', required: true, order: 0 },
      { key: 'issuer', label: 'issuer', type: 'reference', refEntity: 'members', required: false, order: 1 },
      { key: 'team', label: 'team', type: 'reference', refEntity: 'members', multi: true, required: false, order: 2 },
    ],
    ...(memberVisibility === undefined ? {} : { memberVisibility: memberVisibility as { userFields: string[] } }),
  }],
});

describe('memberVisibility no pacote', () => {
  it('a declaração certa, com o kernel que a entende, passa; sem ela, o kernel não importa', () => {
    expect(packageMemberVisibilityIssues(pkg({ userFields: ['issuer', 'team'], bypassPermission: 'replies.supervise' })))
      .toEqual([]);
    expect(packageMemberVisibilityIssues(pkg(undefined, '^2.0.0'))).toEqual([]);
    expect(packageMemberVisibilityIssues(pkg(null, '^2.0.0'))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele ignoraria a restrição e todo membro leria todos os registros', () => {
    expect(packageIssues(pkg({ userFields: ['issuer'] }, '^2.74.0'))).toContainEqual({
      message: '@core.marketplace/issue.member-visibility.kernel',
      messageParams: { screen: 'replies', minimum: MEMBER_VISIBILITY_SINCE_KERNEL },
    });
  });

  it('recusa o campo que não é referência a membro — o nome de alguém num texto nunca casaria com um uid', () => {
    expect(packageMemberVisibilityIssues(pkg({ userFields: ['text'] }))).toEqual([{
      message: '@core.marketplace/issue.member-visibility.field-not-member',
      messageParams: { screen: 'replies', subject: 'text', max: '4' },
    }]);
  });

  it('recusa o campo que a tela não tem, a lista vazia e a forma errada', () => {
    expect(packageMemberVisibilityIssues(pkg({ userFields: ['owner'] }))[0]).toMatchObject({
      message: '@core.marketplace/issue.member-visibility.field-unknown',
      messageParams: { subject: 'owner' },
    });
    expect(packageMemberVisibilityIssues(pkg({ userFields: [] }))[0].message)
      .toBe('@core.marketplace/issue.member-visibility.fields-empty');
    expect(packageMemberVisibilityIssues(pkg('issuer'))[0].message)
      .toBe('@core.marketplace/issue.member-visibility.shape');
  });
});
