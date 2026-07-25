import React from 'react';
import { getScreenIcon } from '../screenIcons';

/**
 * Ícone por NOME, exposto às extensões via `@curatino/ui` como `Icon`. Fica em arquivo próprio (só
 * componente) para não quebrar o Fast Refresh de `screenIcons.tsx`, e delega ao helper `getScreenIcon`
 * — que devolve um `ReactNode` já montado, evitando criar componente durante o render.
 */
export const Icon: React.FC<{ name: string; size?: number }> = ({ name, size = 20 }) => (
  <>{getScreenIcon(name, size)}</>
);
