// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/entities/Action.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/entities/Action.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

export interface ActionDefinition {
  id: string;
  tenantId: string;
  key: string;
  title: string;
  icon: string;
  workflowId: string;
  hiddenWhen?: string | null;
  disabledWhen?: string | null;
  confirmMessage?: string | null;
  danger: boolean;
  enabled: boolean;
  order: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
}

export type ActionLocalCommand = 'replace' | 'merge' | 'save' | 'refresh' | 'clone' | 'delete' | 'close';

/**
 * Ordem canônica de aplicação, independente da ordem em que o workflow devolveu: mesclar antes de
 * gravar, gravar antes de recarregar, e os comandos terminais (clonar/excluir/fechar) por último.
 */
export const ACTION_COMMAND_ORDER: readonly ActionLocalCommand[] = [
  'replace',
  'merge',
  'save',
  'refresh',
  'clone',
  'delete',
  'close',
] as const;

export const ACTION_COMMAND_LABELS: Record<ActionLocalCommand, string> = {
  replace: 'Substituir os dados da tela pelo resultado',
  merge: 'Mesclar o resultado nos dados da tela',
  save: 'Gravar o registro',
  refresh: 'Recarregar o registro do servidor',
  clone: 'Abrir uma cópia do registro',
  delete: 'Excluir o registro',
  close: 'Fechar a aba',
};

export type ActionStatusCode = 'SUCCESS' | 'WARNING' | 'ERROR';

export interface ActionStatus {
  code: ActionStatusCode;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface ActionOutcome {
  result: Record<string, unknown> | null;
  status: ActionStatus;
  commands: ActionLocalCommand[];
}

const STATUS_CODES: readonly ActionStatusCode[] = ['SUCCESS', 'WARNING', 'ERROR'] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asCommand = (entry: unknown): ActionLocalCommand | null => {
  const raw = typeof entry === 'string'
    ? entry
    : isPlainObject(entry) && typeof entry.type === 'string'
      ? entry.type
      : '';
  const normalized = raw.trim().toLowerCase() as ActionLocalCommand;
  return ACTION_COMMAND_ORDER.includes(normalized) ? normalized : null;
};

const asFieldErrors = (value: unknown): Record<string, string> | undefined => {
  if (!isPlainObject(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(value)) {
    if (typeof message === 'string' && message.trim() !== '') out[key] = message.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asCode = (value: unknown): ActionStatusCode | null => {
  const raw = asText(value).toUpperCase();
  return STATUS_CODES.includes(raw as ActionStatusCode) ? (raw as ActionStatusCode) : null;
};

/**
 * Forma compacta `"SUCCESS"` / `["SUCCESS", "Mensagem"]`, para quem monta o status numa Expression —
 * o avaliador tem literal de array mas não de objeto. Texto que não é um código conhecido vira a
 * mensagem, com código `SUCCESS`: `["Enviado"]` e `"Enviado"` são status de sucesso com mensagem.
 */
const statusFromParts = (first: unknown, second: unknown): ActionStatus => {
  const code = asCode(first);
  return code
    ? { code, message: asText(second) }
    : { code: 'SUCCESS', message: asText(first) || asText(second) };
};

const asStatus = (value: unknown): ActionStatus => {
  if (Array.isArray(value)) return statusFromParts(value[0], value[1]);
  if (typeof value === 'string') return statusFromParts(value, undefined);
  if (!isPlainObject(value)) return { code: 'SUCCESS', message: '' };

  // Na forma-objeto as posições são nomeadas: um código desconhecido é descartado, não vira mensagem.
  const code = asCode(value.code) ?? 'SUCCESS';
  const message = asText(value.message);
  const fieldErrors = asFieldErrors(value.fieldErrors);
  return fieldErrors ? { code, message, fieldErrors } : { code, message };
};

/**
 * Traduz os outputs crus do workflow no contrato da Action. Tolerante por desenho: output ausente ou
 * malformado vira "nada a aplicar", nunca uma exceção que quebre a tela de quem chamou.
 */
export const normalizeActionOutcome = (outputs: unknown): ActionOutcome => {
  const source = isPlainObject(outputs) ? outputs : {};
  const rawCommands = Array.isArray(source.actions) ? source.actions : [];
  const requested = new Set(
    rawCommands.map(asCommand).filter((command): command is ActionLocalCommand => command !== null),
  );
  return {
    result: isPlainObject(source.result) ? source.result : null,
    status: asStatus(source.status),
    commands: ACTION_COMMAND_ORDER.filter((command) => requested.has(command)),
  };
};
