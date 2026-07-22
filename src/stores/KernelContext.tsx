import React, { useMemo } from 'react';
import { createPluginHost } from '../kernel';
import type { PluginRecord } from '../kernel';
import { KernelContext } from './useKernel';

interface KernelProviderProps {
  records: PluginRecord[];
  children: React.ReactNode;
}

export const KernelProvider: React.FC<KernelProviderProps> = ({ records, children }) => {
  const value = useMemo(() => {
    const host = createPluginHost();
    return { host, result: host.load(records) };
  }, [records]);

  return <KernelContext.Provider value={value}>{children}</KernelContext.Provider>;
};
