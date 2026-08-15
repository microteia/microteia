import React from 'react';
import { useTheme } from 'styled-components';
import { RiShieldUserLine } from 'react-icons/ri';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';
import { Spinner } from '../../../components/ui/Spinner';
import { useUsersTabViewModel } from './UsersTab.viewmodel';
import { CompositeFilter } from '../../../components/ui/CompositeFilter';
import { S } from './UsersTab.styles';
import type { UserRole } from '../../../../domain/entities';

import { useT, type TranslateFn } from '../../../shared/i18n/useT';
const ROLE_KEYS: Record<UserRole, string> = {
  SYSTEM: 'access.role.system',
  SUPPORT: 'access.role.support',
  USER: 'access.role.user',
};

const roleOptions = (t: TranslateFn): SearchSelectOption[] =>
  (Object.keys(ROLE_KEYS) as UserRole[]).map((role) => ({ value: role, label: t(ROLE_KEYS[role]) }));

const formatDate = (date: Date) =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const UsersTabView: React.FC = () => {
  const t = useT('core.admin');
  const vm = useUsersTabViewModel();

  return (
    <S.Body>
      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={t('access.users.filter.placeholder')}
          screenKey={vm.savedFiltersScreenKey}
        />
        <S.Count>
          {t('access.users.count', { shown: vm.filteredUsers.length, count: vm.totalCount })}
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
            {t(vm.searchTerm ? 'access.users.none-found' : 'access.users.empty')}
          </S.EmptyText>
        </S.EmptyState>
      ) : (
        <S.TableCard>
          <S.Table>
            <S.Thead>
              <tr>
                <S.Th>{t('access.column.user')}</S.Th>
                <S.Th>{t('core.ui/field.email')}</S.Th>
                <S.Th>{t('access.column.registered-at')}</S.Th>
                <S.Th>{t('access.column.role')}</S.Th>
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
                        <S.SavingIndicator>{t('access.saving')}</S.SavingIndicator>
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
  const t = useT('core.admin');
  const theme = useTheme();

  if (isSelf) {
    return <S.RoleBadge $role={role}>{t(ROLE_KEYS[role])}</S.RoleBadge>;
  }

  const roleColors: Record<string, string> = {
    SYSTEM: theme.colors.danger,
    SUPPORT: theme.colors.warning,
    USER: theme.colors.textSecondary,
  };

  return (
    <S.RoleSelectWrapper>
      <SearchSelect
        options={roleOptions(t).map((option) => ({ ...option, color: roleColors[option.value] }))}
        value={role}
        onChange={(v) => { if (v) onRoleChange(userId, v as UserRole); }}
        placeholder={t('access.role.placeholder')}
      />
    </S.RoleSelectWrapper>
  );
};


