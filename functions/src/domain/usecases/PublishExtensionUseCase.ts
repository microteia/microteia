import type { CatalogEntry, IExtensionPublicationRepository, PublicationWrite } from '../repositories/IExtensionPublicationRepository';
import type { LocalizedMessage } from '../schema/i18n/localizedMessage';
import { extensionCodeOf } from '../schema/plugin/codeTrust';
import {
  catalogDependentIssues,
  packageHasCode,
  PUBLISH_REFUSAL_MESSAGES,
  publicationKind,
  publicationProofIssues,
  publicationRevision,
  publishRefusal,
} from '../schema/plugin/publicationProof';
import { DomainError, failedPrecondition } from '../errors/DomainError';

export interface PublishExtensionInput {
  tenantId: string;
  pluginId: string;
  /** Quem publica já viu as dependentes do catálogo que ficam fora da faixa, e concordou. */
  acceptDependentRanges: boolean;
  isSystem: boolean;
  actor: { userId: string; userName: string; photoURL: string | null };
}

export interface PublishExtensionResult {
  kind: 'publish' | 'prove';
  version: string;
}

/**
 * A recusa que AINDA pode virar consentimento — as dependentes do catálogo que esta versão deixa fora
 * da faixa. Leva a lista inteira para a tela perguntar uma vez, dizendo quais.
 */
export class PublicationConsentRequired extends DomainError {
  readonly issues: readonly LocalizedMessage[];

  constructor(issues: readonly LocalizedMessage[]) {
    super('failed-precondition', issues[0]?.message ?? '', issues[0]?.messageParams);
    this.name = 'PublicationConsentRequired';
    this.issues = issues;
  }
}

export type PublishExtensionUseCase = {
  execute: (input: PublishExtensionInput) => Promise<PublishExtensionResult>;
};

const refuse = (message: LocalizedMessage): never => {
  throw failedPrecondition(message.message, message.messageParams);
};

/**
 * Leva ao catálogo a versão INSTALADA no escritório — nunca um pacote que o navegador mande. É isso que
 * faz da publicação uma prova de instalação: o que vai ao catálogo é, por construção, o que está no ar
 * em algum escritório, com backend, dado e código em dia (`publicationProofIssues`).
 *
 * A ordem das recusas é a de leitura de quem publica: primeiro QUEM pode e QUAL versão (o que não
 * depende do estado do escritório), depois o que falta concluir aqui, e por último o que esta versão
 * faz às outras extensões do catálogo — a única que aceita "publicar mesmo assim".
 */
export const makePublishExtensionUseCase = (deps: {
  publications: IExtensionPublicationRepository;
  sha256: (text: string) => string;
  now: () => Date;
}): PublishExtensionUseCase => ({
  execute: async ({ tenantId, pluginId, acceptDependentRanges, isSystem, actor }) => {
    const reading = await deps.publications.read(tenantId, pluginId);
    const installed = reading.installed;
    if (!installed) return refuse({ message: '@core.marketplace/publish.not-installed' });

    const pkg = installed.package;
    const version = pkg.manifest.version;
    const code = extensionCodeOf(pkg);
    const codeHash = code === null ? null : deps.sha256(code);

    const decide = (current: CatalogEntry | null): PublicationWrite => {
      const kind = publicationKind(pkg, current ?? undefined);
      if (kind === 'proven') refuse({ message: '@core.marketplace/publish.already-published' });

      const refusal = publishRefusal({ pkg, isSystem, ownerTenantId: tenantId, published: current ?? undefined });
      // Provar não troca o conteúdo, então não pede versão nova: é o mesmo pacote que já está lá.
      if (refusal && !(kind === 'prove' && refusal === 'version-not-greater')) {
        refuse({
          message: PUBLISH_REFUSAL_MESSAGES[refusal],
          messageParams: { version, published: current?.version ?? '' },
        });
      }

      const [missing] = publicationProofIssues({ ...reading, codeHash });
      if (missing) refuse(missing);

      if (kind === 'publish' && !acceptDependentRanges) {
        const dependents = catalogDependentIssues(pkg, reading.catalog, current?.version ?? null);
        if (dependents.length > 0) throw new PublicationConsentRequired(dependents);
      }

      const proof = {
        tenantId,
        version,
        revision: publicationRevision(pkg),
        provenBy: actor.userId,
        provenAt: deps.now(),
      };
      if (kind === 'prove') return { kind: 'prove', proof };
      return {
        kind: 'publish',
        entry: {
          package: pkg,
          ownerTenantId: tenantId,
          ownerName: actor.userName,
          ownerPhotoURL: actor.photoURL,
          version,
          hasCode: packageHasCode(pkg),
          publishedBy: actor.userId,
          proof,
        },
      };
    };

    const written = await deps.publications.commit(pluginId, decide);
    return { kind: written.kind, version };
  },
});
