import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:contrato';
const LIST_KEY = 'contratos';
const GROUP = 'Contratos';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa o TÍTULO **e o SUBTÍTULO**: o subtítulo do contrato é o NÚMERO, e procurar um
 * contrato por ele é tão comum quanto pelo título — o mesmo de Processos. Onde o subtítulo é
 * classificação (o tipo da pessoa, o do lançamento), a extensão casa só o título, senão devolveria
 * o cadastro inteiro a quem digitasse "fis".
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
      const icon = <Icon name="fileText" size={16} />;
      const items = [];
      if ('novo contrato'.indexOf(q) !== -1) {
        items.push({ id: 'contrato:new', title: 'Novo contrato', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir contratos'.indexOf(q) !== -1) {
        items.push({ id: 'contrato:list', title: 'Abrir Contratos', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'contrato:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Contrato',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'contrato',
    label: 'Contrato',
    description: 'Inserir link para um contrato',
    icon: 'fileText',
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
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Contrato',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
