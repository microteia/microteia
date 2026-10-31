import type { PortalUserRecord } from './IPortalRepository';
import type {
  IPortalIdentityAccountService,
  IPortalIdentityConfigRepository,
  IPortalIdentityRepository,
  IPortalSignInRequestRepository,
  PortalIdentityConfig,
  PortalIdentityInvite,
  PortalIdentityProof,
  PortalSignInRequest,
} from './IPortalIdentity';
import { asPortalSignInSettings, portalClaimKey } from '../schema/portalIdentity';
import {
  mergePortalSubjectRoles,
  portalSubjectRoleOf,
  withPortalSubjectRole,
  withoutPortalSubjectRoles,
} from '../schema/portalRole';

/**
 * A identidade do portal em memória — os convites por claim, os pedidos de entrada, a configuração e
 * as contas —, sobre o MESMO mapa de convidados do escritório falso (`makeFakePortalRepository`): o
 * que o login grava é o que as callables do convidado leem.
 */
export const makeFakePortalIdentity = (users: Map<string, PortalUserRecord>) => {
  const invites = new Map<string, PortalIdentityInvite>();
  const proofs = new Map<string, PortalIdentityProof>();
  const requests = new Map<string, PortalSignInRequest & { used?: boolean }>();
  const accounts = new Map<string, string>();
  const tokens: string[] = [];
  const configs = new Map<string, PortalIdentityConfig>();
  let sequence = 0;

  const configOf = (tenantId: string): PortalIdentityConfig =>
    configs.get(tenantId) ?? { settings: asPortalSignInSettings(undefined), secrets: {} };

  const keyOf = (invite: Pick<PortalIdentityInvite, 'claim'>) => portalClaimKey(invite.claim.name, invite.claim.value);

  const syncAccount = async (_tenantId: string, userId: string) => {
    const bound = [...invites.values()].filter((invite) => invite.boundUserIds.includes(userId));
    const subjectKeys = [...new Set(bound.flatMap((invite) => invite.subjectKeys))].sort();
    const current = users.get(userId);
    if (!current) return;
    const subjectRoles = mergePortalSubjectRoles(bound.map((invite) => invite.subjectRoles ?? []), subjectKeys);
    if (subjectKeys.length === 0) users.delete(userId);
    else users.set(userId, { ...current, subjectKeys, subjectRoles });
  };

  const identity: IPortalIdentityRepository = {
    findInvitesByClaimKeys: async (_t, keys) => [...invites.values()].filter((invite) => keys.includes(keyOf(invite))),
    getInvite: async (_t, id) => invites.get(id) ?? null,
    invitesBoundTo: async (_t, userId) => [...invites.values()].filter((invite) => invite.boundUserIds.includes(userId)),
    invitesByEmail: async (_t, email) => [...invites.values()].filter((invite) => invite.email === email),
    grantInvite: async (_t, grant, subjectKey, role) => {
      const key = portalClaimKey(grant.claim.name, grant.claim.value);
      const existing = [...invites.values()].find((invite) => keyOf(invite) === key);
      if (existing) {
        const granted = !existing.subjectKeys.includes(subjectKey);
        const roles = existing.subjectRoles ?? [];
        const roleChanged = !!role && portalSubjectRoleOf(roles, subjectKey) !== role;
        const next = {
          ...existing,
          subjectKeys: [...new Set([...existing.subjectKeys, subjectKey])],
          ...(roleChanged && role ? { subjectRoles: withPortalSubjectRole(roles, subjectKey, role) } : {}),
        };
        invites.set(existing.id, next);
        return { invite: next, granted, roleChanged };
      }
      sequence += 1;
      const invite: PortalIdentityInvite = {
        id: `inv-${sequence}`,
        email: grant.email,
        displayName: grant.displayName,
        claim: grant.claim,
        subjectKeys: [subjectKey],
        ...(role ? { subjectRoles: [{ subjectKey, role }] } : {}),
        boundUserIds: [],
        invitedBy: grant.invitedBy,
        ...(grant.locale ? { locale: grant.locale } : {}),
      };
      invites.set(invite.id, invite);
      return { invite, granted: true, roleChanged: !!role };
    },
    revokeInvite: async (_t, id, subjectKey) => {
      const invite = invites.get(id);
      if (!invite) return false;
      const remaining = subjectKey === null ? [] : invite.subjectKeys.filter((key) => key !== subjectKey);
      if (remaining.length === invite.subjectKeys.length) return false;
      if (remaining.length === 0) invites.delete(id);
      else invites.set(id, { ...invite, subjectKeys: remaining, subjectRoles: withoutPortalSubjectRoles(invite.subjectRoles ?? [], subjectKey) });
      return true;
    },
    bind: async (tenantId, binding, matched) => {
      if (binding.proofKeys.length === 0) proofs.delete(binding.userId);
      else {
        proofs.set(binding.userId, {
          userId: binding.userId,
          provider: binding.verified.provider,
          subject: binding.subject,
          level: binding.verified.level,
          displayName: binding.displayName,
          proofKeys: binding.proofKeys,
          verifiedAt: new Date(),
        });
      }
      const ids = new Set(matched.map((invite) => invite.id));
      for (const invite of invites.values()) {
        const bound = invite.boundUserIds.includes(binding.userId);
        if (ids.has(invite.id) && !bound) invites.set(invite.id, { ...invite, boundUserIds: [...invite.boundUserIds, binding.userId] });
        if (!ids.has(invite.id) && bound) {
          invites.set(invite.id, { ...invite, boundUserIds: invite.boundUserIds.filter((one) => one !== binding.userId) });
        }
      }
      if (matched.length === 0) {
        users.delete(binding.userId);
        return;
      }
      users.set(binding.userId, {
        userId: binding.userId,
        email: binding.email,
        displayName: binding.displayName,
        subjectKeys: [],
        identity: binding.verified,
        ...(binding.locale ? { locale: binding.locale } : {}),
      });
      await syncAccount(tenantId, binding.userId);
    },
    proofOf: async (_t, userId) => proofs.get(userId) ?? null,
    proofsFor: async (_t, proofKey) => [...proofs.values()].filter((proof) => proof.proofKeys.includes(proofKey)),
    rebind: async (tenantId, invite, proof) => {
      const current = invites.get(invite.id);
      if (!current) return;
      if (!current.boundUserIds.includes(proof.userId)) {
        invites.set(current.id, { ...current, boundUserIds: [...current.boundUserIds, proof.userId] });
      }
      if (!users.has(proof.userId)) {
        users.set(proof.userId, {
          userId: proof.userId,
          email: current.email,
          displayName: proof.displayName || current.displayName,
          subjectKeys: [],
          identity: { provider: proof.provider, claim: { name: current.claim.name, value: current.claim.value }, level: proof.level },
          ...(current.locale ? { locale: current.locale } : {}),
        });
      }
      await syncAccount(tenantId, proof.userId);
    },
    syncAccount,
    setEmailGuestsSuspended: async (_t, suspended) => {
      let changed = 0;
      for (const [userId, user] of users) {
        if (user.identity || !!user.suspended === suspended) continue;
        const next = { ...user };
        if (suspended) next.suspended = true;
        else delete next.suspended;
        users.set(userId, next);
        changed += 1;
      }
      return changed;
    },
  };

  const requestRepo: IPortalSignInRequestRepository = {
    save: async (hash, request) => { requests.set(hash, request); },
    consume: async (hash, now) => {
      const request = requests.get(hash);
      if (!request || request.used || request.expiresAt.getTime() <= now.getTime()) return null;
      requests.set(hash, { ...request, used: true });
      return request;
    },
  };

  const config: IPortalIdentityConfigRepository = {
    get: async (tenantId) => configOf(tenantId),
    save: async (tenantId, next) => { configs.set(tenantId, next); },
  };

  const accountService: IPortalIdentityAccountService = {
    ensureAccount: async (userId, displayName) => {
      if (!accounts.has(userId)) accounts.set(userId, displayName);
    },
    signInToken: async (userId) => {
      tokens.push(userId);
      return `token-for:${userId}`;
    },
  };

  return { identity, proofs, requests: requestRepo, requestStore: requests, config, configs, accounts: accountService, accountStore: accounts, invites, tokens };
};
