import React from 'react';
import { S } from './ScreenCardTemplatePanel.styles';
import { useScreenCardTemplatePanelViewModel } from './ScreenCardTemplatePanel.viewmodel';
import type { ScreenCardTemplatePanelProps } from './ScreenCardTemplatePanel.viewmodel';
import { Button } from '../../../../components/ui/Button';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { CodeEditor } from '../../../../components/ui/CodeEditor';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { RadioGroup } from '../../../../components/ui/RadioButton';
import { RecordCardTemplate } from '../../../../components/ui/RecordCardTemplate';
import { useT } from '../../../../shared/i18n/useT';

/** A aba "Cartão" da tela: o arranjo da listagem e, se preciso, o desenho do cartão em JSON. */
export const ScreenCardTemplatePanel: React.FC<ScreenCardTemplatePanelProps> = (props) => {
  const vm = useScreenCardTemplatePanelViewModel(props);
  const t = useT('core.records');
  return (
    <S.Panel>
      <InfoBanner variant="info" message={t('card-template.panel.description')} />
      {vm.fromExtension && <InfoBanner variant="warning" message={t('card-template.panel.from-extension')} />}

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

      <Checkbox label={t('card-template.panel.custom')} checked={vm.form.custom} onChange={vm.setCustom} />

      {vm.form.custom && (
        <S.Section>
          <S.EditorHeader>
            <S.Hint>{t('card-template.panel.custom.hint')}</S.Hint>
            <Button variant="secondary" size="sm" onClick={vm.resetToDefault}>
              {t('card-template.panel.reset')}
            </Button>
          </S.EditorHeader>
          <CodeEditor language="json" value={vm.form.source} onChange={vm.setSource} minHeight="320px" />
          {vm.issues.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
        </S.Section>
      )}

      <S.Section>
        <S.SectionTitle>{t('card-template.panel.preview')}</S.SectionTitle>
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
    </S.Panel>
  );
};
