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
  'agent.tab': 'Agentes de IA',
  'agent.title': 'Acesso de agente de IA',
  'agent.description':
    'Um acesso permite que um agente de IA trabalhe neste escritório em seu nome — pesquisar '
    + 'registros, cadastrar, alterar, rodar um relatório. Ele nunca pode mais do que você, e você '
    + 'pode revogá-lo quando quiser.',
  'agent.banner.disabled':
    'O acesso de agente de IA não está ativado neste escritório. Instale o "Acesso de Agente de IA" '
    + 'no Marketplace para ligá-lo.',
  'agent.banner.pending':
    'A extensão está instalada, mas o projeto Firebase ainda não foi provisionado, então o endereço '
    + 'não está no ar. Quem administra o projeto precisa rodar "microteia provision".',
  'agent.endpoint.label': 'Endereço da conexão',
  'agent.endpoint.hint':
    'É este o endereço a que o cliente de IA se conecta. Clientes que sabem fazer login — o Claude '
    + 'na web entre eles — pedem só o endereço, e cada pessoa entra com a própria conta. Um cliente '
    + 'que use token fixo manda o token no cabeçalho Authorization, e você o recebe ao emitir um '
    + 'acesso abaixo.',
  'agent.meta.signed-in-as': 'entrou por {client}',
  'agent.empty': 'Nenhum acesso emitido ainda.',
  'agent.action.issue': 'Emitir acesso',
  'agent.action.revoke': 'Revogar',
  'agent.state.active': 'Ativo',
  'agent.state.revoked': 'Revogado',
  'agent.state.expired': 'Expirado',
  'agent.meta.expires': 'expira em',
  'agent.meta.last-used': 'usado por último em',
  'agent.meta.never-used': 'nunca usado',
  'agent.meta.of-another': 'de outro membro',
  'agent.form.title': 'Emitir um acesso de agente de IA',
  'agent.form.name': 'Nome',
  'agent.form.name.placeholder': 'Claude no meu computador',
  'agent.form.name.hint': 'É como você reconhece este acesso depois, para revogar o certo.',
  'agent.form.permissions': 'Permissões que este acesso pode usar',
  'agent.form.permissions.placeholder': 'Escolha as permissões...',
  'agent.form.permissions.hint':
    'Só as permissões que você tem são oferecidas. Escolha as menos possíveis para o que precisa: o '
    + 'acesso pode tudo o que você liberar a ele, e nada além.',
  'agent.form.expiry': 'Validade',
  'agent.form.cancel': 'Cancelar',
  'agent.form.confirm': 'Emitir',
  'agent.form.issuing': 'Emitindo...',
  'agent.expiry.30': '30 dias',
  'agent.expiry.90': '90 dias',
  'agent.expiry.365': '1 ano',
  'agent.expiry.never': 'Sem expiração',
  'agent.issued.title': 'Acesso emitido',
  'agent.issued.once':
    'Copie o token agora: ele é mostrado esta única vez e não pode ser recuperado. Se você o perder, '
    + 'emita outro e revogue este.',
  'agent.issued.token': 'Token de acesso',
  'agent.issued.copy': 'Copiar token',
  'agent.issued.done': 'Pronto',
  'agent.issued.command': 'Para conectar o Claude Code',
  'agent.issued.command.hint':
    'Rode isto num terminal. Outros clientes de IA pedem o endereço e o token separadamente.',
  'agent.token.copied': 'Token copiado para a área de transferência.',
  'agent.revoke.title': 'Revogar este acesso?',
  'agent.revoke.message':
    'O acesso "{name}" para de funcionar imediatamente, e nenhum agente de IA que o use alcança mais '
    + 'este escritório. Isto não pode ser desfeito — emita um acesso novo se precisar de um outra vez.',
  'agent.revoke.failed': 'Não foi possível revogar o acesso. Tente novamente.',
  'agent.expiry.invalid': 'A validade tem de ficar entre 1 e 366 dias.',
  'agent.grant.required': 'Informe qual acesso deve ser revogado.',
  'agent.name.required': 'Dê um nome ao acesso, para ele poder ser reconhecido depois.',
  'agent.nothing-to-grant':
    'Você não tem nenhuma permissão neste escritório, então um acesso emitido aqui não concederia nada.',
  'agent.not-enabled': 'O acesso de agente de IA não está ativado neste escritório.',
  'agent.permission.unknown': 'A permissão "{permission}" não existe neste escritório.',
  'agent.permissions.required': 'Escolha ao menos uma permissão para o acesso.',
  'agent.permissions.unrestricted':
    'Um acesso não pode receber tudo: liste as permissões que ele pode usar, para que elas possam ser revisadas depois.',
  'agent.token.failed': 'Não foi possível emitir o acesso. Tente novamente.',
  'permission.picker.search': 'Buscar uma tela ou uma permissão...',
  'permission.picker.selected': '{selected} de {total} escolhidas',
  'permission.picker.group-count': '{selected}/{total}',
  'permission.picker.clear': 'Limpar',
  'permission.picker.no-matches': 'Nada corresponde a essa busca.',
  'permission.picker.nothing-to-offer':
    'Você não tem permissão nenhuma neste escritório, então não há o que permitir aqui.',
  'permission.picker.included-by': 'Incluída porque você escolheu {by}.',
  'permission.picker.missing-for':
    '{by} precisa desta para funcionar por completo. Deixe-a de fora só se você quis o acesso mais estreito.',
  'agent.oauth.title': 'Autorizar {client}',
  'agent.oauth.intro':
    '{client} está pedindo para trabalhar dentro de {tenant} em seu nome. Ele poderá fazer apenas o '
    + 'que você permitir abaixo, e nunca mais do que você mesmo pode fazer.',
  'agent.oauth.returns-to': 'Ao terminar, ele volta para {host}.',
  'agent.oauth.loopback':
    'Este cliente roda no seu próprio computador. Qualquer programa nesta máquina poderia dizer que '
    + 'é ele, então só continue se foi você quem iniciou a conexão.',
  'agent.oauth.tenant': 'Escritório',
  'agent.oauth.tenant.hint':
    'O acesso vale só para este escritório. Troque de escritório antes, se você quis outro.',
  'agent.oauth.allow': 'Autorizar',
  'agent.oauth.deny': 'Cancelar',
  'agent.oauth.working': 'Autorizando...',
  'agent.oauth.denied': 'Autorização cancelada. Você já pode fechar esta página.',
  'agent.oauth.request.missing': 'Esta página foi aberta sem um pedido de autorização.',
  'agent.oauth.request.unknown': 'Este pedido de autorização não existe mais. Comece de novo pelo cliente.',
  'agent.oauth.request.expired': 'Este pedido de autorização expirou. Comece de novo pelo cliente.',
  'agent.oauth.request.used': 'Este pedido de autorização já foi respondido.',
  'agent.input.unknown': 'Argumento desconhecido "{path}". Aceitos aqui: {accepted}.',
  'agent.input.unknown-none': 'Argumento desconhecido "{path}". Nada mais é aceito aqui.',
  'agent.input.missing': 'Falta o argumento obrigatório "{path}".',
  'agent.input.type': '"{path}" precisa ser do tipo {expected}.',
  'agent.input.enum': '"{path}" precisa ser um destes: {allowed}.',
  'agent.input.minimum': '"{path}" precisa ser no mínimo {limit}.',
  'agent.input.maximum': '"{path}" precisa ser no máximo {limit}.',
  'agent.query.in-needs-list': 'O operador "in" precisa de uma lista de valores em "{path}".',
  'agent.params.unknown': 'Parâmetros desconhecidos: {unknown}. Esta automação aceita: {accepted}.',
  'agent.params.unknown-none': 'Parâmetros desconhecidos: {unknown}. Esta automação não declara parâmetros.',
  'agent.prompts.unknown': 'Filtros desconhecidos: {unknown}. Este relatório aceita: {accepted}.',
  'agent.prompts.unknown-none': 'Filtros desconhecidos: {unknown}. Este relatório não declara filtros.',
  'agent.prompts.required': 'O filtro "{label}" ({key}) do relatório é obrigatório.',
  'agent.run.not-found': 'Nenhuma automação foi iniciada com o id de evento "{eventId}".',
  'agent.audit.date-invalid': '"{path}" não é uma data: envie "AAAA-MM-DD" ou um instante ISO-8601.',
  'agent.document.not-enabled':
    'A tela "{collection}" não tem a aba Documentos, então os registros dela não recebem anexos.',
  'agent.document.name-invalid': 'Dê ao arquivo um nome com a extensão, por exemplo "contrato.pdf".',
  'agent.document.content-invalid': '"content" não é um base64 válido.',
  'agent.document.empty': 'O arquivo está vazio.',
  'agent.document.too-large': 'O arquivo tem {size} MB, e o limite é menos de {limit} MB.',
  'agent.document.type-unknown': 'Tipo de documento desconhecido "{type}". Aceitos: {accepted}.',
  'agent.document.upload-failed': 'Não foi possível guardar o arquivo. Tente de novo.',
  'permission.agent.manage': 'Gerenciar acessos de agente de IA',
  'permission.agent.manage.description':
    'Ver e revogar os acessos de agente de IA de todos os membros. Emitir um acesso para si mesmo não exige esta permissão.',
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
  'permission.reports.manage': 'Gerenciar relatórios',
  'permission.reports.manage.description':
    'Criar, editar e remover os relatórios do escritório. Para EXECUTAR um relatório continua sendo preciso poder ler cada cadastro que ele cobre.',
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
  'resource.agent': 'Agentes de IA',
  'resource.ai': 'Inteligência artificial',
  'resource.audit': 'Auditoria',
  'resource.automation': 'Automações',
  'resource.data-processor': 'Processador de Dados',
  'resource.document-types': 'Tipos de documento',
  'resource.extensions': 'Extensões',
  'resource.members': 'Membros',
  'resource.reports': 'Relatórios',
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
