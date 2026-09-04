export const CORE_MARKETPLACE: Record<string, string> = {
  'page.marketplace': 'Extensões',
  'page.plugin-author': 'Criar extensão',
  'page.plugin-author-edit': 'Editar extensão',

  'author.template.view':
    'import { useCasePhases } from \'@microteia/data\';\n\nexport default function View() {\n  const phases = useCasePhases();\n  return (\n    <div style={{ padding: 16 }}>\n      Minha extensão — {phases.length} fase(s) cadastrada(s).\n    </div>\n  );\n}\n',
  'author.template.startup':
    '// import { Icon } from \'@microteia/ui\';\n\nexport default function startup(host) {\n  /*\n  // Exemplo: registrar comandos no Command Palette (⌘K)\n  host.commands.register({\n    group: \'Minha Extensão\',\n    getItems(query, ctx) {\n      const q = String(query || \'\').toLowerCase().trim();\n      if (!q) return [];\n      \n      // const icon = <Icon name="star" size={16} />;\n      const items = [];\n      \n      // Comando fixo (ex: "novo item")\n      if (\'novo item da extensão\'.indexOf(q) !== -1) {\n        items.push({\n          id: \'minha-ext:novo\',\n          title: \'Novo item da extensão\',\n          group: \'Minha Extensão\',\n          // icon,\n          onSelect: () => {\n            ctx.openTab(\'minha-tela:new\');\n            ctx.close();\n          }\n        });\n      }\n      \n      // Busca em registros (exemplo: entidades customizadas)\n      // for (const r of ctx.customRecords) {\n      //   if (r.screenKey === \'minha-tela\' && r.title?.toLowerCase().indexOf(q) !== -1) {\n      //     items.push({\n      //       id: \'minha-ext:\' + r.id,\n      //       title: r.title,\n      //       subtitle: \'Minha Extensão\',\n      //       group: \'Minha Extensão\',\n      //       icon,\n      //       onSelect: () => { ctx.openTab(\'minha-tela:\' + r.id); ctx.close(); }\n      //     });\n      //   }\n      // }\n      \n      return items.slice(0, 9);\n    },\n  });\n  */\n\n  /*\n  // Exemplo: registrar menção @ no chat\n  host.mentions.register({\n    key: \'minha-mencao\',\n    label: \'Minha Menção\',\n    description: \'Inserir link para um item da extensão\',\n    icon: \'star\',\n    search(query, ctx) {\n      const q = String(query || \'\').toLowerCase().trim();\n      \n      // Retornar lista de opções para o usuário escolher\n      // return ctx.customRecords\n      //   .filter((r) => r.screenKey === \'minha-tela\' && r.title && (!q || r.title.toLowerCase().indexOf(q) !== -1))\n      //   .slice(0, 20)\n      //   .map((r) => ({\n      //     id: r.id,\n      //     title: r.title,\n      //     subtitle: \'Minha Extensão\',\n      //     tabKey: \'minha-tela:\' + r.id\n      //   }));\n      \n      return [];\n    },\n  });\n  */\n\n  // Opcional: retornar função de cleanup para desregistrar ao descarregar a extensão\n  // return () => {\n  //   // Cleanup se necessário\n  // };\n}\n',
  'author.subtitle':
    'Empacote telas, ações, automações e scripts do seu escritório em uma extensão. Salve em Minhas Extensões para editar depois; a publicação fica na tela Extensões.',
  'author.admin-only': 'Somente administradores do escritório podem criar extensões.',
  'author.download': 'Baixar .json',
  'author.saving': 'Salvando...',
  'author.save-changes': 'Salvar alterações',
  'author.save-to-mine': 'Salvar em Minhas Extensões',
  'author.saved': '{name} salvo em Minhas Extensões.',
  'author.save-failed': 'Não foi possível salvar: {detail}',
  'author.exported': 'Arquivo da extensão gerado.',
  'author.identification': 'Identificação',
  'author.content': 'Conteúdo',
  'author.issues': 'Pendências',
  'author.dependencies':
    'Este pacote aponta para artefatos de {list}, e por isso passa a exigir essas extensões: um '
    + 'escritório só consegue instalá-lo depois de instalar cada uma.',
  'author.dependencies.join': ', ',
  'author.id.locked': 'O identificador é fixo após a criação.',
  'author.id.hint': 'DNS reverso, ao menos dois segmentos.',
  'author.field.name': 'Nome',
  'author.field.version': 'Versão',
  'author.field.summary': 'Resumo',
  'author.field.summary.placeholder': 'O que esta extensão adiciona ao escritório.',
  'author.field.category': 'Categoria (opcional)',
  'author.field.category.placeholder': 'Tema, Integração, Relatórios…',
  'author.field.description': 'Descrição (opcional)',
  'author.startup': 'Código de inicialização',
  'author.startup.edit': 'Editar código de inicialização',
  'author.startup.description':
    'Opcional. Roda uma vez quando a extensão é carregada no escritório e recebe um host para registrar serviços — como comandos do ⌘K e menções @. Exporte como default uma função (host) => cleanup?.',
  'author.compile-error': 'Não compila',
  'author.compile-error.detail': 'Não compila: {error}',
  'author.group.empty': 'Nada disponível.',
  'author.group.collapse': 'Colapsar grupo',
  'author.group.expand': 'Expandir grupo',
  'author.group.screen-patches': 'Campos e ações em telas existentes',
  'author.option.locked': 'Necessária por outro item marcado',
  'author.option.carried': 'Embarcada nesta extensão — clique para remover',
  'author.option.required': 'Obrigatório',
  'author.option.included': 'Incluída',
  'author.code-views': 'Telas de código',
  'author.code-views.empty': 'Nenhuma tela de código.',
  'author.view.add': 'Adicionar tela',
  'author.view.remove': 'Remover tela',
  'author.view.title': 'Título',
  'author.view.key': 'Chave (menu e endereço)',
  'author.view.untitled': 'Sem título',
  'author.view.fallback': 'tela de código',
  'author.view.no-code': 'sem código',
  'author.view.modal-title': 'Tela de código — {name}',
  'author.preview.show': 'Pré-visualizar ao lado',
  'author.preview.hide': 'Ocultar pré-visualização',
  'author.preview.failed': 'Não foi possível renderizar a pré-visualização. Verifique o código.',
  'author.selected.one': '{count} item selecionado',
  'author.selected.other': '{count} itens selecionados',
  'author.patch.fields': '{count} campo(s)',
  'author.patch.actions': '{count} ação(ões)',
  'author.patch.join': ' e ',
  'author.patch.summary': '{parts} seu(s)',
  'author.kind.screen': 'a tela',
  'author.kind.action': 'a ação',
  'author.kind.workflow': 'a automação',
  'author.kind.script': 'o script',
  'author.issue.view-key-required': 'A tela de código "{label}" precisa de uma chave.',
  'author.issue.view-key-invalid': 'A chave "{key}" é inválida: use minúsculas, números e "-".',
  'author.issue.view-key-duplicated': 'A chave "{key}" está repetida entre as telas de código.',
  'author.issue.view-title-required': 'Uma tela de código precisa de um título.',
  'author.issue.view-compile': 'A tela de código "{label}" não compila: {error}.',
  'author.issue.startup-compile': 'O código de inicialização não compila: {error}.',
  'author.issue.external-ref':
    '{origin} "{source}" referencia {kind} "{name}", que não está no pacote nem coberta por uma dependência declarada.',

  'author.field.id': 'Identificador',
  'author.field.id.placeholder': 'com.seuescritorio.vendas',
  'author.field.name.placeholder': 'Vendas',
  'author.view.key.placeholder': 'minha-tela',
  'extension.load-failed': 'Não foi possível carregar esta extensão: {message}',
  'marketplace.subtitle':
    'Crie e edite extensões na sua área privada, instale-as para usar no escritório e publique no catálogo para compartilhar com outros escritórios.',
  'marketplace.admin-only':
    'Somente administradores do escritório podem criar, instalar ou publicar extensões.',
  'marketplace.residue':
    '{count} artefato(s) de backend neste projeto Firebase pertencem a extensões que ninguém mais tem '
    + 'instaladas: {functions} Cloud Function(s) e {indexes} índice(s) de banco. Uma chamada que sobra '
    + 'fica só ali; um gatilho não — ele continua rodando a cada alteração, com o código de uma '
    + 'extensão que ninguém tem. Quem cuida do projeto os retira com "microteia provision --prune", no '
    + 'Microteia Console.',
  'marketplace.residue.scanned':
    'Lido de todos os escritórios deste projeto em {date}: {tenants} escritório(s), {extensions} '
    + 'extensão(ões) instalada(s).',
  'marketplace.empty':
    'Nenhuma extensão ainda. Use "Criar extensão", importe um .json ou instale a partir do catálogo público.',
  'marketplace.empty.filtered': 'Nenhuma extensão nesta visão.',
  'filter.all': 'Todas',
  'filter.installed': 'Instaladas',
  'filter.mine': 'Minhas',
  'filter.catalog': 'Catálogo',
  'filter.compose.placeholder': 'Filtrar as extensões…',
  'filter.search.placeholder': 'Nome, resumo ou identificador…',
  'filter.visibility': 'Visibilidade',
  'filter.installation': 'Instalação',
  'filter.installation.yes': 'Instalada',
  'filter.installation.no': 'Desinstalada',
  'filter.category.none': 'Sem categoria',
  'status.published': 'Publicada',
  'status.pending': 'Em análise',
  'status.deprecated': 'Obsoleta',
  'status.private': 'Privada',
  'status.builtin': 'Do sistema',
  'status.system': 'Faz parte do sistema',
  'extension.details': 'Ver detalhes',
  'extension.license': 'Termos de licença',
  'extension.license.title': 'Termos de licença de "{name}"',
  'extension.license.intro':
    'Termos escritos por quem criou esta extensão. Eles se somam aos Termos de Uso do Microteia, e são reproduzidos na página de Termos do escritório enquanto a extensão estiver instalada e ativa.',
  'extension.badge.active': 'Ativa',
  'extension.badge.inactive': 'Inativa',
  'extension.badge.failed': 'Não carregou',
  'extension.badge.update': 'Atualização',
  'extension.badge.has-code': 'Com código',
  'extension.badge.unreviewed': 'Código não revisado',
  'extension.badge.backend-pending': 'Backend pendente',
  'extension.backend-pending.detail':
    'Esta extensão precisa de funções de servidor ou de índices que este projeto Firebase ainda não '
    + 'tem, então ela está instalada mas não está no ar. Quem cuida do projeto aplica isso com '
    + '"microteia provision", no Microteia Console.',
  'extension.badge.migration-pending': 'Atualização de dados pendente',
  'extension.migration-pending.detail':
    'Esta extensão precisa atualizar dados gravados por uma versão anterior dela, então está instalada '
    + 'mas não está no ar. Só um administrador roda isso, em "Atualizar dados" neste cartão.',
  'extension.run-migrations': 'Atualizar dados',
  'extension.install': 'Instalar no escritório',
  'extension.update': 'Atualizar',
  'extension.uninstall': 'Desinstalar do escritório',
  'extension.activate': 'Ativar no escritório',
  'extension.deactivate': 'Desativar no escritório',
  'extension.publish': 'Publicar no catálogo',
  'extension.republish': 'Republicar no catálogo',
  'extension.approve': 'Aprovar publicação',
  'extension.reject': 'Recusar publicação',
  'extension.deprecate': 'Marcar como obsoleta',
  'extension.remove': 'Excluir da área privada',
  'extension.remove.title': 'Excluir extensão',
  'extension.remove.message':
    'Excluir "{name}" da sua área privada? Cópias já instaladas (aqui ou em outros escritórios) e a versão publicada não são afetadas.',
  'extension.import': 'Importar .json',
  'extension.imported': '{name} importado para Minhas Extensões.',
  'extension.import-failed': 'Não foi possível importar: {detail}',
  'extension.review': 'Revisar e confiar no código',
  'extension.review.title': 'Revisar o código de "{name}"',
  'extension.review.intro':
    'Este código roda no navegador de TODOS os membros do escritório, com acesso aos dados que cada um enxerga. Leia antes de liberar. Extensões vindas do catálogo público não passam por aqui — já foram revisadas na publicação.',
  'extension.review.confirm': 'Confiar e executar',
  'extension.trusted': 'Código revisado e liberado para executar neste escritório.',
  'extension.installed': 'Instalada no escritório.',
  'extension.uninstalled': 'Extensão desinstalada.',
  'extension.not-installed':
    'A extensão "{extension}" não está instalada neste escritório, então as funções de servidor dela '
    + 'não respondem aqui.',
  'extension.activated': 'Extensão ativada.',
  'extension.deactivated': 'Extensão desativada.',
  'extension.updated': 'Extensão atualizada.',
  'extension.removed': 'Extensão excluída da sua área privada.',
  'extension.published': 'Publicada no catálogo.',
  'extension.publish-failed': 'Não foi possível publicar: {detail}',
  'extension.sent-for-approval':
    'Enviada para aprovação: uma extensão com código só fica pública depois de aprovada por um administrador do sistema.',
  'extension.approved': 'Extensão aprovada.',
  'extension.deprecated': 'Extensão marcada como obsoleta.',
  'extension.rejected': 'Publicação recusada e removida do catálogo.',
  'extension.operation-failed': 'Não foi possível concluir a operação: {detail}',
  'author.group.screens': 'Telas',
  'author.view.default-title': 'Tela {number}',
  'diagnostic.capability.id.invalid':
    'Capability "{id}" é inválida. Use o formato "grupo.nome" (ex.: "ai.completion").',
  'diagnostic.capability.range.invalid': 'A faixa "{range}" da capability "{id}" é inválida.',
  'diagnostic.capability.unsatisfied':
    'O plugin "{id}" precisa de "{capability}" {range}, e nenhum plugin instalado fornece essa capacidade.',
  'diagnostic.capability.version.invalid': 'A versão "{version}" da capability "{id}" não é um semver válido.',
  'diagnostic.contribution.api-version.missing': 'A contribuição "{id}" precisa declarar apiVersion em semver.',
  'diagnostic.contribution.conflict':
    'O ponto "{point}" aceita uma única contribuição, mas {count} foram registradas. Prevaleceu "{winner}".',
  'diagnostic.contribution.duplicate':
    'A contribuição "{id}" já foi declarada para o ponto "{point}" neste plugin.',
  'diagnostic.contribution.id.invalid':
    'Id de contribuição "{id}" é inválido. Use letras minúsculas, números, "-" e ".".',
  'diagnostic.contribution.impl.kind-forbidden':
    'O ponto "{point}" não aceita implementação do tipo "{kind}". Aceita: {allowed}.',
  'diagnostic.contribution.impl.malformed':
    'A implementação da contribuição "{id}" está malformada para o tipo "{kind}".',
  'diagnostic.contribution.impl.missing':
    'O ponto "{point}" exige uma implementação e a contribuição "{id}" não declarou nenhuma.',
  'diagnostic.contribution.impl.trusted-only':
    'Implementação do tipo "{kind}" é exclusiva de plugins internos. Use "script", "widget" ou "workflow".',
  'diagnostic.contribution.impl.unresolved':
    'A contribuição "{id}" aponta para a implementação "{key}", que o plugin "{plugin}" não forneceu.',
  'diagnostic.contribution.metadata.invalid': 'A metadata da contribuição "{id}" precisa ser um objeto.',
  'diagnostic.contribution.point.incompatible':
    'A contribuição "{id}" espera o contrato {expected} de "{point}", que está na versão {actual}.',
  'diagnostic.contribution.point.invalid': 'Ponto de extensão "{point}" é inválido.',
  'diagnostic.contribution.point.unknown':
    'O ponto de extensão "{point}" não está registrado. A contribuição "{id}" foi ignorada.',
  'diagnostic.dependency.cycle':
    'O plugin "{id}" faz parte de um ciclo de dependências e não pôde ser carregado.',
  'diagnostic.dependency.disabled': 'O plugin "{id}" depende de "{dependency}", que não pôde ser carregado.',
  'diagnostic.dependency.missing': 'O plugin "{id}" depende de "{dependency}", que não está instalado.',
  'diagnostic.dependency.unsatisfied':
    'O plugin "{id}" exige "{dependency}" {range}, mas a versão instalada é {installed}.',
  'diagnostic.backend.not-object': 'A exigência de backend precisa ser um objeto.',
  'diagnostic.backend.functions-invalid': 'backend.functions precisa ser uma lista de nomes de função de servidor.',
  'diagnostic.backend.function-name-invalid': 'O nome de uma função de servidor começa com letra e aceita só letras, dígitos e sublinhado.',
  'diagnostic.backend.parameters-invalid': 'backend.parameters precisa ser uma lista de nomes de configuração.',
  'diagnostic.backend.parameter-name-invalid': 'O nome de uma configuração de backend é em maiúsculas, com dígitos e sublinhado.',
  'diagnostic.backend.indexes-invalid': 'backend.indexes precisa ser uma lista de definições de índice composto.',
  'diagnostic.backend.index.collection-missing': 'Um índice composto precisa nomear a coleção que ele indexa.',
  'diagnostic.backend.index.scope-invalid': 'O escopo de um índice composto é COLLECTION ou COLLECTION_GROUP.',
  'diagnostic.backend.index.fields-missing': 'Um índice composto precisa de pelo menos dois campos — um campo só é indexado automaticamente.',
  'diagnostic.backend.index.field-invalid': 'Todo campo de um índice composto precisa de um caminho.',
  'diagnostic.manifest.dependencies.invalid': 'As dependências precisam ser um objeto { pluginId: faixa }.',
  'diagnostic.manifest.dependency.id.invalid': 'A dependência "{id}" não é um id de plugin válido.',
  'diagnostic.manifest.dependency.range.invalid': 'A faixa "{range}" da dependência "{id}" é inválida.',
  'diagnostic.manifest.export.duplicated': 'O artefato público "{id}" está declarado duas vezes.',
  'diagnostic.manifest.export.id.invalid': 'O artefato público "{id}" não é um id de artefato válido.',
  'diagnostic.manifest.exports.invalid': 'Os artefatos públicos precisam ser uma lista de ids de artefato.',
  'diagnostic.manifest.id.invalid':
    'Id de plugin "{id}" é inválido. Use DNS reverso com ao menos dois segmentos (ex.: "com.acme.contratos").',
  'diagnostic.manifest.kernel.invalid': 'A faixa de kernel "{range}" é inválida. Use algo como "^1.0.0".',
  'diagnostic.manifest.kernel.unsatisfied':
    'O plugin "{name}" exige o Microteia {required}, mas esta instalação está na versão {installed}.',
  'diagnostic.manifest.name.missing': 'O plugin precisa de um nome legível.',
  'diagnostic.manifest.not-object': 'O manifest precisa ser um objeto.',
  'diagnostic.manifest.point.duplicated': 'O ponto de extensão "{id}" foi declarado mais de uma vez neste plugin.',
  'diagnostic.manifest.version.invalid': 'A versão "{version}" não é um semver válido.',
  'diagnostic.permission.invalid':
    'Permissão "{permission}" é inválida. Use "dominio:acao" ou "dominio:recurso:acao" com um dos domínios: {domains}.',
  'diagnostic.plugin.code-ignored':
    'O plugin "{id}" não é interno e por isso suas implementações em código foram ignoradas.',
  'diagnostic.plugin.duplicate':
    'O plugin "{id}" foi declarado mais de uma vez. A segunda declaração foi ignorada.',
  'diagnostic.point.api-version.invalid': 'O ponto "{id}" precisa de uma apiVersion em semver.',
  'diagnostic.point.id.invalid':
    'Ponto de extensão "{id}" é inválido. Use o formato "grupo.nome" (ex.: "ui.page").',
  'diagnostic.point.impl-kind.unknown': 'Tipo de implementação "{kind}" não existe. Use um de: {allowed}.',
  'diagnostic.point.impl-kinds.missing': 'O ponto "{id}" precisa declarar allowedImplKinds.',
  'diagnostic.point.impl-required-none-allowed': 'O ponto "{id}" exige implementação mas não permite nenhum tipo.',
  'diagnostic.point.owned':
    'O ponto de extensão "{id}" já pertence ao plugin "{owner}" e não pode ser redeclarado por "{claimant}".',
  'diagnostic.point.title.missing': 'O ponto "{id}" precisa de um título.',
  'issue.migration.id-duplicated': 'Duas migrações de dados têm o identificador "{id}" — é o identificador que registra que ela já rodou.',
  'issue.migration.id-invalid': 'O identificador "{id}" da migração de dados é inválido: minúsculas, dígitos e hífen, começando por letra.',
  'issue.migration.name-missing': 'A migração de dados "{id}" precisa de um nome — é o que o escritório lê antes de rodá-la.',
  'issue.migration.not-list': 'As migrações de dados precisam ser uma lista.',
  'issue.migration.out-of-order': 'A migração de dados "{id}" vem depois de "{previous}", de uma versão posterior — a ordem declarada é a ordem de execução.',
  'issue.migration.phase-invalid': 'A migração de dados "{id}" declara a fase "{phase}": ela roda "before" ou "after" os artefatos do pacote.',
  'issue.migration.rounds-invalid': 'A migração de dados "{id}" declara {rounds} rodadas — o teto precisa ser um número inteiro de 1 ou mais.',
  'issue.migration.source-missing': 'A migração de dados "{id}" está sem código.',
  'issue.migration.source-modules': 'A migração de dados "{id}" usa import/export/require, que o sandbox não resolve.',
  'issue.migration.version-invalid': 'A migração de dados "{id}" declara a versão "{version}", que não é um semver válido.',
  'issue.package.icon.unknown':
    'O ícone "{icon}" ({where}) não está no catálogo da plataforma. A instalação desenharia o marcador genérico no lugar dele. Peça `list_icons` ao servidor MCP microteia-plugin para ver todas as chaves.',
  'issue.package.near-limit':
    'O pacote tem {size}. Acima de {limit} ele deixa de caber no documento da instalação — convém dividi-lo antes de crescer mais.',
  'issue.package.no-manifest': 'A extensão não tem um manifest com "id".',
  'issue.package.no-summary': 'A extensão precisa de uma descrição curta (summary).',
  'issue.package.no-workflows': 'A extensão precisa da lista "workflows" (pode ser vazia).',
  'issue.package.not-json': 'O arquivo não é um JSON válido.',
  'issue.package.not-object': 'O conteúdo não é um objeto de extensão.',
  'issue.package.too-large':
    'O pacote tem {size} e não caberia no documento da instalação (o limite prático é {limit}). Divida-o — um pacote por idioma, ou um por conjunto de telas.',
  'issue.step.control-incomplete':
    'o passo "{step}" é um nó de controle {type} e não tem `{missing}` — o fluxo não tem sobre o que ramificar.',
  'issue.step.input-invalid':
    'o passo "{step}" ({definition}) dá à entrada "{input}" um valor que o passo recusa: {reason}',
  'issue.step.input-not-mapping':
    'o passo "{step}" ({definition}) põe um valor cru na entrada "{input}" — toda entrada de passo é um InputMapping, um entre Literal, Event, Expression, Output e Variable.',
  'issue.step.mapping-kind':
    'o passo "{step}" ({definition}) mapeia a entrada "{input}" como {kind}, que essa entrada não aceita. Ela recebe: {allowed}.',
  'issue.step.missing-input':
    'o passo "{step}" ({definition}) está sem a entrada obrigatória "{input}".',
  'issue.step.no-definition':
    'o passo "{step}" é do tipo {type} e não nomeia nenhum passo do catálogo — só Condition e Loop podem deixar `stepDefinitionId` vazio.',
  'issue.step.output-unknown-id':
    'o passo "{step}" lê a saída "{output}" do passo "{target}" pela entrada "{input}", e esse passo não a publica. Ele publica: {expected}.',
  'issue.step.output-unknown-step':
    'o passo "{step}" lê, pela entrada "{input}", a saída do passo "{target}", que não existe neste workflow.',
  'issue.step.type-unimplemented':
    'o passo "{step}" é do tipo {type}, que esta versão da plataforma não executa — o fluxo pararia ali.',
  'issue.step.unknown-definition':
    'o passo "{step}" nomeia o passo "{definition}", que não está no catálogo. O pacote não declara dependência nenhuma, então ele também não pode vir de outra extensão.',
  'issue.step.unknown-input':
    'o passo "{step}" ({definition}) preenche a entrada "{input}", que esse passo não tem. Ele recebe: {expected}.',
  'install.dependency-missing':
    'Esta extensão referencia {kind} "{id}" da extensão "{plugin}", que não está instalada — instale-a antes.',
  'install.dependent-breaks':
    '{origin} "{name}" da extensão "{dependent}" referencia {kind} "{id}", que esta versão não traz '
    + 'mais — atualize ou remova essa extensão antes.',
  'issue.patch.own-screen':
    'o complemento aponta para "{target}", que é uma tela do próprio pacote — declare os campos na tela, não num complemento.',
  'issue.patch.unknown-target':
    'o complemento aponta para "{target}", que não é uma coleção fixa do sistema — para estender a tela de outra extensão, use o `sourceId` dela.',
  'issue.screen.duplicate-prefix':
    'a tela "{screen}" emitiria "{prefix}.saved", nome que "{taken}" já usa neste pacote — duas coleções não podem publicar o mesmo evento.',
  'issue.screen.kernel-prefix':
    'a tela "{screen}" declara o prefixo "{prefix}", que é de {entity} — as automações de {entity} passariam a disparar com "{collection}".',
  'issue.screen.reserved-prefix':
    'a tela "{screen}" emitiria "{prefix}.saved", um nome reservado pelo motor de automações — declare outro `eventPrefix`.',
  'issue.report.invalid': 'O relatório "{name}" não pode ser executado como está — {field}: {detail}',
  'issue.ref.external':
    '{origin} "{name}" referencia {kind} "{id}", que não está no pacote nem coberta por uma dependência declarada.',
  'issue.ref.malformed':
    '{origin} "{name}" referencia {kind} "{id}", que não é uma referência válida — use <id-da-extensão>/<id-do-artefato>.',
  'issue.ref.not-exported':
    '{origin} "{name}" referencia {kind} "{id}", que a extensão "{plugin}" não declara em `exports`.',
  'issue.ref.screen-qualified':
    '{origin} "{name}" referencia a tela "{id}" na forma qualificada — uma tela é nomeada pela coleção dela, ou pelo `sourceId` da extensão que a traz.',
  'issue.ref.self':
    '{origin} "{name}" referencia {kind} "{id}" pelo id do próprio pacote — dentro do pacote, nomeie o artefato direto.',
  'issue.ref.undeclared':
    '{origin} "{name}" referencia {kind} "{id}", que pertence à extensão "{plugin}" — declare-a em `dependencies`.',
  'permission.domain.capability': 'Integrações',
  'permission.domain.data': 'Dados do escritório',
  'permission.domain.net': 'Rede externa',
  'permission.domain.script': 'Scripts',
  'permission.domain.ui': 'Interface',
  'permission.domain.workflow': 'Automações',
  'ref.kind.action': 'a ação',
  'ref.kind.screen': 'a tela',
  'ref.kind.script': 'o script',
  'ref.kind.workflow': 'a automação',
  'ref.origin.action': 'ação',
  'ref.origin.patch': 'complemento de',
  'ref.origin.report': 'relatório',
  'ref.origin.screen': 'tela',
  'ref.origin.workflow': 'automação',
  'ref.origin.workflow-step': 'passo "{step}" da automação',
  'extension.code-pending-review':
    'Esta extensão traz uma tela em código, que só será executada após ser publicada no catálogo por um administrador do sistema. Os dados foram instalados normalmente.',
  'publish.id-taken': 'Este identificador já foi publicado por outro escritório.',
  'publish.invalid-version': 'A versão "{version}" não é válida.',
  'publish.no-tenant': 'Sem escritório ou usuário.',
  'lifecycle.already-installed': 'O plugin "{id}" já está instalado (versão {version}). Use atualizar.',
  'lifecycle.invalid-version': 'Versão "{version}" não é um semver válido.',
  'lifecycle.not-installed': 'O plugin não está instalado neste escritório.',
  'lifecycle.not-newer': 'A versão {version} não é mais recente que a instalada ({installed}).',
  'migration.error.failed': 'A atualização de dados "{name}" falhou: {detail}',
  'migration.error.locked': 'Outra atualização de dados desta extensão já está em curso neste escritório. Aguarde ela terminar.',
  'migration.error.max-rounds': 'A atualização de dados "{name}" não terminou em {rounds} rodadas. Rode de novo para continuar de onde parou.',
  'migration.error.no-progress': 'A atualização de dados "{name}" parou com {remaining} registros faltando e não avançou — precisa de correção de quem a escreveu.',
  'migration.ran': 'Dados de {name} atualizados.',
  'migration.up-to-date': 'Os dados de {name} já estão atualizados.',
  'extension.history': 'Histórico de versões',
  'history.title': 'Histórico de versões — {name}',
  'history.intro': 'Todas as versões que este escritório já aplicou desta extensão. Voltar a uma reaplica o pacote dela exatamente como era, e o histórico continua como está.',
  'history.empty': 'Esta extensão ainda não tem nenhuma versão aplicada registrada.',
  'history.current': 'Aplicada agora',
  'history.applied-by': 'Aplicada por {name} em {date}',
  'history.limit': 'São guardadas as últimas {count} versões aplicadas; as mais antigas saem à medida que chegam novas.',
  'history.uninstalled': 'A extensão não está instalada neste escritório. Aplicar uma versão do histórico a traz de volta.',
  'history.apply': 'Aplicar esta versão',
  'history.applied': 'Versão {version} aplicada.',
  'history.error.missing': 'O pacote desta versão não está mais no histórico.',
  'capability.ai-completion': 'Geração de texto por IA',
  'plugin.capabilities.description':
    'Declara o ponto de extensão onde plugins fornecem implementações de Capabilities.',
  'point.capability.description':
    'Fornece a implementação de uma Capability (IA, mensageria, pagamentos). Vários plugins podem fornecer a mesma, e o escritório escolhe qual usar.',
  'point.capability.title': 'Provedor de uma capacidade',
  'author.patch.field-count': '{name} ({count} campo(s))',
};
