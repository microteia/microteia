import { describe, expect, it } from 'vitest';
import { buildScriptSandboxTypeDefs } from './scriptSandboxTypeDefs';
import { QUERY_MAX_RESULTS, QUERY_MAX_SCAN } from '../../../domain/schema/querySpec';

describe('scriptSandboxTypeDefs', () => {
  it('diz os mesmos tetos de consulta que o motor aplica', () => {
    const defs = buildScriptSandboxTypeDefs([]);
    expect(defs).toContain(`at most ${QUERY_MAX_RESULTS} records`);
    expect(defs).toContain(`the\n   * ${QUERY_MAX_SCAN} records it reads`);
  });

  it('documenta a leitura em páginas e o cursor devolvido', () => {
    const defs = buildScriptSandboxTypeDefs([]);
    expect(defs).toMatch(/page\?: QueryPage;/);
    expect(defs).toMatch(/cursor: string \| null;/);
    expect(defs).toMatch(/hasMore: boolean;/);
  });
});
