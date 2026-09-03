import { messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { NEWS_NAMESPACE } from './newsMessages';

/**
 * **Portuguese (Brazil) for News** — the translation that travels inside the extension that owns the
 * text, not inside the kernel's language package.
 */
const NEWS_PT_BR: Record<string, string> = {
  'package.name': 'Notícias',
  'package.category': 'Comunicação',
  'package.description': 'O mural do escritório como extensão — com o não-lido por usuário, os comentários e as etiquetas.',
  'package.summary':
    'O mural do escritório: o comunicado que alguém publica, um selo no menu com o que VOCÊ ainda não leu, curtidas, guardar para depois, etiquetas, documentos anexados e a conversa em comentários embaixo de cada notícia.',

  'nav.news': 'Notícias',
  'page.news': 'Notícias',
  'page.news-read': 'Notícia',

  'screen.singular': 'Notícia',
  'screen.plural': 'Notícias',
  'comment.singular': 'Comentário',
  'comment.plural': 'Comentários',

  'section.content': 'Conteúdo',

  'field.title': 'Título',
  'field.title.placeholder': 'Título da notícia...',
  'field.category': 'Categoria',
  'field.source-url': 'Link da fonte',
  'field.source-url.placeholder': 'https://...',
  'field.summary': 'Resumo',
  'field.summary.placeholder': 'Resumo curto exibido na listagem...',
  'field.content': 'Conteúdo completo',
  'field.news': 'Notícia',
  'field.comment': 'Comentário',

  'lookup.categories': 'Notícia: Categoria',
  'category.general': 'Geral',
  'category.announcement': 'Comunicado',
  'category.circular': 'Circular',
  'category.update': 'Atualização',
  'tags.list': 'Notícia: Etiquetas',

  'overview.body':
    'A extensão **Notícias** traz o mural do escritório: qualquer pessoa publica um comunicado, com resumo, conteúdo em Markdown, categoria e link para a fonte.\n\nO item no menu mostra **quantas notícias você ainda não leu** — o número é seu, não do escritório, e desce assim que você abre cada uma. A lista abre justamente nelas, e você pode **guardar para depois** o que quiser reler.\n\nCada notícia tem **comentários**, com curtida, edição e "(editado)" à mostra. Quem comenta devolve a notícia à caixa de todos, para que ninguém perca a conversa.\n\nQuem publicou pode **editar e excluir** o que publicou, sem depender de um administrador — e o mesmo vale para cada comentário.',
  'overview.adds': 'Adiciona',
  'overview.adds.value': 'Item "Notícias" no menu, com o seu contador de não lidas',
  'overview.record': 'Cadastro',
  'overview.record.value': '5 campos, mais etiquetas e documentos',
  'overview.conversation': 'Conversa',
  'overview.conversation.value': 'Comentários com curtida e edição',
  'overview.opens-on': 'Abre em',
  'overview.opens-on.value': 'Notícias não lidas',
  'overview.banner.per-user': 'O lido, o curtido e o guardado ficam gravados na própria notícia, por usuário. Cada pessoa vê o seu.',
  'overview.banner.uninstall':
    'Remover a extensão remove as telas, nunca as notícias: os registros continuam no escritório e voltam a aparecer se ela for instalada de novo.',

  'license.body':
    'Esta extensão é publicada pela Microteia como **exemplo de autoria**, e é distribuída junto com a plataforma. Você pode instalá-la, estudar a fonte dela, copiá-la e alterá-la dentro do seu próprio escritório, sem cobrança e sem prazo.\n\nO **conteúdo publicado através dela** — as notícias, os comentários e tudo o que as pessoas escrevem neles — é de quem o escreveu. Ele fica no banco de dados do próprio escritório, e desinstalar a extensão não o apaga.\n\nQuem alterar esta extensão e republicá-la com outro nome responde pela versão que publicou, e essa versão deixa de estar coberta por estes termos.',
  'license.banner.warranty':
    'Fornecida como está, sem garantia de espécie alguma. Nem o autor nem a Microteia respondem por danos decorrentes do uso.',

  'view.screen-missing': 'Tela "Notícias" não encontrada. Instale a extensão para ativá-la.',
  'view.write-denied': 'Não foi possível gravar. Verifique se você tem permissão neste escritório.',
  'view.author': 'Autor',

  'list.new': 'Nova Notícia',
  'list.filter.placeholder': 'Filtrar notícias...',
  'list.empty': 'Nenhuma notícia encontrada.',
  'list.filter.read-status': 'Status de leitura',
  'list.filter.unread': 'Não lidas',
  'list.filter.read': 'Lidas',
  'list.filter.saved': 'Salvos para depois',
  'list.badge.unread': 'Não lida',
  'list.edited-by': 'editado por {name} · {when}',
  'list.action.like': 'Curtir',
  'list.action.views': 'Visualizações',
  'list.action.comments': 'Comentários',
  'list.action.save': 'Salvar para depois',
  'list.action.unsave': 'Remover dos salvos',
  'list.action.mark-unread': 'Marcar como não lida',
  'list.action.more': 'Ações',

  'read.not-found': 'Notícia não encontrada.',
  'read.mark-failed': 'Não foi possível registrar a leitura desta notícia.',
  'read.tab.news': 'Notícia',
  'read.tab.documents': 'Documentos',
  'read.edit': 'Editar notícia',
  'read.source': 'Ver fonte original',
  'read.edited-meta': 'editado por {name} · publicado em {when}',
  'read.likes.one': '{count} curtida',
  'read.likes.other': '{count} curtidas',
  'read.views.one': '{count} visualização',
  'read.views.other': '{count} visualizações',
  'read.action.like': 'Curtir',
  'read.action.unlike': 'Descurtir',
  'read.action.views': 'Visualizações',
  'read.action.mark-unread': 'Marcar como não lida',
  'read.action.save': 'Salvar para depois',
  'read.action.unsave': 'Remover dos salvos',
  'read.action.saved': 'Salvo',

  'comments.title': 'Comentários',
  'comments.collapse': 'Recolher',
  'comments.expand': 'Expandir',
  'comments.empty': 'Nenhum comentário ainda. Seja o primeiro a comentar.',
  'comments.placeholder': 'Escreva um comentário em Markdown...',
  'comments.trigger': 'Adicionar um comentário...',
  'comments.submit': 'Comentar',
  'comment.delete.confirm': 'Excluir este comentário?',
  'comment.edit.placeholder': 'Editar comentário...',
  'comment.edited': '(editado)',
  'comment.edited.title': 'Editado por {name} em {when}',
  'comment.action.edit': 'Editar comentário',
  'comment.action.delete': 'Excluir comentário',
  'comment.action.like': 'Curtir',
  'comment.action.unlike': 'Remover curtida',
  'comment.read-more': 'mais... ▼',
  'comment.read-less': 'menos ▲',

  'command.group': 'Notícias',
  'command.new': 'Nova notícia',
  'command.open': 'Abrir Notícias',
  'mention.label': 'Notícia',
  'mention.description': 'Inserir link para uma notícia',
};

export const newsPtBrContribution = (): Contribution => messageBundleContribution({
  locale: 'pt-BR',
  namespace: NEWS_NAMESPACE,
  messages: NEWS_PT_BR,
});
