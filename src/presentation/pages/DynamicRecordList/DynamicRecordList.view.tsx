import React from 'react';
import { RiApps2Line } from 'react-icons/ri';
import { S } from './DynamicRecordList.styles';
import { useDynamicRecordListViewModel } from './DynamicRecordList.viewmodel';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { EntityListView } from '../../components/layout/EntityListView';
import { getScreenIcon } from '../../shared/screenIcons';

export const DynamicRecordListView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useDynamicRecordListViewModel(tabKey);
  const definition = vm.definition;

  if (!vm.isAvailable || !definition) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Tela personalizada</S.Title>
        </S.Header>
        <S.BannerWrapper>
          {vm.isLoading ? (
            <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
          ) : (
            <InfoBanner
              variant="info"
              message="Esta tela personalizada não está mais disponível. Ela pode ter sido desativada ou excluída pelo administrador."
            />
          )}
        </S.BannerWrapper>
      </S.Page>
    );
  }

  return (
    <EntityListView
      title={definition.titlePlural}
      titleIcon={getScreenIcon(definition.icon, 22)}
      onNew={vm.openNewRecord}
      newTitle={`Novo ${definition.titleSingular}`}
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder={`Filtrar ${definition.titlePlural.toLowerCase()}...`}
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading && vm.records.length === 0}
      isEmpty={vm.filteredRecords.length === 0}
      emptyIcon={<RiApps2Line />}
      emptyTitle="Nenhum registro encontrado"
      emptyActionLabel={`Cadastrar ${definition.titleSingular.toLowerCase()}`}
    >
      {vm.filteredRecords.map((record) => {
        const recordTags = vm.tags.filter((t) => record.tagIds?.includes(t.id));
        return (
          <S.RecordCard key={record.id} onClick={() => vm.openRecord(record)}>
            <S.RecordHeader>
              <S.RecordAvatar>{getScreenIcon(definition.icon, 20)}</S.RecordAvatar>
              <S.RecordTitle>{record.title}</S.RecordTitle>
            </S.RecordHeader>
            <CustomFieldMetaRows items={vm.getCardItems(record)} />
            {recordTags.length > 0 && (
              <S.Tags onClick={(e) => e.stopPropagation()}>
                {recordTags.map((t) => (
                  <S.TagPill key={t.id} $color={t.color}>
                    <S.TagDot $color={t.color} />
                    {t.name}
                  </S.TagPill>
                ))}
              </S.Tags>
            )}
          </S.RecordCard>
        );
      })}
    </EntityListView>
  );
};
