import React from 'react';
import { useAuditRetentionPanelViewModel } from './AuditRetentionPanel.viewmodel';
import type { AuditRetentionPanelProps } from './AuditRetentionPanel.viewmodel';
import { S } from './AuditRetentionPanel.styles';
import { AuditLogCardView } from '../AuditLogCard/AuditLogCard.view';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CopyButton } from '../../../components/ui/CopyButton';
import { DateInput } from '../../../components/ui/DateInput';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { useT } from '../../../shared/i18n/useT';

export const AuditRetentionPanelView: React.FC<AuditRetentionPanelProps> = (props) => {
  const t = useT('core.admin');
  const vm = useAuditRetentionPanelViewModel(props);

  return (
    <S.Panel>
      <S.Section>
        <S.SectionTitle>{t('audit.retention.title')}</S.SectionTitle>
        <S.Description>{t('audit.retention.description')}</S.Description>
        {!vm.canManage && <InfoBanner message={t('audit.retention.read-only')} variant="info" />}

        <S.Fields>
          <S.Field>
            {t('audit.retention.days.label')}
            <Input
              type="number"
              min={vm.minDays}
              max={vm.maxDays}
              value={vm.days}
              onChange={(event) => vm.setDays(event.target.value)}
              disabled={!vm.canManage || vm.saving}
              $hasError={vm.daysInvalid}
            />
            <S.Hint $error={vm.daysInvalid}>{t('audit.retention.days.hint', { min: String(vm.minDays), max: String(vm.maxDays) })}</S.Hint>
          </S.Field>
        </S.Fields>

        <S.SectionTitle>{t('audit.archive.title')}</S.SectionTitle>
        <S.Description>{t('audit.archive.description')}</S.Description>
        {!vm.archiveAvailable && <InfoBanner message={t('audit.archive.unavailable')} variant="warning" />}

        <Checkbox
          checked={vm.archive}
          onChange={vm.setArchive}
          label={t('audit.archive.enabled.label')}
          disabled={!vm.canManage || vm.saving || (!vm.archiveAvailable && !vm.archive)}
        />
        {vm.archive && (
          <S.Fields>
            <S.Field>
              {t('audit.archive.years.label')}
              <Input
                type="number"
                min={1}
                max={vm.maxYears}
                value={vm.years}
                onChange={(event) => vm.setYears(event.target.value)}
                disabled={!vm.canManage || vm.saving}
                $hasError={vm.yearsInvalid}
              />
              <S.Hint $error={vm.yearsInvalid}>{t('audit.archive.years.hint', { max: String(vm.maxYears) })}</S.Hint>
            </S.Field>
          </S.Fields>
        )}
        {vm.turningOff && <InfoBanner message={t('audit.archive.turning-off')} variant="warning" />}

        {vm.canManage && (
          <S.Actions>
            <Button onClick={vm.save} disabled={!vm.dirty || vm.saving || vm.daysInvalid || vm.yearsInvalid}>
              {vm.saving ? t('audit.retention.saving') : t('audit.retention.save')}
            </Button>
          </S.Actions>
        )}
      </S.Section>

      {vm.showArchiveStatus && (
        <S.Section>
          <S.SectionTitle>{t('audit.archive.status.title')}</S.SectionTitle>
          {vm.protection && (
            <InfoBanner message={vm.protectionMessage} variant={vm.protection === 'none' || vm.protection === 'unknown' ? 'warning' : 'info'} />
          )}
          {vm.failureMessage && <InfoBanner message={vm.failureMessage} variant="warning" />}

          <S.Facts>
            <S.FactLabel>{t('audit.archive.started')}</S.FactLabel>
            <S.FactValue>{vm.startDay ?? t('audit.archive.none-yet')}</S.FactValue>
            <S.FactLabel>{t('audit.archive.through')}</S.FactLabel>
            <S.FactValue>{vm.lastDay ?? t('audit.archive.none-yet')}</S.FactValue>
            {vm.headHash && (
              <>
                <S.FactLabel>{t('audit.archive.head')}</S.FactLabel>
                <S.FactValue>
                  <S.HashRow>
                    <S.Hash>{vm.headHash}</S.Hash>
                    <CopyButton text={vm.headHash} />
                  </S.HashRow>
                </S.FactValue>
              </>
            )}
          </S.Facts>
          {vm.headHash && <S.Description>{t('audit.archive.head.hint')}</S.Description>}
          <S.Description>{t('audit.archive.utc')}</S.Description>

          <S.Actions>
            <Button variant="secondary" onClick={vm.verify} disabled={vm.verifying || !vm.archiveAvailable}>
              {vm.verifying ? t('audit.archive.verifying', { count: String(vm.verifyProgress) }) : t('audit.archive.verify')}
            </Button>
            {vm.verifying && <Spinner size={18} />}
          </S.Actions>
          {vm.verificationMessage && (
            <InfoBanner message={vm.verificationMessage} variant={vm.verification?.divergence ? 'warning' : 'info'} />
          )}
          {vm.verificationDetails.map((detail) => <S.Detail key={detail}>{detail}</S.Detail>)}
        </S.Section>
      )}

      {vm.showArchiveStatus && vm.archiveAvailable && (
        <S.Section>
          <S.SectionTitle>{t('audit.archive.browse.title')}</S.SectionTitle>
          <S.DayPicker>
            <S.Field>
              {t('audit.archive.browse.day')}
              <DateInput value={vm.browseDay} onChange={vm.setBrowseDay} />
            </S.Field>
            <Button variant="secondary" onClick={vm.openDay} disabled={!vm.browseDay || vm.dayLoading}>
              {t('audit.archive.browse.open')}
            </Button>
          </S.DayPicker>

          {vm.dayLoading && !vm.dayPage && <Spinner size={24} />}
          {vm.dayPage && !vm.dayPage.exported && <InfoBanner message={t('audit.archive.browse.not-exported')} variant="info" />}
          {vm.dayPage?.header && !vm.dayPage.header.complete && (
            <InfoBanner message={t('audit.archive.browse.incomplete')} variant="warning" />
          )}
          {vm.daySummary && <S.Hash>{vm.daySummary}</S.Hash>}
          {vm.dayRows.length > 0 && (
            <S.Lines>
              {vm.dayRows.map((row) => (
                <AuditLogCardView key={row.log.id} row={row} onToggleExpand={() => vm.toggleLine(row.log.id)} onOpenEntity={vm.openEntity} />
              ))}
            </S.Lines>
          )}
          {vm.hasMoreLines && (
            <S.Actions>
              <Button variant="secondary" onClick={vm.loadMoreLines} disabled={vm.dayLoading}>{t('audit.load-more')}</Button>
            </S.Actions>
          )}
        </S.Section>
      )}
    </S.Panel>
  );
};
