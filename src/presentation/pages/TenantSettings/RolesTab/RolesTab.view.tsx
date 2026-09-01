import React from 'react';
import { RiAddLine, RiCloseLine, RiDeleteBinLine, RiEdit2Line, RiLockLine, RiShieldUserLine } from 'react-icons/ri';
import { useRolesTabViewModel } from './RolesTab.viewmodel';
import { S } from './RolesTab.styles';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { Input, Label } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { useT } from '../../../shared/i18n/useT';

const CHIP_LIMIT = 3;

export const RolesTabView: React.FC = () => {
  const t = useT('core.access');
  const vm = useRolesTabViewModel();

  if (!vm.canManage) {
    return <InfoBanner message={t('role.manage-only')} variant="info" />;
  }

  return (
    <S.Container>
      <S.Toolbar>
        <S.SearchWrapper>
          <Input
            value={vm.query}
            onChange={(event) => vm.setQuery(event.target.value)}
            placeholder={t('role.search.placeholder')}
          />
        </S.SearchWrapper>
        <S.RoleActions>
          <Button variant="secondary" onClick={vm.openRoles}>
            <RiShieldUserLine size={16} />
            {t('role.count', { count: String(vm.roles.length) })}
          </Button>
        </S.RoleActions>
      </S.Toolbar>

      {vm.roles.length === 0 && <InfoBanner message={t('role.empty')} variant="info" />}

      <S.Body>
        <S.Groups>
          {vm.isLoading ? (
            <S.EmptyState><Spinner /></S.EmptyState>
          ) : vm.noMatches ? (
            <S.EmptyState>{t('role.search.none')}</S.EmptyState>
          ) : vm.groups.map((group) => (
            <S.Group key={group.resource}>
              <S.GroupTitle>{group.name}</S.GroupTitle>
              {group.permissions.map((permission) => (
                <S.PermissionRow
                  key={permission.id}
                  $active={vm.selected?.id === permission.id}
                  onClick={() => vm.selectPermission(permission.id)}
                >
                  <S.PermissionText>
                    <S.PermissionName>{permission.name}</S.PermissionName>
                    <S.PermissionId>{permission.id}</S.PermissionId>
                  </S.PermissionText>
                  <S.Chips>
                    {permission.grantedBy.length === 0 && <S.NoChip>{t('role.granted.none')}</S.NoChip>}
                    {permission.grantedBy.slice(0, CHIP_LIMIT).map((name) => (
                      <S.Chip key={name}>{name}</S.Chip>
                    ))}
                    {permission.grantedBy.length > CHIP_LIMIT && (
                      <S.NoChip>{t('role.granted.more', { count: String(permission.grantedBy.length - CHIP_LIMIT) })}</S.NoChip>
                    )}
                  </S.Chips>
                </S.PermissionRow>
              ))}
            </S.Group>
          ))}
        </S.Groups>

        {vm.selected && (
          <S.Panel>
            <S.PanelHeader>
              <S.PanelTitleGroup>
                <S.PanelTitle>{vm.selected.name}</S.PanelTitle>
                <S.PermissionId>{vm.selected.id}</S.PermissionId>
              </S.PanelTitleGroup>
              <Button variant="ghost" size="sm" onClick={vm.closePanel} title={t('core.ui/action.close')}>
                <RiCloseLine size={16} />
              </Button>
            </S.PanelHeader>

            {vm.selected.description && <S.PermissionHint>{vm.selected.description}</S.PermissionHint>}
            {vm.selected.includes.length > 0 && (
              <S.PermissionHint>
                {t('role.includes', { names: vm.selected.includes.join(', ') })}
              </S.PermissionHint>
            )}

            <S.GroupTitle>{t('role.panel.roles')}</S.GroupTitle>
            {vm.roles.length === 0 ? (
              <S.PermissionHint>{t('role.empty')}</S.PermissionHint>
            ) : vm.selected.roles.map((binding) => (
              <S.BindingRow key={binding.roleId} $locked={binding.locked}>
                <Checkbox
                  checked={binding.granted}
                  disabled={binding.locked || vm.pendingBinding !== null}
                  onChange={() => void vm.toggleRole(vm.selected!.id, binding.roleId)}
                  label={binding.roleName}
                />
                {binding.impliedBy.length > 0 && (
                  <S.PermissionHint>
                    {t('role.included-by', { names: binding.impliedBy.join(', ') })}
                  </S.PermissionHint>
                )}
              </S.BindingRow>
            ))}
          </S.Panel>
        )}
      </S.Body>

      {vm.isRolesOpen && (
      <Modal onClose={vm.closeRoles} title={t('role.panel.manage')}>
        <S.Container>
          <S.Toolbar>
            <S.Summary>{t('role.count', { count: String(vm.roles.length) })}</S.Summary>
            <Button onClick={vm.startCreateRole}>
              <RiAddLine size={16} />
              {t('role.new')}
            </Button>
          </S.Toolbar>
          <S.RoleList>
            {vm.roles.map((role) => (
              <S.RoleRow key={role.id}>
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
                    <>
                      <Button variant="ghost" size="sm" onClick={() => vm.startEditRole(role)}>
                        <RiEdit2Line size={14} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => vm.requestDeleteRole(role)}>
                        <RiDeleteBinLine size={14} />
                      </Button>
                    </>
                  )}
                </S.RoleActions>
              </S.RoleRow>
            ))}
          </S.RoleList>
        </S.Container>
      </Modal>
      )}

      {vm.roleModal && (
      <Modal onClose={vm.cancelRoleModal} title={t(vm.roleModal.role ? 'role.edit' : 'role.new')}>
        <S.Container>
          <S.Field>
            <Label>{t('role.name')}</Label>
            <Input
              value={vm.roleDraft.name}
              onChange={(event) => vm.setRoleDraft({ name: event.target.value })}
              placeholder={t('role.name.placeholder')}
            />
          </S.Field>
          <S.Field>
            <Label>{t('role.description')}</Label>
            <Input
              value={vm.roleDraft.description}
              onChange={(event) => vm.setRoleDraft({ description: event.target.value })}
              placeholder={t('role.description.placeholder')}
            />
          </S.Field>
          <S.PermissionHint>{t('role.permissions.hint')}</S.PermissionHint>
          <S.Footer>
            <Button variant="secondary" onClick={vm.cancelRoleModal}>{t('core.ui/action.cancel')}</Button>
            <Button onClick={() => void vm.saveRole()} disabled={vm.isSavingRole}>
              {t(vm.isSavingRole ? 'core.ui/action.saving' : 'core.ui/action.save')}
            </Button>
          </S.Footer>
        </S.Container>
      </Modal>
      )}

      <ConfirmModal
        isOpen={!!vm.roleToDelete}
        onConfirm={() => void vm.confirmDeleteRole()}
        onCancel={vm.cancelDeleteRole}
        title={t('role.delete.title')}
        message={t('role.delete.message', { name: vm.roleToDelete?.name ?? '' })}
        confirmLabel={t('core.ui/action.remove')}
        variant="danger"
      />
    </S.Container>
  );
};
