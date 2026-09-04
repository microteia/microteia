import { initFirebase } from './infrastructure/firebase/initFirebase';

initFirebase();

export { callAIProxy } from './infrastructure/handlers/callAIProxy';
export { detectWorkflows } from './infrastructure/handlers/detectWorkflows';
export { runWorkflow } from './infrastructure/handlers/runWorkflow';
export { runScript } from './infrastructure/handlers/runScript';
export { runAction } from './infrastructure/handlers/runAction';
export { runReport } from './infrastructure/handlers/runReport';
export { getUserInfo } from './infrastructure/handlers/getUserInfo';
export { checkNicknameAvailability } from './infrastructure/handlers/checkNicknameAvailability';
export { claimNickname } from './infrastructure/handlers/claimNickname';
export { addTenantMember } from './infrastructure/handlers/addTenantMember';
export { removeTenantMember } from './infrastructure/handlers/removeTenantMember';
export { onUserCreated } from './infrastructure/handlers/onUserCreated';
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
export { onWorkflowEventCreated } from './infrastructure/handlers/onWorkflowEventCreated';
export { getWorkflowStepCatalog } from './infrastructure/handlers/getWorkflowStepCatalog';
export { publishWorkflowEventOnEntityChange } from './infrastructure/handlers/publishWorkflowEventOnEntityChange';
export { recomputeAggregatesOnEntityChange } from './infrastructure/handlers/recomputeAggregatesOnEntityChange';
export { onNoteChange } from './infrastructure/handlers/workflow/onNoteChange';
export { onDocumentChange } from './infrastructure/handlers/workflow/onDocumentChange';
export { getExpressionFunctions } from './infrastructure/handlers/getExpressionFunctions';
