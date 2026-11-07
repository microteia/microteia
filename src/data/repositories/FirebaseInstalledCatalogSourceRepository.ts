import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type {
  IInstalledCatalogSourceRepository,
  InstalledCatalogSourceRead,
} from '../../domain/repositories/IInstalledCatalogSourceRepository';
import type { InstalledCatalogSourceDocument } from '../../domain/usecases/plugins/installedCatalogSnapshot';

/**
 * As quatro coleções de DEFINIÇÃO do escritório, lidas inteiras e sem mapeamento.
 *
 * Sem `limit()` de propósito: são coleções de esquema, que crescem com o que o escritório declara e não
 * com o que ele registra — as mesmas que a aplicação já carrega inteiras no boot para desenhar o menu e
 * as telas. Um retrato truncado se apresentaria como completo, que é o defeito que ele existe para evitar.
 */
const readCollection = async (tenantId: string, name: string): Promise<InstalledCatalogSourceDocument[]> => {
  const snapshot = await getDocs(collection(db, 'tenants', tenantId, name));
  return snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
};

export class FirebaseInstalledCatalogSourceRepository implements IInstalledCatalogSourceRepository {
  async read(tenantId: string): Promise<InstalledCatalogSourceRead> {
    const [screens, lookups, tagLists, extensions] = await Promise.all([
      readCollection(tenantId, 'screenDefinitions'),
      readCollection(tenantId, 'lookupDefinitions'),
      readCollection(tenantId, 'tagDefinitions'),
      readCollection(tenantId, 'installed_extensions'),
    ]);
    return { projectId: db.app.options.projectId ?? '', screens, lookups, tagLists, extensions };
  }
}
