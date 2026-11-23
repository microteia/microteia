import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiShieldKeyholeLine, RiStackLine } from 'react-icons/ri';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { Input, InputGroup, Label } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { PermissionPicker } from '../../../components/ui/PermissionPicker';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { Spinner } from '../../../components/ui/Spinner';
import { usePlansTabViewModel } from './PlansTab.viewmodel';
import { S } from './PlansTab.styles';
import { useT } from '../../../shared/i18n/useT';

export const PlansTabView: React.FC = () => {
  const t = useT('core.admin');
  const vm = usePlansTabViewModel();

  if (vm.loading) {
    return <S.EmptyState><Spinner size={32} /></S.EmptyState>;
  }
  if (vm.error) {
    return <S.EmptyState><S.EmptyText>{vm.error}</S.EmptyText></S.EmptyState>;
  }

  return (
    <S.Body>
      <S.DefaultCard>
        <S.DefaultText>
          <S.DefaultTitle>{t('access.plans.default.label')}</S.DefaultTitle>
          <S.Hint>{t('access.plans.default.hint')}</S.Hint>
        </S.DefaultText>
        <S.DefaultSelect>
          <SearchSelect
            options={vm.defaultPlanOptions}
            value={vm.defaultPlanValue}
            onChange={(value) => { if (value) void vm.setDefaultPlan(value); }}
            placeholder={t('access.plan.placeholder')}
          />
        </S.DefaultSelect>
      </S.DefaultCard>

      <S.Toolbar>
        <S.Hint>{t('access.plans.hint')}</S.Hint>
        <Button type="button" size="sm" onClick={vm.openCreate}>
          <RiAddLine /> {t('access.plans.new')}
        </Button>
      </S.Toolbar>

      {vm.rows.length === 0 ? (
        <S.EmptyState>
          <S.EmptyIcon><RiStackLine /></S.EmptyIcon>
          <S.EmptyText>{t('access.plans.empty')}</S.EmptyText>
        </S.EmptyState>
      ) : (
        <S.TableCard>
          <S.Table>
            <S.Thead>
              <tr>
                <S.Th>{t('access.plans.column.name')}</S.Th>
                <S.Th>{t('access.plans.column.member-limit')}</S.Th>
                <S.Th>{t('access.plans.column.organizations')}</S.Th>
                <S.Th>{t('access.plans.column.permissions')}</S.Th>
                <S.Th>{t('access.plans.column.archived')}</S.Th>
                <S.Th />
              </tr>
            </S.Thead>
            <S.Tbody>
              {vm.rows.map((row) => (
                <S.Tr key={row.id} $archived={row.archived}>
                  <S.Td>
                    <S.NameCell>
                      <S.NameInput
                        value={vm.nameDrafts[row.id] ?? ''}
                        onChange={(event) => vm.setNameDraft(row.id, event.target.value)}
                        onBlur={() => void vm.commitName(row.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                      />
                      {row.isDefault && <S.DefaultBadge>{t('access.plans.default.badge')}</S.DefaultBadge>}
                    </S.NameCell>
                  </S.Td>
                  <S.Td>
                    <S.LimitCell>
                      <S.LimitInput
                        type="number"
                        min={1}
                        step={1}
                        value={vm.limitDrafts[row.id] ?? ''}
                        placeholder={t('access.member-limit.placeholder')}
                        onChange={(event) => vm.setLimitDraft(row.id, event.target.value)}
                        onBlur={() => void vm.commitLimit(row.id)}
                        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                      />
                      {vm.savingPlanId === row.id ? (
                        <S.Saving>{t('access.saving')}</S.Saving>
                      ) : (
                        <S.Hint>
                          {t(vm.limitDrafts[row.id] ? 'access.member-limit.members' : 'access.member-limit.unlimited')}
                        </S.Hint>
                      )}
                    </S.LimitCell>
                  </S.Td>
                  <S.Td>{row.tenantCount}</S.Td>
                  <S.Td>
                    <Button type="button" variant="secondary" size="sm" onClick={() => vm.openPermissions(row.id)}>
                      <RiShieldKeyholeLine />
                      {row.deniedCount === 0
                        ? t('access.plans.permissions.all')
                        : t('access.plans.permissions.count', { count: String(row.deniedCount) })}
                    </Button>
                  </S.Td>
                  <S.Td>
                    <Checkbox
                      checked={row.archived}
                      onChange={(checked) => void vm.setArchived(row.id, checked)}
                      label={t('access.plans.archived')}
                    />
                  </S.Td>
                  <S.Td>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => vm.requestDelete(row.id)}
                      title={t('access.plans.delete')}
                    >
                      <RiDeleteBinLine />
                    </Button>
                  </S.Td>
                </S.Tr>
              ))}
            </S.Tbody>
          </S.Table>
        </S.TableCard>
      )}

      {vm.createOpen && (
        <Modal title={t('access.plans.create.title')} onClose={vm.closeCreate}>
          <S.Form>
            <S.Hint>{t('access.plans.create.hint')}</S.Hint>
            <InputGroup>
              <Label htmlFor="new-plan-name">{t('access.plans.create.name')}</Label>
              <Input
                id="new-plan-name"
                value={vm.createName}
                onChange={(event) => vm.setCreateName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void vm.submitCreate(); }}
              />
            </InputGroup>
            <S.Actions>
              <Button type="button" variant="ghost" onClick={vm.closeCreate}>{t('access.offices.create.cancel')}</Button>
              <Button
                type="button"
                onClick={() => void vm.submitCreate()}
                disabled={vm.creating || vm.createName.trim() === ''}
              >
                {t('access.plans.create.confirm')}
              </Button>
            </S.Actions>
          </S.Form>
        </Modal>
      )}

      {vm.editing && (
        <Modal
          title={t('access.plans.permissions.title', { name: vm.editing.name })}
          onClose={vm.closePermissions}
          size="large"
        >
          <S.Form>
            <InfoBanner message={t('access.plans.permissions.hint')} variant="info" />
            {vm.essentialDenied.length > 0 && (
              <InfoBanner
                message={t('access.plans.permissions.essential', { names: vm.essentialDenied.join(', ') })}
                variant="warning"
              />
            )}
            <S.Hint>{t('access.plans.permissions.scope')}</S.Hint>
            <PermissionPicker
              selected={vm.allowedPermissions}
              onChange={vm.setAllowedPermissions}
              restrictTo={vm.restrictTo}
            />
            <S.Actions>
              <Button type="button" variant="ghost" onClick={vm.closePermissions}>{t('access.offices.create.cancel')}</Button>
              <Button type="button" onClick={() => void vm.savePermissions()} disabled={vm.savingPermissions}>
                {t('access.plans.permissions.save')}
              </Button>
            </S.Actions>
          </S.Form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!vm.planToDelete}
        title={t('access.plans.delete')}
        message={t('access.plans.delete.message', { name: vm.planToDelete?.name ?? '' })}
        confirmLabel={t('access.plans.delete.confirm')}
        cancelLabel={t('access.offices.create.cancel')}
        variant="danger"
        onConfirm={vm.confirmDelete}
        onCancel={vm.cancelDelete}
      />
    </S.Body>
  );
};
