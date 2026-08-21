import { pruneUndefined } from '../utils/pruneUndefined';
import type { PublicExtension, PublicExtensionStatus } from '../../domain/entities/PublicExtension';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { PublishPublicExtensionInput } from '../../domain/repositories/IPublicExtensionRepository';
import { toDateValueOrNow as toDate } from '../utils/toDateValue';

/** Corpo do documento `public_extensions/{domain}` a partir do input de publicação (sem publishedAt,
 *  que o repositório acrescenta com serverTimestamp). Só o `package` passa por pruneUndefined. */
export const publicExtensionDataFromInput = (input: PublishPublicExtensionInput): Record<string, unknown> => ({
  package: pruneUndefined(input.package),
  ownerTenantId: input.ownerTenantId,
  ownerName: input.ownerName,
  ownerPhotoURL: input.ownerPhotoURL ?? null,
  version: input.version,
  status: input.status,
  hasCode: input.hasCode,
  publishedBy: input.publishedBy,
});

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
});
