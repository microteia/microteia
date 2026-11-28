import { describe, expect, it } from 'vitest';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import { createSchemaContext } from '../../../domain/schema/pathResolver';
import { resolveQueryTable } from '../../../domain/schema/querySpec';
import { hydrateRecords } from './runWorkflowQuery';

/**
 * O membro apontado como o relatório, o documento e a automação o leem (#54). O convidado por e-mail
 * não tem `name`, e `responsavel.name` vinha vazio — todos os membros sem nome no MESMO grupo.
 */
const chamados: SchemaScreen = {
  id: 'chamados',
  titleSingular: 'Chamado',
  titleFieldKey: 'assunto',
  fields: [
    { key: 'assunto', label: 'Assunto', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'responsavel', label: 'Responsável', type: 'reference', refEntity: 'members', required: false, order: 1, origin: 'design' },
  ],
};

const MEMBERS: Record<string, Record<string, unknown>> = {
  ana: { email: 'ana@example.com', displayName: '' },
  bia: { email: 'bia@example.com', displayName: 'Bia Souza' },
  caio: { email: 'caio@example.com', name: 'Caio', displayName: 'C. Lima' },
};

const fetcher: IWorkflowRecordFetcher = {
  fetchByIds: async (_tenantId, collection, ids) =>
    new Map(ids.map((id) => [id, collection === 'members' ? MEMBERS[id] ?? null : null])),
} as IWorkflowRecordFetcher;

const nameOfEach = async (): Promise<unknown[]> => {
  const ctx = createSchemaContext([chamados], []);
  const table = resolveQueryTable('chamados', ctx);
  if (!table) throw new Error('tabela não resolveu');
  const rows = ['ana', 'bia', 'caio'].map((id) => ({ id: `c-${id}`, data: { assunto: id, responsavel: id } }));
  const hydrated = await hydrateRecords(rows, table.root, ctx, ['responsavel.name'], 't1', fetcher);
  return hydrated.map((record) => (record.responsavel as Record<string, unknown>).name);
};

describe('o nome do membro apontado (#54)', () => {
  it('sem `name`, cai pela regra da entidade — nome de exibição, depois e-mail —, um nome por pessoa', async () => {
    expect(await nameOfEach()).toEqual(['ana@example.com', 'Bia Souza', 'Caio']);
  });
});
