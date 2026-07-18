import React from 'react';
import { RiFolderLine } from 'react-icons/ri';
import { S } from './Cases.styles';
import { useCasesViewModel } from './Cases.viewmodel';
import { Badge } from '../../components/ui/Badge';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { EntityListCard } from '../../components/ui/EntityListCard';
import { EntityListView } from '../../components/layout/EntityListView';
import { getScreenIcon } from '../../shared/screenIcons';
import { useCaseTagStore } from '../../../stores/useCaseTagStore';
import { useListRowResolver } from '../../shared/listRows';
import { CASE_LIST_ROWS } from './caseListSchema';

export const CasesView: React.FC = () => {
  const vm = useCasesViewModel();
  const { tags } = useCaseTagStore();
  const resolveRow = useListRowResolver();

  return (
    <EntityListView
      title="Processos"
      titleIcon={<RiFolderLine size={22} />}
      onNew={vm.openNewCase}
      newTitle="Novo Processo"
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder="Filtrar processos..."
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading}
      isEmpty={vm.filteredCases.length === 0}
      emptyIcon={<RiFolderLine />}
      emptyTitle="Nenhum processo encontrado"
      emptyActionLabel="Cadastrar primeiro processo"
    >
      {vm.filteredCases.map((c) => {
        const caseTags = tags.filter((t) => c.tagIds?.includes(t.id));
        const days = vm.getDaysInTramitation(c);
        const activeNames = vm.getPartyNames(c.activePoleIds ?? []);
        const passiveNames = vm.getPartyNames(c.passivePoleIds ?? []);
        const hasPoles = activeNames.length > 0 || passiveNames.length > 0;
        const customItems = vm.getCustomFieldItems(c);

        // Exclusivo do Processo: chip de dias em trâmite, badges de status/fase e os polos.
        const belowHeader = (
          <>
            <S.Badges>
              <Badge color={vm.getStatusColor(c.status)}>{c.status}</Badge>
              <Badge color={vm.getPhaseColor(c.phase)}>{c.phase}</Badge>
            </S.Badges>

            {hasPoles && (
              <S.PartesRow>
                <S.PoleColumn $side="left">
                  <S.PoleLabel>Polo Ativo</S.PoleLabel>
                  {activeNames.length > 0
                    ? activeNames.map((n) => <S.PoleName key={n}>{n}</S.PoleName>)
                    : <S.PoleEmpty>—</S.PoleEmpty>}
                </S.PoleColumn>
                <S.PoleColumn $side="right">
                  <S.PoleLabel>Polo Passivo</S.PoleLabel>
                  {passiveNames.length > 0
                    ? passiveNames.map((n) => <S.PoleName key={n}>{n}</S.PoleName>)
                    : <S.PoleEmpty>—</S.PoleEmpty>}
                </S.PoleColumn>
              </S.PartesRow>
            )}
          </>
        );

        // Todas as linhas vêm do registry (`ui.list`) — inclusive o responsável, que é uma relação
        // e tem o ID resolvido para o nome pelo mesmo caminho dos campos `reference` do formulário.
        const record = c as unknown as Record<string, unknown>;
        const metaRows = CASE_LIST_ROWS
          .map((row) => ({
            key: row.key,
            icon: getScreenIcon(row.icon, 12),
            value: resolveRow(record, row),
          }))
          .filter((row) => row.value !== '');

        return (
          <EntityListCard
            key={c.id}
            onClick={() => vm.openCase(c)}
            avatar={<RiFolderLine size={22} />}
            title={c.title}
            subtitle={c.caseNumber ? (
              <S.CaseNumberRow>
                <S.CaseNumber>{c.caseNumber}</S.CaseNumber>
                {days !== null && <S.DaysChip>{days} dias</S.DaysChip>}
              </S.CaseNumberRow>
            ) : undefined}
            belowHeader={belowHeader}
            metaRows={metaRows}
            tags={caseTags}
            extra={customItems.length > 0 ? <CustomFieldMetaRows items={customItems} /> : undefined}
          />
        );
      })}
    </EntityListView>
  );
};
