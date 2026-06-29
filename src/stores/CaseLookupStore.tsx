import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { CaseLookupContext } from './useCaseLookup';
import type { CaseAreaConfig, CasePhaseConfig, CaseStatusConfig, CaseInstanceConfig, CaseActionTypeConfig, CaseCourtConfig, CaseDistrictConfig, CaseJudgeConfig } from '../domain/entities';

export const CaseLookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    caseAreaRepository, 
    casePhaseRepository, 
    caseStatusRepository, 
    caseInstanceRepository,
    caseActionTypeRepository,
    caseCourtRepository,
    caseDistrictRepository,
    caseJudgeRepository,
  } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [areaConfigs, setAreaConfigs] = useState<CaseAreaConfig[]>([]);
  const [phaseConfigs, setPhaseConfigs] = useState<CasePhaseConfig[]>([]);
  const [statusConfigs, setStatusConfigs] = useState<CaseStatusConfig[]>([]);
  const [instanceConfigs, setInstanceConfigs] = useState<CaseInstanceConfig[]>([]);
  const [actionTypeConfigs, setActionTypeConfigs] = useState<CaseActionTypeConfig[]>([]);
  const [courtConfigs, setCourtConfigs] = useState<CaseCourtConfig[]>([]);
  const [districtConfigs, setDistrictConfigs] = useState<CaseDistrictConfig[]>([]);
  const [judgeConfigs, setJudgeConfigs] = useState<CaseJudgeConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [areas, phases, statuses, instances, actionTypes, courts, districts, judges] = await Promise.all([
        caseAreaRepository.getAll(currentTenant.id),
        casePhaseRepository.getAll(currentTenant.id),
        caseStatusRepository.getAll(currentTenant.id),
        caseInstanceRepository.getAll(currentTenant.id),
        caseActionTypeRepository.getAll(currentTenant.id),
        caseCourtRepository.getAll(currentTenant.id),
        caseDistrictRepository.getAll(currentTenant.id),
        caseJudgeRepository.getAll(currentTenant.id),
      ]);
      setAreaConfigs(areas);
      setPhaseConfigs(phases);
      setStatusConfigs(statuses);
      setInstanceConfigs(instances);
      setActionTypeConfigs(actionTypes);
      setCourtConfigs(courts);
      setDistrictConfigs(districts);
      setJudgeConfigs(judges);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, caseAreaRepository, casePhaseRepository, caseStatusRepository, caseInstanceRepository, caseActionTypeRepository, caseCourtRepository, caseDistrictRepository, caseJudgeRepository]);

  useEffect(() => {
    if (!currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on tenant change is architecturally required
    void refresh();
  }, [currentTenant, refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && currentTenant) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, currentTenant]);

  type LookupKind = 'areas' | 'phases' | 'statuses' | 'instances' | 'actionTypes' | 'courts' | 'districts' | 'judges';

  const addItem = useCallback(async (kind: LookupKind, name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    
    switch (kind) {
      case 'areas': {
        const config = await caseAreaRepository.create(currentTenant.id, name, name, user.id);
        setAreaConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
      case 'phases': {
        const config = await casePhaseRepository.create(currentTenant.id, name, name, undefined, user.id);
        setPhaseConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
      case 'statuses': {
        const config = await caseStatusRepository.create(currentTenant.id, name, name, '#6b7280', user.id);
        setStatusConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
      case 'instances': {
        const config = await caseInstanceRepository.create(currentTenant.id, name, name, undefined, user.id);
        setInstanceConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
      case 'actionTypes': {
        const config = await caseActionTypeRepository.create(currentTenant.id, name, name, user.id);
        setActionTypeConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
      case 'courts': {
        const config = await caseCourtRepository.create(currentTenant.id, name, name, user.id);
        setCourtConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
      case 'districts': {
        const config = await caseDistrictRepository.create(currentTenant.id, name, name, user.id);
        setDistrictConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
      case 'judges': {
        const config = await caseJudgeRepository.create(currentTenant.id, name, name, user.id);
        setJudgeConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
        break;
      }
    }
  }, [currentTenant, user, caseAreaRepository, casePhaseRepository, caseStatusRepository, caseInstanceRepository, caseActionTypeRepository, caseCourtRepository, caseDistrictRepository, caseJudgeRepository]);

  const removeItem = useCallback(async (kind: LookupKind, key: string) => {
    if (!currentTenant) return;
    
    switch (kind) {
      case 'areas':
        await caseAreaRepository.delete(currentTenant.id, key);
        setAreaConfigs(prev => prev.filter(i => i.key !== key));
        break;
      case 'phases':
        await casePhaseRepository.delete(currentTenant.id, key);
        setPhaseConfigs(prev => prev.filter(i => i.key !== key));
        break;
      case 'statuses':
        await caseStatusRepository.delete(currentTenant.id, key);
        setStatusConfigs(prev => prev.filter(i => i.key !== key));
        break;
      case 'instances':
        await caseInstanceRepository.delete(currentTenant.id, key);
        setInstanceConfigs(prev => prev.filter(i => i.key !== key));
        break;
      case 'actionTypes':
        await caseActionTypeRepository.delete(currentTenant.id, key);
        setActionTypeConfigs(prev => prev.filter(i => i.key !== key));
        break;
      case 'courts':
        await caseCourtRepository.delete(currentTenant.id, key);
        setCourtConfigs(prev => prev.filter(i => i.key !== key));
        break;
      case 'districts':
        await caseDistrictRepository.delete(currentTenant.id, key);
        setDistrictConfigs(prev => prev.filter(i => i.key !== key));
        break;
      case 'judges':
        await caseJudgeRepository.delete(currentTenant.id, key);
        setJudgeConfigs(prev => prev.filter(i => i.key !== key));
        break;
    }
  }, [currentTenant, caseAreaRepository, casePhaseRepository, caseStatusRepository, caseInstanceRepository, caseActionTypeRepository, caseCourtRepository, caseDistrictRepository, caseJudgeRepository]);

  return (
    <CaseLookupContext.Provider value={{
      areaConfigs,
      phaseConfigs,
      statusConfigs,
      instanceConfigs,
      actionTypeConfigs,
      courtConfigs,
      districtConfigs,
      judgeConfigs,
      loading,
      addItem,
      removeItem,
    }}>
      {children}
    </CaseLookupContext.Provider>
  );
};
