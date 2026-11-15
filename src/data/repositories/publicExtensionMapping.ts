import type { PublicExtension, PublicExtensionStatus } from '../../domain/entities/PublicExtension';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { PublicationProof } from '../../domain/schema/plugin/publicationProof';
import { toDateValueOrNow as toDate } from '../utils/toDateValue';

const proofFromDoc = (value: unknown): PublicationProof | null => {
  if (typeof value !== 'object' || value === null) return null;
  const proof = value as Record<string, unknown>;
  if (typeof proof.tenantId !== 'string') return null;
  return {
    tenantId: proof.tenantId,
    version: typeof proof.version === 'string' ? proof.version : '',
    revision: typeof proof.revision === 'string' ? proof.revision : '',
    provenBy: typeof proof.provenBy === 'string' ? proof.provenBy : '',
    provenAt: toDate(proof.provenAt),
  };
};

export const publicExtensionFromDoc = (domain: string, d: Record<string, unknown>): PublicExtension => ({
  domain,
  package: (d.package as MarketplacePlugin) ?? { manifest: { id: domain, version: '0.0.0', kernel: '*', name: domain }, summary: '', workflows: [] },
  ownerTenantId: (d.ownerTenantId as string | undefined) ?? '',
  ownerName: (d.ownerName as string | undefined) ?? '',
  ownerPhotoURL: (d.ownerPhotoURL as string | null | undefined) ?? null,
  version: (d.version as string | undefined) ?? '0.0.0',
  status: (d.status as PublicExtensionStatus | undefined) ?? 'pending',
  hasCode: Boolean(d.hasCode),
  publishedAt: toDate(d.publishedAt),
  publishedBy: (d.publishedBy as string | undefined) ?? '',
  proof: proofFromDoc(d.proof),
});
