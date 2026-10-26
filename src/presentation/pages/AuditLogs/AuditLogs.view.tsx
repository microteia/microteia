import React from 'react';
import { RiHistoryLine } from 'react-icons/ri';
import { useAuditLogsViewModel } from './AuditLogs.viewmodel';
import { AuditLogCardView } from './AuditLogCard/AuditLogCard.view';
import { S } from './AuditLogs.styles';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { AuditRetentionPanelView } from './AuditRetentionPanel/AuditRetentionPanel.view';

import { useT } from '../../shared/i18n/useT';
export const AuditLogsView: React.FC = () => {
  const t = useT('core.admin');
  const vm = useAuditLogsViewModel();

  if (vm.isUnauthorized) {
    return (
      <S.Restricted>
        <InfoBanner
          message={t('audit.admin-only')}
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
          <S.Title>{t('page.audit-logs')}</S.Title>
        </S.TitleRow>
        <Button variant={vm.showRetention ? 'primary' : 'secondary'} size="sm" onClick={vm.toggleRetention}>
          {vm.showRetention ? t('audit.tab.trail') : t('audit.tab.retention')}
        </Button>
      </S.Header>

      {vm.showRetention ? (
        vm.retentionStatus ? (
          <AuditRetentionPanelView
            status={vm.retentionStatus}
            onStatusChange={vm.setRetentionStatus}
            onOpenEntity={vm.openEntity}
          />
        ) : vm.retentionStatusError ? (
          <S.Restricted><InfoBanner message={vm.retentionStatusError} variant="warning" /></S.Restricted>
        ) : (
          <S.LoadingWrapper><Spinner size={32} /></S.LoadingWrapper>
        )
      ) : (
      <>
      {vm.retentionMessage && (
        <S.RetentionBar>
          <InfoBanner
            message={vm.retentionMessage}
            variant="info"
          />
        </S.RetentionBar>
      )}

      <S.FilterBar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={t('audit.filter.placeholder')}
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
        <S.Empty>{t('audit.empty')}</S.Empty>
      ) : (
        <>
          <S.TableHeader>
            <S.TableHeaderChevronSpacer />
            <S.TableHeaderSeveritySpacer />
            <S.TableHeaderTime>{t('audit.column.time')}</S.TableHeaderTime>
            <span>{t('audit.column.summary')}</span>
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
                  {vm.loading ? t('audit.loading') : t('audit.load-more')}
                </Button>
              </S.LoadMoreWrapper>
            )}
          </S.List>
        </>
      )}
      </>
      )}
    </S.Page>
  );
};
