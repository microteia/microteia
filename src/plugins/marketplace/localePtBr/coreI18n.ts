export const CORE_I18N: Record<string, string> = {
  'section.title': 'Idioma e região',
  'section.description':
    'Como este escritório lê texto, datas e valores. A preferência pessoal, quando existir, vence a do escritório.',
  'locale.label': 'Idioma',
  'locale.description':
    'Os idiomas disponíveis vêm dos pacotes de tradução instalados. Texto sem tradução aparece no idioma original.',
  'timezone.label': 'Fuso horário',
  'timezone.description':
    'Usado para decidir a que dia pertence um instante. Em branco, vale o fuso de quem está com a tela aberta.',
  'page.translations': 'Traduções',
  'nav.translations': 'Traduções',
  'translations.admin-only': 'Somente administradores do escritório podem instalar idiomas.',
  'translations.badge.disabled': 'Desativado',
  'translations.badge.in-use': 'Em uso',
  'translations.badge.shadowed': 'Sem efeito',
  'translations.download': 'Baixar extensão (.json)',
  'translations.download.hint':
    'Informe o idioma no formato pt-BR, es ou de-DE. O arquivo vem com os textos preenchidos: a tradução que já existir para esse idioma, ou o texto original para você sobrescrever. Traduza os valores dentro de messages e não mexa nas chaves.',
  'translations.import': 'Importar extensão de idioma',
  'translations.import.hint':
    'Atalho para instalar a extensão de idioma. O mesmo arquivo pode ser importado pela tela de Extensões — é o mesmo formato e a mesma instalação.',
  'translations.installed': 'Idiomas instalados',
  'translations.installed.hint':
    'Para desativar ou remover um idioma, use a tela de Extensões — um idioma é uma extensão.',
  'translations.installed.success.one':
    'Idioma "{name}" instalado com {count} texto. Escolha-o em Configurações → Idioma e região.',
  'translations.installed.success.other':
    'Idioma "{name}" instalado com {count} textos. Escolha-o em Configurações → Idioma e região.',
  'translations.installing': 'Instalando...',
  'translations.locale': 'Idioma',
  'translations.locale.placeholder': 'es',
  'translations.none-installed': 'Nenhum idioma instalado. O sistema está no idioma original (inglês).',
  'translations.not-a-language-package':
    'Este arquivo não é um pacote de idioma. Para instalar uma extensão comum, use a tela de Extensões.',
  'translations.shadowed.notice':
    'Há mais de um pacote para o idioma em uso. Só o primeiro vale; os marcados como "Sem efeito" não alteram nada. Remova o que sobra na tela de Extensões.',
  'translations.step.download': '1. Baixar a extensão de idioma',
  'translations.step.import': '2. Importar de volta',
  'translations.subtitle':
    'Um idioma é uma extensão como qualquer outra. Baixe a extensão de idioma com todos os textos do sistema — os do núcleo e os das extensões instaladas —, traduza os textos dentro do arquivo e importe de volta.',
  'translations.summary.one': '{name} — {count} texto',
  'translations.summary.other': '{name} — {count} textos',
  'point.messages.description':
    'Declara os textos de um plugin em um idioma. Um pacote só de traduções é uma extensão que contribui apenas aqui — inclusive para textos do núcleo e de outras extensões.',
  'point.messages.title': 'Catálogo de mensagens',
  'package.id-taken-by-extension':
    'O identificador "{id}" já pertence à extensão "{name}", que não é um pacote de idioma. Altere o "id" do arquivo antes de importar — instalar por cima apagaria as telas e automações dela.',
  'package.id-taken-by-language':
    'O identificador "{id}" já pertence ao idioma "{name}". Uma extensão com telas ou automações não pode tomar o lugar de um pacote de idioma: altere o "id" do arquivo.',
  'package.summary':
    'Deixa o sistema no idioma deste pacote. Pode ser desinstalado a qualquer momento, devolvendo a interface ao idioma original.',
  'package.description':
    'Textos do sistema no idioma deste pacote.',
};
