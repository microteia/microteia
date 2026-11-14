import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WORKSPACE_DOCK_DEFAULT_WIDTH,
  WorkspaceDockContext,
  clampDockWidth,
  type WorkspaceDockContextValue,
} from './useWorkspaceDock';

const STORAGE_KEY = 'microteia:workspaceDock';

interface StoredDock {
  lastKey: string | null;
  width: number;
}

/**
 * O painel e a largura são conveniência de quem usa, e não dado: ficam no navegador, como os grupos
 * recolhidos da barra lateral. Sem armazenamento, o dock abre na largura padrão.
 */
const readStored = (): StoredDock => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<StoredDock>;
    return {
      lastKey: typeof parsed.lastKey === 'string' ? parsed.lastKey : null,
      width: typeof parsed.width === 'number' ? clampDockWidth(parsed.width) : WORKSPACE_DOCK_DEFAULT_WIDTH,
    };
  } catch {
    return { lastKey: null, width: WORKSPACE_DOCK_DEFAULT_WIDTH };
  }
};

const writeStored = (value: StoredDock): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Sem armazenamento, o dock continua funcionando — só não lembra na próxima visita.
  }
};

const isToggleShortcut = (event: KeyboardEvent): boolean =>
  (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'j';

export const WorkspaceDockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stored] = useState(readStored);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [everOpened, setEverOpened] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(stored.lastKey);
  const [width, setWidthState] = useState(stored.width);

  const open = useCallback((key: string) => {
    setOpenKey(key);
    setEverOpened(true);
    if (key) {
      setLastKey(key);
      writeStored({ lastKey: key, width });
    }
  }, [width]);

  const close = useCallback(() => setOpenKey(null), []);

  const toggle = useCallback((key?: string) => {
    if (key === undefined) {
      setOpenKey((current) => (current === null ? lastKey ?? '' : null));
      setEverOpened(true);
      return;
    }
    if (openKey === key) {
      setOpenKey(null);
      return;
    }
    open(key);
  }, [lastKey, openKey, open]);

  const setWidth = useCallback((next: number, persist = false) => {
    const clamped = clampDockWidth(next);
    setWidthState(clamped);
    if (persist) writeStored({ lastKey, width: clamped });
  }, [lastKey]);

  // ⌘J / Ctrl+J, como o ⌘K da paleta: um atalho só, que alterna o último painel usado.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isToggleShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const value = useMemo<WorkspaceDockContextValue>(
    () => ({ openKey, everOpened, width, open, toggle, close, setWidth }),
    [openKey, everOpened, width, open, toggle, close, setWidth],
  );

  return <WorkspaceDockContext.Provider value={value}>{children}</WorkspaceDockContext.Provider>;
};
