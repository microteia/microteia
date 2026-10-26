import type { IconType } from 'react-icons';
import {
  RiFileCopyLine,
  RiApps2Line,
  RiListCheck2,
  RiAlarmLine,
  RiFileHistoryLine,
} from 'react-icons/ri';
import type { WorkflowLookupGroup } from '../../domain/services/workflowLookupCatalog';
import { WORKFLOW_SCHEDULE_EVENT } from '../../domain/schema/workflowClock';
import { WORKFLOW_AUDIT_EVENT } from '../../domain/schema/workflowAuditTrigger';

const LOOKUP_GROUP_ICONS: Record<WorkflowLookupGroup, IconType> = {
  document: RiFileCopyLine,
};

export const CUSTOM_RECORD_EVENT_ICON: IconType = RiApps2Line;
export const LOOKUP_EVENT_ICON: IconType = RiListCheck2;
export const SCHEDULE_EVENT_ICON: IconType = RiAlarmLine;
export const AUDIT_EVENT_ICON: IconType = RiFileHistoryLine;

export const getWorkflowEventIcon = (eventName: string): IconType => {
  if (eventName === WORKFLOW_SCHEDULE_EVENT) return SCHEDULE_EVENT_ICON;
  if (eventName === WORKFLOW_AUDIT_EVENT) return AUDIT_EVENT_ICON;
  if (eventName.split('.')[0] === 'lookup') return LOOKUP_EVENT_ICON;
  return CUSTOM_RECORD_EVENT_ICON;
};

export const getWorkflowLookupGroupIcon = (group: WorkflowLookupGroup): IconType => LOOKUP_GROUP_ICONS[group];
