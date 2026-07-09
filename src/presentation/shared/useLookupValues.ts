import { useCallback } from 'react';
import { usePersonLookup } from '../../stores/usePersonLookup';
import { useCaseLookup } from '../../stores/useCaseLookup';
import { useContractLookup } from '../../stores/useContractLookup';
import { useDeadlineLookup } from '../../stores/useDeadlineLookup';
import { useFinancialLookup } from '../../stores/useFinancialLookup';
import { useDocumentTypeLookup } from '../../stores/useDocumentTypeLookup';
import { useNewsCategoryLookup } from '../../stores/useNewsCategoryLookup';

export interface LookupValueOption {
  value: string;
  label: string;
  color?: string;
}

interface LookupConfigLike {
  label: string;
  color?: string;
}

export interface LookupValuesState {
  getLookupOptions: (collection: string) => LookupValueOption[];
}

export const useLookupValues = (): LookupValuesState => {
  const personLookup = usePersonLookup();
  const caseLookup = useCaseLookup();
  const contractLookup = useContractLookup();
  const deadlineLookup = useDeadlineLookup();
  const financialLookup = useFinancialLookup();
  const documentTypeLookup = useDocumentTypeLookup();
  const newsCategoryLookup = useNewsCategoryLookup();

  const getLookupOptions = useCallback(
    (collection: string): LookupValueOption[] => {
      const configsByCollection: Record<string, LookupConfigLike[]> = {
        personTypes: personLookup.typeConfigs,
        personOccupations: personLookup.occupationConfigs,
        personNationalities: personLookup.nationalityConfigs,
        personMaritalStatuses: personLookup.maritalStatusConfigs,
        personCities: personLookup.cityConfigs,
        personRelationships: personLookup.relationshipConfigs,
        caseAreas: caseLookup.areaConfigs,
        casePhases: caseLookup.phaseConfigs,
        caseStatuses: caseLookup.statusConfigs,
        caseInstances: caseLookup.instanceConfigs,
        caseActionTypes: caseLookup.actionTypeConfigs,
        caseCourts: caseLookup.courtConfigs,
        caseDistricts: caseLookup.districtConfigs,
        caseJudges: caseLookup.judgeConfigs,
        documentTypes: documentTypeLookup.typeConfigs,
        newsCategories: newsCategoryLookup.categoryConfigs,
        contractTypes: contractLookup.typeConfigs,
        contractCategories: contractLookup.categoryConfigs,
        contractStatuses: contractLookup.statusConfigs,
        contractObjects: contractLookup.objectConfigs,
        contractAdjustmentIndexes: contractLookup.adjustmentIndexConfigs,
        contractAdjustmentPeriodicities: contractLookup.adjustmentPeriodicityConfigs,
        contractCurrencies: contractLookup.currencyConfigs,
        contractPaymentMethods: contractLookup.paymentMethodConfigs,
        contractBanks: contractLookup.bankConfigs,
        contractCostCenters: contractLookup.costCenterConfigs,
        deadlineTypes: deadlineLookup.typeConfigs,
        financialCategories: financialLookup.categoryConfigs,
        financialStatuses: financialLookup.statusConfigs,
      };
      const configs = configsByCollection[collection] ?? [];
      return configs.map((config) => ({ value: config.label, label: config.label, color: config.color }));
    },
    [personLookup, caseLookup, contractLookup, deadlineLookup, financialLookup, documentTypeLookup, newsCategoryLookup],
  );

  return { getLookupOptions };
};
