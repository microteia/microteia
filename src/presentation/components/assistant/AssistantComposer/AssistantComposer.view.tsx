import React from 'react';
import { RiSendPlane2Fill, RiStopFill } from 'react-icons/ri';
import { useAssistantComposerViewModel, type AssistantComposerProps } from './AssistantComposer.viewmodel';
import { S } from './AssistantComposer.styles';

/** O campo da pergunta: Enter envia, Shift+Enter quebra a linha, `/` abre os comandos. */
export const AssistantComposer: React.FC<AssistantComposerProps> = (props) => {
  const { attachTextarea, ...vm } = useAssistantComposerViewModel(props);

  return (
    <S.Wrapper>
      {vm.suggestions.length > 0 && (
        <S.Suggestions role="listbox">
          {vm.suggestions.map((command) => (
            <S.Suggestion key={command.name} role="option" aria-selected={false} onMouseDown={(event) => { event.preventDefault(); vm.pick(command.name); }}>
              <S.CommandName>/{command.name}</S.CommandName>
              <S.CommandDescription>{command.description}</S.CommandDescription>
            </S.Suggestion>
          ))}
        </S.Suggestions>
      )}
      <S.Box>
        <S.Input
          ref={attachTextarea}
          rows={1}
          value={vm.text}
          placeholder={props.placeholder}
          onChange={vm.change}
          onKeyDown={vm.keyDown}
          aria-label={props.placeholder}
        />
        {props.busy ? (
          <S.Action $stop onClick={props.onStop} title={props.stopLabel} aria-label={props.stopLabel}>
            <RiStopFill size={16} />
          </S.Action>
        ) : (
          <S.Action $stop={false} onClick={vm.submit} disabled={!vm.canSend} title={props.sendLabel} aria-label={props.sendLabel}>
            <RiSendPlane2Fill size={16} />
          </S.Action>
        )}
      </S.Box>
    </S.Wrapper>
  );
};
