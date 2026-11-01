export const CORE_MARKETPLACE: Record<string, string> = {
  'page.marketplace': 'Extensões',
  'page.plugin-author': 'Criar extensão',
  'page.plugin-author-edit': 'Editar extensão',
  'nav.updates.one': '{count} extensão com atualização à espera',
  'nav.updates.other': '{count} extensões com atualização à espera',

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
  'author.field.icon': 'Ícone (opcional)',
  'author.field.icon.placeholder': 'Escolha um ícone',
  'author.field.image': 'Imagem (opcional)',
  'author.image.choose': 'Escolher imagem',
  'author.image.replace': 'Trocar imagem',
  'author.image.remove': 'Remover imagem',
  'author.image.hint': 'PNG, JPEG, WebP ou SVG, até {limit} KB. Aparece ao lado do nome na tela de Extensões; sem ela, usa-se o ícone.',
  'author.image.read-failed': 'Não foi possível ler a imagem: {detail}',
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
  'author.kind.lookup': 'a lista de opções',
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
  'extension.installs.one': '{formatted} instalação',
  'extension.installs.other': '{formatted} instalações',
  'extension.rating.one': 'Nota {average} de {max}, dada por {formatted} pessoa',
  'extension.rating.other': 'Nota {average} de {max}, dada por {formatted} pessoas',
  'extension.verified.first-party': 'Publicada pela Microteia — autenticidade garantida pela origem',
  'extension.verified.publisher': 'Publicador verificado',
  'extension.verify-publisher': 'Marcar o publicador como verificado',
  'extension.unverify-publisher': 'Retirar a verificação do publicador',
  'extension.publisher-verified': '{name} agora é um publicador verificado.',
  'extension.publisher-unverified': '{name} deixou de ser um publicador verificado.',
  'extension.my-rating': 'Sua avaliação',
  'extension.my-rating.hint': 'Sua avaliação aparece para todo escritório que vê esta extensão. A média pode levar alguns segundos para se atualizar.',
  'extension.rate.star.one': '{count} estrela',
  'extension.rate.star.other': '{count} estrelas',
  'extension.rated': 'Obrigado — sua avaliação foi registrada.',
  'extension.rating.clear': 'Retirar minha avaliação',
  'extension.rating.cleared': 'Sua avaliação foi retirada.',
  'issue.package.image.invalid': 'A imagem da extensão (manifest.image) precisa ser um data: URI em base64 de uma imagem PNG, JPEG, WebP ou SVG. Endereços da web não são aceitos: o pacote precisa levar tudo o que mostra.',
  'install.collision.screen': 'A extensão não foi instalada: ela cria a tela "{name}", e o escritório já usa esse nome para uma tela, uma lista de opções ou um conjunto de etiquetas. Nada foi alterado.',
  'install.collision.list': 'A extensão não foi instalada: ela declara a lista "{name}", que pertence a outra extensão ou é o nome de uma tela. Nada foi alterado.',
  'install.prefix-changed': 'Esta versão troca o prefixo da extensão de "{from}" para "{to}", o que renomearia tudo o que ela criou. O prefixo de uma extensão nunca muda: esta versão não foi instalada.',
  'issue.prefix.invalid': 'O prefixo da extensão "{prefix}" não é válido. Use de 2 a 8 letras minúsculas ou dígitos, começando por letra: acme.',
  'issue.prefix.missing': 'O nome "{name}" precisa começar com "{head}": todo nome que esta extensão cria leva o prefixo dela.',
  'issue.package.image.too-large': 'A imagem da extensão tem {size} KB; o limite é {limit} KB.',
  'sort.label': 'Ordenar por',
  'sort.relevance': 'Relevância',
  'sort.installs': 'Mais instaladas',
  'sort.rating': 'Mais bem avaliadas',
  'sort.name': 'Nome',
  'author.imported-locked': 'A extensão "{id}" foi importada. Extensões importadas não podem ser editadas aqui: a fonte delas pertence a quem as escreveu. Crie uma extensão nova, com outro identificador, para empacotar os artefatos do escritório.',
  'author.imported-locked.banner': 'Esta extensão foi importada, por isso não pode ser editada nem exportada aqui: a fonte dela pertence a quem a escreveu. Ela continua podendo ser ativada, instalada e publicada no catálogo. Para alterá-la, peça ao autor uma versão nova e importe-a de novo.',
  'import.authored-here': 'Já existe uma extensão criada neste escritório com o identificador "{id}". Importar a substituiria por uma cópia que não pode mais ser editada — mude o identificador do pacote ou exclua antes a extensão existente.',
  'extension.badge.imported': 'Importada',
  'extension.badge.imported.hint': 'Trazida de um arquivo. Pode ser ativada, instalada e publicada, mas não editada nem baixada: a fonte dela pertence a quem a escreveu.',
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
  'extension.republish': 'Levar a versão {version} ao catálogo',
  'extension.publish.needs-version':
    'Suba a versão desta extensão para levar as mudanças ao catálogo: quem já a instalou só recebe a '
    + 'atualização quando a versão sobe.',
  'extension.approve': 'Aprovar publicação',
  'extension.reject': 'Recusar publicação',
  'extension.deprecate': 'Marcar como obsoleta',
  'extension.remove': 'Excluir da área privada',
  'extension.range.title': 'Aplicar esta versão mesmo assim?',
  'extension.range.message':
    '{detail} Aplicar agora deixa essa extensão instalada, mas sem carregar, até que a outra também seja atualizada.',
  'extension.range.confirm': 'Aplicar mesmo assim',
  'extension.remove.title': 'Excluir extensão',
  'extension.remove.message':
    'Excluir "{name}" da sua área privada? Cópias já instaladas (aqui ou em outros escritórios) e a versão publicada não são afetadas.',
  'extension.import': 'Importar .json',
  'extension.imported': '{name} importado para Minhas Extensões.',
  'extension.import-failed': 'Não foi possível importar: {detail}',
  'import.title': 'Importar {name}',
  'import.intro': 'Reconhecemos a versão {version} desta extensão. Escolha onde ela vai ficar disponível.',
  'import.scope.private': 'Só neste escritório',
  'import.scope.public': 'No catálogo, para todos os escritórios',
  'import.scope.private.hint':
    'Ela vai para Minhas Extensões, pronta para ser instalada aqui. Nenhum outro escritório a vê, e '
    + 'você pode publicá-la no catálogo depois.',
  'import.scope.public.hint':
    'Ela vai para Minhas Extensões e, ao mesmo tempo, para o catálogo que todos os escritórios navegam, '
    + 'onde qualquer um pode instalá-la. Retirá-la do catálogo depois é só com um administrador do sistema.',
  'import.code-requires-system':
    'Esta extensão traz tela em código, e código roda no navegador de cada membro de cada escritório que '
    + 'a instalar — só um administrador do sistema a publica no catálogo. Importar a mantém neste escritório.',
  'import.confirm': 'Importar',
  'extension.review': 'Revisar e confiar no código',
  'extension.trust.title': 'Confiar nesta extensão?',
  'extension.trust.question': 'Você confia no autor desta extensão?',
  'extension.trust.lead': '"{name}" traz código próprio. Ele só executa neste escritório depois que um administrador decide confiar em quem o escreveu.',
  'extension.trust.unknown-author': 'Autor desconhecido',
  'extension.trust.unverified': 'Publicador não verificado',
  'extension.trust.unverified.hint': 'A Microteia não conseguiu confirmar quem publicou esta extensão. Confie apenas se você sabe de onde ela veio.',
  'extension.trust.verified.hint': 'A identidade de quem publicou esta extensão foi confirmada.',
  'extension.trust.effects.title': 'Se você confiar, o código dela vai:',
  'extension.trust.effect.every-member': 'Executar no navegador de todos os membros do escritório',
  'extension.trust.effect.data': 'Ter acesso aos dados que cada membro enxerga',
  'extension.trust.effect.revocable': 'Continuar executando até você desativá-la ou desinstalá-la',
  'extension.trust.catalog-note': 'Extensões instaladas do catálogo público não fazem esta pergunta — elas já foram revisadas na publicação.',
  'extension.trust.decline': 'Não, não confio',
  'extension.trust.confirm': 'Sim, confio no autor',
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
  'issue.package.action.no-target':
    'A ação "{key}" ({where}) não executa nada: declare workflowId (o templateId de uma automação) ou command (um gesto da plataforma sobre o registro).',
  'issue.package.field.lookup.map-kernel':
    'O campo "{field}" de "{screen}" envia a busca externa para campos com onChangeLookup.map, que exige kernel: "^{minimum}". Um kernel anterior ignora o map e grava no registro as chaves cruas do provedor.',
  'issue.package.field.lookup.map-output':
    'O campo "{field}" de "{screen}" mapeia "{output}", que o provedor "{provider}" não devolve. Ele devolve: {outputs}.',
  'issue.package.field.lookup.map-prefix':
    'O campo "{field}" de "{screen}" declara map e targetPrefix no mesmo onChangeLookup. Com map, cada valor vai para o campo que ele nomeia e o targetPrefix nunca é aplicado: retire um dos dois.',
  'issue.package.field.lookup.map-readonly':
    'O campo "{field}" de "{screen}" envia "{output}" para "{target}", cujo valor a plataforma escreve sozinha (compute, derive ou aggregation). A busca seria sobrescrita: mapeie para um campo que a pessoa edita.',
  'issue.package.field.lookup.map-self':
    'O campo "{field}" de "{screen}" envia "{output}" de volta para ele mesmo. O campo que dispara a busca nunca é reescrito, para que a resposta não brigue com a digitação: mapeie para outro campo.',
  'issue.package.field.lookup.map-shape':
    'O campo "{field}" de "{screen}" declara um onChangeLookup.map que não é um objeto não vazio de { "<chave do provedor>": "<chave do campo>" }, ambos em texto.',
  'issue.package.field.lookup.map-target':
    'O campo "{field}" de "{screen}" envia "{output}" para "{target}", que não é campo dessa tela. O map recebe a chave de um campo declarado na mesma tela — achatada, como "enderecoLogradouro", nunca "endereco.logradouro".',
  'issue.package.field.preset.absent':
    'O campo "{field}" de "{screen}" usa o preset "{preset}" em {path}, que nem o kernel, nem este pacote, nem as dependências dele ({dependencies}) declaram. Em execução, preset desconhecido não faz nada: o campo o perderia sem aviso.',
  'issue.package.field.preset.absent.suggest':
    'O campo "{field}" de "{screen}" usa o preset "{preset}" em {path}, que nem o kernel, nem este pacote, nem as dependências dele ({dependencies}) declaram, e o campo o perderia sem aviso. Você quis dizer "{suggestion}"?',
  'issue.package.field.preset.slot':
    'O campo "{field}" de "{screen}" usa o preset "{preset}" em {path}, mas "{preset}" (declarado por {owner}) não declara a seção {part}, e o {path} não faria nada nesse campo.',
  'issue.package.icon.unknown':
    'O ícone "{icon}" ({where}) não está no catálogo da plataforma. A instalação desenharia o marcador genérico no lugar dele. Peça `list_icons` ao servidor MCP microteia-plugin para ver todas as chaves.',
  'issue.package.message.key':
    'A chave de mensagem "{key}" ({where}) é descartada na instalação: uma chave aceita só letras, dígitos, ponto e hífen, começando por letra ou dígito. Escreva "a-b", não "a_b".',
  'issue.package.message.reference':
    'O texto "{reference}" ({where}) parece uma referência de mensagem, mas não é, e a tela o mostraria como está escrito: o namespace e a chave aceitam só letras, dígitos, ponto e hífen, começando por letra ou dígito. Escreva "a-b", não "a_b".',
  'issue.package.nav.dangling':
    'O item de menu "{key}" abre uma aba que nenhuma página desenha; para abrir a lista de uma tela, use screen: "<chave da tela>".',
  'issue.package.nav.dangling.screen':
    'O item de menu "{key}" abre uma aba que nenhuma página desenha; para abrir a lista da tela "{screen}", use screen: "{screen}".',
  'issue.package.nav.filter.not-filterable':
    'O item de menu "{id}" abre a lista filtrada por "{key}", que não é um campo filtrável da tela "{screen}". filter: recebe a chave de um campo declarado com filterable: true (uma data também como "<chave>:ate", o fim do intervalo); { key, empty } recebe o próprio campo.',
  'issue.package.nav.filter.shape':
    'O item de menu "{id}" ({where}) declara um filtro que não é uma lista de { key, values }, cada um com pelo menos um valor, ou de { key, empty: true | false } — nunca os dois no mesmo termo.',
  'issue.package.nav.filter.presence':
    'O item de menu "{id}" filtra "{key}" por estar vazio, mas uma caixa de seleção nunca está vazia: desmarcada é "false". Filtre com { key: "{key}", values: ["false"] }.',
  'issue.package.nav.filter.kernel':
    'O item de menu "{id}" abre a lista filtrada por campo vazio ou preenchido ({ key, empty }), o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo recusa o filtro.',
  'issue.package.nav.filter.target':
    'O item de menu "{id}" ({where}) declara um filtro, mas não abre a lista de uma tela: o filtro só vale para screen ou screenSourceId.',
  'issue.package.nav.filter.value':
    'O item de menu "{id}" filtra "{key}" por "{value}", que o campo não aceita. Uma lista de opções compara pela CHAVE da opção; uma caixa de seleção recebe "true" ou "false"; uma data, AAAA-MM-DD.',
  'issue.package.nav.screen-unknown':
    'O item de menu "{id}" abre a tela "{screen}", que este pacote não declara. screen: recebe a chave de uma das telas do próprio pacote.',
  'issue.package.nav.source-id-unknown':
    'O item de menu "{id}" abre a tela de sourceId "{sourceId}", que nem este pacote nem uma dependência declarada declaram.',
  'issue.package.nav.target':
    'O item de menu "{id}" ({where}) precisa nomear exatamente um alvo: key (tabKey, numa ação de ui.menu), screen ou screenSourceId.',
  'issue.package.near-limit':
    'O pacote tem {size}. Acima de {limit} ele deixa de caber no documento da instalação — convém dividi-lo antes de crescer mais.',
  'issue.package.no-manifest': 'A extensão não tem um manifest com "id".',
  'issue.package.no-summary': 'A extensão precisa de uma descrição curta (summary).',
  'issue.package.no-workflows': 'A extensão precisa da lista "workflows" (pode ser vazia).',
  'issue.package.not-json': 'O arquivo não é um JSON válido.',
  'issue.package.not-object': 'O conteúdo não é um objeto de extensão.',
  'issue.package.record-surface.no-source-id':
    'A contribuição "{id}" ({where}) é endereçada a "record:" sem dizer de qual tela, e por isso nenhum detalhe de registro a mostraria. Escreva recordSurface(<sourceId da tela>).',
  'issue.package.settings.default':
    'O `default` da configuração "{key}" da contribuição "{id}" ({where}) não é um valor que ela aceita: {detail}',
  'issue.package.settings.multi-type':
    'A configuração "{key}" da contribuição "{id}" ({where}) declara `multi`, que só um `select` lê.',
  'issue.package.settings.options-conflict':
    'A configuração "{key}" da contribuição "{id}" ({where}) declara `options` e `optionsFrom` ao mesmo tempo. Fique com uma: uma lista fechada, ou as opções de uma coleção do escritório.',
  'issue.package.settings.options-from-invalid':
    'A configuração "{key}" da contribuição "{id}" ({where}) tem um `optionsFrom` que não diz de onde vêm as opções. Escreva { kind: \'lookup\' | \'entity\', collection }.',
  'issue.package.settings.options-from-type':
    'A configuração "{key}" da contribuição "{id}" ({where}) declara `optionsFrom`, que só um `select` lê.',
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
  'issue.workflow.schedule-invalid':
    'a automação roda em um horário, e o relógio não consegue rodá-la: {detail} Ela seria instalada ligada e nunca dispararia.',
  'issue.workflow.date-reached-invalid':
    'a automação roda quando uma data chega, e o relógio não consegue rodá-la: {detail} Ela seria instalada ligada e nunca dispararia.',
  'issue.workflow.trigger-kernel':
    'a automação é disparada por "{event}", que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest, para que um kernel mais antigo recuse o pacote em vez de instalar uma automação que nunca dispara.',
  'issue.workflow.portal-viewed.untracked':
    'a automação é disparada por "{event}", mas a tela "{screen}" não registra as aberturas no portal — declare `portal: { ..., trackViews: true }` nela. Sem isso o evento nunca é publicado, e a automação instalaria ligada e nunca dispararia.',
  'issue.step.excluded-trigger':
    'o passo "{step}" ({definition}) não pode compor uma automação disparada por "{event}" — o próprio passo declara que realimentaria esse gatilho. Remova-o, ou dispare a automação por outro evento.',
  'issue.step.delay-nested':
    'o passo "{step}" espera dentro de um ramo de condição ou do corpo de uma repetição. A espera só pausa no nível principal da automação — ali o fluxo pararia com erro.',
  'issue.step.delay-in-action':
    'o passo "{step}" espera, e a ação "{action}" roda esta automação. Um botão aguarda a resposta e não consegue aguardar uma pausa — o fluxo pararia com erro. Dispare-a por um evento, ou faça a ação chamar uma automação que não espere.',
  'issue.step.delay-kernel':
    'o passo "{step}" espera, e o passo de espera só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest, para que um kernel mais antigo recuse o pacote em vez de falhar no passo.',
  'issue.step.definition-kernel':
    'o passo "{step}" é do tipo "{definition}", que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest, para que um kernel mais antigo recuse o pacote em vez de falhar no passo.',
  'issue.step.input-kernel':
    'o passo "{step}" preenche "{input}", que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest, para que um kernel mais antigo recuse o pacote em vez de ignorar a entrada.',
  'issue.step.portal-invite.closed':
    'o passo "{step}" convida para a tela "{screen}", que não aceita convite por automação — toda execução falharia. Declare nela `portal: { subject: \'self\', ..., invites: { automation: true } }`.',
  'issue.step.unknown-input':
    'o passo "{step}" ({definition}) preenche a entrada "{input}", que esse passo não tem. Ele recebe: {expected}.',
  'issue.step.document.record-only':
    'o passo "{step}" preenche "{input}", que só um modelo sobre um registro recebe — o modelo de documento "{template}" lê dados, e gerá-lo seria recusado.',
  'issue.step.document.payload-only':
    'o passo "{step}" preenche "{input}", que só um modelo que lê dados recebe — o modelo de documento "{template}" é sobre um registro, e o valor nunca chegaria a ele.',
  'issue.step.document.input-required':
    'o passo "{step}" gera o modelo de documento "{template}" e deixa vazio "{input}", de que esse modelo precisa — gerá-lo seria recusado.',
  'issue.step.document.unknown-parameter':
    'o passo "{step}" preenche "{input}", e o modelo de documento "{template}" não tem o parâmetro "{parameter}" — o valor seria ignorado e o campo sairia em branco. Os parâmetros dele: {expected}.',
  'issue.step.document.belongs-to-invalid':
    'o passo "{step}" diz que o documento pertence a "{parameter}", que não é um parâmetro de registro único do modelo de documento "{template}" — gerá-lo seria recusado. Ele pode nomear: {expected}.',
  'issue.step.document.parameter-required':
    'o passo "{step}" gera o modelo de documento "{template}" sem o parâmetro obrigatório "{parameter}" — preencha "param.{parameter}", ou passe os dados em bloco por "payload".',
  'issue.step.document.destination-without-owner':
    'o passo "{step}" salva o modelo de documento "{template}" na aba Documentos do registro sem dizer qual registro é o dono — preencha "belongsTo", ou salve em Downloads.',
  'install.dependency-missing':
    'Esta extensão referencia {kind} "{id}" da extensão "{plugin}", que não está instalada — instale-a antes.',
  'install.dependency-out-of-range':
    'A extensão "{plugin}" aceita "{dependency}" {range}, e a "{dependency}" instalada está na versão {installed} — '
    + '"{plugin}" não carrega até que "{dependency}" seja atualizada para uma versão dessa faixa.',
  'install.dependent-out-of-range':
    'A extensão "{dependent}" aceita "{plugin}" {range}, e esta versão é a {version} — "{dependent}" deixa de carregar '
    + 'até ser atualizada para uma versão que a aceite.',
  'install.dependent-breaks':
    '{origin} "{name}" da extensão "{dependent}" referencia {kind} "{id}", que esta versão não traz '
    + 'mais — atualize ou remova essa extensão antes.',
  'install.dependent-event-breaks':
    '{origin} "{name}" da extensão "{dependent}" escuta o prefixo de evento "{prefix}", que esta versão não emite '
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
  'issue.report.requires': 'O relatório "{name}" declara um `requires` que omite o que ele usa: {capability}. A lista é derivada do spec — não a escreva.',
  'issue.aggregation.invalid': 'O campo "{field}" da tela "{screen}" não pode agregar como foi declarado — {detail}',
  'issue.aggregation.kernel': 'O campo "{field}" da tela "{screen}" usa a agregação "{op}", que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest, para que um kernel mais antigo recuse o pacote em vez de deixar o campo vazio.',
  'issue.document.order.invalid': 'A lista "{list}" do modelo de documento "{template}" não pode ser ordenada como foi declarada — {detail}',
  'issue.document.order.unknown': 'A lista "{list}" do modelo de documento "{template}" é ordenada por "{path}", que não é um campo da tela dela.',
  'issue.document.order.kernel': 'A lista "{list}" do modelo de documento "{template}" é ordenada por uma lista de chaves, que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest, para que um kernel mais antigo recuse o pacote em vez de falhar ao gerar o documento.',
  'issue.portal.field.derived': 'A tela "{screen}" leva ao portal o campo derivado "{field}" (`logic.derive`). O campo derivado é calculado na leitura e nunca é gravado, por isso o convidado o veria sempre vazio — tire-o de `portal.fields` e de `portal.create.fields`.',
  'issue.portal.visible-when.invalid': 'A condição de portal (`visibleWhen`) da tela "{screen}" não é uma expressão válida — nenhum registro dela chegaria ao portal.',
  'issue.portal.visible-when.unknown': 'A condição de portal (`visibleWhen`) da tela "{screen}" usa "{field}", que não é campo dessa tela.',
  'issue.portal.visible-when.kernel': 'A tela "{screen}" limita quais registros chegam ao portal (`visibleWhen`), o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo ignora a condição e mostraria todos os registros.',
  'issue.portal.create-when.invalid': 'A condição para criar pelo portal (`create.when`) da tela "{screen}" não é uma expressão válida — nenhum convidado conseguiria criar ali.',
  'issue.portal.create-when.kernel': 'A tela "{screen}" limita quem cria pelo portal (`create.when`), o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo ignora a condição e deixaria todo convidado criar.',
  'issue.portal.document-links.kernel': 'A tela "{screen}" entrega ao convidado do portal links curtos de documento (`documentLinks`), o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo ignora a declaração e entregaria ao convidado o link permanente.',
  'issue.portal.document-links.minutes': 'A tela "{screen}" declara `documentLinks.expiresInMinutes` fora de 1 a {maximum}. Informe um número inteiro de minutos nesse intervalo.',
  'issue.portal.track-views.kernel': 'A tela "{screen}" registra quando o convidado do portal abre os registros dela (`trackViews`), o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo ignora a declaração: nada seria registrado, e nada diria isso.',
  'issue.portal.actions.kernel': 'A tela "{screen}" deixa o convidado do portal executar ações (`portal.actions`), o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo ignora a declaração: os botões simplesmente não apareceriam.',
  'issue.portal.action.unknown': 'A tela "{screen}" oferece a ação "{action}" no portal, mas nenhuma ação do pacote com essa `key` está nos `viewActionIds` da tela. `portal.actions` lista CHAVES de ação, tiradas das ações que a tela põe no registro.',
  'issue.portal.action.disabled': 'A tela "{screen}" oferece a ação "{action}" no portal, mas a ação está declarada com `enabled: false` — o convidado nunca a veria.',
  'issue.portal.action.not-runnable': 'A tela "{screen}" oferece a ação "{action}" no portal, mas ela executa um `command` em vez de uma automação. Só ações que rodam uma automação podem rodar no portal.',
  'issue.portal.action.prompts': 'A tela "{screen}" oferece a ação "{action}" no portal, mas declara `promptParameters` — o portal não tem formulário para eles. Dê à automação o que ela precisa a partir do registro (`context`).',
  'issue.portal.reference-titles.kernel': 'A tela "{screen}" mostra o nome de registros vinculados fora do portal (`portal.referenceTitles`), o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo ignora a declaração: esses vínculos chegariam ao convidado sem nome.',
  'issue.portal.reference-titles.field': 'A tela "{screen}" lista "{field}" em `portal.referenceTitles`, mas ele não é um campo `reference` exposto. Só um campo que está em `portal.fields` e aponta para outra tela (`refEntity`) tem nome a mostrar.',
  'issue.portal.widget.surface': 'A contribuição "{id}" declara uma view do portal sem código (`impl.kind: "widget"`) numa superfície que não é `widget` nem `page`. A declaração é um cartão da página inicial do portal (`portalWidgetSpec`) ou uma página do menu do portal (`portalPageSpec`).',
  'issue.portal.widget.kernel': 'A contribuição "{id}" declara um cartão ou uma página do portal sem código, o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo descarta a contribuição: o cartão ou a página simplesmente não apareceria.',
  'issue.edit-window.shape': 'A janela de edição (`editWindow`) da tela "{screen}" precisa ser um objeto: `{ minutes, delete? }`.',
  'issue.edit-window.minutes': 'A janela de edição (`editWindow`) da tela "{screen}" precisa de `minutes` como número inteiro maior que zero.',
  'issue.edit-window.delete': 'A janela de edição (`editWindow`) da tela "{screen}" tem um `delete` que não é verdadeiro nem falso.',
  'issue.member-visibility.shape': 'A visibilidade por registro (`memberVisibility`) da tela "{screen}" precisa ser um objeto: `{ userFields, bypassPermission? }`, com `userFields` uma lista de chaves de campo.',
  'issue.member-visibility.fields-empty': 'A visibilidade por registro (`memberVisibility`) da tela "{screen}" não nomeia campo nenhum em `userFields`. Nenhum registro nomearia ninguém, e só quem supervisiona os leria — nomeie ao menos um campo.',
  'issue.member-visibility.fields-too-many': 'A visibilidade por registro (`memberVisibility`) da tela "{screen}" nomeia mais de {max} campos em `userFields`. As regras de segurança leem {max} posições, e um campo além delas nunca seria conferido.',
  'issue.member-visibility.field-duplicate': 'A visibilidade por registro (`memberVisibility`) da tela "{screen}" nomeia o campo "{subject}" mais de uma vez.',
  'issue.member-visibility.field-unknown': 'A visibilidade por registro (`memberVisibility`) da tela "{screen}" nomeia "{subject}" em `userFields`, mas a tela não tem campo com essa chave.',
  'issue.member-visibility.field-not-member': 'A visibilidade por registro (`memberVisibility`) da tela "{screen}" nomeia "{subject}" em `userFields`, mas ele não é uma referência a membro (`type: "reference"`, `refEntity: "members"`). Só a referência a membro guarda o identificador que as regras de segurança comparam.',
  'issue.member-visibility.bypass-invalid': 'A visibilidade por registro (`memberVisibility`) da tela "{screen}" tem um `bypassPermission` ("{subject}") que não é um identificador de permissão na forma recurso.acao.',
  'issue.member-visibility.kernel': 'A tela "{screen}" declara visibilidade por registro (`memberVisibility`), que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo a ignora, e todo membro que lê a coleção leria todos os registros.',
  'issue.record-sequence.shape': 'O campo "{field}" da tela "{screen}" declara `autoValue.sequence`, que precisa ser um objeto: `{ scope?, resetBy? }`.',
  'issue.record-sequence.scope': 'A sequência do campo "{field}" da tela "{screen}" tem um `scope` desconhecido. Use "tenant" (um contador para o escritório) ou "parent" (um contador por registro-pai).',
  'issue.record-sequence.reset': 'A sequência do campo "{field}" da tela "{screen}" tem um `resetBy` desconhecido. Use "never" ou "year".',
  'issue.record-sequence.nested': 'O campo "{field}" da tela "{screen}" é aninhado, e só campos de primeiro nível podem ser numerados por sequência.',
  'issue.record-sequence.field-type': 'O campo "{field}" da tela "{screen}" declara uma sequência, que só um campo `text` (o número formatado) ou `number` (o inteiro) pode guardar.',
  'issue.record-sequence.pattern-slot': 'O `pattern` da sequência do campo "{field}" da tela "{screen}" precisa ter exatamente uma sequência de `0` — é ali que o número entra, com os zeros como largura mínima.',
  'issue.record-sequence.pattern-numeric': 'O campo "{field}" da tela "{screen}" é `number`: ele guarda o inteiro, e por isso a sequência dele não leva `pattern`.',
  'issue.record-sequence.pattern-year': 'A sequência do campo "{field}" da tela "{screen}" recomeça a cada ano, então o `pattern` precisa conter `YYYY` — senão o número de um ano repete o do ano anterior. Um campo `number` não pode recomeçar por ano.',
  'issue.record-sequence.scope-needs-parent': 'A sequência do campo "{field}" da tela "{screen}" é contada por pai (`scope: "parent"`), mas a tela não declara `parentFieldKey`.',
  'issue.record-sequence.kernel': 'A tela "{screen}" declara um campo numerado (`autoValue.sequence`), que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo trataria o padrão como código sorteado, e números poderiam se repetir.',
  'issue.edit-window.kernel': 'A tela "{screen}" declara uma janela de edição (`editWindow`), que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo ignora a janela, e os registros continuariam editáveis para sempre.',
  'issue.lookup.seed-mode': 'A lista "{collection}" declara `seed: "{seed}"`; use um destes: {expected}.',
  'issue.lookup.seed-kernel': 'A lista "{collection}" semeia opções obrigatórias, ou semeia uma lista da plataforma, o que só existe a partir do kernel {minimum} — declare `kernel: "^{minimum}"` (ou posterior) no manifest. Um kernel mais antigo instalaria a extensão sem essas opções.',
  'issue.ref.event-undeclared':
    '{origin} "{name}" escuta o prefixo de evento "{prefix}", que uma tela da extensão "{plugin}" emite — declare-a em `dependencies`.',
  'issue.ref.event-unresolved':
    '{origin} "{name}" escuta o prefixo de evento "{prefix}", que nenhuma tela do pacote, do núcleo ou de uma dependência declarada emite.',
  'issue.ref.external':
    '{origin} "{name}" referencia {kind} "{id}", que não está no pacote nem coberta por uma dependência declarada.',
  'issue.ref.malformed':
    '{origin} "{name}" referencia {kind} "{id}", que não é uma referência válida — use <id-da-extensão>/<id-do-artefato>.',
  'issue.ref.not-exported':
    '{origin} "{name}" referencia {kind} "{id}", que a extensão "{plugin}" não declara em `exports`.',
  'issue.ref.screen-qualified':
    '{origin} "{name}" referencia a tela "{id}" na forma qualificada — uma tela é nomeada pela coleção dela, ou pelo `sourceId` da extensão que a traz.',
  'issue.ref.lookup-qualified':
    '{origin} "{name}" referencia a lista de opções "{id}" na forma qualificada — uma lista é nomeada pela coleção dela.',
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
  'ref.kind.lookup': 'a lista de opções',
  'ref.kind.script': 'o script',
  'ref.kind.workflow': 'a automação',
  'ref.origin.action': 'ação',
  'ref.origin.patch': 'complemento de',
  'ref.origin.report': 'relatório',
  'ref.origin.screen': 'tela',
  'ref.origin.setting': 'configuração',
  'ref.origin.workflow': 'automação',
  'ref.origin.workflow-step': 'passo "{step}" da automação',
  'extension.code-pending-review':
    'Esta extensão traz uma tela em código, que só será executada após ser publicada no catálogo por um administrador do sistema. Os dados foram instalados normalmente.',
  'publish.id-taken': 'Este identificador já foi publicado por outro escritório.',
  'publish.invalid-version': 'A versão "{version}" não é válida.',
  'publish.code-requires-system':
    'Extensão que traz código só é publicada no catálogo por um administrador do sistema.',
  'publish.version-not-greater':
    'A versão {version} não é maior que a publicada ({published}). Suba a versão: quem já instalou esta '
    + 'extensão só recebe a atualização quando ela sobe.',
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
