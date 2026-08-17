import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **Português (Brasil) do escritório** — a tradução que viaja DENTRO do plugin que a usa.
 *
 * O pacote `com.microteia.locale-pt-br` traduz o núcleo; este bloco traduz o que é deste plugin. A
 * diferença não é de mecanismo — é a mesma contribuição `i18n.messages`, no mesmo formato — e sim de
 * DONO: um plugin nasce em inglês e pode chegar com as traduções que o autor escreveu, sem depender
 * de um pacote de idioma de terceiro para ser legível.
 *
 * É a tendência natural de qualquer extensão: quem declara o texto é quem melhor sabe traduzi-lo. O
 * caminho do pacote de idioma continua aberto e continua valendo para quem quer traduzir o que não é
 * seu — só deixou de ser o único.
 */
const CORE_TENANT_PT_BR: Record<string, string> = {
  'entity.singular': 'Escritório',
  'entity.plural': 'Escritório',
  'office.section.title': 'Dados do Escritório',
  'office.section.description': 'O cadastro do escritório. Acrescente campos próprios a ele no Form Design.',
  'settings.section.title': 'Tela do Escritório',
  'settings.section.description': 'Quais abas aparecem na tela do escritório, e em que ordem.',
  'settings.tabs': 'Abas da tela do Escritório',
  'settings.tabs.description': 'Desligue uma aba para escondê-la de todos neste escritório.',
  'page.tenant-settings': 'Escritório',
  'nav.tenant-settings': 'Escritório',
  'member.already-member': 'Este usuário já é membro do escritório.',
  'member.email-invalid': 'E-mail inválido.',
  'member.email-required': 'Informe o e-mail do usuário.',
  'member.limit-reached': 'Limite de membros do escritório atingido.',
  'member.limit.notice':
    'Limite de membros atingido ({limit}) para este escritório. Remova um membro ou peça ao administrador do sistema para aumentar o limite.',
  'member.new.email': 'E-mail do novo membro',
  'member.new.email.placeholder': 'email@usuario.com',
  'member.not-found': 'Nenhum usuário cadastrado com esse e-mail.',
  'member.remove.message': 'Tem certeza que deseja remover "{name}" do escritório?',
  'member.remove.title': 'Remover Membro',
  'member.removed': 'Membro removido do escritório.',
  'member.role': 'Perfil',
  'member.role-update-failed': 'Erro ao atualizar permissão.',
  'member.role-updated': 'Permissão atualizada.',
  'member.role.placeholder': 'Perfil...',
  'member.you': '(você)',
  'office.address.placeholder': 'Rua, número, complemento, cidade - Estado',
  'office.admin-only': 'Somente administradores podem alterar os dados do escritório.',
  'office.email': 'E-mail do Escritório',
  'office.email.placeholder': 'contato@escritorio.com',
  'office.name': 'Nome do Escritório',
  'office.name.placeholder': 'Ex: Escritório de Advocacia Silva & Associados',
  'office.name.required': 'Nome do escritório é obrigatório.',
  'office.required': 'Preencha os campos obrigatórios.',
  'office.save-failed': 'Erro ao atualizar escritório.',
  'office.saved': 'Escritório atualizado com sucesso!',
  'role.admin': 'Administrador',
  'role.lawyer': 'Advogado',
  'role.secretary': 'Secretário(a)',
  'role.user': 'Usuário',
  'tenant.tab.ai': 'Conexão IA',
  'tenant.tab.members': 'Membros',
  'tenant.tab.office': 'Dados do Escritório',
  'ai.add': 'Adicionar Conexão',
  'ai.api-key.hint.existing':
    'A chave atual permanece guardada em área restrita. Deixe em branco para mantê-la.',
  'ai.api-key.hint.new': 'A chave fica guardada em área restrita e nunca volta para o navegador.',
  'ai.api-key.placeholder': 'Chave cadastrada — preencha para substituir',
  'ai.default': 'Padrão',
  'ai.delete-failed': 'Erro ao excluir conexão.',
  'ai.delete.message': 'Deseja remover a conexão "{name}"? Esta ação não pode ser desfeita.',
  'ai.delete.title': 'Excluir conexão IA',
  'ai.empty': 'Nenhuma conexão IA configurada para este escritório.',
  'ai.load-failed': 'Erro ao carregar conexões IA.',
  'ai.max-tokens': 'Max Tokens',
  'ai.modal.edit': 'Editar Conexão IA',
  'ai.modal.new': 'Nova Conexão IA',
  'ai.model': 'Modelo',
  'ai.model.placeholder': 'Ex: gpt-4o',
  'ai.model.unset': 'modelo não definido',
  'ai.name': 'Nome da Conexão *',
  'ai.name.placeholder': 'Ex: GPT-4o Produção',
  'ai.provider': 'Provider *',
  'ai.provider.custom': 'Personalizado',
  'ai.provider.other': 'Outro',
  'ai.provider.placeholder': 'Selecione o provider...',
  'ai.save-failed': 'Erro ao salvar conexão IA.',
  'ai.section.title': 'Conexões IA do Escritório',
  'ai.set-default': 'Definir como padrão',
  'ai.set-default-failed': 'Erro ao definir conexão padrão.',
  'ai.temperature': 'Temperatura: {value}',
  'ai.temperature.short': 'temp',
  'ai.api-key': 'API Key',
  'ai.api-key.required': 'API Key *',
  'ai.api-key.example': 'sk-...',
  'member.limit-reached-error': 'Limite de membros do escritório atingido.',
  'member.add.admin-only': 'Somente administradores do escritório podem adicionar membros.',
  'member.remove.admin-only': 'Somente administradores do escritório podem remover membros.',
};

export const coreTenantPtBrContribution = (): Contribution =>
  messageBundleContribution({ locale: 'pt-BR', namespace: 'core.tenant', messages: CORE_TENANT_PT_BR });
