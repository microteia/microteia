import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IOfficeDefaultsRepository, OfficeDefaultsIntent } from '../../domain/repositories/IOfficeDefaultsRepository';
import type { LocaleCode } from '../../domain/schema/i18n/localeNegotiation';
import {
  DEFAULT_EXTENSIONS_ONBOARDING_DOC,
  EXTENSION_ONBOARDING_COLLECTION,
  type DefaultCatalogSide,
} from '../../domain/schema/plugin/defaultExtensions';
import type { PluginDependency } from '../../domain/schema/plugin/pluginManifest';
import { REGISTRATION_POLICY_PATH, registrationPolicyOf } from '../../domain/schema/registration';
import { SETTINGS_VALUES_FIELD } from '../../domain/services/tenantSettings';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const LOCALE_SETTING = 'i18n.locale';

export class FirebaseOfficeDefaultsRepository implements IOfficeDefaultsRepository {
  constructor(private readonly db: Firestore) {}

  async readIntent(): Promise<OfficeDefaultsIntent> {
    const snapshot = await this.db.doc(REGISTRATION_POLICY_PATH).get();
    const policy = registrationPolicyOf(snapshot.exists ? snapshot.data() : undefined);
    return { locale: policy.defaultLocale, extensions: policy.defaultExtensions };
  }

  async readCatalog(ids: readonly string[]): Promise<DefaultCatalogSide[]> {
    if (ids.length === 0) return [];
    const snapshots = await this.db.getAll(...ids.map((id) => this.db.collection('public_extensions').doc(id)));
    return snapshots.flatMap((snapshot): DefaultCatalogSide[] => {
      if (!snapshot.exists) return [];
      const dependencies = snapshot.get('package.manifest.dependencies') as unknown;
      return [{
        id: snapshot.id,
        status: typeof snapshot.get('status') === 'string' ? (snapshot.get('status') as string) : 'pending',
        proven: isRecord(snapshot.get('proof')),
        ...(isRecord(dependencies) ? { dependencies: dependencies as Record<string, PluginDependency> } : {}),
      }];
    });
  }

  /**
   * No formato que a tela de Configurações grava (`FirebaseSettingsRepository`): `values` com a chave
   * declarada LITERAL — `i18n.locale` é o nome da propriedade, não um caminho. Num `set` a chave de mapa
   * não é interpretada como caminho; num `update` seria.
   */
  async setLocale(tenantId: string, locale: LocaleCode): Promise<void> {
    await this.db
      .collection('tenants').doc(tenantId)
      .collection('settings').doc('tenant')
      .set({
        scope: 'tenant',
        [SETTINGS_VALUES_FIELD]: { [LOCALE_SETTING]: locale },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
  }

  async stage(tenantId: string, pending: readonly string[]): Promise<void> {
    await this.db
      .collection('tenants').doc(tenantId)
      .collection(EXTENSION_ONBOARDING_COLLECTION).doc(DEFAULT_EXTENSIONS_ONBOARDING_DOC)
      .set({ pending: [...pending], failed: [], stagedAt: FieldValue.serverTimestamp() });
  }
}
