import type { DispatchNotificationRequest } from '../usecases/DispatchNotificationUseCase';
import type { RecordKeyAdoptionState } from '../schema/recordKeyAdoption';
import { PERMISSION_SCREENS_MANAGE } from '../schema/access/kernelPermissions';

/** O tipo do aviso, declarado pelo dono do ponto (`core.automation`) em `notification.category`. */
export const RECORD_KEY_CONFLICTS_CATEGORY = 'core.automation/record-key-conflicts';

export interface RecordKeyConflictNoticeInput {
  tenantId: string;
  collection: string;
  state: RecordKeyAdoptionState;
  /** A tela que o escritório abre para a coleção — o clique leva à listagem dela, onde está o aviso. */
  screenId: string;
  /** O nome da tela, já no idioma do escritório: parâmetro de aviso é texto. */
  screenTitle: string;
  /** As chaves pendentes como a pessoa as reconhece — os rótulos dos campos, `Data + Hora + Tipo`. */
  keyLabels: readonly string[];
}

/**
 * O aviso de que a adoção achou registros antigos que repetem um valor único (ou não têm nenhum).
 *
 * A adoção roda por vários gatilhos — salvar uma tela, instalar uma extensão, alguém abrir a lista —,
 * e nenhum deles é um gesto de quem resolve. O aviso da listagem só chega a quem a abre; este chega
 * a quem tem `screens.manage`, pela porta única de notificação, e cada pessoa o silencia por canal na
 * página de Notificações.
 *
 * `null` quando não há o que corrigir: passada que só reservou, ou chave pendente só por falha de
 * leitura — essa se refaz sozinha, e avisar uma pessoa não a ajudaria.
 *
 * Um aviso por passada (`generation`): as reconferências de cada registro corrigido não chegam aqui,
 * e a passada nova — que só acontece quando sobram conflitos além dos listados — avisa de novo,
 * porque achou outros.
 */
export const recordKeyConflictNotice = (input: RecordKeyConflictNoticeInput): DispatchNotificationRequest | null => {
  const { state } = input;
  if (Object.keys(state.pending).length === 0 || state.issueCount === 0) return null;
  return {
    tenantId: input.tenantId,
    source: 'core.records/record-key-adoption',
    title: '@core.records/key.adoption.notice.title',
    message: '@core.records/key.adoption.notice.message',
    params: { screen: input.screenTitle, keys: input.keyLabels.join(', '), count: String(state.issueCount) },
    link: `dyn:${input.screenId}`,
    category: RECORD_KEY_CONFLICTS_CATEGORY,
    dedupKey: `record-key-conflicts:${input.collection}:${state.generation}`,
    // A Auditoria já tem a linha da passada (`recordPassFinished`); repeti-la seria ruído.
    channels: { audit: false, inApp: true, email: true, push: true },
    recipientIds: [],
    recipientPermissions: [PERMISSION_SCREENS_MANAGE],
  };
};
