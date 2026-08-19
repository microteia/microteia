import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:processo';
const LIST_KEY = 'processos';
const GROUP = 'Processos';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * Aqui a busca casa o TÍTULO **e o SUBTÍTULO**: o subtítulo do processo é o NÚMERO, e procurar um
 * processo pelo número é tão comum quanto pelo título. Nas demais telas o subtítulo é classificação
 * (o tipo da pessoa, o do lançamento) e casá-lo devolveria o cadastro inteiro — por isso a escolha é
 * de cada extensão, e não uma regra do kernel.
 */
const matches = (record, screen, q) => {
  if (!q) return true;
  const haystack = (textOf(record, screen.titleFieldKey) + ' ' + textOf(record, screen.subtitleFieldKey)).toLowerCase();
  return haystack.indexOf(q) !== -1;
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
      const icon = <Icon name="folder" size={16} />;
      const items = [];
      if ('novo processo'.indexOf(q) !== -1) {
        items.push({ id: 'processo:new', title: 'Novo processo', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir processos'.indexOf(q) !== -1) {
        items.push({ id: 'processo:list', title: 'Abrir Processos', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'processo:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Processo',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'processo',
    label: 'Processo',
    description: 'Inserir link para um processo',
    icon: 'folder',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      const collection = screen.dataCollection || screen.id;
      return ctx.records
        .filter((r) => r.collection === collection)
        .map((r) => ({ record: r, title: r[screen.titleFieldKey] }))
        .filter(({ title }) => title && (!q || title.toLowerCase().indexOf(q) !== -1))
        .slice(0, 20)
        .map(({ record, title }) => ({ id: record.id, title, subtitle: 'Processo', tabKey: viewKey(screen, record.id) }));
    },
  });
}
