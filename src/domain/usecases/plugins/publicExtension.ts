import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PublicExtension } from '../../entities/PublicExtension';
import { compareSemVer, isValidSemVer, parseSemVer } from '../../schema/plugin/semver';

/** Extensão "com código" = traz ao menos uma view de código. É o que restringe quem pode publicar. */
export const extensionHasCode = (pkg: MarketplacePlugin): boolean => (pkg.views?.length ?? 0) > 0;

/**
 * Quem pode pôr a extensão no catálogo global.
 *
 * Extensão COM código roda no navegador de todo membro de todo escritório que a instalar, e por isso
 * só a equipe global a publica — não há autosserviço para código de terceiro. Sem código, o pacote é
 * declaração (telas, automações, ações, relatórios), e quem administra o escritório dono publica
 * direto. As Rules cobram a mesma divisão; esta função é o que a tela usa para não oferecer o que
 * seria recusado lá.
 */
export const canPublishPublicly = (pkg: MarketplacePlugin, isSystem: boolean): boolean =>
  isSystem || !extensionHasCode(pkg);

/** `a` é estritamente maior que `b` em semver? (é o que exige subir a versão ao republicar). */
export const isVersionGreater = (a: string, b: string): boolean => {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa || !pb) return false;
  return compareSemVer(pa, pb) > 0;
};

export type PublishRefusal =
  | 'invalid-version'
  | 'code-requires-system'
  | 'id-taken'
  | 'version-not-greater';

export interface PublishAttempt {
  pkg: MarketplacePlugin;
  isSystem: boolean;
  ownerTenantId: string;
  /** O que já está no catálogo sob o mesmo domínio, se houver. */
  published: PublicExtension | undefined;
}

/**
 * O motivo pelo qual esta publicação não pode acontecer, ou `null` quando pode.
 *
 * A recusa por versão é a que não é óbvia: um escritório que já instalou a extensão só recebe a nova
 * cópia quando a versão SOBE (`updateSourceOf`, na tela de Extensões). Republicar por cima da mesma
 * versão grava um pacote que ninguém jamais receberia — falha silenciosa, que é a pior espécie.
 */
export const publishRefusal = ({ pkg, isSystem, ownerTenantId, published }: PublishAttempt): PublishRefusal | null => {
  const version = pkg.manifest.version;
  if (!isValidSemVer(version)) return 'invalid-version';
  if (!canPublishPublicly(pkg, isSystem)) return 'code-requires-system';
  if (!published) return null;
  if (published.ownerTenantId !== ownerTenantId) return 'id-taken';
  if (!isVersionGreater(version, published.version)) return 'version-not-greater';
  return null;
};
