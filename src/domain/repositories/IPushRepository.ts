import type { Push, PushInteraction } from '../entities';

export interface IPushRepository {
  /**
   * Busca todos os pushes de um tenant
   */
  getPushes(tenantId: string): Promise<Push[]>;

  /**
   * Busca um push pelo ID
   */
  getPushById(tenantId: string, pushId: string): Promise<Push | null>;

  /**
   * Atualiza o status de um push
   */
  updatePushStatus(pushId: string, status: 'pending' | 'reviewed' | 'archived' | 'fault'): Promise<void>;

  /**
   * Deleta um push
   */
  deletePush(tenantId: string, pushId: string): Promise<void>;

  /**
   * Subscreve para mudanças em tempo real
   */
  subscribeToPushes(tenantId: string, callback: (pushes: Push[]) => void): () => void;
}

export interface IPushInteractionRepository {
  /**
   * Busca todas as interações de um usuário
   */
  getInteractions(userId: string): Promise<PushInteraction[]>;

  /**
   * Cria ou atualiza uma interação
   */
  upsertInteraction(
    userId: string,
    pushId: string,
    data: Partial<Omit<PushInteraction, 'id' | 'userId' | 'pushId' | 'createdAt'>>
  ): Promise<PushInteraction>;

  /**
   * Subscreve para mudanças em tempo real
   */
  subscribeToInteractions(userId: string, callback: (interactions: PushInteraction[]) => void): () => void;
}
