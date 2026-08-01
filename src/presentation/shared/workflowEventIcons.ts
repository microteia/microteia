import type { IconType } from 'react-icons';
import {
  RiTeamLine,
  RiFolderLine,
  RiTimeLine,
  RiMoneyDollarCircleLine,
  RiInboxLine,
  RiNewspaperLine,
  RiFileCopyLine,
  RiApps2Line,
  RiListCheck2,
} from 'react-icons/ri';
import type { WorkflowLookupGroup } from '../../domain/services/workflowLookupCatalog';

const ENTITY_EVENT_ICONS: Record<string, IconType> = {
  person: RiTeamLine,
  case: RiFolderLine,
  deadline: RiTimeLine,
  financial: RiMoneyDollarCircleLine,
  push: RiInboxLine,
};

const LOOKUP_GROUP_ICONS: Record<WorkflowLookupGroup, IconType> = {
  deadline: RiTimeLine,
  financial: RiMoneyDollarCircleLine,
  document: RiFileCopyLine,
  news: RiNewspaperLine,
};

export const CUSTOM_RECORD_EVENT_ICON: IconType = RiApps2Line;
export const LOOKUP_EVENT_ICON: IconType = RiListCheck2;

export const getWorkflowEventIcon = (eventName: string): IconType => {
  const prefix = eventName.split('.')[0];
  if (prefix === 'custom_record') return CUSTOM_RECORD_EVENT_ICON;
  if (prefix === 'lookup') return LOOKUP_EVENT_ICON;
  return ENTITY_EVENT_ICONS[prefix] ?? RiApps2Line;
};

export const getWorkflowLookupGroupIcon = (group: WorkflowLookupGroup): IconType => LOOKUP_GROUP_ICONS[group];
