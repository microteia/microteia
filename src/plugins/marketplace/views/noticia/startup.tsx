import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:news';
const READ_TAB_PREFIX = 'news-read:';
const LIST_KEY = 'news';
const GROUP = 'Notícias';

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection);
};

const matches = (record, q) => {
  if (!q) return true;
  const title = textOf(record, 'title').toLowerCase();
  const summary = textOf(record, 'summary').toLowerCase();
  return title.indexOf(q) !== -1 || summary.indexOf(q) !== -1;
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="newspaper" size={16} />;
      const items = [];
      if ('nova notícia'.indexOf(q) !== -1) {
        items.push({ id: 'noticia:new', title: 'Nova notícia', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir notícias'.indexOf(q) !== -1) {
        items.push({ id: 'noticia:list', title: 'Abrir Notícias', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, q)) continue;
        items.push({
          id: 'noticia:' + r.id,
          title: textOf(r, 'title'),
          subtitle: textOf(r, 'summary') || 'Notícia',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(READ_TAB_PREFIX + r.id); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'noticia',
    label: 'Notícia',
    description: 'Inserir link para uma notícia',
    icon: 'newspaper',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return recordsOf(ctx, screen)
        .filter((r) => textOf(r, 'title') && matches(r, q))
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          title: textOf(r, 'title'),
          subtitle: textOf(r, 'summary') || 'Notícia',
          tabKey: READ_TAB_PREFIX + r.id,
        }));
    },
  });
}
