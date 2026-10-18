import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { IDocumentTemplateSource } from '../../domain/repositories/IDocumentGenerationPorts';
import type {
  DocumentTemplate,
  DocumentTemplateSpec,
  ResolvedDocumentTemplate,
} from '../../domain/schema/document/documentTemplate';
import {
  DOCUMENT_TEMPLATES_COLLECTION,
  resolveDocumentTemplates,
  templateScreenIndex,
} from '../../domain/schema/document/documentTemplate';
import type { InstalledExtensionCache } from './InstalledExtensionCache';
import type { IScreenDefinitionProvider } from '../../domain/repositories/IScreenDefinitionProvider';

/**
 * Os modelos que valem: as contribuições das extensões ligadas, sobrepostas pelos documentos do
 * escritório na mesma chave. A regra é a de `resolveDocumentTemplates`, a mesma que a tela aplica —
 * o modelo oferecido no botão é o modelo gerado.
 */
export class FirestoreDocumentTemplateSource implements IDocumentTemplateSource {
  constructor(
    private readonly db: Firestore,
    private readonly extensions: InstalledExtensionCache,
    private readonly screens: IScreenDefinitionProvider,
  ) {}

  private async screenIndex(tenantId: string) {
    const screens = await this.screens.getScreens(tenantId);
    return templateScreenIndex(
      screens.map((screen) => ({ key: screen.id, sourceId: screen.sourceId, collection: screen.collection })),
    );
  }

  async resolveDraft(tenantId: string, draft: DocumentTemplateSpec): Promise<ResolvedDocumentTemplate | null> {
    const [resolved] = resolveDocumentTemplates([], [{ ...draft, id: draft.key, enabled: true }], await this.screenIndex(tenantId));
    return resolved ?? null;
  }

  async resolve(tenantId: string): Promise<ResolvedDocumentTemplate[]> {
    const [packaged, snapshot, index] = await Promise.all([
      this.extensions.documentTemplates(tenantId),
      this.db.collection(`tenants/${tenantId}/${DOCUMENT_TEMPLATES_COLLECTION}`).get(),
      this.screenIndex(tenantId),
    ]);
    const tenant = snapshot.docs.map((doc): DocumentTemplate => {
      const data = doc.data();
      return {
        ...(data as Omit<DocumentTemplate, 'id'>),
        id: doc.id,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null,
      };
    });
    return resolveDocumentTemplates(packaged, tenant, index);
  }
}
