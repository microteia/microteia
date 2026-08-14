import React, { useRef } from 'react';
import { RiBookLine } from 'react-icons/ri';
import { S } from './ExpressionEditor.styles';
import { useExpressionEditorViewModel } from './ExpressionEditor.viewmodel';
import type { ExpressionEditorProps } from './ExpressionEditor.viewmodel';
import { FunctionMenu } from './components/FunctionMenu/FunctionMenu.view';

import { useT } from '../../../shared/i18n/useT';
export type { ExpressionEditorProps };

export const ExpressionEditor: React.FC<ExpressionEditorProps> = (props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useT('core.ui');
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
            placeholder={props.placeholder ?? t('expression.placeholder')}
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
          {t('expression.see-functions')}
        </S.FunctionRefButton>
      </S.Container>

      <FunctionMenu
        active={vm.autocompleteState.active}
        items={vm.autocompleteItems}
        highlightedIndex={vm.highlightedIndex}
        position={vm.autocompleteState.position}
        onSelect={vm.selectItem}
        onHover={vm.onAutocompleteHover}
      />
    </>
  );
};
