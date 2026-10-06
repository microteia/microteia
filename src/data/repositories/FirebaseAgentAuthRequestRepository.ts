import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import {
  AGENT_OAUTH_CONSENT_FUNCTION,
  AGENT_OAUTH_REQUEST_FUNCTION,
} from '../../domain/schema/agent/agentBackend';
import type {
  AgentAuthRequestView,
  AgentConsentInput,
  IAgentAuthRequestRepository,
} from '../../domain/repositories/IAgentAuthRequestRepository';

export class FirebaseAgentAuthRequestRepository implements IAgentAuthRequestRepository {
  async get(requestId: string): Promise<AgentAuthRequestView> {
    const call = httpsCallable<{ requestId: string }, AgentAuthRequestView>(
      functions,
      AGENT_OAUTH_REQUEST_FUNCTION,
    );
    return (await call({ requestId })).data;
  }

  async consent(input: AgentConsentInput): Promise<string> {
    const call = httpsCallable<AgentConsentInput, { redirectTo: string }>(
      functions,
      AGENT_OAUTH_CONSENT_FUNCTION,
    );
    return (await call(input)).data.redirectTo;
  }
}
