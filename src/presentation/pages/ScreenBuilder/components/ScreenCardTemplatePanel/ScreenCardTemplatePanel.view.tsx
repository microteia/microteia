import React from 'react';
import { S } from './ScreenCardTemplatePanel.styles';
import { useScreenCardTemplatePanelViewModel } from './ScreenCardTemplatePanel.viewmodel';
import type { ScreenCardTemplatePanelProps, ScreenCardTemplatePanelViewModel } from './ScreenCardTemplatePanel.viewmodel';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { RadioGroup } from '../../../../components/ui/RadioButton';
import { RecordCardTemplate } from '../../../../components/ui/RecordCardTemplate';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { TemplateSourceEditor } from '../../../../components/ui/TemplateSourceEditor';
import { useT } from '../../../../shared/i18n/useT';

/** A pré-visualização sobre um registro de verdade — o comportamento real, inclusive o que some vazio. */
const Preview: React.FC<{ vm: ScreenCardTemplatePanelViewModel }> = ({ vm }) => {
  const t = useT('core.records');
  return (
    <S.Section data-testid="card-template-preview">
      <S.PreviewHeader>
        <S.SectionTitle>{t('card-template.panel.preview')}</S.SectionTitle>
        {vm.previewRecordOptions.length > 1 && (
          <S.PreviewPicker>
            <SearchSelect
              options={vm.previewRecordOptions}
              value={vm.previewRecordId}
              onChange={vm.setPreviewRecordId}
              placeholder={t('card-template.panel.preview.record')}
            />
          </S.PreviewPicker>
        )}
      </S.PreviewHeader>
      {vm.previewRecord ? (
        <S.Preview>
          <RecordCardTemplate
            body={vm.previewBody}
            record={vm.previewRecord}
            resolvers={vm.previewResolvers}
            screenIcon={vm.screenIcon}
            accentColor={vm.previewAccent}
            onOpen={vm.ignoreOpen}
          />
        </S.Preview>
      ) : (
        <S.Hint>{t('card-template.panel.preview.empty')}</S.Hint>
      )}
    </S.Section>
  );
};

/**
 * A seção "Cartão da listagem" da aba Cartão: o arranjo da lista e, se preciso, o desenho do cartão —
 * no editor Visual/JSON compartilhado com os desenhos do portal, com a pré-visualização sobre um
 * registro de verdade.
 */
export const ScreenCardTemplatePanel: React.FC<ScreenCardTemplatePanelProps> = (props) => {
  const vm = useScreenCardTemplatePanelViewModel(props);
  const t = useT('core.records');
  return (
    <S.Panel>
      <S.Heading>
        <S.Title>{t('card-template.panel.title')}</S.Title>
        <S.Hint>{t('card-template.panel.description')}</S.Hint>
      </S.Heading>
      {vm.fromExtension && <InfoBanner variant="warning" message={t('card-template.panel.from-extension')} />}

      <S.Arrangement>
        <S.Section>
          <S.SectionTitle>{t('card-template.panel.layout')}</S.SectionTitle>
          <RadioGroup name="card-layout" value={vm.form.layout} onChange={vm.setLayout} options={vm.layoutOptions} direction="horizontal" />
        </S.Section>
        {vm.form.layout === 'grid' && (
          <S.Section>
            <S.SectionTitle>{t('card-template.panel.width')}</S.SectionTitle>
            <RadioGroup name="card-width" value={vm.form.minWidth} onChange={vm.setMinWidth} options={vm.widthOptions} direction="horizontal" />
          </S.Section>
        )}
      </S.Arrangement>

      <Checkbox label={t('card-template.panel.custom')} checked={vm.form.custom} onChange={vm.setCustom} />

      {vm.form.custom ? (
        <TemplateSourceEditor
          testId="card-template-editor"
          vocabulary={vm.vocabulary}
          source={vm.form.source}
          onSourceChange={vm.setSource}
          defaultSource={vm.defaultSource}
          resetLabel={t('card-template.panel.reset')}
          jsonHint={t('card-template.panel.custom.hint')}
          issues={vm.designIssues}
          fields={props.fields}
          actionOptions={vm.actionOptions}
          preview={<Preview vm={vm} />}
        />
      ) : (
        <Preview vm={vm} />
      )}
    </S.Panel>
  );
};
