import { describe, it, expect } from 'vitest';
import { withContentOrigin } from './contentOrigin';
import { SCRIPT_VERSION_CONTENT_KEYS } from '../../domain/schema/workflowVersion';

describe('withContentOrigin', () => {
  it('conteúdo sem origem é EDIÇÃO', () => {
    expect(withContentOrigin({ sourceTs: 'x' }, SCRIPT_VERSION_CONTENT_KEYS)).toEqual({ sourceTs: 'x', contentOrigin: { kind: 'edit' } });
  });

  it('a origem dita é respeitada — é como a instalação diz que é ela', () => {
    const origin = { kind: 'extension', pluginId: 'com.acme', sourceRev: 3 };
    expect(withContentOrigin({ sourceTs: 'x', contentOrigin: origin }, SCRIPT_VERSION_CONTENT_KEYS).contentOrigin).toBe(origin);
  });

  it('gravação que não toca conteúdo não leva origem', () => {
    expect(withContentOrigin({ ownerPluginIds: ['a'] }, SCRIPT_VERSION_CONTENT_KEYS)).toEqual({ ownerPluginIds: ['a'] });
  });
});
