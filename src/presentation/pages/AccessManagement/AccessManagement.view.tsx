import React from 'react';
import { useTheme } from 'styled-components';
import { RiShieldUserLine, RiLockLine } from 'react-icons/ri';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import { Spinner } from '../../components/ui/Spinner';
import { useAccessManagementViewModel } from './AccessManagement.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { S } from './AccessManagement.styles';
import type { UserRole } from '../../../domain/entities';

const ROLE_OPTIONS: SearchSelectOption[] = [
  { value: 'SYSTEM', label: 'Sistema' },
  { value: 'USER',   label: 'Usuário' },
];

const formatDate = (date: Date) =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const AccessManagementView: React.FC = () => {
  const vm = useAccessManagementViewModel();

  if (vm.isUnauthorized) {
    return (
      <S.DeniedPage>
        <S.DeniedIcon><RiLockLine /></S.DeniedIcon>
        <S.DeniedTitle>Acesso Negado</S.DeniedTitle>
        <S.DeniedSubtitle>
          Apenas administradores podem acessar a Gestão de Acessos.
        </S.DeniedSubtitle>
      </S.DeniedPage>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>Gestão de Acessos</S.Title>
        <S.Subtitle>Gerencie as permissões dos usuários cadastrados no sistema</S.Subtitle>
      </S.Header>

      <S.Body>
        <S.Toolbar>
          <CompositeFilter
            defs={vm.filterDefs}
            tokens={vm.filterTokens}
            onChange={vm.setFilterTokens}
            placeholder="Filtrar usuários..."
            screenKey={vm.savedFiltersScreenKey}
          />
          <S.Count>
            {vm.filteredUsers.length} de {vm.totalCount} usuário{vm.totalCount !== 1 ? 's' : ''}
          </S.Count>
        </S.Toolbar>

        {vm.loading ? (
          <S.EmptyState>
            <Spinner size={32} />
          </S.EmptyState>
        ) : vm.error ? (
          <S.EmptyState>
            <S.EmptyText>{vm.error}</S.EmptyText>
          </S.EmptyState>
        ) : vm.filteredUsers.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiShieldUserLine /></S.EmptyIcon>
            <S.EmptyText>
              {vm.searchTerm ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum usuário cadastrado.'}
            </S.EmptyText>
          </S.EmptyState>
        ) : (
          <S.TableCard>
            <S.Table>
              <S.Thead>
                <tr>
                  <S.Th>Usuário</S.Th>
                  <S.Th>E-mail</S.Th>
                  <S.Th>Cadastrado em</S.Th>
                  <S.Th>Perfil Atual</S.Th>
                </tr>
              </S.Thead>
              <S.Tbody>
                {vm.filteredUsers.map((u) => (
                  <S.Tr key={u.id}>
                    <S.Td>
                      <S.UserCell>
                        <S.Avatar>
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName} referrerPolicy="no-referrer" />
                          ) : (
                            u.displayName.charAt(0).toUpperCase()
                          )}
                        </S.Avatar>
                        <S.UserName>{u.displayName}</S.UserName>
                        {vm.savingUserId === u.id && (
                          <S.SavingIndicator>salvando…</S.SavingIndicator>
                        )}
                      </S.UserCell>
                    </S.Td>
                    <S.Td>
                      <S.Email>{u.email}</S.Email>
                    </S.Td>
                    <S.Td>
                      <S.DateText>{formatDate(u.createdAt)}</S.DateText>
                    </S.Td>
                    <S.Td>
                      <RoleCellContent
                        userId={u.id}
                        role={u.role}
                        isSelf={u.id === vm.currentUserId}
                        saving={vm.savingUserId === u.id}
                        onRoleChange={vm.handleRoleChange}
                      />
                    </S.Td>
                  </S.Tr>
                ))}
              </S.Tbody>
            </S.Table>
          </S.TableCard>
        )}
      </S.Body>
    </S.Page>
  );
};

interface RoleCellContentProps {
  userId: string;
  role: UserRole;
  isSelf: boolean;
  saving: boolean;
  onRoleChange: (userId: string, role: UserRole) => Promise<void>;
}

const RoleCellContent: React.FC<RoleCellContentProps> = ({
  userId, role, isSelf, onRoleChange,
}) => {
  const theme = useTheme();

  if (isSelf) {
    return <S.RoleBadge $role={role}>{ROLE_LABELS[role]}</S.RoleBadge>;
  }

  const roleColors: Record<string, string> = {
    SYSTEM: theme.colors.danger,
    USER: theme.colors.textSecondary,
  };

  return (
    <S.RoleSelectWrapper>
      <SearchSelect
        options={ROLE_OPTIONS.map((o) => ({ ...o, color: roleColors[o.value] }))}
        value={role}
        onChange={(v) => { if (v) onRoleChange(userId, v as UserRole); }}
        placeholder="Selecionar perfil"
      />
    </S.RoleSelectWrapper>
  );
};

const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM: 'Sistema',
  USER:   'Usuário',
};
