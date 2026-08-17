import React from 'react';
import { useOfficeTabViewModel } from './OfficeTab.viewmodel';
import { S } from './OfficeTab.styles';
import { Button } from '../../../components/ui/Button';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { CustomFieldsSection } from '../../../components/ui/CustomFieldsSection';
import { useT } from '../../../shared/i18n/useT';

export const OfficeTabView: React.FC = () => {
  const t = useT('core.tenant');
  const vm = useOfficeTabViewModel();

  return (
    <S.Container>
      {!vm.isAdmin && <InfoBanner message={t('office.admin-only')} variant="info" />}

      <CustomFieldsSection
        fields={vm.fields}
        values={vm.values}
        errors={vm.fieldErrors}
        disabled={!vm.isAdmin}
        onChange={vm.setFieldValue}
      />

      {vm.isAdmin && (
        <S.SaveRow>
          <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving}>
            {vm.isSaving ? t('core.ui/action.saving') : t('core.ui/action.save')}
          </Button>
        </S.SaveRow>
      )}
    </S.Container>
  );
};
