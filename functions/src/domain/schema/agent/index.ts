// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/agent/index.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

export {
  AGENT_BACKEND_FUNCTIONS,
  AGENT_CREATE_GRANT_FUNCTION,
  AGENT_MCP_FUNCTION,
  AGENT_OAUTH_CONSENT_FUNCTION,
  AGENT_OAUTH_FUNCTION,
  AGENT_OAUTH_REQUEST_FUNCTION,
  AGENT_REVOKE_GRANT_FUNCTION,
} from './agentBackend';

export type {
  AgentGrant,
  AgentGrantOrigin,
  AgentGrantRefusal,
  ParsedAgentToken,
  TripleToken,
} from './agentGrant';
export {
  AGENT_GRANTS_COLLECTION,
  AGENT_SECRET_LENGTH,
  AGENT_TOKEN_PREFIX,
  buildAgentToken,
  buildTripleToken,
  effectiveAgentPermissions,
  generateAgentSecret,
  grantRefusal,
  hashAgentSecret,
  parseAgentToken,
  parseTripleToken,
  secretHashMatches,
} from './agentGrant';

export type {
  AgentAuthRequest,
  AuthCodeDeps,
  AuthCodeRefusal,
  OAuthClientMetadata,
  OAuthErrorCode,
  PresentedAuthCode,
} from './agentOAuth';
export {
  AGENT_AUTH_REQUESTS_COLLECTION,
  AUTHORIZATION_SERVER_METADATA_PATH,
  OAUTH_ACCESS_TTL_MS,
  OAUTH_AUTHORIZE_PATH,
  OAUTH_CODE_PREFIX,
  OAUTH_CODE_TTL_MS,
  OAUTH_CONSENT_PATH,
  OAUTH_REDIRECT_CLAUDE,
  OAUTH_REFRESH_PREFIX,
  OAUTH_REQUEST_TTL_MS,
  OAUTH_SCOPES,
  OAUTH_TOKEN_PATH,
  PROTECTED_RESOURCE_METADATA_PATH,
  authorizationCodeRefusal,
  bearerChallenge,
  authorizationServerMetadata,
  buildAuthCode,
  buildRefreshToken,
  codeChallengeFor,
  hostingOrigin,
  httpFunctionEndpoint,
  parseAuthCode,
  parseClientMetadata,
  parseRefreshToken,
  protectedResourceMetadata,
  redirectUriAllowed,
} from './agentOAuth';

export type { AgentOperation, AgentPermissionRule, AgentResourceUri, AgentToolDefinition } from './agentOps';
export {
  AGENT_ENFORCED,
  AGENT_OPERATIONS,
  AGENT_RESOURCES,
  AGENT_SEARCH_MAX_RESULTS,
  AGENT_TOOLS,
  AGENT_UNENFORCED,
  agentParameterAccepts,
  agentParameterPlaceholder,
  agentToolByName,
} from './agentOps';

export type { AgentFileContent } from './agentDocument';
export {
  AGENT_DOCUMENT_MAX_BYTES,
  AGENT_DOCUMENT_MAX_MB,
  DOCUMENT_TYPES_COLLECTION,
  agentDocumentContentType,
  agentDocumentName,
  agentDocumentStoragePath,
  inspectAgentFileContent,
  resolveAgentDocumentType,
} from './agentDocument';

export type { AgentInputIssue } from './agentInput';
export { AGENT_SCHEMA_KEYWORDS, checkAgentInput } from './agentInput';

export type {
  AgentIdempotency,
  AgentParameter,
  AgentStepSummary,
  AgentWorkflowDataAccess,
  AgentWorkflowOutput,
} from './agentWorkflow';
export {
  describeParameter,
  describeParameters,
  indexStepCatalog,
  summarizeSteps,
  unknownParameterKeys,
  workflowDataAccess,
  workflowIdempotency,
  workflowOutputs,
} from './agentWorkflow';
