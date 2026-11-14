import { describe, expect, it } from 'vitest';
import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { AppliedBackend } from '../../entities/AppliedBackend';
import { backendFunctionAvailability } from './backendFunctionAvailability';
import { backendFingerprint } from '../../schema/plugin/backendRequirement';

const extension = (functions: string[], overrides: Partial<InstalledExtension> = {}): InstalledExtension => ({
  id: 'com.acme.chat',
  active: true,
  package: { manifest: { id: 'com.acme.chat', version: '1.0.0', kernel: '^2.0.0', name: 'Chat', backend: { functions } } },
  ...overrides,
} as unknown as InstalledExtension);

describe('backendFunctionAvailability', () => {
  it('ninguém reivindica: disabled', () => {
    expect(backendFunctionAvailability([extension(['other'])], null, 'chatFn')).toBe('disabled');
  });

  it('a extensão inativa não conta', () => {
    expect(backendFunctionAvailability([extension(['chatFn'], { active: false })], null, 'chatFn')).toBe('disabled');
  });

  it('reivindicada mas sem backend aplicado: pending', () => {
    expect(backendFunctionAvailability([extension(['chatFn'])], null, 'chatFn')).toBe('pending');
  });

  it('com o backend aplicado no projeto, na impressão declarada: ready', () => {
    const one = extension(['chatFn']);
    const applied = { extensions: [{ pluginId: 'com.acme.chat', fingerprint: backendFingerprint(one.package.manifest.backend, undefined) }] } as unknown as AppliedBackend;
    expect(backendFunctionAvailability([one], applied, 'chatFn')).toBe('ready');
  });
});
