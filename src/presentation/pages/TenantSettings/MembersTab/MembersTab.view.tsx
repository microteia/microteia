import React from 'react';
import { useTheme } from 'styled-components';
import { RiDeleteBinLine } from 'react-icons/ri';
import { useMembersTabViewModel } from './MembersTab.viewmodel';
import { S } from './MembersTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { MultiSearchSelect } from '../../../components/ui/MultiSearchSelect';
import type { MultiSearchSelectOption } from '../../../components/ui/MultiSearchSelect';
import { InfoBanner } from '../../../components/ui/InfoBanner';

import { useT, useLabel } from '../../../shared/i18n/useT';

export const MembersTabView: React.FC = () => {
  const t = useT('core.tenant');
  const label = useLabel();
  const vm = useMembersTabViewModel();
  const theme = useTheme();

  // O nome do perfil é DADO do escritório: passa por `useLabel` só para haver um caminho de rótulo,
  // e volta intacto quando não é referência.
  const roleOptions: MultiSearchSelectOption[] = vm.roles.map((role) => ({
    value: role.id,
    label: label(role.name),
    color: theme.colors.primary,
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
          <Label>{t('member.roles')}</Label>
          <MultiSearchSelect
            options={roleOptions}
            values={vm.addRoleIds}
            onChange={vm.setAddRoleIds}
            placeholder={t('member.roles.placeholder')}
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
                  {isOwner ? (
                    <Badge color={theme.colors.danger}>{t('member.owner')}</Badge>
                  ) : isCurrentUser ? (
                    <Badge color={theme.colors.textSecondary}>
                      {vm.memberRoleNames(member).join(', ') || t('member.roles.none')}
                    </Badge>
                  ) : (
                    <>
                      <MultiSearchSelect
                        options={roleOptions}
                        values={member.roleIds}
                        onChange={(roleIds) => void vm.handleRolesChange(member, roleIds)}
                        placeholder={t('member.roles.placeholder')}
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
