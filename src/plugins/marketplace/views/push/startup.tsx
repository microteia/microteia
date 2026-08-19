import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:push';
const LIST_KEY = 'pushes';
const SETTINGS_KEY = 'push-settings';
const GROUP = 'Pushes';

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection);
};

const matches = (record, q) => {
  if (!q) return true;
  const subject = textOf(record, 'subject').toLowerCase();
  const number = textOf(record, 'processNumber').toLowerCase();
  return subject.indexOf(q) !== -1 || number.indexOf(q) !== -1;
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="inbox" size={16} />;
      const items = [];
      if ('abrir pushes do tribunal'.indexOf(q) !== -1) {
        items.push({ id: 'push:list', title: 'Abrir Pushes do Tribunal', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      // O recebimento é do administrador — e é o que se procura por "gmail", "e-mail" ou
      // "recebimento", nunca por "push". Era um comando do kernel; saiu junto com a tela.
      if (ctx.tenantRole === 'admin' && 'configurar recebimento de pushes gmail e-mail intimações'.indexOf(q) !== -1) {
        items.push({
          id: 'push:settings',
          title: 'Configurar recebimento de Pushes',
          subtitle: 'Contas de e-mail monitoradas',
          group: GROUP,
          icon: <Icon name="mailOpen" size={16} />,
          onSelect: () => { ctx.openTab(SETTINGS_KEY); ctx.close(); },
        });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, q)) continue;
        items.push({
          id: 'push:' + r.id,
          title: textOf(r, 'subject') || '(sem assunto)',
          subtitle: textOf(r, 'processNumber') || 'Push',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });
}
