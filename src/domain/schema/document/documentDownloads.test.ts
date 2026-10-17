import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTOMATION_DOWNLOAD_VISIBILITY,
  DEFAULT_DOWNLOAD_RETENTION_DAYS,
  DOWNLOAD_AUTOMATION_VISIBILITY_SETTING,
  DOWNLOAD_RETENTION_SETTING,
  downloadExpiresAt,
  downloadPolicyOf,
  downloadStoragePath,
  isDownloadExpired,
  isDownloadStoragePath,
  resolveRetentionDays,
} from './documentDownloads';
import { documentTemplateIssues } from './documentTemplate';

const POLICY = { retentionDays: 7, automationVisibility: 'managers' as const };

describe('downloadPolicyOf', () => {
  it('sem configuração, vale o padrão: 7 dias e só quem gerencia', () => {
    expect(downloadPolicyOf({})).toEqual({
      retentionDays: DEFAULT_DOWNLOAD_RETENTION_DAYS,
      automationVisibility: DEFAULT_AUTOMATION_DOWNLOAD_VISIBILITY,
    });
  });

  it('lê o que o escritório configurou, e o valor inválido cai no padrão em vez de quebrar a geração', () => {
    expect(downloadPolicyOf({ [DOWNLOAD_RETENTION_SETTING]: 30, [DOWNLOAD_AUTOMATION_VISIBILITY_SETTING]: 'everyone' }))
      .toEqual({ retentionDays: 30, automationVisibility: 'everyone' });
    expect(downloadPolicyOf({ [DOWNLOAD_RETENTION_SETTING]: -1, [DOWNLOAD_AUTOMATION_VISIBILITY_SETTING]: 'owner' }))
      .toEqual({ retentionDays: 7, automationVisibility: 'managers' });
  });
});

describe('resolveRetentionDays', () => {
  it('o pedido vence o modelo, que vence o escritório', () => {
    expect(resolveRetentionDays(2, 30, POLICY)).toBe(2);
    expect(resolveRetentionDays(undefined, 30, POLICY)).toBe(30);
    expect(resolveRetentionDays(undefined, undefined, POLICY)).toBe(7);
  });

  it('0 é um pedido legítimo — não expira — e não cai para o próximo nível', () => {
    expect(resolveRetentionDays(0, 30, POLICY)).toBe(0);
  });

  it('o valor fora da faixa é pulado, como numa configuração', () => {
    expect(resolveRetentionDays(1000, 2.5, POLICY)).toBe(7);
  });
});

describe('vencimento', () => {
  const now = new Date('2026-10-17T12:00:00Z');

  it('soma os dias ao instante; 0 não vence', () => {
    expect(downloadExpiresAt(now, 7)).toEqual(new Date('2026-10-24T12:00:00Z'));
    expect(downloadExpiresAt(now, 0)).toBeNull();
  });

  it('o vencido sai da lista mesmo antes de o TTL o apagar', () => {
    expect(isDownloadExpired({ expiresAt: new Date('2026-10-17T11:59:59Z') }, now)).toBe(true);
    expect(isDownloadExpired({ expiresAt: null }, now)).toBe(false);
  });
});

describe('caminho no bucket', () => {
  it('a pasta é o id do item, e só ela é reconhecida como do item', () => {
    const path = downloadStoragePath('t1', 'd1', 'Recibo de pagamento.pdf');
    expect(path).toBe('tenants/t1/downloads/d1/Recibo_de_pagamento.pdf');
    expect(isDownloadStoragePath('t1', 'd1', path)).toBe(true);
    expect(isDownloadStoragePath('t1', 'd2', path)).toBe(false);
    expect(isDownloadStoragePath('t1', 'd1', 'tenants/t1/contracts/c1/x.pdf')).toBe(false);
  });
});

describe('o destino e a retenção na validação do modelo', () => {
  const base = { key: 'recibo', title: 'Recibo', collection: 'pagamentos', format: 'markdown' as const, body: 'x' };

  it('aceita os dois destinos e a retenção na faixa', () => {
    expect(documentTemplateIssues({ ...base, destination: 'downloads', retentionDays: 0 })).toEqual([]);
    expect(documentTemplateIssues({ ...base, destination: 'record' })).toEqual([]);
  });

  it('recusa destino inventado e retenção fora da faixa', () => {
    const fields = documentTemplateIssues({
      ...base,
      destination: 'email' as never,
      retentionDays: 400,
    }).map((issue) => issue.field);
    expect(fields).toEqual(['destination', 'retentionDays']);
  });
});
