import React from 'react';
import { useTheme } from 'styled-components';
import { RiDeleteBinLine } from 'react-icons/ri';
import { useMembersTabViewModel, TENANT_ROLE_KEYS } from './MembersTab.viewmodel';
import { S } from './MembersTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import type { TenantRole } from '../../../../domain/entities';

import { useT } from '../../../shared/i18n/useT';
const ROLES: TenantRole[] = ['admin', 'lawyer', 'secretary', 'user'];

export const MembersTabView: React.FC = () => {
  const t = useT('core.tenant');
  const vm = useMembersTabViewModel();
  const theme = useTheme();

  const roleColors: Record<TenantRole, string> = {
    admin: theme.colors.danger,
    lawyer: theme.colors.info,
    secretary: theme.colors.primary,
    user: theme.colors.textSecondary,
  };

  const roleOptions: SearchSelectOption[] = ROLES.map((r) => ({
    value: r,
    label: t(TENANT_ROLE_KEYS[r]),
    color: roleColors[r],
  }));

  return (
    <S.Container>
      {!vm.canAddMore && (
        <InfoBanner
          variant="warning"
          message={t('member.limit.notice', { limit: String(vm.memberLimit) })}
        />
      )}

      <S.AddMemberRow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Label>{t('member.new.email')}</Label>
          <Input
            type="email"
            value={vm.addEmail}
            onChange={(e) => vm.setAddEmail(e.target.value)}
            placeholder={t('member.new.email.placeholder')}
            disabled={!vm.canAddMore}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void vm.handleAddMember();
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Label>{t('member.role')}</Label>
          <SearchSelect
            options={roleOptions}
            value={vm.addRole}
            onChange={(val) => {
              if (val) vm.setAddRole(val as TenantRole);
            }}
            placeholder={t('member.role.placeholder')}
            disabled={!vm.canAddMore}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button onClick={() => void vm.handleAddMember()} disabled={vm.isAddingMember || !vm.canAddMore}>
            {t(vm.isAddingMember ? 'core.ui/action.adding' : 'core.ui/action.add')}
          </Button>
        </div>
      </S.AddMemberRow>

      {vm.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
          <Spinner />
        </div>
      ) : (
        <S.MemberList>
          {vm.members.map((member) => {
            const isOwner = member.userId === vm.tenantOwnerId;
            const isCurrentUser = member.userId === vm.currentUserId;
            return (
              <S.MemberRow key={member.userId}>
                <S.Avatar>
                  {member.photoURL ? (
                    <img src={member.photoURL} alt={member.displayName} referrerPolicy="no-referrer" />
                  ) : (
                    member.displayName.charAt(0).toUpperCase()
                  )}
                </S.Avatar>
                <S.MemberInfo>
                  <S.MemberName>
                    {member.displayName}
                    {isCurrentUser && ` ${t('member.you')}`}
                  </S.MemberName>
                  <S.MemberEmail>{member.email}</S.MemberEmail>
                </S.MemberInfo>
                <S.MemberActions>
                  {isOwner || isCurrentUser ? (
                    <Badge color={roleColors[member.role]}>
                      {t(TENANT_ROLE_KEYS[member.role])}
                    </Badge>
                  ) : (
                    <>
                      <SearchSelect
                        options={roleOptions}
                        value={member.role}
                        onChange={(val) => {
                          if (val) void vm.handleRoleChange(member, val as TenantRole);
                        }}
                        placeholder={t('member.role.placeholder')}
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => vm.handleRemoveMember(member)}
                      >
                        <RiDeleteBinLine size={14} />
                      </Button>
                    </>
                  )}
                </S.MemberActions>
              </S.MemberRow>
            );
          })}
        </S.MemberList>
      )}

      <ConfirmModal
        isOpen={!!vm.memberToRemove}
        onConfirm={() => void vm.confirmRemoveMember()}
        onCancel={vm.cancelRemoveMember}
        title={t('member.remove.title')}
        message={t('member.remove.message', { name: vm.memberToRemove?.displayName ?? '' })}
        confirmLabel={t('core.ui/action.remove')}
        variant="danger"
      />
    </S.Container>
  );
};
