/** Os textos dos dados: entidades nativas, listas, máscaras e as buscas externas. */
export const CORE_DATA_MESSAGES: Record<string, string> = {
  'lookup.field.color': 'Color',
  'lookup.field.id': 'Id',
  'lookup.field.key': 'Key',
  'lookup.field.label': 'Label',
  'member.field.display-name': 'Display name',
  'member.field.email': 'E-mail',
  'member.field.name': 'Name',
  'member.field.role': 'Role',
  'point.entity.description':
    'Declares a native entity (collection, fields, FKs) for the schema and the engine.',
  'point.entity.title': 'Domain entity',
  'point.field-preset.description':
    'Declares a field preset (template mask, formatting pipeline, validation by expression or regex). No code: the same declaration holds in the form and when an automation writes.',
  'point.field-preset.title': 'Ready-made mask, formatting and validation',
  'point.lookup-provider.description':
    'Declares a provider for "On change, fetch external data": the whole request is data (URL, when to fire, response map). No code — the kernel runs it and enforces https, a timeout and the absence of credentials.',
  'point.lookup-provider.title': 'External data lookup',
  'point.lookup.description': 'Declares a simple list collection (types, categories, statuses).',
  'point.lookup.title': 'Value list (lookup)',
  'point.service.description':
    'A plugin registers a service of its own (e.g. an external integration), resolvable by key through useDI().resolveService. The typed container of the core stays untouched.',
  'point.service.title': 'Injectable plugin service',
  'lookup-provider.failed': 'Could not fetch the data',
  'plugin.data.description': 'Declares the data points and exposes the native entities and system lookups.',
};
