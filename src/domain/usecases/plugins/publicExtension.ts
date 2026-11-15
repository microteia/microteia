import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { packageHasCode, packageHasServerCode } from '../../schema/plugin/publicationProof';

/**
 * A régua de publicação mora em `schema/plugin/publicationProof.ts`, compartilhada com a callable
 * `publishExtension` — é ela que escreve no catálogo, e a tela não pode oferecer o que ela recusaria.
 * Daqui saem só os nomes com que o navegador sempre a chamou.
 */
export {
  canPublishPublicly,
  isVersionGreater,
  publishRefusal,
  type PublishAttempt,
  type PublishRefusal,
} from '../../schema/plugin/publicationProof';

/** Traz a fonte das próprias Cloud Functions — código que roda no SERVIDOR do projeto que o aprovar. */
export const extensionHasServerCode = (pkg: MarketplacePlugin): boolean => packageHasServerCode(pkg);

/** Extensão "com código" = traz uma view de código OU a fonte de Cloud Function. */
export const extensionHasCode = (pkg: MarketplacePlugin): boolean => packageHasCode(pkg);
