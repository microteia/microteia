import React from 'react';
import { usePortalCreateFormViewModel, type PortalCreateFormProps } from './PortalCreateForm.viewmodel';
import { S } from './PortalCreateForm.styles';
import { Button } from '../../../../components/ui/Button';
import { Input, InputGroup, Label, Textarea } from '../../../../components/ui/Input';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { DateInput } from '../../../../components/ui/DateInput';
import { TimeInput } from '../../../../components/ui/TimeInput';
import { CurrencyInput } from '../../../../components/ui/CurrencyInput';
import { Spinner } from '../../../../components/ui/Spinner';
import { useT } from '../../../../shared/i18n/useT';
import type { PortalFieldInfo } from '../../../../../domain/entities/Portal';

const textOf = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

export const PortalCreateForm: React.FC<PortalCreateFormProps> = (props) => {
  const vm = usePortalCreateFormViewModel(props);
  const t = useT('core.tenant');

  const control = (field: PortalFieldInfo) => {
    const id = `portal-create-${field.key}`;
    const value = vm.values[field.key];
    switch (field.type) {
      case 'textarea':
      case 'markdown':
        return <Textarea id={id} value={textOf(value)} onChange={(event) => vm.setValue(field.key, event.target.value)} />;
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            value={textOf(value)}
            onChange={(event) => vm.setValue(field.key, event.target.value === '' ? null : Number(event.target.value))}
          />
        );
      case 'currency':
        return <CurrencyInput id={id} value={typeof value === 'number' ? value : null} onChange={(next) => vm.setValue(field.key, next)} />;
      case 'date':
        return <DateInput id={id} value={textOf(value)} onChange={(next) => vm.setValue(field.key, next)} />;
      case 'time':
        return <TimeInput id={id} value={textOf(value)} onChange={(next) => vm.setValue(field.key, next)} />;
      case 'select':
        return (
          <SearchSelect
            options={vm.selectOptions(field)}
            value={textOf(value)}
            onChange={(next) => vm.setValue(field.key, next)}
          />
        );
      case 'checkbox':
        return <Checkbox checked={value === true} onChange={(next) => vm.setValue(field.key, next)} label={field.label} />;
      default:
        return <Input id={id} value={textOf(value)} onChange={(event) => vm.setValue(field.key, event.target.value)} />;
    }
  };

  return (
    <S.Form onSubmit={(event) => { event.preventDefault(); void vm.submit(); }}>
      <S.Title>
        {vm.isEditing
          ? t('portal.edit.title', { screen: props.screen.titleSingular })
          : t('portal.create.title', { screen: props.screen.titleSingular })}
      </S.Title>

      {vm.linkLoading ? (
        <Spinner size={20} />
      ) : vm.noLinkOptions ? (
        <S.Muted>{t('portal.create.no-link', { link: vm.linkLabel })}</S.Muted>
      ) : vm.showLinkSelect && (
        <InputGroup>
          <Label>{vm.linkLabel}</Label>
          <SearchSelect
            options={vm.linkOptions}
            value={vm.linkRecordId}
            onChange={vm.setLinkRecordId}
            placeholder={t('portal.create.link.placeholder')}
          />
        </InputGroup>
      )}

      <S.Grid>
        {vm.fields.map((field) => (field.type === 'checkbox' ? (
          <S.Wide key={field.key}>{control(field)}</S.Wide>
        ) : (
          <InputGroup key={field.key} $fullWidth={field.type === 'textarea' || field.type === 'markdown'}>
            <Label htmlFor={`portal-create-${field.key}`}>
              {field.required ? t('portal.create.required', { label: field.label }) : field.label}
            </Label>
            {control(field)}
          </InputGroup>
        )))}
      </S.Grid>

      {vm.error && <S.Error>{vm.error}</S.Error>}

      <S.Actions>
        <Button type="button" variant="ghost" onClick={props.onCancel} disabled={vm.submitting}>
          {t('portal.create.cancel')}
        </Button>
        {vm.isEditing ? (
          <Button type="submit" disabled={vm.submitting || vm.missingRequired}>
            {vm.submitting ? t('portal.edit.saving') : t('portal.edit.save')}
          </Button>
        ) : (
          <Button type="submit" disabled={vm.submitting || !vm.linkRecordId || vm.missingRequired}>
            {vm.submitting ? t('portal.create.sending') : t('portal.create.send')}
          </Button>
        )}
      </S.Actions>
    </S.Form>
  );
};
