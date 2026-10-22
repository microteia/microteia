import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { PORTAL_VISIBLE_WHEN_SINCE_KERNEL } from '../../schema/portal';
import { packagePortalIssues } from './pluginPortal';
import { packageIssues } from './pluginReferences';

const field = (key: string): TemplateField => ({ key, label: key, type: 'text', required: false, order: 0 });

const pkg = (visibleWhen: string | undefined, kernel = `^${PORTAL_VISIBLE_WHEN_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.ledger', version: '1.0.0', kernel, name: 'Ledger', contributes: [] },
  workflows: [],
  screens: [{
    key: 'entries',
    titleSingular: 'Entry',
    titlePlural: 'Entries',
    icon: 'list',
    titleFieldKey: 'description',
    fields: [field('description'), field('type')],
    portal: { subject: 'self', fields: ['description'], ...(visibleWhen ? { visibleWhen } : {}) },
  }],
  screenPatches: [{ target: 'entries', fields: [field('channel')] }],
});

describe('visibleWhen no pacote', () => {
  it('a condição certa, com o kernel que a entende, passa — inclusive campo de patch do próprio pacote', () => {
    expect(packagePortalIssues(pkg('type == "revenue" and channel != "internal"'))).toEqual([]);
    expect(packagePortalIssues(pkg(undefined, '^2.0.0'))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele ignoraria a condição e mostraria todos os registros', () => {
    expect(packageIssues(pkg('type == "revenue"', '^2.60.0'))).toContainEqual({
      message: '@core.marketplace/issue.portal.visible-when.kernel',
      messageParams: { screen: 'entries', minimum: PORTAL_VISIBLE_WHEN_SINCE_KERNEL },
    });
  });

  it('confere a sintaxe e os campos citados', () => {
    expect(packagePortalIssues(pkg('type =='))).toEqual([
      { message: '@core.marketplace/issue.portal.visible-when.invalid', messageParams: { screen: 'entries' } },
    ]);
    expect(packagePortalIssues(pkg('kind == "revenue"'))).toEqual([
      { message: '@core.marketplace/issue.portal.visible-when.unknown', messageParams: { screen: 'entries', field: 'kind' } },
    ]);
  });
});
