import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { EDIT_WINDOW_SINCE_KERNEL } from '../../schema/editWindow';
import { packageEditWindowIssues } from './pluginEditWindow';
import { packageIssues } from './pluginReferences';

const pkg = (editWindow: unknown, kernel = `^${EDIT_WINDOW_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.chat', version: '1.0.0', kernel, name: 'Chat', contributes: [] },
  workflows: [],
  screens: [{
    key: 'messages',
    titleSingular: 'Message',
    titlePlural: 'Messages',
    icon: 'message',
    titleFieldKey: 'text',
    fields: [{ key: 'text', label: 'text', type: 'textarea', required: true, order: 0 }],
    ...(editWindow === undefined ? {} : { editWindow: editWindow as { minutes: number } }),
  }],
});

describe('editWindow no pacote', () => {
  it('a janela certa, com o kernel que a entende, passa; sem janela, o kernel não importa', () => {
    expect(packageEditWindowIssues(pkg({ minutes: 15, delete: true }))).toEqual([]);
    expect(packageEditWindowIssues(pkg(undefined, '^2.0.0'))).toEqual([]);
    expect(packageEditWindowIssues(pkg(null, '^2.0.0'))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele ignoraria a janela e o registro ficaria editável para sempre', () => {
    expect(packageIssues(pkg({ minutes: 15 }, '^2.67.0'))).toContainEqual({
      message: '@core.marketplace/issue.edit-window.kernel',
      messageParams: { screen: 'messages', minimum: EDIT_WINDOW_SINCE_KERNEL },
    });
  });

  it('recusa `minutes` que não é inteiro positivo, e `delete` que não é booleano', () => {
    for (const minutes of [0, -5, 1.5, '15', undefined]) {
      expect(packageEditWindowIssues(pkg({ minutes }))).toEqual([
        { message: '@core.marketplace/issue.edit-window.minutes', messageParams: { screen: 'messages' } },
      ]);
    }
    expect(packageEditWindowIssues(pkg({ minutes: 15, delete: 'yes' }))).toEqual([
      { message: '@core.marketplace/issue.edit-window.delete', messageParams: { screen: 'messages' } },
    ]);
    expect(packageEditWindowIssues(pkg(15))).toEqual([
      { message: '@core.marketplace/issue.edit-window.shape', messageParams: { screen: 'messages' } },
    ]);
  });
});
