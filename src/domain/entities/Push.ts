// ─── Push (Email de Tribunal) ─────────────────────────────────────────────────

export interface PushMovement {
  date: Date;
  type: string;
  description?: string;
  documentUrl?: string;
}

export type PushStatus = 'pending' | 'reviewed' | 'archived' | 'fault';

export interface Push {
  id: string;
  tenantId: string;
  
  // Metadados do email original
  emailId: string;           // ID da mensagem no Gmail
  from: string;              // Remetente (ex: pje@tjba.jus.br)
  to: string;                // Destinatário
  subject: string;           // Assunto do email
  receivedAt: Date;          // Data de recebimento
  emailBodyHtml?: string;    // Corpo HTML completo para visualização
  emailBodyText?: string;    // Corpo texto puro
  
  // Dados processuais extraídos
  processNumber?: string;    // Número do processo
  court?: string;            // Órgão (vara/tribunal)
  activeParty?: string;      // Polo ativo
  passiveParty?: string;     // Polo passivo
  legalClass?: string;       // Classe judicial
  filingDate?: Date;         // Data de autuação
  distributionType?: string; // Tipo de distribuição (sorteio, livre, etc)
  processSubject?: string;   // Assunto do processo
  
  // Movimentações processuais
  movements?: PushMovement[];
  
  // Status e controle
  status: PushStatus;
  parsedByAI: boolean;       // Se precisou de IA para extrair dados
  parsingError?: string;     // Erro no parsing, se houver
  
  createdAt: Date;
  createdBy: string;         // 'system' para criação automática

  // Última triagem manual (mudança de status) — usado pela auditoria
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;

  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Push Interaction ─────────────────────────────────────────────────────────

export interface PushInteraction {
  id: string;
  userId: string;
  pushId: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}
