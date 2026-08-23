import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiLockLine, RiRefreshLine } from 'react-icons/ri';
import { useRolesTabViewModel } from './RolesTab.viewmodel';
import { S } from './RolesTab.styles';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { Spinner } from '../../../components/ui/Spinner';
import { useT } from '../../../shared/i18n/useT';

export const RolesTabView: React.FC = () => {
  const t = useT('core.access');
  const vm = useRolesTabViewModel();

  if (!vm.canManage) {
    return <InfoBanner message={t('role.manage-only')} variant="info" />;
  }

  const isEditing = vm.isCreating || !!vm.selectedRole;

  return (
    <S.Container>
      <S.Toolbar>
        <S.Summary>{t('role.count', { count: String(vm.roles.length) })}</S.Summary>
        <S.RoleActions>
          <Button
            variant="secondary"
            onClick={() => void vm.syncMemberPermissions()}
            disabled={vm.isSyncing}
            title={t('role.sync.hint')}
          >
            <RiRefreshLine size={16} />
            {t(vm.isSyncing ? 'role.sync.running' : 'role.sync')}
          </Button>
          <Button onClick={vm.startCreate} disabled={isEditing}>
            <RiAddLine size={16} />
            {t('role.new')}
          </Button>
        </S.RoleActions>
      </S.Toolbar>

      {vm.isLoading ? (
        <S.EmptyState><Spinner /></S.EmptyState>
      ) : vm.roles.length === 0 && !isEditing ? (
        <S.EmptyState>{t('role.empty')}</S.EmptyState>
      ) : (
        <S.RoleList>
          {vm.roles.map((role) => (
            <S.RoleRow
              key={role.id}
              $active={vm.selectedRole?.id === role.id}
              onClick={() => vm.selectRole(role)}
            >
              <S.RoleInfo>
                <S.RoleName>{role.name}</S.RoleName>
                <S.RoleDescription>
                  {role.description || t('role.permission-count', { count: String(role.permissions.length) })}
                </S.RoleDescription>
              </S.RoleInfo>
              <S.RoleActions>
                {role.system ? (
                  <RiLockLine size={16} title={t('role.system.locked')} />
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      vm.requestDelete(role);
                    }}
                  >
                    <RiDeleteBinLine size={14} />
                  </Button>
                )}
              </S.RoleActions>
            </S.RoleRow>
          ))}
        </S.RoleList>
      )}

      {isEditing && (
        <S.Editor>
          {vm.selectedRole?.system && <InfoBanner message={t('role.system.locked')} variant="info" />}

          <S.Fields>
            <S.Field>
              <Label>{t('role.name')}</Label>
              <Input
                value={vm.draftName}
                onChange={(event) => vm.setDraftName(event.target.value)}
                placeholder={t('role.name.placeholder')}
                disabled={vm.selectedRole?.system}
              />
            </S.Field>
            <S.Field>
              <Label>{t('role.description')}</Label>
              <Input
                value={vm.draftDescription}
                onChange={(event) => vm.setDraftDescription(event.target.value)}
                placeholder={t('role.description.placeholder')}
                disabled={vm.selectedRole?.system}
              />
            </S.Field>
          </S.Fields>

          <S.Groups>
            {vm.groups.map((group) => (
              <S.Group key={group.resource}>
                <S.GroupTitle>{group.name}</S.GroupTitle>
                {group.permissions.map((permission) => (
                  <S.PermissionRow key={permission.id} $implied={permission.implied}>
                    <input
                      type="checkbox"
                      checked={permission.checked}
                      disabled={permission.implied || vm.selectedRole?.system}
                      onChange={() => vm.togglePermission(permission.id)}
                    />
                    <S.PermissionText>
                      <S.PermissionName>{permission.name}</S.PermissionName>
                      {permission.implied && (
                        <S.PermissionHint>
                          {t('role.included-by', { names: permission.impliedBy.join(', ') })}
                        </S.PermissionHint>
                      )}
                      {!permission.implied && permission.checked && permission.includes.length > 0 && (
                        <S.PermissionHint>
                          {t('role.includes', { names: permission.includes.join(', ') })}
                        </S.PermissionHint>
                      )}
                      {!permission.checked && permission.description && (
                        <S.PermissionHint>{permission.description}</S.PermissionHint>
                      )}
                    </S.PermissionText>
                  </S.PermissionRow>
                ))}
              </S.Group>
            ))}
          </S.Groups>

          <S.Footer>
            <S.Summary>
              {t('role.summary', {
                explicit: String(vm.explicitCount),
                effective: String(vm.effectiveCount),
              })}
            </S.Summary>
            <S.RoleActions>
              <Button variant="secondary" onClick={vm.cancelEdit}>
                {t('core.ui/action.cancel')}
              </Button>
              <Button
                onClick={() => void vm.save()}
                disabled={vm.isSaving || vm.selectedRole?.system}
              >
                {t(vm.isSaving ? 'core.ui/action.saving' : 'core.ui/action.save')}
              </Button>
            </S.RoleActions>
          </S.Footer>
        </S.Editor>
      )}

      <ConfirmModal
        isOpen={!!vm.roleToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title={t('role.delete.title')}
        message={t('role.delete.message', { name: vm.roleToDelete?.name ?? '' })}
        confirmLabel={t('core.ui/action.remove')}
        variant="danger"
      />
    </S.Container>
  );
};
