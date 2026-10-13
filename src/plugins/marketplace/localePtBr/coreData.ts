export const CORE_DATA: Record<string, string> = {
  'lookup.field.color': 'Cor',
  'lookup.field.id': 'Id',
  'lookup.field.key': 'Chave',
  'lookup.field.label': 'Rótulo',
  'member.field.display-name': 'Nome de exibição',
  'member.field.email': 'E-mail',
  'member.field.name': 'Nome',
  'member.field.role': 'Papel',
  'lookup.qualified': '{screen}: {entity}',
  'lookup.document-types.screen': 'Documentos',
  'lookup.document-types.entity': 'Tipo',
  'member.plural': 'Membros',
  'member.singular': 'Membro',
  'point.entity.description': 'Declara uma entidade nativa (coleção, campos, FKs) para o schema e o motor.',
  'point.entity.title': 'Entidade de domínio',
  'point.business-calendar.description':
    'Declara a coleção que guarda os calendários de dias úteis: os dias da semana que nunca são úteis e, por ano, os dias que também não são. O kernel conta; a extensão diz onde os calendários moram.',
  'point.business-calendar.title': 'Calendários de dias úteis',
  'point.field-preset.description':
    'Declara um preset de campo (máscara por template, pipeline de formatação, validação por expressão ou regex). Sem código: a mesma declaração vale no formulário e na gravação por automação.',
  'point.field-preset.title': 'Máscara, formatação e validação prontas',
  'point.lookup-provider.description':
    'Declara um provedor para "Ao alterar, buscar dados externos": a requisição inteira é dado (URL, quando disparar, mapa da resposta). Sem código — o kernel executa e impõe https, timeout e ausência de credencial.',
  'point.lookup-provider.title': 'Busca de dados externos',
  'point.lookup.description': 'Declara uma coleção de lista simples (tipos, categorias, status).',
  'point.lookup.title': 'Lista de valores (lookup)',
  'point.service.description':
    'Um plugin registra um serviço próprio (ex.: integração externa), resolvível por chave via useDI().resolveService. O container tipado do núcleo permanece intocado.',
  'point.service.title': 'Serviço injetável de plugin',
  'lookup-provider.failed': 'Não foi possível consultar os dados',
  'plugin.data.description':
    'Declara os pontos de dados e expõe as entidades nativas e os lookups do sistema.',
};
