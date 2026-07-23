import { describe, it, expect, vi } from 'vitest';
import type { ScreenDefinition } from '../../entities';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';
import type { ICustomRecordRepository } from '../../repositories/ICustomRecordRepository';
import { makeDeleteScreenDefinitionUseCase } from './DeleteScreenDefinitionUseCase';

const actor = { uid: 'u1', name: 'U', photoURL: '' };

const screen = (overrides: Partial<ScreenDefinition>): ScreenDefinition =>
  ({ id: 'minha', tenantId: 't1', fields: [], ...overrides } as ScreenDefinition);

const makeRepo = (screens: ScreenDefinition[]) => {
  const del = vi.fn(async () => {});
  const repo = { getAll: async () => screens, delete: del } as unknown as IScreenDefinitionRepository;
  return { repo, del };
};

const noRecords = { hasRecords: async () => false } as unknown as ICustomRecordRepository;
const withRecords = { hasRecords: async () => true } as unknown as ICustomRecordRepository;

describe('DeleteScreenDefinitionUseCase', () => {
  it('exclui uma tela normal sem registros', async () => {
    const { repo, del } = makeRepo([screen({ id: 'minha' })]);
    await makeDeleteScreenDefinitionUseCase(repo, noRecords).execute('t1', 'minha', actor);
    expect(del).toHaveBeenCalledWith('t1', 'minha', actor);
  });

  it('recusa excluir uma tela de extensão (ownerPluginId), sem chamar delete', async () => {
    const { repo, del } = makeRepo([screen({ id: 'vnd', ownerPluginId: 'com.acme.vendas' })]);
    await expect(
      makeDeleteScreenDefinitionUseCase(repo, noRecords).execute('t1', 'vnd', actor),
    ).rejects.toThrow(/extensão/);
    expect(del).not.toHaveBeenCalled();
  });

  it('a checagem de extensão vem antes da de registros', async () => {
    const { repo } = makeRepo([screen({ id: 'vnd', ownerPluginId: 'com.acme.vendas' })]);
    await expect(
      makeDeleteScreenDefinitionUseCase(repo, withRecords).execute('t1', 'vnd', actor),
    ).rejects.toThrow(/extensão/);
  });

  it('recusa tela normal com registros', async () => {
    const { repo, del } = makeRepo([screen({ id: 'minha' })]);
    await expect(
      makeDeleteScreenDefinitionUseCase(repo, withRecords).execute('t1', 'minha', actor),
    ).rejects.toThrow(/registros/);
    expect(del).not.toHaveBeenCalled();
  });
});
