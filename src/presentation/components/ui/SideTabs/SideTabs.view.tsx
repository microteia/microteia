import React from 'react';
import { S } from './SideTabs.styles';
import { getScreenIcon } from '../../../shared/screenIcons';

export interface SideTabItem {
  key: string;
  /** Já traduzido. */
  label: string;
  /** Do conjunto curado de ícones de tela. */
  icon?: string;
}

export interface SideTabsProps {
  items: SideTabItem[];
  active: string;
  onChange: (key: string) => void;
  children: React.ReactNode;
}

/**
 * Abas VERTICAIS dentro de uma aba — para quando uma configuração tem partes que não cabem juntas
 * sem virar uma parede de campos. No celular, a lista vira uma faixa rolável no topo.
 */
export const SideTabs: React.FC<SideTabsProps> = ({ items, active, onChange, children }) => (
  <S.Layout>
    <S.Nav role="tablist" aria-orientation="vertical">
      {items.map((item) => (
        <S.Item
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === active}
          $active={item.key === active}
          onClick={() => onChange(item.key)}
        >
          {item.icon && <S.ItemIcon>{getScreenIcon(item.icon, 16)}</S.ItemIcon>}
          {item.label}
        </S.Item>
      ))}
    </S.Nav>
    <S.Content role="tabpanel">{children}</S.Content>
  </S.Layout>
);
