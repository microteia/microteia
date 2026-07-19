import type { IconType } from 'react-icons';
import {
  RiCalendarEventLine,
  RiNotification3Line,
  RiFileHistoryLine,
  RiBracesLine,
  RiSearchLine,
  RiLogoutBoxRLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiToolsLine,
  RiBracketsLine,
  RiShieldCheckLine,
  RiDeleteBin6Line,
  RiSaveLine
} from 'react-icons/ri';

const STEP_ICONS: Record<string, IconType> = {
  RiCalendarEventLine,
  RiNotification3Line,
  RiFileHistoryLine,
  RiBracesLine,
  RiSearchLine,
  RiLogoutBoxRLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiBracketsLine,
  RiShieldCheckLine,
  RiDeleteBin6Line,
  RiSaveLine,
};

export const getStepIcon = (icon: string): IconType => STEP_ICONS[icon] ?? RiToolsLine;
