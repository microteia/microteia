import React from 'react';
import { useOfficeTabViewModel } from './OfficeTab.viewmodel';
import { S } from './OfficeTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { InfoBanner } from '../../../components/ui/InfoBanner';

export const OfficeTabView: React.FC = () => {
  const vm = useOfficeTabViewModel();

  return (
    <S.Container>
      {!vm.isAdmin && (
        <InfoBanner
          message="Somente administradores podem alterar os dados do escritório."
          variant="info"
        />
      )}
      <S.FormGrid>
        <S.FormGroup $fullWidth>
          <Label>Nome do Escritório *</Label>
          <Input
            value={vm.officeForm.name}
            onChange={(e) => vm.setOfficeForm({ name: e.target.value })}
            placeholder="Ex: Escritório de Advocacia Silva & Associados"
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup>
          <Label>CNPJ</Label>
          <Input
            value={vm.officeForm.cnpj}
            onChange={(e) => vm.setOfficeForm({ cnpj: e.target.value })}
            placeholder="00.000.000/0000-00"
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup>
          <Label>E-mail do Escritório</Label>
          <Input
            type="email"
            value={vm.officeForm.email}
            onChange={(e) => vm.setOfficeForm({ email: e.target.value })}
            placeholder="contato@escritorio.com"
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup>
          <Label>Telefone</Label>
          <Input
            value={vm.officeForm.phone}
            onChange={(e) => vm.setOfficeForm({ phone: e.target.value })}
            placeholder="(00) 00000-0000"
            disabled={!vm.isAdmin}
          />
        </S.FormGroup>
        <S.FormGroup $fullWidth>
          <Label>Endereço</Label>
          <Input
            value={vm.officeForm.address}
            onChange={(e) => vm.setOfficeForm({ address: e.target.value })}
            placeholder="Rua, número, complemento, cidade - Estado"
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
