import { createContext, useContext } from 'react';
import type { CaseAreaConfig, CasePhaseConfig, CaseStatusConfig, CaseInstanceConfig, CaseActionTypeConfig, CaseCourtConfig, CaseDistrictConfig, CaseJudgeConfig } from '../domain/entities';

export type CaseLookupKind = 'areas' | 'phases' | 'statuses' | 'instances' | 'actionTypes' | 'courts' | 'districts' | 'judges';

type LookupKind = CaseLookupKind;

export interface CaseLookupStoreState {
  areaConfigs: CaseAreaConfig[];
  phaseConfigs: CasePhaseConfig[];
  statusConfigs: CaseStatusConfig[];
  instanceConfigs: CaseInstanceConfig[];
  actionTypeConfigs: CaseActionTypeConfig[];
  courtConfigs: CaseCourtConfig[];
  districtConfigs: CaseDistrictConfig[];
  judgeConfigs: CaseJudgeConfig[];
  loading: boolean;
  addItem: (kind: LookupKind, name: string) => Promise<void>;
  removeItem: (kind: LookupKind, key: string) => Promise<void>;
}

export const CaseLookupContext = createContext<CaseLookupStoreState | null>(null);

export const useCaseLookup = (): CaseLookupStoreState => {
  const ctx = useContext(CaseLookupContext);
  if (!ctx) throw new Error('useCaseLookup must be used within CaseLookupStoreProvider');
  return ctx;
};
