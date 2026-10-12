import type { IconType } from 'react-icons';
import {
  RiTeamLine,
  RiFolderLine,
  RiTimeLine,
  RiInboxLine,
  RiFileCopyLine,
  RiApps2Line,
  RiListCheck2,
  RiAlarmLine,
} from 'react-icons/ri';
import type { WorkflowLookupGroup } from '../../domain/services/workflowLookupCatalog';
import { WORKFLOW_SCHEDULE_EVENT } from '../../domain/schema/workflowClock';

const ENTITY_EVENT_ICONS: Record<string, IconType> = {
  person: RiTeamLine,
  case: RiFolderLine,
  deadline: RiTimeLine,
  push: RiInboxLine,
};

const LOOKUP_GROUP_ICONS: Record<WorkflowLookupGroup, IconType> = {
  document: RiFileCopyLine,
};

export const CUSTOM_RECORD_EVENT_ICON: IconType = RiApps2Line;
export const LOOKUP_EVENT_ICON: IconType = RiListCheck2;
export const SCHEDULE_EVENT_ICON: IconType = RiAlarmLine;

export const getWorkflowEventIcon = (eventName: string): IconType => {
  if (eventName === WORKFLOW_SCHEDULE_EVENT) return SCHEDULE_EVENT_ICON;
  const prefix = eventName.split('.')[0];
  if (prefix === 'custom_record') return CUSTOM_RECORD_EVENT_ICON;
  if (prefix === 'lookup') return LOOKUP_EVENT_ICON;
  return ENTITY_EVENT_ICONS[prefix] ?? RiApps2Line;
};

export const getWorkflowLookupGroupIcon = (group: WorkflowLookupGroup): IconType => LOOKUP_GROUP_ICONS[group];
