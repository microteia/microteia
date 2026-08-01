import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_COLLECTIONS } from '../src/domain/schema/screenEntity';

/**
 * Uma tela É uma coleção, e o nome dela só existe em runtime. Por isso o `firestore.rules` autoriza
 * os registros por um `match` CURINGA — e o curinga precisa recusar tudo que já tem regra nomeada e
 * mais estrita (workflow_executions com `write: if false`, members sem create/delete, cases exigindo
 * advogado ou admin). O Firestore concede quando QUALQUER regra concede: uma coleção que escape da
 * denylist teria o acesso afrouxado em silêncio.
 *
 * Este teste é a rede: falha assim que a lista das rules divergir de `RESERVED_COLLECTIONS`.
 */
describe('coleções reservadas', () => {
  it('a denylist do firestore.rules espelha exatamente RESERVED_COLLECTIONS', () => {
    const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
    const block = rules.match(/function isReservedCollection\(name\) \{\s*return name in \[([\s\S]*?)\];/);
    expect(block, 'função isReservedCollection não encontrada no firestore.rules').toBeTruthy();

    const fromRules = [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(fromRules).toEqual([...RESERVED_COLLECTIONS].sort());
  });

  /**
   * A denylist sozinha não protege o arquivo: uma coleção reservada SEM o `match` nomeado dela fica
   * sem regra nenhuma — o curinga a recusa e a nomeada não existe, então toda escrita é negada.
   *
   * Foi o que aconteceu ao tirar Contrato do kernel: a edição levou junto 22 blocos vizinhos, entre
   * eles `screenDefinitions`, `lookupDefinitions` e `tagDefinitions` — e instalar QUALQUER extensão
   * passou a falhar com "Missing or insufficient permissions". A denylist continuava coerente, então
   * o teste acima passou.
   *
   * A lista abaixo é o mínimo que precisa ter regra própria: as coleções de que o kernel depende
   * para funcionar, e as que uma entidade fora do kernel ainda usa.
   */
  it('toda coleção reservada de que o sistema depende tem o seu match nomeado', () => {
    const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
    const named = new Set([...rules.matchAll(/match \/([A-Za-z_]+)\/\{/g)].map((m) => m[1]));

    const REQUIRED = [
      'screenDefinitions', 'lookupDefinitions', 'tagDefinitions',
      'workflow_definitions', 'workflow_events', 'workflow_executions',
      'actions', 'scripts', 'aiConnections',
      'plugin_installations', 'extensions', 'installed_extensions',
      'members', 'deadlines', 'pushes', 'news',
    ];

    for (const collection of REQUIRED) {
      expect(named, `"${collection}" perdeu o match nomeado no firestore.rules`).toContain(collection);
    }
  });

  it('o curinga do storage.rules recusa o caminho de logs, que tem regra própria', () => {
    const storage = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');
    const block = storage.match(/function isReservedStoragePath\(collection\) \{\s*return collection in \[([\s\S]*?)\];/);
    expect(block, 'função isReservedStoragePath não encontrada no storage.rules').toBeTruthy();
    expect([...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])).toContain('logs');
  });
});
