import type {
  AgentGrantInput,
  IAgentGrantRepository,
  IssuedAgentGrant,
} from '../../repositories/IAgentGrantRepository';
import type { AgentGrant } from '../../schema/agent/agentGrant';

export type SubscribeToAgentGrantsUseCase = {
  execute: (
    tenantId: string,
    onUpdate: (grants: AgentGrant[]) => void,
    onError?: (error: Error) => void,
  ) => () => void;
};

export const makeSubscribeToAgentGrantsUseCase = (
  repo: IAgentGrantRepository,
): SubscribeToAgentGrantsUseCase => ({
  execute: (tenantId, onUpdate, onError) => repo.subscribe(tenantId, onUpdate, onError),
});

export type IssueAgentGrantUseCase = {
  execute: (tenantId: string, input: AgentGrantInput) => Promise<IssuedAgentGrant>;
};

export const makeIssueAgentGrantUseCase = (
  repo: IAgentGrantRepository,
): IssueAgentGrantUseCase => ({
  execute: (tenantId, input) => repo.issue(tenantId, input),
});

export type RevokeAgentGrantUseCase = {
  execute: (tenantId: string, grantId: string) => Promise<boolean>;
};

export const makeRevokeAgentGrantUseCase = (
  repo: IAgentGrantRepository,
): RevokeAgentGrantUseCase => ({
  execute: (tenantId, grantId) => repo.revoke(tenantId, grantId),
});
