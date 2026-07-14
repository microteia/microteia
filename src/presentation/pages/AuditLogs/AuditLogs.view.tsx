import React from 'react';
import { RiHistoryLine } from 'react-icons/ri';
import { useAuditLogsViewModel } from './AuditLogs.viewmodel';
import { AuditLogCardView } from './AuditLogCard/AuditLogCard.view';
import { S } from './AuditLogs.styles';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { InfoBanner } from '../../components/ui/InfoBanner';

export const AuditLogsView: React.FC = () => {
  const vm = useAuditLogsViewModel();

  if (vm.isUnauthorized) {
    return (
      <S.Restricted>
        <InfoBanner
          message="Somente administradores do escritório podem acessar a Auditoria."
          variant="info"
        />
      </S.Restricted>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          <RiHistoryLine size={22} />
          <S.Title>Auditoria</S.Title>
        </S.TitleRow>
      </S.Header>

      <S.RetentionBar>
        <InfoBanner
          message="Estes registros ficam disponíveis para consulta rápida por 30 dias. Após esse período, os dados só podem ser recuperados mediante requisição técnica, sem garantia de existência."
          variant="info"
        />
      </S.RetentionBar>

      <S.FilterBar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar registros de auditoria..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.FilterBar>

      {vm.error && (
        <S.Restricted>
          <InfoBanner message={vm.error} variant="warning" />
        </S.Restricted>
      )}

      {vm.loading && vm.rows.length === 0 ? (
        <S.LoadingWrapper><Spinner size={32} /></S.LoadingWrapper>
      ) : vm.rows.length === 0 ? (
        <S.Empty>Nenhum registro de auditoria encontrado.</S.Empty>
      ) : (
        <>
          <S.TableHeader>
            <S.TableHeaderChevronSpacer />
            <S.TableHeaderSeveritySpacer />
            <S.TableHeaderTime>Horário</S.TableHeaderTime>
            <span>Resumo</span>
          </S.TableHeader>
          <S.List>
            {vm.rows.map((row) => (
              <AuditLogCardView
                key={row.log.id}
                row={row}
                onToggleExpand={() => vm.toggleExpand(row.log.id)}
                onOpenEntity={vm.openEntity}
              />
            ))}
            {vm.hasMore && (
              <S.LoadMoreWrapper>
                <Button variant="secondary" onClick={vm.loadMore} disabled={vm.loading}>
                  {vm.loading ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </S.LoadMoreWrapper>
            )}
          </S.List>
        </>
      )}
    </S.Page>
  );
};
