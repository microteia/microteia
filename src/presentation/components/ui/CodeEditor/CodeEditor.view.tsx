import React from 'react';
import Editor from '@monaco-editor/react';
import { RiMagicLine } from 'react-icons/ri';
import { S } from './CodeEditor.styles';
import { useCodeEditorViewModel, type CodeEditorProps } from './CodeEditor.viewmodel';
import '../../../../infrastructure/monaco/setupMonaco';

export const CodeEditor: React.FC<CodeEditorProps> = (props) => {
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
          Formatar ao digitar
        </S.Toggle>
        <S.FormatBtn type="button" onClick={vm.handleFormat}>
          <RiMagicLine size={14} />
          Formatar
        </S.FormatBtn>
      </S.Toolbar>
      <S.EditorArea $minHeight={vm.minHeight}>
        <Editor
          height="100%"
          language="typescript"
          path={vm.modelPath}
          value={vm.value}
          onChange={vm.handleChange}
          onMount={vm.handleMount}
          options={vm.editorOptions}
          loading={<S.Loading>Carregando editor…</S.Loading>}
        />
      </S.EditorArea>
    </S.Wrapper>
  );
};
