import React from 'react';
import { RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { Input } from '../../../../components/ui/Input';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { MappingValueControl } from '../MappingValueControl';
import { S } from './HttpRequestBuilderControl.styles';
import { useHttpRequestBuilderControlViewModel } from './HttpRequestBuilderControl.viewmodel';
import type { HttpFieldList, HttpRequestBuilderControlProps } from './HttpRequestBuilderControl.viewmodel';
import type { InputMapping } from '../../../../../domain/entities/Workflow';

import { useT } from '../../../../shared/i18n/useT';

export const HttpRequestBuilderControl: React.FC<HttpRequestBuilderControlProps> = (props) => {
  const t = useT('core.automation');
  const vm = useHttpRequestBuilderControlViewModel(props.value, props.onChange);

  const mappingControl = (mapping: InputMapping | undefined, onChange: (next: InputMapping) => void) => (
    <MappingValueControl
      mapping={mapping}
      onChange={onChange}
      eventFields={props.eventFields}
      pathRoot={props.pathRoot}
      inputRoot={props.inputRoot}
      stepOutputFields={props.stepOutputFields}
      workflowVariables={props.workflowVariables}
      priorStepOptions={props.priorStepOptions}
      getStepOutputs={props.getStepOutputs}
    />
  );

  const fieldList = (list: HttpFieldList) => (
    <>
      {vm.fields(list).length === 0 && <S.Empty>{t('http.fields.empty')}</S.Empty>}
      {vm.fields(list).map((field, index) => (
        <S.FieldRow key={index}>
          <Input
            value={field.name}
            onChange={(e) => vm.updateField(list, index, { ...field, name: e.target.value })}
            placeholder={t('http.field.name')}
          />
          {mappingControl(field.value, (value) => vm.updateField(list, index, { ...field, value }))}
          <S.RemoveButton onClick={() => vm.removeField(list, index)} title={t('http.field.remove')}>
            <RiDeleteBinLine size={14} />
          </S.RemoveButton>
        </S.FieldRow>
      ))}
      <S.AddButton onClick={() => vm.addField(list)}>
        <RiAddLine size={14} /> {t('http.field.add')}
      </S.AddButton>
    </>
  );

  return (
    <S.Container>
      {vm.hostWarning && <InfoBanner variant="warning" message={vm.hostWarning} />}

      <S.Section>
        <S.SectionTitle>{t('http.url')}</S.SectionTitle>
        <S.RequestLine>
          <SearchSelect
            options={vm.methodOptions}
            value={vm.spec.method}
            onChange={vm.setMethod}
            placeholder={t('http.method')}
          />
          {mappingControl(vm.spec.url, vm.setUrl)}
        </S.RequestLine>
        <S.HelpText>{t('http.url.hint')}</S.HelpText>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('http.path-params')}</S.SectionTitle>
        {fieldList('pathParams')}
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('http.query')}</S.SectionTitle>
        {fieldList('query')}
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('http.headers')}</S.SectionTitle>
        {fieldList('headers')}
      </S.Section>

      {vm.spec.method !== 'GET' && (
        <S.Section>
          <S.SectionTitle>{t('http.body')}</S.SectionTitle>
          <SearchSelect options={vm.bodyKindOptions} value={vm.bodyKind} onChange={vm.setBodyKind} />
          {vm.bodyHasFields && (
            <>
              <S.HelpText>{t('http.body.json.hint')}</S.HelpText>
              {fieldList('bodyFields')}
            </>
          )}
          {vm.bodyKind === 'text' && (
            <Input
              value={vm.bodyContentType}
              onChange={(e) => vm.setBodyContentType(e.target.value)}
              placeholder={t('http.body.content-type')}
            />
          )}
          {vm.bodyValue && mappingControl(vm.bodyValue, vm.setBodyValue)}
        </S.Section>
      )}

      <S.Section>
        <S.SectionTitle>{t('http.response')}</S.SectionTitle>
        <S.OptionsRow>
          <S.Section>
            <S.HelpText>{t('http.response-type')}</S.HelpText>
            <SearchSelect
              options={vm.responseTypeOptions}
              value={vm.spec.responseType ?? 'auto'}
              onChange={vm.setResponseType}
            />
          </S.Section>
          <S.Section>
            <S.HelpText>{t('http.timeout')}</S.HelpText>
            <Input
              type="number"
              value={vm.timeoutText}
              onChange={(e) => vm.setTimeoutText(e.target.value)}
            />
            <S.HelpText>{vm.timeoutHint}</S.HelpText>
          </S.Section>
        </S.OptionsRow>
        <Checkbox
          checked={vm.spec.failOnHttpError !== false}
          onChange={vm.setFailOnHttpError}
          label={t('http.fail-on-error')}
        />
        <S.HelpText>{t('http.fail-on-error.hint')}</S.HelpText>
      </S.Section>

      <S.Section>
        <S.SectionTitle>{t('http.sample')}</S.SectionTitle>
        <S.Sample
          value={vm.spec.responseSample ?? ''}
          onChange={(e) => vm.setResponseSample(e.target.value)}
          spellCheck={false}
        />
        <S.HelpText>{t('http.sample.hint')}</S.HelpText>
      </S.Section>

      {(vm.issues.length > 0 || vm.warnings.length > 0) && (
        <S.Messages>
          {vm.issues.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
          {vm.warnings.map((warning) => <InfoBanner key={warning} variant="info" message={warning} />)}
        </S.Messages>
      )}
    </S.Container>
  );
};
