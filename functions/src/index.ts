import { initFirebase } from './infrastructure/firebase/initFirebase';

initFirebase();

export { agentMcp } from './infrastructure/handlers/agentMcp';
export { createAgentGrant } from './infrastructure/handlers/createAgentGrant';
export { revokeAgentGrant } from './infrastructure/handlers/revokeAgentGrant';
export { agentOAuth } from './infrastructure/handlers/agentOAuth';
export { getAgentAuthRequest, consentAgentAuthRequest } from './infrastructure/handlers/agentOAuthConsent';
export { callAIProxy } from './infrastructure/handlers/callAIProxy';
export { detectWorkflows } from './infrastructure/handlers/detectWorkflows';
export { runWorkflow } from './infrastructure/handlers/runWorkflow';
export { runScript } from './infrastructure/handlers/runScript';
export { runAction } from './infrastructure/handlers/runAction';
export { runReport } from './infrastructure/handlers/runReport';
export { renderDocument } from './infrastructure/handlers/renderDocument';
export { onDownloadDeleted } from './infrastructure/handlers/onDownloadDeleted';
export { attachDownloadToRecord } from './infrastructure/handlers/attachDownloadToRecord';
export { previewDocument } from './infrastructure/handlers/previewDocument';
export { getUserInfo } from './infrastructure/handlers/getUserInfo';
export { checkNicknameAvailability } from './infrastructure/handlers/checkNicknameAvailability';
export { claimNickname } from './infrastructure/handlers/claimNickname';
export { addTenantMember } from './infrastructure/handlers/addTenantMember';
export { removeTenantMember } from './infrastructure/handlers/removeTenantMember';
export { onUserCreated } from './infrastructure/handlers/onUserCreated';
export {
  invitePortalUser,
  revokePortalUser,
  getPortalContext,
  getPortalDocumentUrl,
  submitPortalRecord,
  attachPortalDocument,
} from './infrastructure/handlers/portalAccess';
export {
  projectPortalRecord,
  projectPortalDocument,
  refreshPortalAudience,
  reprojectPortalOnScreenChange,
} from './infrastructure/handlers/portalProjection';
export {
  materializePermissionsOnExtensionChange,
  materializePermissionsOnMemberChange,
  materializePermissionsOnRoleChange,
  materializePermissionsOnScreenChange,
} from './infrastructure/handlers/materializeMemberPermissions';
export { syncTenantPermissions } from './infrastructure/handlers/syncTenantPermissions';
export { auditFlatEntityChange } from './infrastructure/handlers/auditFlatEntityChange';
export { auditNestedEntityChange } from './infrastructure/handlers/auditNestedEntityChange';
export { auditTenantDeleted } from './infrastructure/handlers/auditTenantDeleted';
export { backupDeletedAuditLog } from './infrastructure/handlers/backupDeletedAuditLog';
export { logClientError } from './infrastructure/handlers/logClientError';
export { manageNotificationEmail, getWebPushPublicKey } from './infrastructure/handlers/notifications';
export { onWorkflowEventCreated } from './infrastructure/handlers/onWorkflowEventCreated';
export { syncWorkflowClock, runWorkflowClock } from './infrastructure/handlers/workflowClock';
export { getWorkflowStepCatalog } from './infrastructure/handlers/getWorkflowStepCatalog';
export { publishWorkflowEventOnEntityChange } from './infrastructure/handlers/publishWorkflowEventOnEntityChange';
export { publishWorkflowEventOnAuditLog } from './infrastructure/handlers/publishWorkflowEventOnAuditLog';
export { recomputeAggregatesOnEntityChange } from './infrastructure/handlers/recomputeAggregatesOnEntityChange';
export {
  reconcileAggregatesOnScreenChange,
  runAggregateBackfill,
  reconcileAggregates,
} from './infrastructure/handlers/aggregateBackfill';
export {
  reconcileRecordKeysOnScreenChange,
  runRecordKeyAdoption,
  recheckRecordKeysOnEntityChange,
  reconcileRecordKeys,
} from './infrastructure/handlers/recordKeyAdoption';
export { onNoteChange } from './infrastructure/handlers/workflow/onNoteChange';
export { onDocumentChange } from './infrastructure/handlers/workflow/onDocumentChange';
export { getExpressionFunctions } from './infrastructure/handlers/getExpressionFunctions';
export { countExtensionInstalls, aggregateExtensionRatings } from './infrastructure/handlers/extensionStats';
