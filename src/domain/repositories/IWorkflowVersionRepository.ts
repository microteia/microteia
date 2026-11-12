import type { ArtifactVersion, VersionedArtifact } from '../schema/workflowVersion';

export interface IWorkflowVersionRepository {
  /** As versões guardadas do artefato (automação ou script), da mais nova para a mais antiga. */
  listVersions(tenantId: string, artifact: VersionedArtifact, id: string, max: number): Promise<ArtifactVersion[]>;
}
