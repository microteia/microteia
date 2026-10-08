import type { InputMapping, WorkflowEvent } from './Workflow';

/**
 * O `message` do logger do MOTOR é uma REFERÊNCIA (`@core.automation/…`), e `params` traz o que a
 * frase interpola — a linha é gravada em `execution.logs` e lida na tela, no idioma de quem lê.
 * O `console.log` que o Script do escritório emite entra pelo mesmo método como texto cru: quem
 * resolve trata o que não começa com `@` como já pronto, então as duas naturezas convivem.
 */
export interface WorkflowLogger {
  info(message: string, params?: Record<string, string>): void;
  warn(message: string, params?: Record<string, string>): void;
  error(message: string, params?: Record<string, string>): void;
}

export interface WorkflowServices {
  logger: WorkflowLogger;
  now(): Date;
}

/** De onde partiu o gesto de uma PESSOA: o app ou um agente de IA, pelo MCP, em nome dela. */
export type ActorVia = 'ui' | 'agent';

/**
 * A pessoa que causou a execução: a IDENTIDADE (uid, nome efetivo, foto, por onde veio) e o ACESSO
 * (as permissões dela nesta execução).
 *
 * As duas metades viajam de forma diferente, e é isso que justifica serem campos separados. A
 * identidade é um fato — quem apertou o botão não muda depois — e atravessa o barramento de eventos.
 * As permissões são um retrato do acesso, que envelhece: só existem na execução EM PROCESSO, e o ator
 * remontado de um evento publicado chega com `permissions: []`.
 */
export interface WorkflowActor {
  userId: string;
  /** O nome efetivo, pela mesma regra do front (apelido → nome completo → displayName → e-mail). */
  name: string;
  photoURL: string;
  via: ActorVia;
  permissions: string[];
}

export interface WorkflowContext {
  event: WorkflowEvent;
  outputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
  services: WorkflowServices;
  logger: WorkflowLogger;
  execution: {
    id: string;
    workflowDefinitionId: string;
    tenantId: string;
  };
  /**
   * QUEM disparou esta execução, quando alguém disparou.
   *
   * Ausente na automação que nasce de um gatilho: ali não há pessoa, e `hasPermission(...)` responde
   * NÃO — a pergunta "esta pessoa pode?" sem pessoa nenhuma só tem essa resposta segura.
   *
   * Vive no CONTEXTO, e não num gate de módulo como o idioma: uma instância de Cloud Function atende
   * requisições concorrentes, e permissão vazada de uma execução para outra é o defeito que este
   * modelo inteiro existe para não ter.
   */
  actor?: WorkflowActor;
  input?: Record<string, unknown>;
  // Configuração bruta do step em execução. Permite que um step com inputs dinâmicos (ex:
  // 'Chamar Workflow') resolva chaves de configuração que resolveInputsSafe não conhece.
  stepConfiguration?: Record<string, InputMapping>;
}

export interface WorkflowResult {
  success: boolean;
  /** REFERÊNCIA de mensagem; `messageParams` traz o que a frase interpola. */
  message?: string;
  messageParams?: Record<string, string>;
  outputs?: Record<string, unknown>;
  // Encerra o workflow imediatamente após este step, atravessando ramos de condição e
  // repetições. O workflow retorna os outputs do último step executado antes do encerramento.
  halt?: boolean;
}
