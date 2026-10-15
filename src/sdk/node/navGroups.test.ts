import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import type { NavGroupDeclaration, VisibleNavGroups } from './navGroups';
import { navGroupFindings, sameNameDifferentKeys, summarizeNavGroups } from './navGroups';

/**
 * O caso que originou isto: Calendário e Dias úteis declaram `schedule` ("Agenda" em pt-BR), e uma
 * extensão do escritório declarou "Agenda" com outra chave. O menu ganhou dois títulos iguais, e
 * nada no caminho de autoria tinha como avisar.
 */
const SCHEDULE: NavGroupDeclaration = {
  key: 'schedule', label: 'Schedule', translations: { en: 'Schedule', 'pt-BR': 'Agenda' }, order: 20,
  from: 'example', pluginId: 'com.microteia.calendar', path: 'examples/calendar/plugin.ts',
};
const ADMIN: NavGroupDeclaration = {
  key: 'admin', label: 'Administration', translations: { en: 'Administration' }, order: 110,
  from: 'platform', pluginId: 'core.ui',
};

const visible = (declarations: NavGroupDeclaration[]): VisibleNavGroups =>
  ({ declarations, installationKnown: null, failures: [] });

const pkg = (contributes: Contribution[]): MarketplacePlugin =>
  ({ manifest: { id: 'com.acme.menu', version: '1.0.0', contributes } } as unknown as MarketplacePlugin);

const group = (key: string, label: string): Contribution =>
  ({ point: 'ui.nav.group', id: key, apiVersion: '1.0.0', metadata: { key, label, order: 10 } });

const item = (key: string, groupKey: string): Contribution =>
  ({ point: 'ui.nav', id: key, apiVersion: '1.0.0', metadata: { key, label: key, group: groupKey } });

describe('os grupos da barra lateral no check', () => {
  it('avisa o grupo de chave nova com o nome de um que já existe, e diz qual chave usar', () => {
    const findings = navGroupFindings(pkg([group('com.microteia.agenda', 'Agenda')]), visible([SCHEDULE, ADMIN]));
    expect(findings).toHaveLength(1);
    expect(findings[0].status).toBe('same-name');
    expect(findings[0].key).toBe('com.microteia.agenda');
    expect(findings[0].detail).toContain('declare key "schedule"');
  });

  it('declarar a MESMA chave de outro pacote é juntar-se a ele, e não é aviso', () => {
    expect(navGroupFindings(pkg([group('schedule', 'Agenda')]), visible([SCHEDULE]))).toEqual([]);
  });

  it('o próprio pacote, lido também do diretório, não conta como outro', () => {
    const self: NavGroupDeclaration = { ...SCHEDULE, key: 'com.microteia.agenda', from: 'workspace', pluginId: 'com.acme.menu' };
    expect(navGroupFindings(pkg([group('com.microteia.agenda', 'Planner')]), visible([self]))).toEqual([]);
  });

  it('avisa o item que entra num grupo que nenhuma fonte visível declara', () => {
    const findings = navGroupFindings(pkg([item('cases', 'cases-group')]), visible([SCHEDULE]));
    expect(findings.map((one) => [one.status, one.key])).toEqual([['undeclared', 'cases-group']]);
    expect(navGroupFindings(pkg([item('calendar', 'schedule')]), visible([SCHEDULE]))).toEqual([]);
  });
});

describe('a lista de grupos servida ao autor', () => {
  const OFFICE: NavGroupDeclaration = {
    key: 'com.microteia.agenda', label: 'Agenda', translations: {}, order: 10, from: 'installation', pluginId: 'com.acme.menu',
  };

  it('uma linha por chave, na ordem do menu, com quem declara', () => {
    const summary = summarizeNavGroups([ADMIN, SCHEDULE, { ...SCHEDULE, from: 'installation' }, OFFICE]);
    expect(summary.map((one) => one.key)).toEqual(['com.microteia.agenda', 'schedule', 'admin']);
    expect(summary[1].declaredBy.map((one) => one.from)).toEqual(['example', 'installation']);
    expect(summary[1].names).toEqual(['Schedule', 'Agenda']);
  });

  it('aponta o nome que aparece em mais de uma chave', () => {
    expect(sameNameDifferentKeys([SCHEDULE, OFFICE, ADMIN])).toEqual([
      { name: 'Agenda', keys: ['com.microteia.agenda', 'schedule'] },
    ]);
  });
});
