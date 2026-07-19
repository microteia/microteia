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

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setAreaConfigs([]);
      setPhaseConfigs([]);
      setStatusConfigs([]);
      setInstanceConfigs([]);
      setActionTypeConfigs([]);
      setCourtConfigs([]);
      setDistrictConfigs([]);
      setJudgeConfigs([]);
      return;
    }
    setLoading(true);
    const done = () => setLoading(false);
    const unsubscribes = [
      caseAreaRepository.subscribe(currentTenant.id,       (items) => { setAreaConfigs(items);       done(); }),
      casePhaseRepository.subscribe(currentTenant.id,      (items) => { setPhaseConfigs(items);      done(); }),
      caseStatusRepository.subscribe(currentTenant.id,     (items) => { setStatusConfigs(items);     done(); }),
      caseInstanceRepository.subscribe(currentTenant.id,   (items) => { setInstanceConfigs(items);   done(); }),
      caseActionTypeRepository.subscribe(currentTenant.id, (items) => { setActionTypeConfigs(items); done(); }),
      caseCourtRepository.subscribe(currentTenant.id,      (items) => { setCourtConfigs(items);      done(); }),
      caseDistrictRepository.subscribe(currentTenant.id,   (items) => { setDistrictConfigs(items);   done(); }),
      caseJudgeRepository.subscribe(currentTenant.id,      (items) => { setJudgeConfigs(items);      done(); }),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [currentTenant, caseAreaRepository, casePhaseRepository, caseStatusRepository, caseInstanceRepository, caseActionTypeRepository, caseCourtRepository, caseDistrictRepository, caseJudgeRepository]);

  type LookupKind = 'areas' | 'phases' | 'statuses' | 'instances' | 'actionTypes' | 'courts' | 'districts' | 'judges';

  const addItem = useCallback(async (kind: LookupKind, name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    
    switch (kind) {
      case 'areas': {
        await caseAreaRepository.create(currentTenant.id, name, name, user.id);
        break;
      }
      case 'phases': {
        await casePhaseRepository.create(currentTenant.id, name, name, undefined, user.id);
        break;
      }
      case 'statuses': {
        await caseStatusRepository.create(currentTenant.id, name, name, '#6b7280', user.id);
        break;
      }
      case 'instances': {
        await caseInstanceRepository.create(currentTenant.id, name, name, undefined, user.id);
        break;
      }
      case 'actionTypes': {
        await caseActionTypeRepository.create(currentTenant.id, name, name, user.id);
        break;
      }
      case 'courts': {
        await caseCourtRepository.create(currentTenant.id, name, name, user.id);
        break;
      }
      case 'districts': {
        await caseDistrictRepository.create(currentTenant.id, name, name, user.id);
        break;
      }
      case 'judges': {
        await caseJudgeRepository.create(currentTenant.id, name, name, user.id);
        break;
      }
    }
  }, [currentTenant, user, caseAreaRepository, casePhaseRepository, caseStatusRepository, caseInstanceRepository, caseActionTypeRepository, caseCourtRepository, caseDistrictRepository, caseJudgeRepository]);

  const removeItem = useCallback(async (kind: LookupKind, key: string) => {
    if (!currentTenant) return;
    
    switch (kind) {
      case 'areas':
        await caseAreaRepository.delete(currentTenant.id, key);
        break;
      case 'phases':
        await casePhaseRepository.delete(currentTenant.id, key);
        break;
      case 'statuses':
        await caseStatusRepository.delete(currentTenant.id, key);
        break;
      case 'instances':
        await caseInstanceRepository.delete(currentTenant.id, key);
        break;
      case 'actionTypes':
        await caseActionTypeRepository.delete(currentTenant.id, key);
        break;
      case 'courts':
        await caseCourtRepository.delete(currentTenant.id, key);
        break;
      case 'districts':
        await caseDistrictRepository.delete(currentTenant.id, key);
        break;
      case 'judges':
        await caseJudgeRepository.delete(currentTenant.id, key);
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
