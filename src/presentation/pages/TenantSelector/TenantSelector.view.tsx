import React from 'react';
import { RiBuildingLine, RiAddLine, RiArrowRightLine } from 'react-icons/ri';
import { S } from './TenantSelector.styles';
import { useTenantSelectorViewModel } from './TenantSelector.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FullPageSpinner } from '../../components/ui/Spinner';

export const TenantSelectorView: React.FC = () => {
  const vm = useTenantSelectorViewModel();

  if (vm.isLoading) return <FullPageSpinner />;

  return (
    <S.Container>
      <S.Card>
        <S.Header>
          <S.Logo>Curatino</S.Logo>
          <S.Subtitle>Selecione o escritório em que deseja trabalhar</S.Subtitle>
        </S.Header>

        {vm.availableTenants.length > 0 && (
          <div>
            <S.SectionTitle>Meus Escritórios</S.SectionTitle>
            <S.TenantList>
              {vm.availableTenants.map((tenant) => (
                <S.TenantItem
                  key={tenant.id}
                  $active={vm.selectedTenantId === tenant.id}
                  onClick={() => vm.handleSelectTenant(tenant.id)}
                >
                  <S.TenantAvatar>
                    {tenant.name.charAt(0).toUpperCase()}
                  </S.TenantAvatar>
                  <S.TenantInfo>
                    <S.TenantName>{tenant.name}</S.TenantName>
                    <S.TenantRole>
                      {tenant.cnpj ? `CNPJ: ${tenant.cnpj}` : 'Escritório'}
                    </S.TenantRole>
                  </S.TenantInfo>
                </S.TenantItem>
              ))}
            </S.TenantList>
          </div>
        )}

        <S.Actions>
          {vm.availableTenants.length > 0 && (
            <Button onClick={vm.handleSelectAndContinue} disabled={!vm.selectedTenantId}>
              <RiArrowRightLine size={16} />
              Entrar no Escritório
            </Button>
          )}

          {vm.availableTenants.length > 0 && (
            <S.Divider>ou crie um novo</S.Divider>
          )}

          {!vm.showCreateForm ? (
            <Button variant="secondary" onClick={() => vm.setShowCreateForm(true)}>
              <RiAddLine size={16} />
              Criar Novo Escritório
            </Button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Input
                placeholder="Nome do Escritório"
                value={vm.newTenantName}
                onChange={(e) => vm.setNewTenantName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void vm.handleCreateTenant(); }}
                autoFocus
              />
              <Button
                onClick={() => void vm.handleCreateTenant()}
                disabled={!vm.newTenantName.trim() || vm.isCreating}
              >
                <RiBuildingLine size={16} />
                {vm.isCreating ? 'Criando...' : 'Criar Escritório'}
              </Button>
              <Button variant="secondary" onClick={() => vm.setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          )}
        </S.Actions>
      </S.Card>
    </S.Container>
  );
};
