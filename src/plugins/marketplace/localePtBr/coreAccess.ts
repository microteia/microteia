export const CORE_ACCESS: Record<string, string> = {
  'action.create': 'Criar',
  'action.delete': 'Excluir',
  'action.read': 'Visualizar',
  'action.update': 'Editar',
  'diagnostic.permission.cycle':
    'As permissões dependem umas das outras em círculo ({path}), então nenhuma delas pode ser concedida.',
  'diagnostic.permission.duplicate':
    'A permissão "{id}" foi declarada mais de uma vez. Só a primeira declaração vale.',
  'diagnostic.permission.id.invalid':
    'O identificador de permissão "{id}" é inválido. Use a forma recurso.acao, como financeiro.read.',
  'diagnostic.permission.name.missing': 'A permissão "{id}" está sem nome.',
  'diagnostic.permission.not-object': 'A permissão não é um objeto.',
  'diagnostic.permission.requires.invalid':
    'As dependências da permissão "{id}" precisam ser uma lista de identificadores de permissão.',
  'diagnostic.permission.requires.malformed':
    'A permissão "{id}" depende de "{required}", que não é um identificador válido.',
  'diagnostic.permission.requires.self': 'A permissão "{id}" não pode depender de si mesma.',
  'diagnostic.permission.requires.unknown':
    'A permissão "{id}" depende de "{required}", que não existe.',
  'diagnostic.permission.unknown': 'A permissão "{id}" não existe.',
  'diagnostic.requirement.cycle':
    'A dependência acrescentada de "{id}" em "{required}" foi ignorada, porque "{required}" já depende de "{id}".',
  'diagnostic.requirement.id.invalid':
    'A dependência acrescentada aponta para "{id}", que não é um identificador de permissão válido.',
  'diagnostic.requirement.not-object': 'A dependência acrescentada não é um objeto.',
  'diagnostic.requirement.requires.invalid':
    'As dependências acrescentadas à permissão "{id}" precisam ser uma lista não vazia de identificadores de permissão.',
  'diagnostic.requirement.requires.malformed':
    'A dependência "{required}" acrescentada à permissão "{id}" não é um identificador válido.',
  'diagnostic.requirement.requires.self':
    'A permissão "{id}" não pode receber uma dependência de si mesma.',
  'diagnostic.requirement.target.unknown':
    'Uma dependência foi acrescentada à permissão "{id}", que não existe. O acréscimo foi ignorado.',
  'diagnostic.requirement.unknown':
    'A dependência "{required}" acrescentada à permissão "{id}" não existe, então ela foi ignorada — "{id}" continua funcionando como antes.',
  'permission.ai.manage': 'Gerenciar conexões de IA',
  'permission.ai.manage.description':
    'Cadastrar, editar e remover as conexões de inteligência artificial do escritório.',
  'permission.audit.read': 'Ler a auditoria',
  'permission.audit.read.description': 'Ver tudo o que foi criado, alterado e excluído no escritório.',
  'permission.automation.manage': 'Gerenciar automações',
  'permission.automation.manage.description':
    'Criar, editar e excluir automações, scripts e as ações exibidas nas telas.',
  'permission.automation.run': 'Executar automações',
  'permission.automation.run.description': 'Disparar uma automação, uma ação ou um script manualmente.',
  'permission.data-processor.use': 'Usar o Processador de Dados',
  'permission.data-processor.use.description': 'Importar e transformar dados em lote.',
  'permission.denied': 'Você não tem permissão para fazer isto ({permission}).',
  'office.unauthenticated': 'É necessário entrar no sistema.',
  'office.not-member': 'Você não é membro deste escritório.',
  'permission.document-types.manage': 'Gerenciar tipos de documento',
  'permission.document-types.manage.description':
    'Criar, editar e remover os tipos de documento sob os quais os registros anexam arquivos.',
  'permission.extensions.manage': 'Gerenciar extensões',
  'permission.extensions.manage.description':
    'Instalar, atualizar, ativar e remover extensões do escritório.',
  'permission.members.manage': 'Gerenciar membros',
  'permission.members.manage.description':
    'Incluir e remover pessoas do escritório, e escolher os perfis de acesso de cada uma.',
  'permission.roles.manage': 'Gerenciar perfis de acesso',
  'permission.roles.manage.description':
    'Criar, editar e excluir perfis de acesso, e escolher quais permissões cada um concede.',
  'permission.screens.manage': 'Gerenciar telas',
  'permission.screens.manage.description':
    'Criar e alterar telas, campos e listas de opções no Form Design.',
  'permission.settings.manage': 'Alterar as configurações do escritório',
  'permission.settings.manage.description':
    'Definir os padrões que valem para todo mundo no escritório.',
  'permission.tenant.update': 'Alterar o cadastro do escritório',
  'permission.tenant.update.description': 'Editar o nome, o logotipo e os demais dados do escritório.',
  'permission.translations.manage': 'Gerenciar traduções',
  'permission.translations.manage.description': 'Alterar os textos da interface para o escritório.',
  'point.permission.description':
    'Uma capacidade do sistema, declarada por quem a implementa e agrupada em perfis de acesso pelo escritório.',
  'point.permission.title': 'Permissão',
  'point.resource.description':
    'O rótulo de um recurso sobre o qual as permissões falam, quando ele não é uma coleção de tela.',
  'point.requirement.description':
    'Uma dependência acrescentada a uma permissão declarada por outro pacote, ou derivada de uma tela, para que lê-la também conceda o que uma extensão complementar precisa.',
  'point.requirement.title': 'Dependência acrescentada de permissão',
  'point.resource.title': 'Recurso de permissão',
  'resource.ai': 'Inteligência artificial',
  'resource.audit': 'Auditoria',
  'resource.automation': 'Automações',
  'resource.data-processor': 'Processador de Dados',
  'resource.document-types': 'Tipos de documento',
  'resource.extensions': 'Extensões',
  'resource.members': 'Membros',
  'resource.roles': 'Perfis de acesso',
  'resource.screens': 'Telas',
  'resource.settings': 'Configurações',
  'resource.tenant': 'Escritório',
  'resource.translations': 'Traduções',
  'role.count': '{count} perfis de acesso',
  'role.delete-failed': 'Não foi possível excluir o perfil de acesso.',
  'role.delete.message':
    'Excluir o perfil de acesso "{name}"? Quem o tiver perde o que ele concedia.',
  'role.delete.title': 'Excluir perfil de acesso',
  'role.deleted': 'Perfil de acesso excluído.',
  'role.description': 'Descrição',
  'role.description.placeholder': 'Para que serve este perfil…',
  'role.empty': 'Nenhum perfil de acesso ainda. Crie o primeiro para começar a conceder acesso.',
  'role.included-by': 'Incluída por: {names}',
  'role.identifier.hint': 'O identificador para usar em hasPermission(\'…\') dentro de uma expressão',
  'role.includes': 'Inclui automaticamente: {names}',
  'role.manage-only': 'Só quem gerencia perfis de acesso pode abrir esta aba.',
  'role.name': 'Nome',
  'role.name.placeholder': 'Financeiro, Recepção…',
  'role.name.required': 'O perfil de acesso precisa de um nome.',
  'role.new': 'Novo perfil',
  'role.permission-count': '{count} permissões',
  'role.qualified-name': '{action} — {resource}',
  'role.save-failed': 'Não foi possível salvar o perfil de acesso.',
  'role.saved': 'Perfil de acesso salvo.',
  'role.search.none': 'Nenhuma permissão corresponde a esta busca.',
  'role.search.placeholder': 'Filtrar permissões…',
  'role.summary': '{explicit} escolhidas, {effective} em vigor',
  'role.system.locked': 'Este perfil é controlado pelo sistema e não pode ser alterado aqui.',
  'role.system.protected':
    'Este perfil de acesso é controlado pelo sistema e não pode ser alterado nem excluído.',
  'role.edit': 'Editar perfil de acesso',
  'role.granted.more': '+{count}',
  'role.granted.none': 'Nenhum perfil',
  'role.panel.manage': 'Perfis de acesso',
  'role.panel.roles': 'Perfis que a concedem',
  'role.permissions.hint': 'As permissões de um perfil são escolhidas na lista, clicando numa permissão.',
};
