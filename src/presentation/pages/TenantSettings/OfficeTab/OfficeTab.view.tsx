import React from 'react';
import { useOfficeTabViewModel } from './OfficeTab.viewmodel';
import { S } from './OfficeTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { InfoBanner } from '../../../components/ui/InfoBanner';

import { useT } from '../../../shared/i18n/useT';
export const OfficeTabView: React.FC = () => {
  const t = useT('core.admin');
  const vm = useOfficeTabViewModel();

  return (
    <S.Container>
      {!vm.isAdmin && (
        <InfoBanner
          message={t('office.admin-only')}
          variant="info"
        />
      )}
      <S.FormGrid>
        <S.FormGroup $fullWidth>
          <Label>{t('office.name')}</Label>
          <Input
            value={vm.officeForm.name}
            onChange={(e) => vm.setOfficeForm({ name: e.target.value })}
            placeholder={t('office.name.placeholder')}
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup>
          <Label>{t('office.tax-id')}</Label>
          <Input
            value={vm.officeForm.cnpj}
            onChange={(e) => vm.setOfficeForm({ cnpj: e.target.value })}
            placeholder="00.000.000/0000-00"
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup>
          <Label>{t('office.email')}</Label>
          <Input
            type="email"
            value={vm.officeForm.email}
            onChange={(e) => vm.setOfficeForm({ email: e.target.value })}
            placeholder={t('office.email.placeholder')}
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup>
          <Label>{t('core.ui/field.phone')}</Label>
          <Input
            value={vm.officeForm.phone}
            onChange={(e) => vm.setOfficeForm({ phone: e.target.value })}
            placeholder="(00) 00000-0000"
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup $fullWidth>
          <Label>{t('core.ui/field.address')}</Label>
          <Input
            value={vm.officeForm.address}
            onChange={(e) => vm.setOfficeForm({ address: e.target.value })}
            placeholder={t('office.address.placeholder')}
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
      </S.FormGrid>
      {vm.isAdmin && (
        <S.SaveRow>
          <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving}>
            {vm.isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </S.SaveRow>
      )}
    </S.Container>
  );
};
