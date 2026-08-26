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
  RiSaveLine,
  RiRobot2Line,
  RiAiGenerate
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
  RiRobot2Line,
  RiAiGenerate,
};

export const getStepIcon = (icon: string): IconType => STEP_ICONS[icon] ?? RiToolsLine;
