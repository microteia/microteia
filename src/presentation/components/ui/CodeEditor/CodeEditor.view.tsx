import React from 'react';
import Editor from '@monaco-editor/react';
import { RiMagicLine } from 'react-icons/ri';
import { S } from './CodeEditor.styles';
import { useCodeEditorViewModel, type CodeEditorProps } from './CodeEditor.viewmodel';
import '../../../../infrastructure/monaco/setupMonaco';

import { useT } from '../../../shared/i18n/useT';

export const CodeEditor: React.FC<CodeEditorProps> = (props) => {
  const t = useT('core.ui');
  const vm = useCodeEditorViewModel(props);

  return (
    <S.Wrapper>
      <S.Toolbar>
        <S.Toggle>
          <S.HiddenCheckbox
            type="checkbox"
            checked={vm.autoFormat}
            onChange={vm.toggleAutoFormat}
          />
          <S.Switch $on={vm.autoFormat} />
          {t('code-editor.auto-format')}
        </S.Toggle>
        <S.FormatBtn type="button" onClick={vm.handleFormat}>
          <RiMagicLine size={14} />
          {t('code-editor.format')}
        </S.FormatBtn>
      </S.Toolbar>
      <S.EditorArea $minHeight={vm.minHeight}>
        <Editor
          height="100%"
          language={vm.language}
          path={vm.modelPath}
          value={vm.value}
          onChange={vm.handleChange}
          onMount={vm.handleMount}
          options={vm.editorOptions}
          loading={<S.Loading>{t('code-editor.loading')}</S.Loading>}
        />
      </S.EditorArea>
    </S.Wrapper>
  );
};
