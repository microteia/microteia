import React from 'react';
import { S } from './ReportSubscribe.styles';
import { useReportSubscribeViewModel } from './ReportSubscribe.viewmodel';
import type { ReportSubscribeProps } from './ReportSubscribe.viewmodel';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Checkbox } from '../Checkbox';
import { InfoBanner } from '../InfoBanner';
import { Input } from '../Input';
import { MultiSearchSelect } from '../MultiSearchSelect';
import { SearchSelect } from '../SearchSelect';

/** Assinar um relatório: quando ele roda, para quem vai e, se for o caso, o limite que dispara o aviso. */
export const ReportSubscribe: React.FC<ReportSubscribeProps> = (props) => {
  const vm = useReportSubscribeViewModel(props);

  return (
    <Modal
      title={vm.title}
      onClose={props.onClose}
      size="medium"
      actions={(
        <Button variant="primary" size="sm" onClick={() => { void vm.save(); }} disabled={!vm.canSave} $isLoading={vm.isSaving}>
          {vm.labels.save}
        </Button>
      )}
    >
      <S.Form>
        {vm.filtersNotice && <InfoBanner message={vm.filtersNotice} variant="info" />}
        {vm.error && <InfoBanner message={vm.error} variant="warning" />}

        <S.Field>
          {vm.labels.name}
          <Input value={vm.name} onChange={(event) => vm.setName(event.target.value)} />
        </S.Field>

        <S.Row>
          <S.Field>
            {vm.labels.frequency}
            <SearchSelect options={vm.frequencyOptions} value={vm.frequency} onChange={vm.setFrequency} />
          </S.Field>
          <S.Field>
            {vm.labels.hour}
            <SearchSelect options={vm.hourOptions} value={vm.hour} onChange={vm.setHour} />
          </S.Field>
        </S.Row>

        <S.Field>
          {vm.labels.file}
          <SearchSelect options={vm.fileOptions} value={vm.file} onChange={vm.setFile} />
        </S.Field>

        <S.Field>
          {vm.labels.recipients}
          <MultiSearchSelect options={vm.memberOptions} values={vm.recipients} onChange={vm.setRecipients} />
        </S.Field>

        {vm.canAlert && (
          <Checkbox checked={vm.alertOn} onChange={vm.setAlertOn} label={vm.labels.alert} />
        )}
        {vm.canAlert && vm.alertOn && (
          <S.Alert>
            <S.Row>
              <S.Field>
                {vm.labels.measure}
                <SearchSelect options={vm.measureOptions} value={vm.alertMeasure} onChange={vm.setAlertMeasure} />
              </S.Field>
              <S.Field>
                {vm.labels.op}
                <SearchSelect options={vm.opOptions} value={vm.alertOp} onChange={vm.setAlertOp} />
              </S.Field>
              <S.Field>
                {vm.labels.value}
                <Input inputMode="decimal" value={vm.alertValue} onChange={(event) => vm.setAlertValue(event.target.value)} />
              </S.Field>
            </S.Row>
          </S.Alert>
        )}
      </S.Form>
    </Modal>
  );
};
