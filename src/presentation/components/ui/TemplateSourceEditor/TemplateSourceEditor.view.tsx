import React from 'react';
import { RiArrowGoBackLine, RiArrowGoForwardLine } from 'react-icons/ri';
import { S } from './TemplateSourceEditor.styles';
import { useTemplateSourceEditorViewModel } from './TemplateSourceEditor.viewmodel';
import type { TemplateSourceEditorProps } from './TemplateSourceEditor.viewmodel';
import { Button } from '../Button';
import { CodeEditor } from '../CodeEditor';
import { InfoBanner } from '../InfoBanner';
import { TemplateDesigner } from '../TemplateDesigner';
import { useT } from '../../../shared/i18n/useT';

/** O par Visual/JSON de um template declarativo: modo, desfazer, "começar do padrão" e o editor da vez. */
export const TemplateSourceEditor: React.FC<TemplateSourceEditorProps> = (props) => {
  const vm = useTemplateSourceEditorViewModel(props);
  const t = useT('core.records');
  return (
    <S.Editor data-testid={props.testId}>
      <S.Toolbar>
        <S.ModeSwitch role="tablist" aria-label={t('template-designer.mode')}>
          <S.ModeButton type="button" role="tab" aria-selected={vm.mode === 'visual'} $active={vm.mode === 'visual'} onClick={() => vm.setMode('visual')}>
            {t('template-designer.mode.visual')}
          </S.ModeButton>
          <S.ModeButton type="button" role="tab" aria-selected={vm.mode === 'json'} $active={vm.mode === 'json'} onClick={() => vm.setMode('json')}>
            {t('template-designer.mode.json')}
          </S.ModeButton>
        </S.ModeSwitch>
        {!props.readOnly && (
          <S.ToolbarActions>
            {vm.mode === 'visual' && (
              <>
                <S.IconButton type="button" title={t('template-designer.undo')} disabled={!vm.canUndo} onClick={vm.undo}>
                  <RiArrowGoBackLine size={16} />
                </S.IconButton>
                <S.IconButton type="button" title={t('template-designer.redo')} disabled={!vm.canRedo} onClick={vm.redo}>
                  <RiArrowGoForwardLine size={16} />
                </S.IconButton>
              </>
            )}
            <Button variant="secondary" size="sm" onClick={vm.reset}>{props.resetLabel}</Button>
          </S.ToolbarActions>
        )}
      </S.Toolbar>

      {vm.mode === 'visual' && vm.design && (
        <TemplateDesigner
          vocabulary={props.vocabulary}
          design={vm.design}
          onChange={vm.setDesign}
          issues={props.issues}
          fields={props.fields}
          actionOptions={props.actionOptions}
          onUndo={vm.undo}
          onRedo={vm.redo}
          preview={props.preview}
          readOnly={props.readOnly}
        />
      )}
      {vm.mode === 'visual' && vm.visualLocked && (
        <S.Section>
          <InfoBanner variant="warning" message={vm.visualLocked} />
          <S.Actions>
            <Button variant="secondary" size="sm" onClick={() => vm.setMode('json')}>{t('template-designer.open-json')}</Button>
          </S.Actions>
        </S.Section>
      )}
      {vm.mode === 'json' && (
        <>
          <S.Hint>{props.jsonHint}</S.Hint>
          <CodeEditor language="json" value={props.source} onChange={vm.setSource} minHeight={props.jsonMinHeight ?? '320px'} />
          {vm.issueTexts.map((issue) => <InfoBanner key={issue} variant="warning" message={issue} />)}
          {props.preview}
        </>
      )}
    </S.Editor>
  );
};
