import React from 'react';
import { RiBuilding2Line } from 'react-icons/ri';
import { Spinner } from '../../../components/ui/Spinner';
import { useOfficesTabViewModel } from './OfficesTab.viewmodel';
import { CompositeFilter } from '../../../components/ui/CompositeFilter';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import type { TenantPlan } from '../../../../domain/entities';
import { S } from './OfficesTab.styles';

const formatDate = (date: Date) =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const OfficesTabView: React.FC = () => {
  const vm = useOfficesTabViewModel();

  return (
    <S.Body>
      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar escritórios..."
          screenKey={vm.savedFiltersScreenKey}
        />
        <S.Count>
          {vm.filteredTenants.length} de {vm.totalCount} escritório{vm.totalCount !== 1 ? 's' : ''}
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
      ) : vm.filteredTenants.length === 0 ? (
        <S.EmptyState>
          <S.EmptyIcon><RiBuilding2Line /></S.EmptyIcon>
          <S.EmptyText>
            {vm.searchTerm ? 'Nenhum escritório encontrado para esta busca.' : 'Nenhum escritório cadastrado.'}
          </S.EmptyText>
        </S.EmptyState>
      ) : (
        <S.TableCard>
          <S.Table>
            <S.Thead>
              <tr>
                <S.Th>Escritório</S.Th>
                <S.Th>Criado em</S.Th>
                <S.Th>Plano</S.Th>
                <S.Th>Membros atuais</S.Th>
                <S.Th>Limite de membros</S.Th>
              </tr>
            </S.Thead>
            <S.Tbody>
              {vm.filteredTenants.map((t) => (
                <S.Tr key={t.id}>
                  <S.Td>
                    <S.OfficeName>{t.name}</S.OfficeName>
                  </S.Td>
                  <S.Td>
                    <S.DateText>{formatDate(t.createdAt)}</S.DateText>
                  </S.Td>
                  <S.Td>
                    <S.PlanCell>
                      <SearchSelect
                        options={vm.planOptions}
                        value={vm.planDrafts[t.id] ?? t.plan}
                        onChange={(val) => {
                          if (val) void vm.handlePlanChange(t.id, val as TenantPlan);
                        }}
                        placeholder="Plano..."
                      />
                    </S.PlanCell>
                  </S.Td>
                  <S.Td>
                    <S.MemberCount>{t.memberCount}</S.MemberCount>
                  </S.Td>
                  <S.Td>
                    <S.LimitCell>
                      <S.LimitInput
                        type="number"
                        min={0}
                        step={1}
                        value={vm.memberLimitDrafts[t.id] ?? ''}
                        placeholder="Sem limite"
                        onChange={(e) => vm.handleMemberLimitDraftChange(t.id, e.target.value)}
                        onBlur={() => void vm.handleMemberLimitCommit(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                      {vm.savingTenantId === t.id ? (
                        <S.SavingIndicator>salvando…</S.SavingIndicator>
                      ) : (
                        <S.LimitHint>{vm.memberLimitDrafts[t.id] ? 'membros' : 'ilimitado'}</S.LimitHint>
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
