import { initFirebase } from './infrastructure/firebase/initFirebase';

initFirebase();

export { callAIProxy } from './infrastructure/handlers/callAIProxy';
export { getUserInfo } from './infrastructure/handlers/getUserInfo';
export { checkNicknameAvailability } from './infrastructure/handlers/checkNicknameAvailability';
export { claimNickname } from './infrastructure/handlers/claimNickname';
export { exchangeGmailCode } from './infrastructure/handlers/exchangeGmailCode';
export { addTenantMember } from './infrastructure/handlers/addTenantMember';
export { removeTenantMember } from './infrastructure/handlers/removeTenantMember';
export { onUserCreated } from './infrastructure/handlers/onUserCreated';
export { gmailPush } from './infrastructure/handlers/gmailPush';
export { renewGmailWatches } from './infrastructure/handlers/renewGmailWatches';
export { auditFlatEntityChange } from './infrastructure/handlers/auditFlatEntityChange';
export { auditNestedEntityChange } from './infrastructure/handlers/auditNestedEntityChange';
export { auditTenantDeleted } from './infrastructure/handlers/auditTenantDeleted';
export { auditNewsChange, auditNewsCommentChange, auditNewsTagChange } from './infrastructure/handlers/auditNewsEntityChange';
export { backupDeletedAuditLog } from './infrastructure/handlers/backupDeletedAuditLog';
export { logClientError } from './infrastructure/handlers/logClientError';
