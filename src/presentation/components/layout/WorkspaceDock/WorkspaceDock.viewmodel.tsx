import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useWorkspaceDock } from '../../../../stores/useWorkspaceDock';
import { useDockPanels } from '../../../shared/useDockPanels';
import type { SurfaceSlotDescriptor } from '../../../shared/settings/useSettingsCatalog';

export interface WorkspaceDockViewModel {
  panels: SurfaceSlotDescriptor[];
  active: SurfaceSlotDescriptor | null;
  /** Os painéis já abertos nesta sessão: continuam montados, escondidos, para não perder o estado. */
  mounted: SurfaceSlotDescriptor[];
  width: number;
  resizing: boolean;
  select: (key: string) => void;
  close: () => void;
  startResize: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export const useWorkspaceDockViewModel = (): WorkspaceDockViewModel => {
  const { openKey, everOpened, width, open, close, setWidth } = useWorkspaceDock();
  const panels = useDockPanels();
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number; last: number } | null>(null);

  // A chave pedida pode não estar disponível (o painel saiu, a permissão mudou) ou ser `''` — o
  // atalho pede "o último ou o primeiro". Nos dois casos vale o primeiro disponível.
  const active = useMemo(() => {
    if (openKey === null || panels.length === 0) return null;
    return panels.find((panel) => panel.key === openKey) ?? panels[0];
  }, [openKey, panels]);

  const mounted = useMemo(() => (everOpened ? panels : []), [everOpened, panels]);

  const select = useCallback((key: string) => open(key), [open]);

  // O arraste vai para a ESQUERDA para alargar: o dock cresce a partir da borda direita da tela.
  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: width, last: width };
    setResizing(true);

    const move = (moveEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.last = drag.startWidth + (drag.startX - moveEvent.clientX);
      setWidth(drag.last);
    };
    const end = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setResizing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      if (drag) setWidth(drag.last, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }, [width, setWidth]);

  return { panels, active, mounted, width, resizing, select, close, startResize };
};
