import { createContext, useContext } from 'react';
import type { Push } from '../domain/entities';

export interface PushContext {
  pushes: Push[];
  loading: boolean;
  loadError: string;
  refresh: () => Promise<void>;
  updateStatus: (pushId: string, status: 'pending' | 'reviewed' | 'archived') => Promise<void>;
  deletePush: (pushId: string) => Promise<void>;
}

export const PushContext = createContext<PushContext | null>(null);

export const usePush = (): PushContext => {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error('usePush must be used within PushStoreProvider');
  return ctx;
};
