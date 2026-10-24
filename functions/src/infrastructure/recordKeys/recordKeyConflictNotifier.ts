import type { DispatchNotificationUseCase } from '../../domain/usecases/DispatchNotificationUseCase';
import type { MessageBundle } from '../../domain/schema/i18n/messages';
import type { RecordKeyAdoptionState } from '../../domain/schema/recordKeyAdoption';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import { resolveEntityKeys } from '../../domain/schema/screenEntity';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';
import { recordKeyConflictNotice } from '../../domain/services/recordKeyConflictNotice';
import { agentCatalog, agentText } from '../agent/agentMessages';

export interface RecordKeyConflictNotifierDeps {
  schemaContext: (tenantId: string) => Promise<SchemaContext>;
  messageBundles: (tenantId: string) => Promise<MessageBundle[]>;
  /** O idioma do escritório — os parâmetros do aviso são texto, e saem nele. */
  officeLocale: (tenantId: string) => Promise<string | undefined>;
  dispatch: DispatchNotificationUseCase;
}

/**
 * Avisa quem administra as telas que a adoção achou registros antigos a corrigir. A montagem é de
 * `recordKeyConflictNotice` (pura); aqui só se resolvem os nomes — a tela e os campos de cada chave,
 * como a pessoa os lê na listagem — no idioma do escritório.
 */
export const notifyRecordKeyConflicts = async (
  deps: RecordKeyConflictNotifierDeps,
  tenantId: string,
  collection: string,
  state: RecordKeyAdoptionState,
): Promise<void> => {
  if (Object.keys(state.pending).length === 0 || state.issueCount === 0) return;
  const [ctx, bundles, locale] = await Promise.all([
    deps.schemaContext(tenantId),
    deps.messageBundles(tenantId),
    deps.officeLocale(tenantId),
  ]);
  const catalog = agentCatalog(bundles, locale ?? DEFAULT_LOCALE);
  const screen = ctx.screens.get(collection);
  const fieldLabel = (key: string): string => {
    const label = screen?.fields.find((field) => field.key === key)?.label;
    return label ? agentText(catalog, label).text : key;
  };
  const keyLabels = resolveEntityKeys(ctx, collection)
    .filter((key) => state.pending[key.name] !== undefined)
    .map((key) => key.fields.map(fieldLabel).join(' + '));

  const request = recordKeyConflictNotice({
    tenantId,
    collection,
    state,
    screenId: screen?.id ?? collection,
    screenTitle: screen ? agentText(catalog, screen.titlePlural ?? screen.titleSingular).text : collection,
    keyLabels: keyLabels.length > 0 ? keyLabels : Object.keys(state.pending),
  });
  if (request) await deps.dispatch.execute(request);
};
