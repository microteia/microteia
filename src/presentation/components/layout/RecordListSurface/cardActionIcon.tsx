import React from 'react';
import { RiLinkM, RiFileCopyLine, RiPriceTag3Line, RiDeleteBinLine } from 'react-icons/ri';
import { getScreenIcon } from '../../../shared/screenIcons';
import type { RecordCardAction } from '../../../shared/entityScreen/useRecordListViewModel';
import type { ScreenListAction } from '../../../../domain/entities';

const ACTION_ICONS: Record<ScreenListAction, React.ReactNode> = {
  copyLink: <RiLinkM size={14} />,
  clone: <RiFileCopyLine size={14} />,
  manageTags: <RiPriceTag3Line size={14} />,
  delete: <RiDeleteBinLine size={14} />,
};

/**
 * Ícone de uma ação de registro (RecordCardAction): as embutidas (copyLink/clone/manageTags/delete)
 * têm ícone fixo; as customizadas trazem `iconKey` do registro de ícones das telas. Partilhado pela
 * lista padrão e pela ponte de extensões, para que a mesma ação apareça igual onde quer que seja
 * renderizada (linha do card, cabeçalho de edição, dropdown…).
 */
export const cardActionIcon = (action: RecordCardAction, size = 14): React.ReactNode =>
  action.iconKey ? getScreenIcon(action.iconKey, size) : ACTION_ICONS[action.key as ScreenListAction];
