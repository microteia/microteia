import { createContext, useContext } from 'react';
import type { PushInteraction } from '../domain/entities';

export interface PushInteractionContext {
  interactions: PushInteraction[];
  loading: boolean;
  unreadCount: number;
  getInteraction: (pushId: string) => PushInteraction | undefined;
  markAsRead: (pushId: string) => Promise<void>;
}

export const PushInteractionContext = createContext<PushInteractionContext | null>(null);

export const usePushInteraction = (): PushInteractionContext => {
  const ctx = useContext(PushInteractionContext);
  if (!ctx) throw new Error('usePushInteraction must be used within PushInteractionStoreProvider');
  return ctx;
};
