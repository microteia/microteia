import { describe, expect, it } from 'vitest';
import type { Contribution } from '../../schema/plugin/contribution';
import { declaredNavGroupsOf, navGroupKeysJoinedBy, navGroupNameKey, navGroupNames } from './declaredNavGroups';

const CONTRIBUTIONS: Contribution[] = [
  { point: 'i18n.messages', id: 'en.cal', apiVersion: '1.0.0', metadata: { locale: 'en', namespace: 'com.microteia.calendar', messages: { 'nav.group.schedule': 'Schedule' } } },
  { point: 'i18n.messages', id: 'pt.cal', apiVersion: '1.0.0', metadata: { locale: 'pt-BR', namespace: 'com.microteia.calendar', messages: { 'nav.group.schedule': 'Agenda' } } },
  { point: 'ui.nav.group', id: 'schedule', apiVersion: '1.0.0', metadata: { key: 'schedule', label: '@com.microteia.calendar/nav.group.schedule', order: 20 } },
  { point: 'ui.nav.group', id: 'literal', apiVersion: '1.0.0', metadata: { key: 'com.acme.cases', label: 'Processos', order: 30 } },
  { point: 'ui.nav', id: 'calendar', apiVersion: '1.0.0', metadata: { key: 'calendar', label: 'x', group: 'schedule' } },
  { point: 'ui.nav', id: 'loose', apiVersion: '1.0.0', metadata: { key: 'loose', label: 'y' } },
];

describe('os grupos da barra lateral que um pacote declara', () => {
  it('resolvem o nome em cada idioma que o pacote traz, com o inglês como rótulo', () => {
    expect(declaredNavGroupsOf(CONTRIBUTIONS)).toEqual([
      { key: 'schedule', label: 'Schedule', translations: { en: 'Schedule', 'pt-BR': 'Agenda' }, order: 20 },
      { key: 'com.acme.cases', label: 'Processos', translations: {}, order: 30 },
    ]);
  });

  it('a referência sem texto no pacote fica como está, para ser diagnosticável', () => {
    const [group] = declaredNavGroupsOf([CONTRIBUTIONS[2]]);
    expect(group.label).toBe('@com.microteia.calendar/nav.group.schedule');
  });

  it('as chaves em que os itens de menu entram', () => {
    expect(navGroupKeysJoinedBy(CONTRIBUTIONS)).toEqual(['schedule']);
  });

  it('o nome compara sem caixa, acento nem espaço sobrando', () => {
    expect(navGroupNameKey('  Agênda  ')).toBe(navGroupNameKey('agenda'));
    expect(navGroupNames({ label: 'Schedule', translations: { en: 'Schedule', 'pt-BR': 'Agenda' } })).toEqual(['schedule', 'agenda']);
  });
});
