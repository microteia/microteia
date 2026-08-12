import { useState, useRef, useCallback, useEffect } from 'react';

export type DropdownPlacement = 'top' | 'bottom';

export interface AnchoredDropdownPosition {
  top: number | null;
  bottom: number | null;
  left: number;
  minWidth: number;
  maxHeight: number;
  placement: DropdownPlacement;
}

interface UseAnchoredDropdownParams {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  dropdownRef: React.RefObject<HTMLElement | null>;
  desiredMaxHeight?: number;
  /**
   * A borda pela qual o painel se alinha ao gatilho. `'left'` (padrão) serve ao campo, que tem a
   * largura do painel; `'right'` serve ao gatilho ESTREITO — um botão de menu —, cujo painel é mais
   * largo que ele e cresceria para fora da tela se abrisse pela esquerda.
   */
  align?: 'left' | 'right';
  /** Largura mínima do painel, quando ela não vem do gatilho. */
  minWidth?: number;
}

interface UseAnchoredDropdownResult {
  dropPos: AnchoredDropdownPosition;
  reposition: () => void;
}

const GAP = 6;
const VIEWPORT_MARGIN = 12;
const MIN_HEIGHT = 120;
const DEFAULT_MAX_HEIGHT = 320;

const initialPosition: AnchoredDropdownPosition = {
  top: 0,
  bottom: null,
  left: 0,
  minWidth: 0,
  maxHeight: DEFAULT_MAX_HEIGHT,
  placement: 'bottom',
};

export const useAnchoredDropdown = ({
  open,
  anchorRef,
  dropdownRef,
  desiredMaxHeight = DEFAULT_MAX_HEIGHT,
  align = 'left',
  minWidth: desiredMinWidth = 0,
}: UseAnchoredDropdownParams): UseAnchoredDropdownResult => {
  const [dropPos, setDropPos] = useState<AnchoredDropdownPosition>(initialPosition);
  const rafRef = useRef(0);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
    const preferred = Math.min(desiredMaxHeight, viewportHeight * 0.7);

    let placement: DropdownPlacement;
    let top: number | null;
    let bottom: number | null;
    let maxHeight: number;

    if (spaceBelow >= preferred || spaceBelow >= spaceAbove) {
      placement = 'bottom';
      maxHeight = Math.max(MIN_HEIGHT, Math.min(preferred, spaceBelow));
      top = rect.bottom + GAP;
      bottom = null;
    } else {
      placement = 'top';
      maxHeight = Math.max(MIN_HEIGHT, Math.min(preferred, spaceAbove));
      top = null;
      bottom = viewportHeight - rect.top + GAP;
    }

    // A largura real do painel já aberto entra na conta: sem ela, o painel mais largo que o gatilho
    // era posicionado como se coubesse onde não cabe. Na primeira abertura ainda não há o que medir,
    // e valem o gatilho e a largura mínima pedida.
    const minWidth = Math.max(rect.width, desiredMinWidth);
    const width = Math.max(minWidth, dropdownRef.current?.offsetWidth ?? 0);
    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > viewportWidth - VIEWPORT_MARGIN) {
      left = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
    }
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    setDropPos({ top, bottom, left, minWidth, maxHeight, placement });
  }, [anchorRef, dropdownRef, desiredMaxHeight, align, desiredMinWidth]);

  useEffect(() => {
    if (!open) return;

    const schedule = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(reposition);
    };

    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      schedule();
    };

    schedule();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', schedule);
    };
  }, [open, reposition, dropdownRef]);

  return { dropPos, reposition };
};
