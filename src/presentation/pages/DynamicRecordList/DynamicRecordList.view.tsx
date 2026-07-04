import React from 'react';
import { RiAddLine, RiApps2Line } from 'react-icons/ri';
import { S } from './DynamicRecordList.styles';
import { useDynamicRecordListViewModel } from './DynamicRecordList.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
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
    <S.Page>
      <S.Header>
        <S.TitleRow>
          {getScreenIcon(definition.icon, 22)}
          <S.Title>{definition.titlePlural}</S.Title>
        </S.TitleRow>
        <Button onClick={vm.openNewRecord}>
          <RiAddLine size={16} />
          {`Novo ${definition.titleSingular}`}
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={`Filtrar ${definition.titlePlural.toLowerCase()}...`}
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading && vm.records.length === 0 ? (
          <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
        ) : vm.filteredRecords.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiApps2Line /></S.EmptyIcon>
            <S.EmptyTitle>Nenhum registro encontrado</S.EmptyTitle>
            <Button onClick={vm.openNewRecord} variant="secondary">
              <RiAddLine size={14} />
              {`Cadastrar ${definition.titleSingular.toLowerCase()}`}
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>
            {vm.filteredRecords.map((record) => (
              <S.RecordCard key={record.id} onClick={() => vm.openRecord(record)}>
                <S.RecordHeader>
                  <S.RecordAvatar>{getScreenIcon(definition.icon, 20)}</S.RecordAvatar>
                  <S.RecordTitle>{record.title}</S.RecordTitle>
                </S.RecordHeader>
                {vm.listFields.length > 0 && (
                  <S.RecordMeta>
                    {vm.listFields.map((field) => (
                      <S.MetaRow key={field.key}>
                        <S.MetaLabel>{field.label}:</S.MetaLabel>
                        <S.MetaValue>{vm.displayValue(record, field)}</S.MetaValue>
                      </S.MetaRow>
                    ))}
                  </S.RecordMeta>
                )}
              </S.RecordCard>
            ))}
          </S.Grid>
        )}
      </S.Content>
    </S.Page>
  );
};
