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
  /**
   * COMANDO do sistema que a ação executa, no lugar de um fluxo de trabalho: `copyLink`, `clone`,
   * `manageTags`, `delete`, `unlink` — ou qualquer outro registrado no ponto `ui.record.action`.
   * Presente, `workflowId` é ignorado.
   *
   * Existe porque nem toda ação é automação. Copiar link, duplicar e excluir são operações de tela:
   * não têm o que rodar no servidor, e antes só existiam como caixa de seleção do kernel. Como
   * comando, elas entram na MESMA lista das ações do escritório — com ícone, ordem, `hiddenWhen` e
   * confirmação próprios.
   */
  command?: string | null;
  hiddenWhen?: string | null;
  disabledWhen?: string | null;
  /**
   * Expressão que diz quando a ação está LIGADA — o que a transforma num interruptor: o botão passa
   * a mostrar o estado atual do registro, em vez de só disparar. Ausente (o normal) = botão comum.
   *
   * Existe porque um cadastro costuma ter um estado que se alterna (ativo/inativo, arquivado,
   * destacado) e antes isso só existia em código, no cabeçalho de uma tela fixa. Como `hiddenWhen` e
   * `disabledWhen`, é avaliada só na UI, com os valores do formulário e o registro gravado.
   */
  activeWhen?: string | null;
  confirmMessage?: string | null;
  /**
   * A ação PERGUNTA antes de executar: abre o formulário dos parâmetros do fluxo de trabalho, como a
   * execução manual de uma automação, e só dispara depois que o usuário confirma.
   *
   * É declaração explícita, e não dedução a partir de "o fluxo tem parâmetros": todo fluxo chamado
   * por uma Action já recebe `action`, `source`, `context`, `recordId` e `isNew`, e quase nenhum deve
   * abrir tela. Ausente (o normal), a ação dispara direto.
   */
  promptParameters?: boolean | null;
  /**
   * Com o que cada parâmetro chega PREENCHIDO, por EXPRESSÃO no mesmo escopo do `hiddenWhen` (campos
   * do registro na raiz, mais `record`, `isNew`, `role`, `surface`). Chave = parâmetro do fluxo.
   *
   * Existe porque o nome do campo na tela raramente é o nome do parâmetro no fluxo: o push guarda
   * `processNumber` e o fluxo "Criar Prazo" pede `caseNumber`. Parâmetro sem entrada aqui ainda é
   * preenchido quando existe um campo de mesmo nome — o mapa é para quando os nomes divergem, ou
   * quando o valor é derivado.
   */
  parameterDefaults?: Record<string, string> | null;
  danger: boolean;
  enabled: boolean;
  order: number;
  /** Presente quando a action foi trazida por uma extensão; a desinstalação a remove. Dono
   * PRIMÁRIO (= `ownerPluginIds[0]`), usado para exibição/lock. */
  ownerPluginId?: string | null;
  /** Conjunto de extensões que compartilham esta action (refcount). A action só é removida quando o
   * conjunto fica vazio. */
  ownerPluginIds?: string[] | null;
  /** Id UNIVERSAL de origem (o GUID do artefato no tenant autor), estável entre pacotes — é por ele
   * que a instalação deduplica: dois plugins com a mesma origem reusam a mesma action. */
  sourceId?: string | null;
  /** Revisão de ORIGEM (epoch ms do `updatedAt` no autor), carimbada no empacotamento. A atualização
   * só reescreve o conteúdo quando a revisão que chega é estritamente maior que a materializada. */
  sourceRev?: number | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
}

/**
 * O que TODA action entrega ao fluxo, preenchido pelo sistema e nunca pelo formulário. `recordId` é o
 * registro do botão — a única forma de o fluxo saber sobre qual registro age quando a ação não abre o
 * formulário dos parâmetros (`promptParameters`).
 */
export const ACTION_RECORD_PARAMETER = 'recordId';

export const ACTION_SYSTEM_PARAMETER_KEYS = ['action', 'source', 'context', ACTION_RECORD_PARAMETER, 'isNew'] as const;

/**
 * As chaves que o fluxo de uma action devolve ao botão, nas saídas do ÚLTIMO passo executado. Sem
 * nenhuma delas, o botão diz que nada voltou (`handler.action.no-result`).
 */
export const ACTION_RETURN_KEYS = ['result', 'status', 'actions'] as const;

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
  replace: '@core.automation/action.command.replace',
  merge: '@core.automation/action.command.merge',
  save: '@core.automation/action.command.save',
  refresh: '@core.automation/action.command.refresh',
  clone: '@core.automation/action.command.clone',
  delete: '@core.automation/action.command.delete',
  close: '@core.automation/action.command.close',
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

export const ACTION_STATUS_CODES: readonly ActionStatusCode[] = ['SUCCESS', 'WARNING', 'ERROR'] as const;

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
  return ACTION_STATUS_CODES.includes(raw as ActionStatusCode) ? (raw as ActionStatusCode) : null;
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
