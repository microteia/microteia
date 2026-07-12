import type { IconType } from 'react-icons';
import {
  RiCalendarEventLine,
  RiNotification3Line,
  RiFileHistoryLine,
  RiBracesLine,
  RiSearchLine,
  RiExternalLinkLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiToolsLine,
  RiBracketsLine,
  RiShieldCheckLine,
  RiSaveLine
} from 'react-icons/ri';

const STEP_ICONS: Record<string, IconType> = {
  RiCalendarEventLine,
  RiNotification3Line,
  RiFileHistoryLine,
  RiBracesLine,
  RiSearchLine,
  RiExternalLinkLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiBracketsLine,
  RiShieldCheckLine,
  RiSaveLine,
};

export const getStepIcon = (icon: string): IconType => STEP_ICONS[icon] ?? RiToolsLine;
