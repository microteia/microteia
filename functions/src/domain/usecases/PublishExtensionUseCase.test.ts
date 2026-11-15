import { describe, expect, it } from 'vitest';
import { makePublishExtensionUseCase, PublicationConsentRequired, type PublishExtensionInput } from './PublishExtensionUseCase';
import type {
  CatalogEntry,
  IExtensionPublicationRepository,
  PublicationReading,
  PublicationWrite,
} from '../repositories/IExtensionPublicationRepository';
import type { InstalledCopySide, PublishablePackage } from '../schema/plugin/publicationProof';
import { publicationRevision } from '../schema/plugin/publicationProof';
import { DomainError } from '../errors/DomainError';

const NOW = new Date('2026-11-15T12:00:00Z');

const pkg = (version: string, over: Partial<PublishablePackage> = {}): PublishablePackage => ({
  manifest: { id: 'com.acme.crm', version },
  ...over,
});

const copy = (over: Partial<InstalledCopySide> = {}): InstalledCopySide => ({
  active: true,
  source: 'private',
  package: pkg('1.1.0'),
  ...over,
});

const reading = (over: Partial<PublicationReading> = {}): PublicationReading => ({
  installed: copy(),
  siblings: new Map(),
  appliedMigrationIds: new Set(),
  projectBackend: [],
  catalog: [],
  ...over,
});

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  ownerTenantId: 't1',
  version: '1.0.0',
  status: 'approved',
  package: pkg('1.0.0'),
  proof: null,
  ...over,
});

const setup = (read: PublicationReading, current: CatalogEntry | null) => {
  const writes: PublicationWrite[] = [];
  const publications: IExtensionPublicationRepository = {
    read: async () => read,
    commit: async (_pluginId, decide) => {
      const write = decide(current);
      writes.push(write);
      return write;
    },
  };
  const useCase = makePublishExtensionUseCase({ publications, sha256: (text) => `sha:${text.length}`, now: () => NOW });
  return { useCase, writes };
};

const input = (over: Partial<PublishExtensionInput> = {}): PublishExtensionInput => ({
  tenantId: 't1',
  pluginId: 'com.acme.crm',
  acceptDependentRanges: false,
  isSystem: false,
  actor: { userId: 'u1', userName: 'Ana', photoURL: null },
  ...over,
});

const refusal = async (promise: Promise<unknown>): Promise<DomainError> => {
  try { await promise; } catch (error) { return error as DomainError; }
  throw new Error('esperava recusa');
};

describe('PublishExtensionUseCase', () => {
  it('publica a cópia INSTALADA, com a prova de que ela estava completa', async () => {
    const { useCase, writes } = setup(reading(), entry());
    await expect(useCase.execute(input())).resolves.toEqual({ kind: 'publish', version: '1.1.0' });
    expect(writes).toEqual([{
      kind: 'publish',
      entry: {
        package: pkg('1.1.0'),
        ownerTenantId: 't1',
        ownerName: 'Ana',
        ownerPhotoURL: null,
        version: '1.1.0',
        hasCode: false,
        publishedBy: 'u1',
        proof: { tenantId: 't1', version: '1.1.0', revision: publicationRevision(pkg('1.1.0')), provenBy: 'u1', provenAt: NOW },
      },
    }]);
  });

  it('sem cópia instalada não há o que provar — nem chega a abrir a transação', async () => {
    const { useCase, writes } = setup(reading({ installed: null }), null);
    expect((await refusal(useCase.execute(input()))).message).toBe('@core.marketplace/publish.not-installed');
    expect(writes).toEqual([]);
  });

  it('quem e qual versão vêm antes do estado do escritório: domínio de outro escritório é recusa', async () => {
    const { useCase } = setup(reading({ installed: copy({ active: false }) }), entry({ ownerTenantId: 't2' }));
    expect((await refusal(useCase.execute(input()))).message).toBe('@core.marketplace/publish.id-taken');
  });

  it('versão não maior que a publicada, com outro conteúdo: recusa dizendo as duas', async () => {
    const { useCase } = setup(reading({ installed: copy({ package: pkg('1.0.0', { startup: 'x' }) }) }), entry());
    const error = await refusal(useCase.execute(input()));
    expect(error.message).toBe('@core.marketplace/publish.version-not-greater');
    expect(error.params).toEqual({ version: '1.0.0', published: '1.0.0' });
  });

  it('código só o SYSTEM publica', async () => {
    const withCode = pkg('1.1.0', { views: [{ key: 'board', source: 'export default () => null;' }] });
    const trusted = copy({ package: withCode, codeTrust: { hash: `sha:${'board\u0000export default () => null;'.length}` } });
    expect((await refusal(setup(reading({ installed: trusted }), null).useCase.execute(input()))).message)
      .toBe('@core.marketplace/publish.code-requires-system');
    await expect(setup(reading({ installed: trusted }), null).useCase.execute(input({ isSystem: true })))
      .resolves.toEqual({ kind: 'publish', version: '1.1.0' });
  });

  it('o que falta concluir no escritório é recusa, com o motivo', async () => {
    const { useCase } = setup(reading({ installed: copy({ active: false }) }), entry());
    expect((await refusal(useCase.execute(input()))).message).toBe('@core.marketplace/publish.inactive');
  });

  describe('entrada anterior à regra', () => {
    it('com o mesmo conteúdo instalado aqui, só COMPROVA — sem exigir versão nova', async () => {
      const { useCase, writes } = setup(reading({ installed: copy({ package: pkg('1.0.0') }) }), entry());
      await expect(useCase.execute(input())).resolves.toEqual({ kind: 'prove', version: '1.0.0' });
      expect(writes[0]).toEqual({
        kind: 'prove',
        proof: { tenantId: 't1', version: '1.0.0', revision: publicationRevision(pkg('1.0.0')), provenBy: 'u1', provenAt: NOW },
      });
    });

    it('já comprovada, não há gesto', async () => {
      const proof = { tenantId: 't1', version: '1.0.0', revision: 'r', provenBy: 'u1', provenAt: NOW };
      const { useCase } = setup(reading({ installed: copy({ package: pkg('1.0.0') }) }), entry({ proof }));
      expect((await refusal(useCase.execute(input()))).message).toBe('@core.marketplace/publish.already-published');
    });
  });

  describe('dependentes do catálogo', () => {
    const catalog = [{ id: 'com.acme.sales', version: '1.0.0', status: 'approved', dependencies: { 'com.acme.crm': '^1.0.0' } }];
    const major = reading({ installed: copy({ package: pkg('2.0.0') }), catalog });

    it('a versão que deixa uma fora da faixa pede consentimento, com a lista inteira', async () => {
      const error = await refusal(setup(major, entry()).useCase.execute(input()));
      expect(error).toBeInstanceOf(PublicationConsentRequired);
      expect((error as PublicationConsentRequired).issues).toEqual([{
        message: '@core.marketplace/publish.dependent-out-of-range',
        messageParams: { dependent: 'com.acme.sales', range: '^1.0.0', version: '2.0.0' },
      }]);
    });

    it('com o consentimento, publica', async () => {
      await expect(setup(major, entry()).useCase.execute(input({ acceptDependentRanges: true })))
        .resolves.toEqual({ kind: 'publish', version: '2.0.0' });
    });
  });
});
