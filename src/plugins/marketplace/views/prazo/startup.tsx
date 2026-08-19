import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:prazo';
const LIST_KEY = 'prazos';
const GROUP = 'Prazos';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO (o tipo do prazo). O subtítulo é o STATUS, uma classificação que todo
 * registro repete: casá-la devolveria a agenda inteira para quem digitasse "pen". Quem inclui o
 * subtítulo é Processos e Contratos, onde ele é o NÚMERO do registro.
 */
const matches = (record, screen, q) => {
  if (!q) return true;
  return textOf(record, screen.titleFieldKey).toLowerCase().indexOf(q) !== -1;
};

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection && textOf(r, screen.titleFieldKey));
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="time" size={16} />;
      const items = [];
      if ('novo prazo'.indexOf(q) !== -1) {
        items.push({ id: 'prazo:new', title: 'Novo prazo', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir prazos'.indexOf(q) !== -1) {
        items.push({ id: 'prazo:list', title: 'Abrir Prazos', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'prazo:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Prazo',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'prazo',
    label: 'Prazo',
    description: 'Inserir link para um prazo',
    icon: 'time',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return recordsOf(ctx, screen)
        .filter((r) => matches(r, screen, q))
        .slice(0, 20)
        .map((record) => ({
          id: record.id,
          title: textOf(record, screen.titleFieldKey),
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Prazo',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
