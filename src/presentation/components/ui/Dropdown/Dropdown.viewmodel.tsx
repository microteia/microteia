import { useState, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import { useAnchoredDropdown, type AnchoredDropdownPosition } from '../../../hooks/useAnchoredDropdown';

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

export interface DropdownViewModel {
  isOpen: boolean;
  dropPos: AnchoredDropdownPosition;
  containerRef: React.RefObject<HTMLDivElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  handleToggle: () => void;
  handleItemClick: (onClick: () => void) => void;
}

/**
 * A largura que o gatilho não dá: um botão de menu é estreito, e é o item mais longo que decide o
 * quanto o painel ocupa. Serve às duas pontas — posicionar sem sair da tela, e desenhar.
 */
const MENU_MIN_WIDTH = 200;

export const useDropdownViewModel = ({ align = 'left' }: DropdownProps): DropdownViewModel => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { dropPos, reposition } = useAnchoredDropdown({
    open: isOpen,
    anchorRef: containerRef,
    dropdownRef: menuRef,
    align,
    minWidth: MENU_MIN_WIDTH,
  });

  const handleToggle = useCallback(() => {
    reposition();
    setIsOpen((prev) => !prev);
  }, [reposition]);

  const handleItemClick = useCallback((onClick: () => void) => {
    onClick();
    setIsOpen(false);
  }, []);

  /**
   * O painel mora fora do card — num portal, para que quem rola não o corte —, então "clicar fora"
   * pergunta aos DOIS: sem o menu na conta, o clique num item o fecharia antes de acioná-lo.
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return {
    isOpen,
    dropPos,
    containerRef,
    menuRef,
    handleToggle,
    handleItemClick,
  };
};
