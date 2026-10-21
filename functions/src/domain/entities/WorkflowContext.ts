import type { BusinessCalendarSet } from '../schema/time/businessDays';
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
  /**
   * O fuso do escritório NESTA execução — em que `today()` diz que dia é. Ausente, UTC.
   *
   * É do contexto, e não de um gate de módulo, pela mesma razão de `actor`: uma instância atende
   * escritórios diferentes ao mesmo tempo.
   */
  timeZone?: string;
  /**
   * Resolve o fuso de um escritório (`i18n.timezone`, usuário → escritório → padrão). Quem monta
   * serviços COMPARTILHADOS entre escritórios — o container — fornece este, e não `timeZone`: o
   * fuso é resolvido no começo de cada execução, por `hydrateAndRunWorkflow`.
   */
  timeZoneOf?(tenantId: string, userId?: string): Promise<string>;
  /**
   * Os calendários de dias úteis do escritório NESTA execução — o que `addBusinessDays` conta. `null`
   * é "nenhuma extensão declara calendários", e a conta recusa com erro nomeado. Ausente, ninguém
   * carregou: só se carrega quando a execução cita uma das contas (`mentionsBusinessDays`).
   */
  businessCalendars?: BusinessCalendarSet | null;
  /** Carrega os calendários de um escritório. Mesmo papel de `timeZoneOf` para os serviços compartilhados. */
  businessCalendarsOf?(tenantId: string): Promise<BusinessCalendarSet | null>;
}

/**
 * De onde partiu o gesto de uma PESSOA: o app, um agente de IA pelo MCP em nome dela, ou o portal —
 * e aí a pessoa é de fora do escritório, sem permissão nenhuma.
 */
export type ActorVia = 'ui' | 'agent' | 'portal';

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
  /**
   * PAUSA o workflow depois deste step até `resumeAt` — o passo `delay`. Mesmo contrato de `halt`: o
   * passo pede, o executor obedece. Só vale no nível principal do fluxo e numa execução que pode
   * esperar (a que nasce do barramento de eventos); nas outras, o executor recusa.
   */
  suspend?: { resumeAt: Date };
}
