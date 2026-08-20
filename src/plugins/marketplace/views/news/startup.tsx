import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:news';
const READ_TAB_PREFIX = 'news-read:';
const LIST_KEY = 'news';
const NAMESPACE = 'com.microteia.news';

/** A reference into this extension's own catalog, for whoever renders the label to resolve. */
const message = (key) => '@' + NAMESPACE + '/' + key;

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
    group: message('command.group'),
    /**
     * `getItems` is not a component, so there is no hook here — the translator arrives in the CONTEXT.
     * An absolute key (`namespace/key`) makes it resolve this extension's catalog instead of the
     * kernel's.
     *
     * The query is compared against the TRANSLATED title, and that is the whole point: matching a
     * hardcoded phrase would leave the command unreachable for anyone typing what they actually read
     * on screen.
     */
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="newspaper" size={16} />;
      const group = message('command.group');
      const newTitle = ctx.t(NAMESPACE + '/command.new');
      const openTitle = ctx.t(NAMESPACE + '/command.open');
      const items = [];
      if (newTitle.toLowerCase().indexOf(q) !== -1) {
        items.push({ id: 'news:new', title: newTitle, group, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if (openTitle.toLowerCase().indexOf(q) !== -1) {
        items.push({ id: 'news:list', title: openTitle, group, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, q)) continue;
        items.push({
          id: 'news:' + r.id,
          title: textOf(r, 'title'),
          subtitle: textOf(r, 'summary'),
          group,
          icon,
          onSelect: () => { ctx.openTab(READ_TAB_PREFIX + r.id); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    // The trigger typed after `@`. It is an IDENTIFIER, not a label: it stays stable across languages,
    // the same way a field key does.
    key: 'news',
    label: message('mention.label'),
    description: message('mention.description'),
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
          subtitle: textOf(r, 'summary'),
          tabKey: READ_TAB_PREFIX + r.id,
        }));
    },
  });
}
