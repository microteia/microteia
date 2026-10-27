import { describe, expect, it } from 'vitest';
import {
  IAM_CREDENTIALS_API,
  TOKEN_CREATOR_ROLE,
  checkSessionSigning,
  enableApiArgs,
  gcloudLine,
  grantArgs,
  missingSteps,
  policyGrantsSelfSigning,
  resolveRuntimeAccount,
  serviceAccountFromDescribe,
} from './sessionSigning.js';
import type { Gcloud } from './sessionSigning.js';

const ACCOUNT = 'microteia-fn@demo.iam.gserviceaccount.com';
const ok = (stdout: string) => ({ code: 0, stdout, stderr: '' });
const fail = (stderr = 'denied') => ({ code: 1, stdout: '', stderr });

/** Um `gcloud` de mentira: responde pelo primeiro par de palavras do comando, e anota o que foi pedido. */
const fakeGcloud = (answers: Record<string, ReturnType<typeof ok>>) => {
  const calls: string[][] = [];
  const gcloud: Gcloud = async (args) => {
    calls.push(args);
    return answers[`${args[0]} ${args[1]}`] ?? fail('unexpected');
  };
  return { gcloud, calls };
};

const policy = (bindings: unknown[]) => JSON.stringify({ bindings });

describe('a conta que as functions usam', () => {
  it('lê a da function publicada — 2ª geração em serviceConfig, 1ª na raiz', () => {
    expect(serviceAccountFromDescribe(JSON.stringify({ serviceConfig: { serviceAccountEmail: ACCOUNT } }))).toBe(ACCOUNT);
    expect(serviceAccountFromDescribe(JSON.stringify({ serviceAccountEmail: ACCOUNT }))).toBe(ACCOUNT);
    expect(serviceAccountFromDescribe('{}')).toBeNull();
    expect(serviceAccountFromDescribe('not json')).toBeNull();
  });

  it('prefere a da function; sem ela, cai na padrão do Compute pelo número do projeto', async () => {
    const deployed = fakeGcloud({ 'functions describe': ok(JSON.stringify({ serviceConfig: { serviceAccountEmail: ACCOUNT } })) });
    await expect(resolveRuntimeAccount('demo', 'southamerica-east1', deployed.gcloud)).resolves.toEqual({ account: ACCOUNT, source: 'function' });
    expect(deployed.calls[0]).toContain('--region=southamerica-east1');

    const fresh = fakeGcloud({ 'functions describe': fail('NOT_FOUND'), 'projects describe': ok('123456789\n') });
    await expect(resolveRuntimeAccount('demo', 'r', fresh.gcloud)).resolves.toEqual({
      account: '123456789-compute@developer.gserviceaccount.com',
      source: 'default',
    });
  });

  it('sem conta legível e sem número de projeto, recusa em vez de adivinhar', async () => {
    const blind = fakeGcloud({ 'functions describe': fail(), 'projects describe': fail('PERMISSION_DENIED') });
    await expect(resolveRuntimeAccount('demo', 'r', blind.gcloud)).rejects.toThrow(/project number/);
  });
});

describe('a política IAM', () => {
  it('reconhece o papel concedido à própria conta, e só a ela', () => {
    expect(policyGrantsSelfSigning(policy([{ role: TOKEN_CREATOR_ROLE, members: [`serviceAccount:${ACCOUNT}`] }]), ACCOUNT)).toBe(true);
    expect(policyGrantsSelfSigning(policy([{ role: TOKEN_CREATOR_ROLE, members: ['serviceAccount:outra@x.com'] }]), ACCOUNT)).toBe(false);
    expect(policyGrantsSelfSigning(policy([{ role: 'roles/viewer', members: [`serviceAccount:${ACCOUNT}`] }]), ACCOUNT)).toBe(false);
    expect(policyGrantsSelfSigning('{}', ACCOUNT)).toBe(false);
  });

  it('uma concessão CONDICIONAL não conta — ela pode não valer na hora de assinar', () => {
    const conditional = { role: TOKEN_CREATOR_ROLE, members: [`serviceAccount:${ACCOUNT}`], condition: { expression: 'false' } };
    expect(policyGrantsSelfSigning(policy([conditional]), ACCOUNT)).toBe(false);
  });
});

describe('a conferência', () => {
  const describeOk = ok(JSON.stringify({ serviceConfig: { serviceAccountEmail: ACCOUNT } }));

  it('tudo feito: nada a mudar', async () => {
    const { gcloud } = fakeGcloud({
      'functions describe': describeOk,
      'services list': ok(`${IAM_CREDENTIALS_API}\n`),
      'iam service-accounts': ok(policy([{ role: TOKEN_CREATOR_ROLE, members: [`serviceAccount:${ACCOUNT}`] }])),
    });
    const check = await checkSessionSigning('demo', 'r', gcloud);
    expect(check).toEqual({ account: ACCOUNT, source: 'function', apiEnabled: true, granted: true });
    expect(missingSteps('demo', check)).toEqual([]);
  });

  it('faltando os dois: habilita a API e concede o papel à conta sobre ela mesma', async () => {
    const { gcloud } = fakeGcloud({
      'functions describe': describeOk,
      'services list': ok(''),
      'iam service-accounts': ok(policy([])),
    });
    const check = await checkSessionSigning('demo', 'r', gcloud);
    expect(missingSteps('demo', check).map(gcloudLine)).toEqual([
      `gcloud services enable ${IAM_CREDENTIALS_API} --project=demo`,
      `gcloud iam service-accounts add-iam-policy-binding ${ACCOUNT} --member=serviceAccount:${ACCOUNT} `
        + `--role=${TOKEN_CREATOR_ROLE} --project=demo`,
    ]);
  });

  it('o que não deu para ler vira "não sei" — e entra nos passos, que são idempotentes', async () => {
    const { gcloud } = fakeGcloud({ 'functions describe': describeOk, 'services list': fail(), 'iam service-accounts': fail() });
    const check = await checkSessionSigning('demo', 'r', gcloud);
    expect(check.apiEnabled).toBeNull();
    expect(check.granted).toBeNull();
    expect(missingSteps('demo', check)).toEqual([enableApiArgs('demo'), grantArgs('demo', ACCOUNT)]);
  });
});
