import React, { useState, useRef, useCallback, useEffect } from 'react';
import { S } from './Dropdown.styles';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleItemClick = useCallback((onClick: () => void) => {
    onClick();
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <S.Container ref={containerRef}>
      <S.Trigger onClick={handleToggle}>
        {trigger}
      </S.Trigger>
      {isOpen && (
        <S.Menu $align={align}>
          {items.map((item) => (
            <S.MenuItem
              key={item.id}
              onClick={() => handleItemClick(item.onClick)}
              $variant={item.variant}
            >
              {item.icon && <S.MenuItemIcon>{item.icon}</S.MenuItemIcon>}
              <S.MenuItemLabel>{item.label}</S.MenuItemLabel>
            </S.MenuItem>
          ))}
        </S.Menu>
      )}
    </S.Container>
  );
};
