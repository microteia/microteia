import React from 'react';
import ReactDOM from 'react-dom';
import { useMentionMenuViewModel, type MentionMenuProps } from './MentionMenu.viewmodel';
import { S } from './MentionMenu.styles';

import { useT } from '../../../shared/i18n/useT';

export const MentionMenu: React.FC<MentionMenuProps> = (props) => {
  const t = useT('core.ui');
  const vm = useMentionMenuViewModel(props);

  if (!props.active || !props.position || vm.filteredCommands.length === 0) return null;

  return ReactDOM.createPortal(
    <S.Menu
      style={{ top: props.position.top, left: props.position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <S.Header>{t('mention.menu.header')}</S.Header>
      {vm.filteredCommands.map((cmd, i) => (
        <S.Item
          key={cmd.key}
          $highlighted={i === props.highlightedIndex}
          onMouseEnter={() => props.onHover(i)}
          onClick={() => props.onSelect(cmd.key)}
        >
          <S.IconWrap><cmd.icon size={15} /></S.IconWrap>
          <S.Text>
            <S.Label>{cmd.label}</S.Label>
            <S.Description>{cmd.description}</S.Description>
          </S.Text>
          {/* eslint-disable-next-line no-restricted-syntax -- legenda da TECLA física; não muda com o idioma. */}
          <S.Shortcut>Enter</S.Shortcut>
        </S.Item>
      ))}
    </S.Menu>,
    document.body,
  );
};
