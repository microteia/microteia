import React from 'react';
import { RiAddLine, RiBuilding2Line } from 'react-icons/ri';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input, InputGroup, Label, ErrorMessage } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { useOfficesTabViewModel } from './OfficesTab.viewmodel';
import { CompositeFilter } from '../../../components/ui/CompositeFilter';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import type { TenantPlan } from '../../../../domain/entities';
import { S } from './OfficesTab.styles';

import { useT, useLocaleFormat } from '../../../shared/i18n/useT';

export const OfficesTabView: React.FC = () => {
  const t = useT('core.admin');
  const { formatDate } = useLocaleFormat();
  const vm = useOfficesTabViewModel();

  return (
    <S.Body>
      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={t('access.offices.filter.placeholder')}
          screenKey={vm.savedFiltersScreenKey}
        />
        <S.Count>
          {t('access.offices.count', { shown: vm.filteredTenants.length, count: vm.totalCount })}
        </S.Count>
        <Button type="button" size="sm" onClick={vm.openCreate}>
          <RiAddLine /> {t('access.offices.create')}
        </Button>
      </S.Toolbar>

      {vm.createOpen && (
        <Modal title={t('access.offices.create.title')} onClose={vm.closeCreate}>
          <S.CreateForm>
            <S.CreateHint>{t('access.offices.create.hint')}</S.CreateHint>
            <InputGroup>
              <Label htmlFor="new-office-name">{t('access.offices.create.name')}</Label>
              <Input id="new-office-name" value={vm.createName} onChange={(event) => vm.setCreateName(event.target.value)} />
            </InputGroup>
            <InputGroup>
              <Label htmlFor="new-office-owner">{t('access.offices.create.owner')}</Label>
              <Input
                id="new-office-owner"
                type="email"
                value={vm.createOwnerEmail}
                onChange={(event) => vm.setCreateOwnerEmail(event.target.value)}
              />
            </InputGroup>
            {vm.createError && <ErrorMessage role="alert">{vm.createError}</ErrorMessage>}
            <S.CreateActions>
              <Button type="button" variant="ghost" onClick={vm.closeCreate}>{t('access.offices.create.cancel')}</Button>
              <Button type="button" onClick={vm.submitCreate} disabled={!vm.canCreate}>{t('access.offices.create.confirm')}</Button>
            </S.CreateActions>
          </S.CreateForm>
        </Modal>
      )}

      {vm.loading ? (
        <S.EmptyState>
          <Spinner size={32} />
        </S.EmptyState>
      ) : vm.error ? (
        <S.EmptyState>
          <S.EmptyText>{vm.error}</S.EmptyText>
        </S.EmptyState>
      ) : vm.filteredTenants.length === 0 ? (
        <S.EmptyState>
          <S.EmptyIcon><RiBuilding2Line /></S.EmptyIcon>
          <S.EmptyText>
            {t(vm.searchTerm ? 'access.offices.none-found' : 'access.offices.empty')}
          </S.EmptyText>
        </S.EmptyState>
      ) : (
        <S.TableCard>
          <S.Table>
            <S.Thead>
              <tr>
                <S.Th>{t('access.column.office')}</S.Th>
                <S.Th>{t('access.column.created-at')}</S.Th>
                <S.Th>{t('access.column.plan')}</S.Th>
                <S.Th>{t('access.column.members')}</S.Th>
                <S.Th>{t('access.column.member-limit')}</S.Th>
              </tr>
            </S.Thead>
            <S.Tbody>
              {vm.filteredTenants.map((tenant) => (
                <S.Tr key={tenant.id}>
                  <S.Td>
                    <S.OfficeName>{tenant.name}</S.OfficeName>
                  </S.Td>
                  <S.Td>
                    <S.DateText>{formatDate(tenant.createdAt)}</S.DateText>
                  </S.Td>
                  <S.Td>
                    <S.PlanCell>
                      <SearchSelect
                        options={vm.planOptions}
                        value={vm.planDrafts[tenant.id] ?? tenant.plan}
                        onChange={(val) => {
                          if (val) void vm.handlePlanChange(tenant.id, val as TenantPlan);
                        }}
                        placeholder={t('access.plan.placeholder')}
                      />
                    </S.PlanCell>
                  </S.Td>
                  <S.Td>
                    <S.MemberCount>{tenant.memberCount}</S.MemberCount>
                  </S.Td>
                  <S.Td>
                    <S.LimitCell>
                      <S.LimitInput
                        type="number"
                        min={0}
                        step={1}
                        value={vm.memberLimitDrafts[tenant.id] ?? ''}
                        placeholder={t('access.member-limit.placeholder')}
                        onChange={(e) => vm.handleMemberLimitDraftChange(tenant.id, e.target.value)}
                        onBlur={() => void vm.handleMemberLimitCommit(tenant.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                      {vm.savingTenantId === tenant.id ? (
                        <S.SavingIndicator>{t('access.saving')}</S.SavingIndicator>
                      ) : (
                        <S.LimitHint>
                          {t(vm.memberLimitDrafts[tenant.id]
                            ? 'access.member-limit.members'
                            : 'access.member-limit.unlimited')}
                        </S.LimitHint>
                      )}
                    </S.LimitCell>
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
