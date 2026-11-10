import type { IHttpConnectionRepository } from '../../repositories/IHttpConnectionRepository';
import {
  validateHttpConnection,
  type HttpConnection,
  type HttpConnectionData,
  type HttpConnectionIssue,
} from '../../schema/httpConnection';

export type SaveHttpConnectionResult =
  | { ok: true; connection: HttpConnection }
  | { ok: false; issues: HttpConnectionIssue[] };

export interface SaveHttpConnectionInput {
  tenantId: string;
  /** Ausente: credencial nova. */
  id?: string;
  data: HttpConnectionData;
  /** Obrigatório na criação; na edição, vazio mantém o segredo gravado. */
  secret: string;
  /** As credenciais que o escritório já tem — é contra elas que a chave precisa ser única. */
  existing: readonly HttpConnection[];
}

/**
 * A validação mora aqui, e não só na tela: a mesma `validateHttpConnection` que o servidor aplicaria,
 * mais a chave única entre as do escritório e o segredo obrigatório na criação.
 */
export type SaveHttpConnectionUseCase = {
  execute: (input: SaveHttpConnectionInput) => Promise<SaveHttpConnectionResult>;
};

const normalize = (data: HttpConnectionData): HttpConnectionData => ({
  key: data.key.trim(),
  name: data.name.trim(),
  scheme: data.scheme,
  ...(data.scheme === 'basic' && data.username ? { username: data.username.trim() } : {}),
  ...((data.scheme === 'header' || data.scheme === 'query') && data.paramName ? { paramName: data.paramName.trim() } : {}),
  hosts: [...new Set(data.hosts.map((host) => host.trim().toLowerCase()).filter(Boolean))],
});

export const makeSaveHttpConnectionUseCase = (repo: IHttpConnectionRepository): SaveHttpConnectionUseCase => ({
  execute: async ({ tenantId, id, data, secret, existing }) => {
    const clean = normalize(data);
    const otherKeys = existing.filter((one) => one.id !== id).map((one) => one.key);
    const issues = validateHttpConnection(clean, otherKeys);
    const current = id ? existing.find((one) => one.id === id) : undefined;
    if (!secret.trim() && !current?.hasSecret) {
      issues.push({ field: 'secret', error: '@core.automation/http-connection.issue.secret' });
    }
    if (issues.length > 0) return { ok: false, issues };

    if (id) {
      await repo.update(tenantId, id, clean, secret.trim() || undefined);
      return { ok: true, connection: { ...clean, id, hasSecret: true } };
    }
    return { ok: true, connection: await repo.create(tenantId, clean, secret.trim()) };
  },
});
