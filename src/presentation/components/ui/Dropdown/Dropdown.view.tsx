import React from 'react';
import ReactDOM from 'react-dom';
import { S } from './Dropdown.styles';
import { useDropdownViewModel, type DropdownProps } from './Dropdown.viewmodel';

/* eslint-disable react-hooks/refs -- o ViewModel expõe refs só para passar ao DOM; nada lê .current no render */
export const Dropdown: React.FC<DropdownProps> = (props) => {
  const vm = useDropdownViewModel(props);

  return (
    <S.Container ref={vm.containerRef}>
      <S.Trigger onClick={vm.handleToggle}>
        {props.trigger}
      </S.Trigger>
      {vm.isOpen && ReactDOM.createPortal(
        <S.Menu
          ref={vm.menuRef}
          $top={vm.dropPos.top}
          $bottom={vm.dropPos.bottom}
          $left={vm.dropPos.left}
          $minWidth={vm.dropPos.minWidth}
          $maxHeight={vm.dropPos.maxHeight}
        >
          {props.items.map((item) => (
            <S.MenuItem
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => vm.handleItemClick(item.onClick)}
              $variant={item.variant}
            >
              {item.icon && <S.MenuItemIcon>{item.icon}</S.MenuItemIcon>}
              <S.MenuItemLabel>{item.label}</S.MenuItemLabel>
            </S.MenuItem>
          ))}
        </S.Menu>,
        document.body,
      )}
    </S.Container>
  );
};
/* eslint-enable react-hooks/refs */
