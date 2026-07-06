import React, { useRef } from 'react';
import { RiBookLine } from 'react-icons/ri';
import { S } from './ExpressionEditor.styles';
import { useExpressionEditorViewModel } from './ExpressionEditor.viewmodel';
import type { ExpressionEditorProps } from './ExpressionEditor.viewmodel';
import { FunctionMenu } from './components/FunctionMenu/FunctionMenu.view';
import { FunctionReferenceModal } from './components/FunctionReferenceModal/FunctionReferenceModal.view';

export type { ExpressionEditorProps };

export const ExpressionEditor: React.FC<ExpressionEditorProps> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const vm = useExpressionEditorViewModel(props, textareaRef);

  return (
    <>
      <S.Container>
        <S.EditorWrapper $isValid={vm.isValid}>
          <S.Brace>{'{'}</S.Brace>
          <S.Textarea
            ref={textareaRef}
            value={props.value}
            onChange={vm.handleChange}
            onKeyDown={vm.handleKeyDown}
            placeholder={props.placeholder ?? 'Digite uma expressão...'}
            spellCheck={false}
          />
          <S.Brace>{'}'}</S.Brace>
          <S.StatusIndicator $isValid={vm.isValid} />
        </S.EditorWrapper>

        {vm.validationMessage && (
          <S.ValidationMessage $isError={vm.isValid === false}>
            {vm.validationMessage}
          </S.ValidationMessage>
        )}

        <S.FunctionRefButton onClick={vm.openFunctionRef}>
          <RiBookLine size={14} />
          Ver funções disponíveis
        </S.FunctionRefButton>
      </S.Container>

      <FunctionMenu
        active={vm.autocompleteState.active}
        functions={vm.filteredFunctions}
        highlightedIndex={vm.highlightedIndex}
        position={vm.autocompleteState.position}
        onSelect={vm.selectFunction}
        onHover={vm.onAutocompleteHover}
      />

      <FunctionReferenceModal
        isOpen={vm.functionRefOpen}
        onClose={vm.closeFunctionRef}
      />
    </>
  );
};
