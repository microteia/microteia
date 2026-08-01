import React from 'react';
import { getScreenIcon } from '../../../shared/screenIcons';
import type { RecordCardAction } from '../../../shared/entityScreen/useRecordListViewModel';

/**
 * Ícone de uma ação de registro (RecordCardAction). Toda ação declara o seu no catálogo curado de
 * telas — as embutidas na metadata da contribuição, as do escritório no cadastro da Action. O kernel
 * tinha aqui um mapa fixo para copiar-link/duplicar/etiquetas/excluir; ele sumiu junto com o resto
 * do que o kernel sabia sobre elas.
 *
 * Partilhado pela lista padrão e pela ponte de extensões, para que a mesma ação apareça igual onde
 * quer que seja renderizada (linha do card, cabeçalho de edição, dropdown…).
 */
export const cardActionIcon = (action: RecordCardAction, size = 14): React.ReactNode =>
  action.iconKey ? getScreenIcon(action.iconKey, size) : null;
