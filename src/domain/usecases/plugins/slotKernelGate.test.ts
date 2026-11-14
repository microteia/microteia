import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { SLOT_DOCK_SINCE_KERNEL, UI_SLOT_POINT } from '../../schema/ui/uiExtensionPoints';
import { slotKernelIssues } from './slotKernelGate';

const pkg = (kernel: string, metadata: Record<string, unknown>): MarketplacePlugin => ({
  manifest: {
    id: 'com.acme.panel',
    version: '1.0.0',
    kernel,
    name: 'Panel',
    contributes: [{ point: UI_SLOT_POINT, id: 'slot-1', apiVersion: '1.0.0', metadata, impl: { kind: 'widget', spec: {} } }],
  },
  workflows: [],
} as unknown as MarketplacePlugin);

describe('slotKernelIssues', () => {
  it('recusa o dock num pacote que admite kernel anterior', () => {
    expect(slotKernelIssues(pkg('^2.0.0', { surface: 'dock.right', key: 'notes', title: 'Notes' })))
      .toEqual([{ message: '@core.marketplace/issue.package.slot.kernel', messageParams: { id: 'slot-1', minimum: SLOT_DOCK_SINCE_KERNEL } }]);
  });

  it('recusa o portão por function em qualquer região', () => {
    expect(slotKernelIssues(pkg('^2.100.0', { surface: 'top-bar.right', key: 'x', title: 'X', requiresFunction: 'myFn' })))
      .toHaveLength(1);
  });

  it('aceita quando a faixa já exige o kernel que desenha o dock', () => {
    expect(slotKernelIssues(pkg(`^${SLOT_DOCK_SINCE_KERNEL}`, { surface: 'dock.right', key: 'notes', title: 'Notes' }))).toEqual([]);
  });

  it('não cobra o trecho que não usa nada novo', () => {
    expect(slotKernelIssues(pkg('^2.0.0', { surface: 'top-bar.right', key: 'x', title: 'X' }))).toEqual([]);
  });
});
