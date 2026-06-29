import React from 'react';
import { useTheme } from 'styled-components';
import { RiDeleteBinLine } from 'react-icons/ri';
import { useMembersTabViewModel, TENANT_ROLE_LABELS } from './MembersTab.viewmodel';
import { S } from './MembersTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';
import type { TenantRole } from '../../../../domain/entities';

const ROLES: TenantRole[] = ['admin', 'lawyer', 'secretary', 'user'];

export const MembersTabView: React.FC = () => {
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
    label: TENANT_ROLE_LABELS[r],
    color: roleColors[r],
  }));

  return (
    <S.Container>
      <S.AddMemberRow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Label>E-mail do novo membro</Label>
          <Input
            type="email"
            value={vm.addEmail}
            onChange={(e) => vm.setAddEmail(e.target.value)}
            placeholder="email@usuario.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void vm.handleAddMember();
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Label>Perfil</Label>
          <SearchSelect
            options={roleOptions}
            value={vm.addRole}
            onChange={(val) => {
              if (val) vm.setAddRole(val as TenantRole);
            }}
            placeholder="Perfil..."
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button onClick={() => void vm.handleAddMember()} disabled={vm.isAddingMember}>
            {vm.isAddingMember ? 'Adicionando...' : 'Adicionar'}
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
                    {isCurrentUser && ' (você)'}
                  </S.MemberName>
                  <S.MemberEmail>{member.email}</S.MemberEmail>
                </S.MemberInfo>
                <S.MemberActions>
                  {isOwner || isCurrentUser ? (
                    <Badge color={roleColors[member.role]}>
                      {TENANT_ROLE_LABELS[member.role]}
                    </Badge>
                  ) : (
                    <>
                      <SearchSelect
                        options={roleOptions}
                        value={member.role}
                        onChange={(val) => {
                          if (val) void vm.handleRoleChange(member, val as TenantRole);
                        }}
                        placeholder="Perfil..."
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
        title="Remover Membro"
        message={`Tem certeza que deseja remover "${vm.memberToRemove?.displayName}" do escritório?`}
        confirmLabel="Remover"
        variant="danger"
      />
    </S.Container>
  );
};
