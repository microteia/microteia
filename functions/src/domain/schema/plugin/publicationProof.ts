// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/publicationProof.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { LocalizedMessage } from '../i18n/localizedMessage';
import { contentFingerprint } from '../contentFingerprint';
import {
  isBackendRequirementApplied,
  type AppliedBackendFingerprint,
  type PluginBackendRequirement,
} from './backendRequirement';
import { extensionCodeOf, isCodeTrusted } from './codeTrust';
import { hasBlockingMigrationsAmong, type PluginMigration } from './migration';
import { dependencyRange, type PluginDependency } from './pluginManifest';
import { compareSemVer, isValidSemVer, parseSemVer, satisfiesRange } from './semver';

/**
 * A régua de PUBLICAÇÃO no catálogo — o que torna o catálogo um lugar de onde se instala sem
 * intervenção de ninguém.
 *
 * Mora no módulo compartilhado porque são dois os que perguntam, e não podem discordar: a callable
 * `publishExtension`, que é a única porta de escrita do catálogo, e a tela de Extensões, que não deve
 * OFERECER o gesto que a callable recusaria.
 *
 * A regra é uma só: **a versão que vai ao catálogo é a que está instalada, completa, no escritório que
 * a publica.** Completa quer dizer o que um escritório que a instalar depois NÃO teria como resolver
 * sozinho — backend no ar, dado migrado, código revisado, dependência alcançável. É o que permite a uma
 * instalação inteira receber extensões sem que cada escritório repita o caminho de quem as montou.
 */

/** O prefixo das extensões do KERNEL: carregadas em todo escritório, nunca instaladas. */
export const KERNEL_PLUGIN_PREFIX = 'core.';

/** O que a régua lê de um pacote. Estrutural, para valer igual no navegador e no servidor. */
export interface PublishablePackage {
  manifest: {
    id: string;
    version: string;
    dependencies?: Record<string, PluginDependency>;
    backend?: PluginBackendRequirement;
  };
  views?: ReadonlyArray<{ key: string; source: string }> | null;
  startup?: string | null;
  backendSource?: { hash: string } | null;
  migrations?: PluginMigration[] | null;
}

/** Traz a fonte das próprias Cloud Functions — código que roda no SERVIDOR do projeto que o aprovar. */
export const packageHasServerCode = (pkg: Pick<PublishablePackage, 'backendSource'>): boolean =>
  pkg.backendSource !== undefined && pkg.backendSource !== null;

/**
 * Extensão "com código" = traz uma view de código OU a fonte de Cloud Function. É o que restringe quem
 * pode publicar: o código roda no navegador (ou no servidor) de todo escritório que a instalar.
 */
export const packageHasCode = (pkg: Pick<PublishablePackage, 'views' | 'backendSource'>): boolean =>
  (pkg.views?.length ?? 0) > 0 || packageHasServerCode(pkg);

/** Quem pode pôr a extensão no catálogo: com código, só a equipe global; sem código, o escritório dono. */
export const canPublishPublicly = (pkg: Pick<PublishablePackage, 'views' | 'backendSource'>, isSystem: boolean): boolean =>
  isSystem || !packageHasCode(pkg);

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

/** A frase de cada recusa — interpola `{version}` e `{published}`. */
export const PUBLISH_REFUSAL_MESSAGES: Record<PublishRefusal, string> = {
  'invalid-version': '@core.marketplace/publish.invalid-version',
  'code-requires-system': '@core.marketplace/publish.code-requires-system',
  'id-taken': '@core.marketplace/publish.id-taken',
  'version-not-greater': '@core.marketplace/publish.version-not-greater',
};

/** O que já está no catálogo sob o mesmo domínio, na parte que a recusa lê. */
export interface PublishedSide {
  ownerTenantId: string;
  version: string;
}

export interface PublishAttempt {
  pkg: PublishablePackage;
  isSystem: boolean;
  ownerTenantId: string;
  published: PublishedSide | undefined;
}

/**
 * QUEM pode publicar e QUAL versão — a recusa que não depende do escritório estar em dia.
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

/**
 * O registro de que a versão publicada foi instalada por completo antes de ir ao catálogo. Só a
 * callable o grava; as Rules recusam o cliente que tente escrevê-lo.
 */
export interface PublicationProof {
  /** O escritório em que a versão estava instalada, completa, no momento da publicação. */
  tenantId: string;
  version: string;
  /** `contentFingerprint` do pacote publicado: é ESTE conteúdo que a prova cobre, não a versão. */
  revision: string;
  provenBy: string;
  provenAt: Date;
}

/** A identidade de CONTEÚDO que a prova carimba e que a comparação com o catálogo usa. */
export const publicationRevision = (pkg: unknown): string => contentFingerprint(pkg);

/** A cópia instalada no escritório que publica, na parte que a régua lê. */
export interface InstalledCopySide {
  active: boolean;
  source: string;
  package: PublishablePackage;
  codeTrust?: { hash?: unknown } | null;
  backendState?: { fingerprint?: unknown } | null;
}

/** Uma entrada do catálogo, na parte que a régua lê — sem o pacote inteiro, que pode ser grande. */
export interface CatalogSide {
  id: string;
  version: string;
  status: string;
  dependencies?: Record<string, PluginDependency>;
}

export interface PublicationFacts {
  /** A cópia instalada desta extensão no escritório que publica, ou `null`. */
  installed: InstalledCopySide | null;
  /** SHA-256 em hex de `extensionCodeOf(installed.package)`, ou `null` quando não há código de host. */
  codeHash: string | null;
  /** O que o projeto tem aplicado (`backend_state/applied`). */
  projectBackend: readonly AppliedBackendFingerprint[];
  /** Os ids de migração que este escritório já aplicou para esta extensão. */
  appliedMigrationIds: ReadonlySet<string>;
  /** As OUTRAS extensões instaladas no mesmo escritório. */
  siblings: ReadonlyMap<string, { source: string }>;
  /** O catálogo, sem esta extensão. */
  catalog: readonly CatalogSide[];
}

const issue = (message: string, messageParams?: Record<string, string>): LocalizedMessage =>
  messageParams ? { message, messageParams } : { message };

/**
 * Por que a versão instalada AINDA não pode ir ao catálogo — vazio quando pode.
 *
 * Cada motivo é o que o escritório que instalasse do catálogo encontraria pela frente sem poder
 * resolver:
 *
 * - **não instalada / desligada** — ninguém provou que ela sobe;
 * - **cópia embutida** — a de primeira parte viaja no bundle, não no catálogo;
 * - **backend pendente** — todo escritório que a instalasse ficaria esperando um `provision`;
 * - **migração pendente** — a extensão está fora do boot aqui mesmo;
 * - **código sem revisão** — ninguém executou o código que iria rodar no navegador dos outros;
 * - **dependência** — a dependência precisa ser alcançável por quem instala: do kernel, embutida, ou
 *   no catálogo numa versão dentro da faixa. Uma cópia privada da dependência funciona AQUI e em lugar
 *   nenhum mais.
 *
 * O que ela NÃO vê é se a extensão carregou no navegador (`load-failed`): isso é diagnóstico do
 * runtime, e quem o cobra é a tela, que não oferece o gesto enquanto houver pendência.
 */
export const publicationProofIssues = (facts: PublicationFacts): LocalizedMessage[] => {
  const { installed } = facts;
  if (!installed) return [issue('@core.marketplace/publish.not-installed')];
  if (installed.source === 'builtin') return [issue('@core.marketplace/publish.builtin-copy')];
  if (!installed.active) return [issue('@core.marketplace/publish.inactive')];

  const pkg = installed.package;
  const issues: LocalizedMessage[] = [];

  if (!isBackendRequirementApplied(pkg, installed.backendState?.fingerprint, facts.projectBackend)) {
    issues.push(issue('@core.marketplace/publish.backend-pending'));
  }
  if (hasBlockingMigrationsAmong(pkg.migrations, facts.appliedMigrationIds)) {
    issues.push(issue('@core.marketplace/publish.migration-pending'));
  }
  if (!isCodeTrusted(installed, extensionCodeOf(pkg) !== null, facts.codeHash)) {
    issues.push(issue('@core.marketplace/publish.code-not-trusted'));
  }

  for (const [dependency, declared] of Object.entries(pkg.manifest.dependencies ?? {})) {
    if (dependency.startsWith(KERNEL_PLUGIN_PREFIX)) continue;
    const sibling = facts.siblings.get(dependency);
    if (!sibling) {
      issues.push(issue('@core.marketplace/publish.dependency-not-installed', { dependency }));
      continue;
    }
    if (sibling.source === 'builtin') continue;
    const range = dependencyRange(declared);
    const entry = facts.catalog.find((candidate) => candidate.id === dependency);
    if (!entry || entry.status !== 'approved' || !satisfiesRange(entry.version, range)) {
      issues.push(issue('@core.marketplace/publish.dependency-not-in-catalog', { dependency, range }));
    }
  }

  return issues;
};

/**
 * As extensões do CATÁLOGO que esta versão deixaria fora da faixa que elas declaram — o único motivo
 * de publicação que aceita consentimento.
 *
 * Recusar sempre travaria a saída, pela mesma razão de `dependencyRangeIssues` na instalação: `com.a`
 * 0.2 recusada por estar fora da faixa de `com.b` 0.1, e `com.b` 0.2 recusada porque o catálogo só tem
 * `com.a` 0.1. A ordem certa de levar as duas passa por um instante em que uma delas não instala — e a
 * tela pergunta, dizendo qual, em vez de deixar isso acontecer calado.
 *
 * Só conta o que ESTA publicação quebra: a dependente que já estava fora da faixa com a versão
 * publicada antes não vira aviso. Sem versão anterior no catálogo não há o que quebrar.
 */
export const catalogDependentIssues = (
  pkg: Pick<PublishablePackage, 'manifest'>,
  catalog: readonly CatalogSide[],
  previousVersion: string | null,
): LocalizedMessage[] => {
  if (previousVersion === null) return [];
  const id = pkg.manifest.id;
  const version = pkg.manifest.version;
  return catalog.flatMap((entry) => {
    if (entry.id === id || entry.status !== 'approved') return [];
    const declared = entry.dependencies?.[id];
    if (declared === undefined) return [];
    const range = dependencyRange(declared);
    if (satisfiesRange(version, range) || !satisfiesRange(previousVersion, range)) return [];
    return [issue('@core.marketplace/publish.dependent-out-of-range', { dependent: entry.id, range, version })];
  });
};

/**
 * O que a publicação faz com o catálogo:
 *
 * - `publish` — versão nova (ou primeira) no catálogo;
 * - `prove` — o catálogo já tem EXATAMENTE este conteúdo, publicado antes de a prova existir: só o
 *   registro de prova é acrescentado, sem exigir versão nova para um pacote que não mudou;
 * - `proven` — o catálogo já tem este conteúdo, provado. Não há gesto.
 */
export type PublicationKind = 'publish' | 'prove' | 'proven';

export const publicationKind = (
  installedPackage: unknown,
  published: { package: unknown; proof?: PublicationProof | null } | undefined,
): PublicationKind => {
  if (!published) return 'publish';
  if (publicationRevision(installedPackage) !== publicationRevision(published.package)) return 'publish';
  return published.proof ? 'proven' : 'prove';
};
