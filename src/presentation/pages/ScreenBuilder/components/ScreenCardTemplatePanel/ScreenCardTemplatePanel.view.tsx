import React from 'react';
import { RiArrowGoBackLine, RiArrowGoForwardLine } from 'react-icons/ri';
import { S } from './ScreenCardTemplatePanel.styles';
import { useScreenCardTemplatePanelViewModel } from './ScreenCardTemplatePanel.viewmodel';
import type { ScreenCardTemplatePanelProps, ScreenCardTemplatePanelViewModel } from './ScreenCardTemplatePanel.viewmodel';
import { Button } from '../../../../components/ui/Button';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { CodeEditor } from '../../../../components/ui/CodeEditor';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { RadioGroup } from '../../../../components/ui/RadioButton';
import { RecordCardTemplate } from '../../../../components/ui/RecordCardTemplate';
import { SearchSelect } from '../../../../components/ui/SearchSelect';
import { TemplateDesigner } from '../../../../components/ui/TemplateDesigner';
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
 * no designer visual (o padrão) ou no JSON, que editam o mesmo texto gravado.
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
        <S.Editor>
          <S.Toolbar>
            <S.ModeSwitch role="tablist" aria-label={t('card-template.panel.mode')}>
              <S.ModeButton type="button" role="tab" aria-selected={vm.mode === 'visual'} $active={vm.mode === 'visual'} onClick={() => vm.setMode('visual')}>
                {t('card-template.panel.mode.visual')}
              </S.ModeButton>
              <S.ModeButton type="button" role="tab" aria-selected={vm.mode === 'json'} $active={vm.mode === 'json'} onClick={() => vm.setMode('json')}>
                {t('card-template.panel.mode.json')}
              </S.ModeButton>
            </S.ModeSwitch>
            <S.ToolbarActions>
              {vm.mode === 'visual' && (
                <>
                  <S.IconButton type="button" title={t('card-template.panel.undo')} disabled={!vm.canUndo} onClick={vm.undo}>
                    <RiArrowGoBackLine size={16} />
                  </S.IconButton>
                  <S.IconButton type="button" title={t('card-template.panel.redo')} disabled={!vm.canRedo} onClick={vm.redo}>
                    <RiArrowGoForwardLine size={16} />
                  </S.IconButton>
                </>
              )}
              <Button variant="secondary" size="sm" onClick={vm.resetToDefault}>
                {t('card-template.panel.reset')}
              </Button>
            </S.ToolbarActions>
          </S.Toolbar>

          {vm.mode === 'visual' && vm.design && (
            <TemplateDesigner
              vocabulary={vm.vocabulary}
              design={vm.design}
              onChange={vm.setDesign}
              issues={vm.designIssues}
              fields={props.fields}
              actionOptions={vm.actionOptions}
              onUndo={vm.undo}
              onRedo={vm.redo}
              preview={<Preview vm={vm} />}
            />
          )}
          {vm.mode === 'visual' && vm.visualLocked && (
            <S.Section>
              <InfoBanner variant="warning" message={t('card-template.panel.visual-locked', { problem: vm.visualLocked })} />
              <S.Actions>
                <Button variant="secondary" size="sm" onClick={() => vm.setMode('json')}>{t('card-template.panel.open-json')}</Button>
              </S.Actions>
            </S.Section>
          )}
          {vm.mode === 'json' && (
            <>
              <S.Hint>{t('card-template.panel.custom.hint')}</S.Hint>
              <CodeEditor language="json" value={vm.form.source} onChange={vm.setSource} minHeight="320px" />
              {vm.issues.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
              <Preview vm={vm} />
            </>
          )}
        </S.Editor>
      ) : (
        <Preview vm={vm} />
      )}
    </S.Panel>
  );
};
