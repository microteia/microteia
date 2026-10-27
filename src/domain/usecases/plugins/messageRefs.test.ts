import { describe, expect, it } from 'vitest';
import type { LookupModuleTemplate, MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { Contribution } from '../../schema/plugin/contribution';
import { I18N_API_VERSION, I18N_MESSAGES_POINT } from '../../schema/i18n/extensionPoints';
import { messageRefIssues } from './messageRefs';

const bundle = (messages: Record<string, string>): Contribution => ({
  point: I18N_MESSAGES_POINT,
  id: 'en.com.acme.office',
  apiVersion: I18N_API_VERSION,
  metadata: { locale: 'en', namespace: 'com.acme.office', messages },
});

const pkgWith = (lookups: LookupModuleTemplate[], messages: Record<string, string>): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.office',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: '@com.acme.office/extension.name',
    contributes: [bundle({ 'extension.name': 'Office', ...messages })],
  },
  workflows: [],
  lookups,
});

const statuses = (label: string): LookupModuleTemplate[] => [
  { collection: 'statuses', label: '@com.acme.office/lookup.statuses', options: [{ key: 'nao_habilitado', label }] },
];

describe('a referência de mensagem que a tela não reconheceria', () => {
  it('aceita referência com ponto e hífen, e chave de opção com sublinhado', () => {
    expect(messageRefIssues(pkgWith(
      statuses('@com.acme.office/option.nao-habilitado'),
      { 'lookup.statuses': 'Statuses', 'option.nao-habilitado': 'Not enabled' },
    ))).toEqual([]);
  });

  it('recusa a chave declarada com sublinhado, que o catálogo descartaria', () => {
    expect(messageRefIssues(pkgWith(
      statuses('@com.acme.office/option.nao-habilitado'),
      { 'lookup.statuses': 'Statuses', 'option.nao_habilitado': 'Not enabled' },
    ))).toEqual([{
      message: '@core.marketplace/issue.package.message.key',
      messageParams: { key: 'option.nao_habilitado', where: 'contributes[0].metadata.messages' },
    }]);
  });

  it('recusa a referência com sublinhado, que a tela mostraria crua', () => {
    expect(messageRefIssues(pkgWith(
      statuses('@com.acme.office/option.nao_habilitado'),
      { 'lookup.statuses': 'Statuses' },
    ))).toEqual([{
      message: '@core.marketplace/issue.package.message.reference',
      messageParams: { reference: '@com.acme.office/option.nao_habilitado', where: 'lookups[0].options[0].label' },
    }]);
  });

  it('aponta cada referência quebrada uma vez só', () => {
    const lookups = [...statuses('@com.acme.office/option.x_y'), ...statuses('@com.acme.office/option.x_y')];
    expect(messageRefIssues(pkgWith(lookups, { 'lookup.statuses': 'Statuses' }))).toHaveLength(1);
  });

  it('não confunde texto comum com referência', () => {
    expect(messageRefIssues(pkgWith(
      statuses('Write to support@acme.com or @team/on_call today'),
      { 'lookup.statuses': 'Statuses' },
    ))).toEqual([]);
  });
});
