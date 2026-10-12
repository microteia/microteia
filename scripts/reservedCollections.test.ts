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
   *
   * `SELADAS` é o caso oposto, e é deliberado: coleção reservada que NÃO tem match nomeado fica sem
   * regra nenhuma, e é isso que se quer de um resto de código removido — o nome continua bloqueado
   * para telas novas, e os documentos que sobraram nos escritórios não são lidos nem escritos por
   * ninguém. Sem este teste, a diferença entre "selada de propósito" e "alguém apagou o bloco por
   * engano" não estaria escrita em lugar nenhum.
   */
  it('toda coleção reservada de que o sistema depende tem o seu match nomeado', () => {
    const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
    const named = new Set([...rules.matchAll(/match \/([A-Za-z_]+)\/\{/g)].map((m) => m[1]));

    const REQUIRED = [
      'screenDefinitions', 'lookupDefinitions', 'tagDefinitions',
      'workflow_definitions', 'workflow_events', 'workflow_executions', 'workflow_clock',
      'actions', 'scripts', 'aiConnections',
      'extensions', 'installed_extensions', 'extension_history',
      'members',
    ];

    /** Reservadas de propósito SEM regra: nada as lê, e o que sobrou delas fica inalcançável. */
    const SELADAS = ['plugin_installations'];

    for (const collection of REQUIRED) {
      expect(named, `"${collection}" perdeu o match nomeado no firestore.rules`).toContain(collection);
    }
    for (const collection of SELADAS) {
      expect(RESERVED_COLLECTIONS, `"${collection}" precisa continuar reservada`).toContain(collection);
      expect(named, `"${collection}" ganhou um match: ou ele é engano, ou ela saiu de SELADAS`)
        .not.toContain(collection);
    }
  });

  /**
   * `.get(campo, padrão)` do Firestore só devolve o padrão quando o campo está AUSENTE. A instalação
   * de uma extensão grava `writeRoles: null` quando o pacote não restringe papéis — para apagar um
   * valor que existisse antes —, e `.size()` sobre nulo ESTOURA. Regra que estoura NEGA: era isso que
   * recusava toda gravação em `persons`, `deadlines` e `news`, enquanto `cases` e `financials`, que
   * declaram a lista, gravavam normalmente. Confirmado pela API TestRuleset, que aponta
   * "Null value error" exatamente na linha do `.size()`.
   */
  it('as listas da tela são lidas por acessor à prova de nulo', () => {
    const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

    expect(rules, 'screenList precisa checar o tipo antes de usar a lista')
      .toMatch(/function screenList\(name, field\)[\s\S]{0,200}?is list/);

    for (const field of ['writeRoles', 'memberWritableFields']) {
      expect(rules, `${field} lido direto de .get() volta nulo e derruba a regra: use screenList`)
        .not.toMatch(new RegExp(`\\.get\\('${field}'`));
    }
  });

  it('o curinga do storage.rules recusa o caminho de logs, que tem regra própria', () => {
    const storage = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');
    const block = storage.match(/function isReservedStoragePath\(collection\) \{\s*return collection in \[([\s\S]*?)\];/);
    expect(block, 'função isReservedStoragePath não encontrada no storage.rules').toBeTruthy();
    expect([...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])).toContain('logs');
  });
});
