import React from 'react';
import { RiSearchLine } from 'react-icons/ri';
import { useCommandPaletteViewModel } from './CommandPalette.viewmodel';
import { S } from './CommandPalette.styles';

import { useT } from '../../../shared/i18n/useT';
export const CommandPalette: React.FC = () => {
  const vm = useCommandPaletteViewModel();
  const t = useT('core.ui');

  /* eslint-disable react-hooks/refs -- vm ViewModel exposes ref only for DOM passing; no ref.current is read during render */
  return (
    <S.Overlay onClick={vm.handleClose}>
      <S.Dialog onClick={(e) => e.stopPropagation()} onKeyDown={vm.handleKeyDown}>
        <S.InputRow>
          <S.SearchIcon>
            <RiSearchLine size={18} />
          </S.SearchIcon>
          <S.Input
            ref={vm.inputRef}
            value={vm.query}
            onChange={(e) => vm.handleQueryChange(e.target.value)}
            placeholder={t('command.search.placeholder')}
          />
          <S.KbdHint>Esc</S.KbdHint>
        </S.InputRow>

        <S.Results>
          {vm.groups.length === 0 ? (
            <S.Empty>Nenhum resultado encontrado.</S.Empty>
          ) : (
            vm.groups.map((group) => (
              <div key={group.name}>
                <S.GroupHeader>{group.name}</S.GroupHeader>
                {group.items.map((item) => (
                  <S.Item
                    key={item.id}
                    $selected={item.id === vm.selectedId}
                    onClick={() => vm.handleSelect(item)}
                    onMouseEnter={() => {}}
                  >
                    {item.icon && <S.ItemIcon>{item.icon}</S.ItemIcon>}
                    <S.ItemText>
                      <S.ItemTitle>{item.title}</S.ItemTitle>
                      {item.subtitle && <S.ItemSubtitle>{item.subtitle}</S.ItemSubtitle>}
                    </S.ItemText>
                  </S.Item>
                ))}
              </div>
            ))
          )}
        </S.Results>

        <S.Footer>
          <S.FooterKey>↑↓</S.FooterKey>
          <span>navegar</span>
          <S.FooterKey>↵</S.FooterKey>
          <span>abrir</span>
          <S.FooterKey>Esc</S.FooterKey>
          <span>fechar</span>
        </S.Footer>
      </S.Dialog>
    </S.Overlay>
  );
  /* eslint-enable react-hooks/refs */
};
