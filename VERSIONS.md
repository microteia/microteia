# Notas de Versão — Curatino

> Histórico de novidades, melhorias e correções do Curatino, escrito para quem usa o sistema no dia a dia. Para o histórico técnico de alterações, consulte o log de commits do git.

Cada versão corresponde ao campo `version` de `package.json`. A mais recente fica no topo.

<!-- Nova entrada vai aqui, acima das anteriores, no formato:

#### [0.0.9] — AAAA-MM-DD

- Descrição elegante da mudança, em linguagem simples.
-->

## [0.134.0] — 2026-07-23

- A tela de Extensões agora tem os botões "Criar extensão" e "Importar .json"; extensões importadas de um arquivo passam a aparecer na lista, com opção de ativar, desativar e remover.
- Ao montar uma extensão, os avisos de pendência mostram o nome do item que ficou de fora (antes exibiam apenas um código interno).

## [0.133.0] — 2026-07-23

- Nova tela "Criar extensão": marque as telas, ações, automações e scripts do seu escritório, preencha os dados da extensão e baixe um arquivo pronto para compartilhar. O sistema aponta na hora qualquer dependência que ficou de fora.
- Agora é possível importar uma extensão a partir de um arquivo, com a mesma conferência que a criação faz — se algo estiver faltando, a importação avisa antes de instalar.

## [0.132.3] — 2026-07-23

- Nas listas, quando o título de um registro é um campo de relacionamento (por exemplo, o produto de um item de venda), o card agora mostra o nome do registro relacionado, e não mais um código interno.

## [0.132.2] — 2026-07-23

- Ao instalar ou remover uma extensão, as telas e os botões que ela traz agora aparecem (ou somem) na hora, sem precisar atualizar o navegador.

## [0.132.1] — 2026-07-23

- Correção importante: ao remover uma extensão que traz telas, as telas agora são de fato removidas (antes ficavam órfãs). E o botão de uma extensão (como "Resumo" no módulo Vendas) passa a aparecer também nos cartões da lista.

## [0.132.0] — 2026-07-23

- Extensões agora podem trazer módulos ainda mais completos: além de telas, também ações (botões) e automações com scripts. A extensão de exemplo "Vendas" ganhou o botão "Resumo" na tela de Venda. Tudo é removido junto ao desinstalar.

## [0.131.3] — 2026-07-23

- As telas e campos de uma extensão passam a se comportar como as telas fixas do sistema no Form Design: você pode fazer ajustes não-críticos (como renomear um campo) e adicionar seus próprios campos, mas não pode excluí-los — a tela sai apenas ao remover a extensão. Cada tela/campo de extensão mostra a etiqueta "Extensão".

## [0.131.2] — 2026-07-23

- Correção: a instalação de extensões que trazem telas (como "Vendas") falhava com uma mensagem genérica. Agora funciona, e qualquer falha de instalação passa a mostrar o motivo real.

## [0.131.1] — 2026-07-23

- As telas trazidas por uma extensão ficam protegidas no Form Design: seus campos não podem ser editados ou excluídos, e a tela só sai ao remover a extensão. Você continua podendo adicionar seus próprios campos por cima.

## [0.131.0] — 2026-07-23

- Extensões agora podem trazer módulos completos ao escritório — telas próprias de cadastro com campos, cálculos automáticos e relacionamentos. A extensão de exemplo "Vendas" adiciona Produtos, Vendas e Itens: o preço do item vem do produto escolhido, o total do item é calculado, e o total da venda soma os itens. Ao remover a extensão, os dados são preservados.

## [0.130.1] — 2026-07-23

- Mais segurança no catálogo de extensões: uma extensão só entra no catálogo se estiver íntegra, e uma extensão que não puder ser carregada no escritório passa a explicar o motivo, em vez de simplesmente não aparecer.

## [0.130.0] — 2026-07-23

- As extensões agora podem adicionar itens ao menu e telas próprias ao escritório. Ao instalar uma extensão com interface, o novo item aparece na hora na barra lateral; ao desativar ou remover, ele some. A extensão de exemplo "Guia do Escritório" demonstra o recurso.

## [0.129.0] — 2026-07-22

- As extensões agora podem ter uma página de detalhes rica: na tela de Extensões, clique em "Ver detalhes" para conhecer o que cada uma faz antes de instalar.

## [0.128.0] — 2026-07-22

- A tela de Extensões passou a ter um catálogo compartilhado: novas extensões podem ser disponibilizadas para todos os escritórios sem precisar atualizar o sistema. Cada extensão mostra se é interna ou publicada no catálogo.

## [0.127.1] — 2026-07-22

- Ajuste na extensão de exemplo "Boas-vindas ao Cliente" para que ela registre corretamente o evento na Auditoria ao cadastrar uma nova pessoa.

## [0.127.0] — 2026-07-22

- Chegou a primeira versão da tela **Extensões**: um catálogo de funcionalidades que o administrador pode instalar no escritório com um clique. A extensão de exemplo "Boas-vindas ao Cliente" registra na Auditoria toda vez que uma nova pessoa é cadastrada — e pode ser removida a qualquer momento, desfazendo tudo que ela adicionou.

## [0.126.0] — 2026-07-22

- Base para o futuro catálogo de extensões do Curatino: o sistema já sabe registrar quais extensões um escritório instalou, ativou ou removeu. Ainda não há extensões para instalar — isso vem a seguir. Nenhuma mudança visível no uso.

## [0.125.2] — 2026-07-22

- Preparação técnica para que futuras extensões possam adicionar integrações próprias ao sistema. Nenhuma mudança visível no uso.

## [0.125.1] — 2026-07-22

- Aprimoramento interno na forma como o sistema organiza seus cadastros (Pessoas, Processos, Contratos, etc.), preparando o terreno para novos tipos de cadastro no futuro. Nenhuma tela ou comportamento muda.

## [0.125.0] — 2026-07-22

- Os provedores de inteligência artificial (OpenAI, Anthropic, Google, Mistral e Cohere) passaram a ser módulos independentes. Na prática, novos provedores poderão ser oferecidos ao escritório sem que o sistema precise ser atualizado. A escolha do provedor nas Configurações continua igual.

## [0.124.3] — 2026-07-22

- O ambiente de testes foi colocado no ar, permitindo validar as novidades antes que elas cheguem ao escritório. Nada muda no uso do sistema.

## [0.124.2] — 2026-07-22

- Passamos a manter um ambiente de testes separado do ambiente real do escritório, para que novidades sejam validadas com segurança antes de chegar ao seu dia a dia. Nada muda no uso do sistema.

## [0.124.1] — 2026-07-22

- Os passos e as funções disponíveis nas Automações passaram a ser organizados como módulos independentes, preparando o terreno para que novos passos possam ser adicionados ao escritório sem atualizar o sistema inteiro. Todos os passos e funções existentes continuam disponíveis, com o mesmo comportamento.

## [0.124.0] — 2026-07-22

- O Curatino agora carrega cada tela sob demanda, no momento em que você a abre. O sistema abre bem mais rápido no primeiro acesso do dia, especialmente em conexões lentas.
- Toda a estrutura de telas, menu e busca rápida (⌘K) passou a funcionar como módulos independentes — a base que permitirá, em breve, instalar novos recursos no escritório sem atualizar o sistema inteiro. Nenhuma tela, atalho ou item de menu mudou de lugar.

## [0.123.4] — 2026-07-22

- Continuação da preparação para as extensões do Curatino: o sistema já sabe reconhecer, conferir e organizar os recursos que serão instalados, recusando com uma explicação clara qualquer extensão incompatível — sem afetar as demais. Nada muda no uso do dia a dia por enquanto.

## [0.123.3] — 2026-07-22

- Início da preparação para as extensões do Curatino: uma base técnica que, nas próximas versões, permitirá instalar novos recursos no escritório sem precisar atualizar o sistema inteiro. Nada muda no uso do dia a dia por enquanto.

## [0.123.2] — 2026-07-22

- Revisão dos índices do banco de dados: os que não eram mais usados por nenhuma tela foram retirados e os que faltavam foram acrescentados, deixando as consultas mais econômicas e evitando falhas em buscas por processo e por escritório.

## [0.123.1] — 2026-07-21

- Os botões de "Marcar todos como lidos" e "Marcar todos como revisados" agora aparecem apenas quando há itens aplicáveis na lista filtrada, tornando a interface mais inteligente.

## [0.123.0] — 2026-07-21

- A tela de Pushes do Tribunal agora abre com o filtro de "Não lidos" já aplicado, facilitando a visualização das intimações pendentes.
- Adicionados botões elegantes para marcar todos os pushes não lidos como lidos e para marcar todos como revisados de uma só vez.
- Ao marcar um push como revisado, ele agora é automaticamente marcado também como lido.

## [0.122.3] — 2026-07-21

- Melhorias internas de infraestrutura: as regras de segurança e índices do banco de dados agora ficam em arquivos próprios, facilitando atualizações futuras.

## [0.122.2] — 2026-07-21

- Corrigido um problema que fazia os campos voltarem aos valores originais ao trocar de aba do navegador durante a edição ou cadastro de registros.

## [0.122.1] — 2026-07-20

- Melhorias internas de qualidade: novas verificações automáticas que detectam, antes da publicação, ajustes de tela que não seriam salvos e funcionalidades que ficariam de fora de uma atualização.

## [0.122.0] — 2026-07-20

- O CEP do cadastro de Pessoas passa a buscar o endereço automaticamente: ao digitar um CEP válido, rua, bairro, cidade e estado são preenchidos.
- O Form Design agora mostra também os campos do sistema das telas padrão (Pessoas, Processos, Contratos, Prazos e Financeiro). É possível mudar o nome que aparece na tela, o texto de exemplo, a seção, a posição e até ocultar um campo que o escritório não usa.
- Esses campos também aceitam as regras de comportamento: ocultar ou bloquear conforme o preenchimento de outros campos, preencher outros campos ao serem alterados, e buscar dados externos.
- Campos do sistema e campos próprios do escritório aparecem agora numa lista só, e podem ser reordenados livremente entre si.
- Um botão restaura qualquer campo do sistema ao padrão original, desfazendo os ajustes.
- Tipo do campo, máscara, obrigatoriedade e validação continuam definidos pelo sistema — eles também valem para os registros gravados por automações.

## [0.121.0] — 2026-07-20

- Escolher um vínculo agora pode preencher outros campos automaticamente. Ao selecionar o produto de um item de venda, por exemplo, o preço vem junto — e continua editável, caso aquela venda tenha um valor diferente.
- Voltou a busca de endereço pelo CEP: ao digitar um CEP válido no cadastro de pessoas, rua, bairro, cidade e estado são preenchidos sozinhos. CEP não encontrado apenas avisa, sem atrapalhar o preenchimento manual.
- A busca respeita a digitação: se você corrigir o CEP antes de a consulta terminar, vale sempre o endereço do último CEP informado.

## [0.120.0] — 2026-07-19

- Um campo agora pode totalizar os registros de outra tela vinculados a ele — como o total dos itens de uma venda, a quantidade de parcelas de um contrato ou o maior valor lançado. Basta escolher a tela dos filhos, a operação e o campo a ser medido.
- O total se mantém sozinho: sempre que um filho é incluído, alterado, excluído ou movido para outro registro, o valor do pai é recalculado.
- É possível considerar apenas parte dos filhos, informando uma condição — por exemplo, somar somente os itens que não foram cancelados.
- Campos calculados podem usar esses totais para montar textos, como um resumo que mostra a quantidade de itens e o valor total da venda.

## [0.119.0] — 2026-07-19

- Campos podem agora se preencher sozinhos a partir dos outros campos do mesmo cadastro. Basta descrever como o valor é montado — um nome completo formado pelo nome e pelo sobrenome, o total de um item calculado pela quantidade e pelo preço, ou uma frase que reúne várias informações do registro.
- O campo calculado aparece pronto no formulário e vai se atualizando conforme os demais campos são preenchidos. Ele fica bloqueado para digitação, já que o valor vem do cálculo.
- O valor é gravado junto com o registro, então pode ser usado em filtros, ordenações e rotinas — e é calculado da mesma forma quando o registro é gravado por uma automação.

## [0.118.0] — 2026-07-19

- Novo passo **Encerrar Workflow**: interrompe a rotina naquele ponto e devolve como resultado o que o passo anterior produziu. Serve para sair mais cedo de dentro de uma condição ou de uma repetição, sem precisar contornar os passos seguintes.
- O passo **Saída do Workflow** foi descontinuado, pois o **Montar Objeto** já cumpre a mesma função com mais recursos. Rotinas que ainda usem o passo antigo precisam ser abertas e ajustadas para voltar a executar.

## [0.117.0] — 2026-07-19

- Chegam as **Ações**: botões próprios do escritório que aparecem nas telas de cadastro e executam uma rotina automatizada. Um clique consulta, calcula ou integra o que for preciso, e traz o resultado de volta para a tela — podendo preencher campos, gravar o registro ou apenas avisar o que aconteceu.
- Cada ação tem título, ícone e o fluxo de trabalho que executa, e pode exibir uma mensagem de confirmação antes de rodar.
- É possível controlar quando cada ação aparece ou fica desabilitada conforme o preenchimento da tela — por exemplo, liberar o envio de e-mail somente depois que o endereço estiver informado, ou mostrar a ação apenas para administradores.
- As ações são configuradas uma única vez e reaproveitadas em quantas telas você quiser, escolhendo em Form Design se elas aparecem no cadastro, na listagem, ou em ambos.

## [0.116.0] — 2026-07-19

- Os campos de responsável — "Advogado responsável" em Processos e Prazos e "Responsável" em Contratos — passam a escolher entre as **Pessoas** do escritório, e não mais entre os usuários com acesso ao sistema. Assim é possível indicar qualquer advogado ou colaborador cadastrado, tenha ele conta de acesso ou não.
- Nos registros antigos, o responsável escolhido pelo modelo anterior aparece destacado como valor não encontrado, bastando reabrir o registro e selecionar a Pessoa correspondente.
- Ao criar um Processo ou Prazo, o responsável deixa de vir preenchido automaticamente com o próprio usuário: escolha a Pessoa responsável pelo trabalho.
- Em Processos, o responsável passa a ser opcional, como já era em Prazos e Contratos.

## [0.115.5] — 2026-07-19

- Valores que não constam mais na lista de um campo de seleção deixam de sumir da tela: agora aparecem destacados em âmbar, com um aviso de que a opção pode ter sido excluída. Antes o campo ficava visualmente vazio, mesmo com o conteúdo preservado no registro.
- Nas listas de opções cadastráveis, o item destacado traz um atalho para recolocá-lo na lista com um clique.
- Em campos que apontam para outro cadastro, quando o registro referenciado não é encontrado o sistema exibe "Registro não encontrado" junto ao identificador, que permite localizar os dados na auditoria.

## [0.115.4] — 2026-07-19

- Corrigido: ao cadastrar uma opção nova direto de um campo de seleção, o item aparecia duplicado na lista até a tela ser recarregada.

## [0.115.3] — 2026-07-19

- Corrigido: as listas de opções cadastráveis (áreas, fases, situações, instâncias, tipos de ação, tribunais, comarcas, juízes, tipos de prazo, tipos de documento, categorias de notícia e as opções de pessoas, contratos e financeiro) não mostravam, para os demais usuários, os itens recém-incluídos por um colega — era preciso recarregar a página. Agora elas se atualizam sozinhas, como o restante do sistema.

## [0.115.2] — 2026-07-19

- Corrigido: e-mails de movimentação do PJe do TJBA chegavam com as letras acentuadas trocadas e deixavam de ser reconhecidos, impedindo o registro automático das movimentações. O mesmo problema podia afetar comunicados de outros tribunais.
- Corrigido: os links para os documentos das movimentações podiam vir quebrados. Comunicados recebidos hoje mais cedo com link inválido precisam ser reprocessados.

## [0.115.1] — 2026-07-19

- Ajuste interno no processamento de e-mails dos tribunais.

## [0.115.0] — 2026-07-19

- As janelas de configuração de tela e de campo ficaram mais largas e foram divididas em abas, para caber na tela sem rolagem. No campo, as regras de formatação, validação, ocultação e desabilitação passaram para a aba "Avançado"; na tela, as opções foram separadas entre "Geral", "Listagem" e "Registros filhos".
- Ao escolher o tipo "Vínculo com registro", a tela vinculada e a opção de múltiplas seleções agora aparecem lado a lado.
- Se algo obrigatório não estiver preenchido, o sistema abre automaticamente a aba onde está o campo, em vez de apenas avisar.
- Corrigido: nas telas do sistema, o atalho "Gerenciar etiquetas" aparecia bloqueado na configuração do card, mesmo em telas que têm etiquetas.

## [0.114.1] — 2026-07-19

- Na configuração de uma tela personalizada, o atalho "Gerenciar etiquetas" do card agora fica visivelmente indisponível enquanto "Habilitar Etiquetas" estiver desmarcado — antes ele parecia disponível, mas não tinha efeito.
- Desmarcar "Habilitar Etiquetas" também desmarca o atalho, para que a tela não guarde uma configuração sem efeito.

## [0.114.0] — 2026-07-18

- A aba de registros vinculados agora usa a mesma listagem das telas personalizadas em janela. Na prática, os registros filhos ganharam de uma vez tudo o que a listagem já oferecia: os atalhos do card (copiar link, duplicar, gerenciar etiquetas e excluir), a barra de filtros com filtros salvos, as etiquetas no card e o convite para cadastrar o primeiro registro quando a lista está vazia.
- Daqui em diante, toda melhoria feita nas listagens chega junto às abas de registros vinculados, sem precisar ser refeita.
- O filtro da aba não oferece mais o campo que liga o registro ao seu principal — como todos os registros da aba pertencem ao mesmo, filtrar por ele não trazia resultado nenhum.

## [0.113.1] — 2026-07-18

- Corrigido um problema nas telas personalizadas: ao criar uma etiqueta pela janela de etiquetas, ela não aparecia na lista e era preciso recarregar o navegador para vê-la. Agora a etiqueta nova surge na hora, já na ordem alfabética — e o mesmo vale quando uma etiqueta é renomeada.

## [0.113.0] — 2026-07-18

- As telas do sistema (Pessoas, Processos, Contratos, Prazos e Financeiro) ganharam uma janela de Configurações, onde é possível escolher quais atalhos aparecem no card da listagem — copiar link, duplicar, gerenciar etiquetas e excluir. Cada tela oferece apenas os atalhos que fazem sentido nela: Prazos, por exemplo, não tem etiquetas.
- Atalhos próprios do fluxo de trabalho, como "Concluir" em Prazos e "Registrar pagamento" no Financeiro, continuam sempre disponíveis.
- Processos e Contratos, que não tinham nenhum atalho no card, agora podem exibi-los.

## [0.112.2] — 2026-07-18

- Ao configurar os registros filhos de uma tela do sistema (Processos, Contratos, Pessoas, Financeiro e Prazos), a janela deixou de exibir campos que não se aplicam a essas telas, como título, ícone e as opções de abas — que são fixos e não podiam ser alterados de qualquer forma.

## [0.112.1] — 2026-07-18

- Removido um texto explicativo desnecessário na configuração de registros filhos das telas do sistema.

## [0.112.0] — 2026-07-18

- A configuração de registros filhos agora tem um caminho único: você seleciona os filhos de dentro da tela principal, seja ela personalizada ou do sistema. As telas do sistema (Processos, Contratos, Pessoas, Financeiro e Prazos) ganharam um botão de configuração para escolher quais telas aparecem como aba dentro de cada registro.
- A antiga opção "Esta tela é filha de outra?", que ficava na tela filha e gerava confusão, foi removida.

## [0.111.0] — 2026-07-18

- Os registros filhos agora podem ser configurados a partir da tela principal. Ao editar a tela de Veículos, por exemplo, uma seção "Registros filhos desta tela" lista as telas que possuem um campo apontando para Veículos — basta marcar quais devem aparecer como aba dentro de cada veículo. A configuração pelo lado da tela filha continua disponível, e é o caminho para vincular a uma tela do sistema, como Processos.

## [0.110.1] — 2026-07-18

- Corrigido um erro ao salvar telas na configuração (criar tela, editar, ativar/desativar, reordenar e salvar campo), que passou a falhar após a atualização anterior.

## [0.110.0] — 2026-07-18

- Agora uma tela pode ter registros filhos. Exemplo: em uma tela de Vendas, os Itens da venda passam a aparecer como uma aba dentro de cada venda, com os campos que você configurar (inclusive vínculos, como o produto). Basta criar a tela dos itens, adicionar um campo de vínculo apontando para a tela principal e indicá-la como "Tela pai" na configuração.
- A tela dos itens deixa de aparecer no menu lateral e na busca, já que seus registros só existem dentro do registro principal. Ao clicar em "+", a janela do item abre já vinculada; ao salvar, ela fecha e volta para o registro principal.
- Vale também para as telas do sistema: é possível, por exemplo, ter uma tela de Audiências vinculada a Processos.

## [0.109.1] — 2026-07-18

- Preparação interna para o recurso de registros filhos (ex.: os Itens de uma Venda): a configuração de telas passou a permitir indicar uma tela pai e o campo que faz o vínculo. A exibição desses registros dentro do registro pai vem na próxima atualização.

## [0.109.0] — 2026-07-18

- A tela de Contratos passou a usar o mesmo motor de formulário das demais: as mensagens de validação aparecem abaixo de cada campo, as listas (Tipo, Categoria, Status, Objeto, Índice de reajuste, Moeda, Forma de pagamento, Banco e Centro de custo) permitem cadastrar novas opções direto no campo, e as partes envolvidas ganharam busca por digitação com seleção múltipla. A aba de Processos vinculados continua funcionando como antes.
- Com isso, todas as telas de cadastro do sistema seguem o mesmo padrão de formulário e de listagem.

## [0.108.1] — 2026-07-18

- Corrigida a faixa colorida de prioridade nos cards de Prazos, que havia passado para a lateral e ultrapassava a borda arredondada do card. Voltou a ser a linha fina no topo, como antes.

## [0.108.0] — 2026-07-18

- Os cards da listagem de Financeiro passaram a seguir a configuração da tela para os campos simples, mantendo os atalhos que abrem a Pessoa, o Processo e o Contrato, a linha de datas e o valor destacado no rodapé. Com isso, todas as listagens do sistema seguem o mesmo padrão visual.

## [0.107.0] — 2026-07-18

- Os cards da listagem de Prazos passaram a seguir a configuração da tela: Processo, datas de vencimento e conclusão, responsável e descrição agora vêm da definição de cada campo. A faixa colorida de prioridade, os selos de situação, o contador de dias e o atalho para abrir o processo continuam como antes.
- Corrigido o ícone do valor em Processos, Contratos e Financeiro, que estava caindo em um ícone genérico.

## [0.106.0] — 2026-07-18

- Os cards da listagem de Contratos passaram a seguir a configuração da tela, com o valor total exibido como moeda. Situação, tipo, período de vigência e as partes (Contratante e Contratado) continuam exibidos como antes.

## [0.105.1] — 2026-07-18

- No card de Processos, o advogado responsável passou a ser exibido a partir da configuração da tela, como as demais linhas. Com isso, todas as informações do card seguem a definição dos campos.

## [0.105.0] — 2026-07-18

- Os cards da listagem de Processos passaram a seguir a configuração da tela: as linhas exibidas (Área, Instância, Vara, Valor da causa) agora vêm da definição de cada campo, e o valor da causa aparece formatado como moeda. As características próprias do Processo — dias em trâmite, situação e fase, e os polos ativo e passivo — continuam exibidas como antes.

## [0.104.0] — 2026-07-18

- A tela de Processos passou a usar o mesmo motor de formulário das demais: as mensagens de validação aparecem abaixo de cada campo, os polos ativo e passivo ganharam busca por digitação com seleção múltipla, o valor da causa virou campo de moeda, e as listas (Área, Fase, Status, Instância, Vara, Comarca, Juiz e Tipo de ação) permitem cadastrar novas opções direto no campo.

## [0.103.0] — 2026-07-18

- A tela de Financeiro passou a usar o mesmo motor de formulário das demais: as mensagens de validação aparecem abaixo de cada campo, Categoria, Status e Centro de custo permitem cadastrar novas opções direto no campo, e Processo, Pessoa e Contrato ganharam busca por digitação. A aba de Documentos agora usa o mesmo painel das outras telas.

## [0.102.1] — 2026-07-18

- Corrigido um campo "Etiquetas" que passou a aparecer indevidamente no formulário de Pessoas. As etiquetas continuam sendo gerenciadas pelo botão no topo da tela, como antes.

## [0.102.0] — 2026-07-18

- A tela de Prazos passou a usar o mesmo motor de formulário das demais telas: as mensagens de validação agora aparecem abaixo de cada campo, o tipo de prazo permite cadastrar novas opções direto no campo, e a prioridade exibe suas cores. Os campos Processo e Advogado responsável ganharam busca por digitação.

## [0.101.5] — 2026-07-18

- Nas automações, ao buscar itens de uma lista de escolha (Juiz, Vara, Área do Direito, Tipo, Status e demais), agora é possível filtrar e trazer o identificador e a cor do item. Antes esses dois campos não apareciam entre as opções, e a lista oferecia um campo "Coleção" que nunca tinha conteúdo.

## [0.101.4] — 2026-07-18

- Campos de seleção deixam de exibir uma opção como se estivesse escolhida quando o registro não tem valor gravado. Isso acontecia em Processos (Área do Direito, Instância, Fase, Status e Advogado Responsável), Prazos (Tipo, Prioridade e Advogado Responsável), Financeiro (Tipo e Status) e Pessoas (Tipo de Pessoa): a tela mostrava um valor que não existia na base, e o registro não aparecia ao ser pesquisado por esse campo. Os valores sugeridos continuam sendo preenchidos normalmente na criação de um novo registro.

## [0.101.3] — 2026-07-18

- O Processador de Dados passa a respeitar exatamente como o texto está escrito no documento ao preencher os campos de uma automação: nomes, endereços e descrições são copiados sem trocar maiúsculas por minúsculas nem "arrumar" a grafia. A única exceção são os campos de escolha entre opções, em que a diferença de maiúsculas e de acentos é ignorada apenas para encontrar a opção certa — o texto "Ba", por exemplo, passa a ser reconhecido como a opção "BA", em vez de deixar o campo vazio.

## [0.101.2] — 2026-07-18

- A etapa "Gravar Registro" das automações agora avisa, no histórico de execução, sempre que algum campo enviado não pôde ser gravado — informando quais foram e o motivo. Antes esses campos eram simplesmente ignorados, sem nenhum registro.

## [0.101.1] — 2026-07-18

- Corrigido um problema em que a etapa "Gravar Registro" das automações ignorava o Título ao incluir ou alterar Processos e Contratos: o campo era descartado silenciosamente e o registro era gravado sem ele.

## [0.101.0] — 2026-07-18

- Nova função `map` nas expressões: a partir de uma lista, ela recolhe um mesmo dado de todos os itens — por exemplo, os nomes de todas as partes de um processo. Basta indicar o caminho do dado desejado, e há a opção de descartar os valores em branco do resultado.
- As funções `contains` e `indexOf` passam a funcionar tanto com listas quanto com texto, em qualquer lugar do sistema. Antes, cada uma aceitava apenas um dos dois casos conforme onde era usada, o que provocava erros inesperados ou resultados incorretos.

## [0.100.2] — 2026-07-18

- As mensagens de validação por expressão (e de formato) agora também aparecem abaixo do campo correspondente nas telas personalizadas e nos campos adicionais, não só no aviso do topo.

## [0.100.1] — 2026-07-18

- Ao salvar um cadastro de Pessoa ou de uma tela personalizada, as mensagens de validação agora aparecem também logo abaixo de cada campo com problema (além do aviso no topo), facilitando identificar exatamente o que corrigir. A mensagem some assim que o campo é ajustado.

## [0.100.0] — 2026-07-18

- Nas telas personalizadas, agora é possível escolher quais atalhos aparecem em cada card da listagem — copiar link, duplicar, gerenciar etiquetas e excluir. Basta marcar as opções desejadas em "Ações no card da listagem" ao editar a tela.

## [0.99.5] — 2026-07-18

- As caixas de seleção da configuração de telas e de campos personalizados, além dos campos do tipo "sim/não" nos formulários, passaram a usar o visual padrão do sistema, ficando consistentes com o restante da interface e com o tema claro/escuro.

## [0.99.4] — 2026-07-18

- As telas de cadastro de Pessoas e das telas personalizadas passaram a compartilhar o mesmo motor interno de detalhe (abrir, editar, clonar, excluir, anotações, documentos e etiquetas), deixando o comportamento mais uniforme e a manutenção mais simples, sem mudança visível no uso.

## [0.99.3] — 2026-07-17

- As anotações e os documentos das telas de Pessoas e das telas personalizadas passaram a compartilhar exatamente o mesmo mecanismo interno, e a formatação de campos com máscara (como CPF, CNPJ e telefone) ficou totalmente unificada — mais consistência e menos pontos de manutenção.

## [0.99.2] — 2026-07-17

- Aprimoramentos internos no cadastro de Pessoas: a formatação e a verificação de CPF, CNPJ e telefone passaram a seguir integralmente a definição de cada campo, deixando a tela mais leve e consistente com o restante do sistema.

## [0.99.1] — 2026-07-17

- Os cards das telas personalizadas na listagem passaram a ter o mesmo visual dos cards de Pessoas (ícone em círculo ao lado do título), deixando a aparência totalmente uniforme.

## [0.99.0] — 2026-07-17

- As telas de listagem (Pessoas e telas personalizadas) passaram a compartilhar o mesmo cabeçalho, filtro e área de conteúdo, deixando tudo mais uniforme. A listagem de telas personalizadas teve pequenos ajustes visuais (estado "vazio" e espaçamento) para ficar igual às demais.

## [0.98.1] — 2026-07-17

- Mais reorganização interna das telas de cadastro (ações de copiar link, duplicar, etiquetas e excluir agora compartilham o mesmo código). Sem mudança no uso.

## [0.98.0] — 2026-07-17

- As telas de cadastro (Pessoas e telas personalizadas) passaram a compartilhar o mesmo cabeçalho, abas e botões de ação, deixando a experiência mais uniforme. Nas telas personalizadas, o ícone da tela agora aparece num círculo ao lado do título, como em Pessoas.

## [0.97.0] — 2026-07-17

- As abas de Anotações e Documentos passaram a usar um mesmo componente em todas as telas (Pessoas e telas personalizadas), garantindo comportamento e visual idênticos e facilitando melhorias futuras. Sem mudança no uso do dia a dia.

## [0.96.2] — 2026-07-17

- Organização interna do código da tela de Pessoas (listagem e cadastro reunidos), sem mudança visível no uso.

## [0.96.1] — 2026-07-17

- Continuação do ajuste interno da tela de Pessoas, separando com mais clareza as regras de cada campo (o que é obrigatório, as opções disponíveis) da forma como ele é exibido. Sem mudança visível no uso.

## [0.96.0] — 2026-07-17

- Reorganização interna da tela de Pessoas: o formulário e o card da listagem agora são montados a partir de uma única definição de cada campo, o que torna a manutenção mais simples e consistente — adicionar ou ajustar um campo passa a ser feito em um só lugar. Sem mudança visível no uso do dia a dia.

## [0.95.1] — 2026-07-17

- Nos cards de Pessoas, os atalhos do canto passaram a seguir o mesmo visual dos demais (aparecem no hover e destacam em vermelho ao excluir), e as linhas de informação agora podem exibir qualquer campo da pessoa apenas indicando-o na configuração da tela.

## [0.95.0] — 2026-07-17

- A listagem de Pessoas ganhou cards padronizados com título, subtítulo com ícone, etiquetas e — ao passar o mouse — atalhos rápidos no canto (copiar link, duplicar, gerenciar etiquetas e excluir), sem precisar abrir o cadastro. Cada linha de informação exibe um ícone, e a ordem e os ícones são definidos pela configuração da tela.

## [0.94.0] — 2026-07-17

- A tela de Pessoas passou a montar seu formulário sobre a mesma base das telas personalizadas: os campos de Pessoa Física e Jurídica aparecem e somem conforme o tipo escolhido, com as listas (Profissão, Cidade, Sexo, Relacionamento e demais) funcionando como antes. Um primeiro passo para deixar a manutenção de todas as telas mais uniforme.

## [0.93.1] — 2026-07-17

- No construtor de telas, a janela de criar/editar campo ficou mais larga e organizada em duas colunas, mais fácil de preencher.
- Ao escrever uma expressão de campo, os campos da tela e o "value" agora aparecem como sugestões conforme você digita.

## [0.93.0] — 2026-07-17

- Campos agora podem ter regras inteligentes por expressão: uma expressão de **validação** que exibe uma mensagem de erro personalizada (aplicada tanto ao salvar na tela quanto nas automações), além de expressões para **desabilitar** ou **ocultar** o campo automaticamente conforme os outros campos preenchidos. Configuráveis no construtor de telas, para campos personalizados de qualquer tela.

## [0.92.4] — 2026-07-17

- No editor de automações, um passo "Chamar Workflow" que não aguarda o retorno deixa de aparecer na lista de "Saída de outro step", já que nesse modo ele não devolve nenhuma saída para ser aproveitada.

## [0.92.3] — 2026-07-17

- Corrigido um problema no editor de automações: quando um passo usava a saída de um passo anterior do tipo "Chamar Workflow", essa saída não aparecia na lista de seleção. Agora as saídas do workflow chamado (quando ele aguarda o retorno) ficam disponíveis para escolher.

## [0.92.2] — 2026-07-17

- Corrigido um problema em que uma automação era executada mesmo quando parâmetros marcados como obrigatórios não estavam preenchidos. Agora, se faltar um campo obrigatório, a execução é interrompida e o motivo fica registrado no histórico da automação.

## [0.92.1] — 2026-07-17

- Ajustes internos de manutenção do projeto, sem qualquer mudança visível no uso do sistema.

## [0.92.0] — 2026-07-17

- No passo "Chamar Workflow" de uma automação, agora existe a opção "Aguardar retorno": quando ativada, a automação executa o outro workflow, espera ele terminar e aproveita as saídas dele nos passos seguintes. Assim é possível, por exemplo, chamar um workflow que calcula um valor e usar esse resultado logo em seguida. Sem a opção, o comportamento continua o mesmo de antes: o outro workflow é apenas disparado e a automação segue em frente sem esperar.

## [0.91.3] — 2026-07-16

- A tela de Automações agora abre já filtrada por "Meus Workflows", mostrando primeiro as suas automações. Basta ajustar o filtro para ver também as públicas de outros escritórios.

## [0.91.2] — 2026-07-16

- Corrigido o filtro de automações por tipo "Públicos": agora as suas próprias automações publicadas também aparecem ao filtrar por Públicos, e não apenas as de outros escritórios.

## [0.91.1] — 2026-07-16

- Corrigido um problema nas listas de opções (tipos, categorias, status e afins) em que um valor padrão do sistema aparecia duplicado quando também existia um valor cadastrado com o mesmo nome. Agora, quando isso acontece, o sistema mostra apenas o valor padrão, sem repetição.

## [0.91.0] — 2026-07-16

- Agora é possível testar um Script ou uma Automação direto na tela, sem sair do sistema. Um novo botão "Executar" abre uma janela que pede os dados de entrada — pelo formulário ou colando um JSON — e, ao rodar, mostra o resultado e as mensagens de log de forma clara.
- Nos Scripts, ficou disponível o `console.log` (e a função `log`) para acompanhar o que acontece durante a execução; essas mensagens aparecem tanto ao testar o Script quanto na aba de Execuções das Automações que o utilizam.

## [0.90.0] — 2026-07-16

- As mensagens de aviso e de erro que aparecem no topo da tela agora desaparecem sozinhas depois de 10 segundos. Basta manter o mouse sobre a mensagem para pausar essa contagem e lê-la com calma — ao tirar o mouse, ela volta a se fechar automaticamente. Também é possível fechá-la na hora clicando no "x".
- Corrigido um problema em que o botão de fechar ("x") sumia quando a mensagem de erro era muito longa. Agora o texto quebra em várias linhas e o "x" continua sempre visível.

## [0.89.1] — 2026-07-16

- Corrigido um erro ao salvar steps de automação com campos opcionais deixados em branco, como validar o objeto inteiro sem informar uma propriedade específica.

## [0.89.0] — 2026-07-16

- No editor de automações (visualização em fluxo), agora dá para inserir um passo, uma Condição ou uma Repetição em qualquer ponto do fluxo, não só no fim. Passe o mouse sobre a linha onde quer o novo item — inclusive na primeira linha, logo abaixo do Gatilho — e escolha entre os três botões que aparecem. Isso vale também dentro das Repetições e dos ramos das Condições.

## [0.88.0] — 2026-07-16

- No editor de automações (visualização em fluxo), agora você pode arrastar um passo já existente para dentro de uma Repetição ou de um ramo de uma Condição — e também tirá-lo de lá de volta para o fluxo principal. Assim não é mais preciso recriar o passo do zero quando ele deveria estar dentro de um Loop ou Condição.

## [0.87.0] — 2026-07-16

- O passo "Montar Objeto" das automações ficou mais flexível: o nome do objeto agora é opcional. Quando você dá um nome, os campos continuam agrupados num único objeto (ideal para gravar um cadastro de uma vez). Quando deixa o nome em branco, cada campo montado fica disponível diretamente para os próximos passos, sem precisar navegar por um objeto.

## [0.86.0] — 2026-07-16

- As automações agora podem repetir passos para cada item de uma lista: o novo passo de Repetição recebe uma lista (ou um item único) e executa a sequência de passos do seu corpo uma vez para cada item. Ao final, os resultados de todas as repetições ficam reunidos numa lista, disponível para o próximo passo da automação. As repetições podem ser aninhadas e aproveitam normalmente as saídas dos passos anteriores.
- Na tela de passos, a Repetição aparece como um bloco recolhível e elegante, deixando claro visualmente quais passos rodam a cada item.

## [0.85.0] — 2026-07-15

- As automações agora podem ramificar o fluxo: um novo passo de Condição avalia uma regra durante a execução e decide quais passos seguintes rodam quando o resultado é Verdadeiro e quais rodam quando é Falso. Depois dos ramos, o fluxo volta a seguir normalmente. As condições podem ser aninhadas e continuam aproveitando as saídas dos passos anteriores.
- A tela de passos ganhou a visualização do fluxo com trilhas coloridas de "Verdadeiro" e "Falso", além da lista indentada equivalente, para acompanhar visualmente cada caminho da automação.

## [0.84.0] — 2026-07-15

- Os parâmetros de uma automação (e as entradas e saídas de um Script) agora podem ser marcados como "Vários", permitindo receber uma lista de valores do mesmo tipo — seja uma lista simples, como etiquetas, ou uma lista de fichas completas, como itens com descrição e valor. A opção fica disponível para todos os tipos de campo, tanto no editor visual quanto no modo avançado.
- Quando a inteligência artificial do Processador não consegue interpretar os dados, a tela agora exibe um aviso simples e os detalhes completos ficam registrados nos Logs de Auditoria — com a possível causa (incluindo quando a resposta foi cortada por atingir o limite de tokens da conexão de IA), o esquema solicitado e o início e o fim da resposta recebida.

## [0.83.3] — 2026-07-15

- Corrigido problema que causava duplicação de itens nas listas de seleção após cadastrar novas informações. Ao cadastrar um processo, pessoa ou outro registro, ele não aparecerá mais duplicado nos formulários de telas relacionadas.

## [0.83.2] — 2026-07-14

- Corrigido problema crítico que poderia causar perda de emails recebidos do Gmail ao renovar a autorização. O sistema agora preserva corretamente o histórico de sincronização durante renovações de token.

## [0.83.1] — 2026-07-14

- Aprimorado o rastreamento de sincronização de emails do Gmail para melhor diagnóstico de problemas.

## [0.83.0] — 2026-07-13

- Workflows copiados agora rastreiam sua origem e podem ser atualizados quando o workflow original é modificado.
- Adicionado campo de versão editável nos workflows para melhor controle de versionamento.

## [0.82.8] — 2026-07-13

- Corrigido problema de duplicação de scripts ao copiar workflows públicos. Agora, quando múltiplos workflows compartilham o mesmo script, apenas uma cópia é criada no destino.

## [0.82.7] — 2026-07-13

- Corrigido problema que impedia a cópia de workflows públicos (parâmetros eram passados na ordem errada).
- Mensagens de erro ao copiar workflows agora mostram detalhes do problema encontrado.

## [0.82.6] — 2026-07-13

- Corrigido erro 404 ao copiar workflows públicos para o escritório.

## [0.82.5] — 2026-07-13

- Resolvido problema de acesso ao catálogo de etapas de workflow: a região southamerica-east1 agora está totalmente configurada com permissões públicas adequadas, eliminando erros de autenticação e CORS ao carregar os recursos do sistema.

## [0.82.4] — 2026-07-13

- Corrigida a região das Cloud Functions para southamerica-east1, eliminando erros de CORS ao carregar as funções de expressão disponíveis.

## [0.82.3] — 2026-07-13

- Adicionado sistema de publicação individual de funções do servidor para contornar limites de processamento durante atualizações do sistema. O processo agora ocorre de forma sequencial e controlada, evitando falhas na implantação.

## [0.82.2] — 2026-07-13

- Ao copiar um workflow público, todos os workflows associados (chamados por meio de etapas "Chamar Workflow") e scripts agora são copiados automaticamente de forma recursiva, garantindo que a automação funcione imediatamente. A cópia é feita pelo sistema com privilégios elevados, permitindo acesso seguro aos recursos do escritório de origem sem violar as regras de segurança.

## [0.82.1] — 2026-07-13

- Corrigido problema no catálogo de tipos de etapas de workflow: a propriedade "tipo" agora é transmitida corretamente para o editor visual.

## [0.82.0] — 2026-07-13

- Workflows agora podem ser marcados como públicos e aparecem automaticamente na lista de automações de todos os escritórios, identificados com um badge "Público" e mostrando o nome e foto do proprietário. Qualquer usuário pode copiar um workflow público para seu próprio escritório com um único clique, incluindo todos os scripts associados — perfeito para compartilhar automações úteis entre diferentes escritórios.

## [0.81.0] — 2026-07-13

- As chaves de API das conexões de Inteligência Artificial passam a ser guardadas em área restrita, acessível apenas pelo sistema: uma vez cadastradas, elas nunca mais são enviadas de volta ao navegador. Ao editar uma conexão, o campo da chave aparece em branco — deixe-o assim para manter a chave atual ou preencha-o para substituí-la.

## [0.80.2] — 2026-07-13

- Corrigido um problema na criação de valores personalizados que causava inconsistências ao gravar registros por meio de workflows ou scripts, impedindo que o campo personalizado fosse reconhecido corretamente pelo sistema.

## [0.80.1] — 2026-07-13

- Corrigido um problema que impedia a exclusão imediata de valores personalizados adicionados aos campos Sexo, Estado Civil, Nacionalidade e outros lookups. Agora, ao adicionar um novo valor, o botão de exclusão aparece instantaneamente, sem precisar recarregar a página.

## [0.80.0] — 2026-07-13

- O campo Sexo no cadastro de pessoas agora funciona como uma lista personalizável. Os valores padrões são Masculino, Feminino e Não Informado, e novos valores podem ser criados conforme necessário, seguindo o mesmo padrão de Estado Civil e Nacionalidade.

## [0.79.0] — 2026-07-12

- O Processador de Dados foi reorganizado em etapas guiadas: origem dos dados, inteligência artificial, automação e execução. Cada etapa aparece sozinha na tela, com o caminho percorrido sempre visível no topo.
- Ao enviar um PDF com várias páginas, agora é possível escolher qual página processar — antes o sistema usava sempre a primeira. A página escolhida é exibida em miniatura, e seu texto entra pronto para revisão.
- Antes de executar, a tela apresenta um resumo do que será processado (origem, inteligência escolhida e automação), e ao final é possível iniciar um novo processamento com um clique.

## [0.78.1] — 2026-07-12

- Correção de um problema que impedia a geração de uma nova versão do sistema para publicação.

## [0.78.0] — 2026-07-12

- Os campos agora podem ter regras próprias de validação e de formatação, definidas uma única vez e respeitadas em todo o sistema — tanto quando você preenche um cadastro na tela quanto quando uma automação grava o registro sozinha.
- Nos campos personalizados, além das máscaras prontas, é possível criar a sua própria regra: por exemplo, exigir que um número de registro tenha duas letras seguidas de seis dígitos, ou converter o texto para maiúsculas antes de gravar.
- CPF, CNPJ, e-mail, telefone e CEP passam a ser conferidos e padronizados automaticamente em Pessoas, evitando que um documento inválido entre no cadastro.
- Os parâmetros de uma automação e de um script também aceitam essas regras, e a automação avisa exatamente qual campo reprovou, com o motivo, quando algum dado chega fora do padrão.
- Novo passo "Validar Objeto" nas automações: confere um conjunto de dados contra as regras de um cadastro conhecido (ou contra regras que você mesmo define) antes de seguir adiante.

#### [0.77.0] — 2026-07-12

- Nas automações, quando um registro é trazido por referência (a Pessoa de um Processo, o Processo de um Prazo, e assim por diante), ele agora chega **completo**, com todos os seus campos, e não apenas com os poucos campos de resumo. Isso vale para condições, expressões, passos e Scripts — sem nenhuma consulta extra ao banco.
- No editor de Script, os parâmetros que apontam para um cadastro e os parâmetros do tipo objeto passaram a ser reconhecidos com todos os seus campos: o editor sugere e valida corretamente coisas como o nome, o CPF ou o endereço da pessoa, em vez de tratar tudo como texto e marcar erro à toa.

#### [0.76.0] — 2026-07-12

- Novo passo **Montar Objeto** nas automações: monte um registro campo a campo (com valores fixos, do evento, de expressões, de saídas de outros passos ou de variáveis) e dê um nome a ele para reaproveitar nos passos seguintes.
- O passo **Gravar Registro** ficou mais simples e direto: em vez de mapear campo por campo, agora você indica de onde vem o registro pronto (dos passos anteriores ou do evento), opcionalmente a propriedade desejada, e o cadastro em que ele será gravado. Se o registro já tiver um identificador, ele é atualizado; caso contrário, é incluído.
- Os nomes de campos e parâmetros das automações e cadastros agora aceitam letras maiúsculas (por exemplo, `dataNascimento`), e não apenas minúsculas — desde que sigam o formato de um nome de variável.
- Ao gravar um registro que já existe (por exemplo, reaproveitando um registro trazido de outro passo), o passo **Gravar Registro** agora ignora automaticamente os campos internos de controle (como datas e autoria) em vez de falhar, e registra que a atualização foi feita pela automação.

#### [0.75.0] — 2026-07-11

- Ao criar um parâmetro do tipo "Lista de Opções" nas automações, as opções agora aparecem logo abaixo do tipo — antes do campo de valor padrão — deixando claro que é ali que se informam as escolhas disponíveis. O valor padrão passa a ser escolhido a partir das opções cadastradas.
- A aba "JSON (avançado)" dos parâmetros ganhou uma referência com todas as propriedades disponíveis e um exemplo completo, que pode ser inserido no editor com um clique.

#### [0.74.0] — 2026-07-11

- As automações agora podem **criar, atualizar e excluir registros** dos cadastros do escritório — não apenas consultá-los. Há dois novos passos no editor de automações: "Gravar Registro" e "Excluir Registro", que funcionam com cadastros fixos, personalizados e listas.
- Nos Scripts, além de `query`, ficam disponíveis as funções `upsert` (incluir/atualizar) e `remove` (excluir). Uma nova tela "Funções de Dados", acessível pelo editor de Script, reúne e explica todas essas funções com exemplos.
- A exclusão passou a remover **apenas o registro escolhido**, sem apagar itens relacionados em cascata. Assim, excluir um processo, uma pessoa ou um contrato é mais rápido e previsível.

#### [0.73.0] — 2026-07-11

- Novas funções para usar em expressões e Scripts: **onlyNumber**, que extrai apenas os números de um valor (útil para limpar CPF, CNPJ ou telefone — ex.: "123.aaa.bb-fff.45" vira "12345"), e **formatMoney**, que exibe um número como valor monetário (ex.: 123,90 vira "R$ 123,90"), com o formato brasileiro como padrão.

#### [0.72.2] — 2026-07-11

- Melhoria interna no processo de qualidade do desenvolvimento, para evitar que erros no backend passem despercebidos. Sem mudanças perceptíveis no uso do sistema.

#### [0.72.1] — 2026-07-11

- Corrigido: a função **substituir** (usada em Scripts e em expressões) agora troca exatamente o texto informado. Antes, buscar por caracteres como ".", "(" ou "$" apagava ou alterava trechos inesperados — por exemplo, remover os pontos de um CPF acabava esvaziando o valor inteiro.

#### [0.72.0] — 2026-07-11

- O Processador de Dados agora funciona com automações que têm campos **agrupados em objetos** (por exemplo, um "Reclamante" com nome, CPF, endereço e outros dados dentro dele). A inteligência artificial preenche esses grupos aninhados a partir do texto ou do PDF, campo por campo, respeitando os valores padrão definidos na automação.

#### [0.71.1] — 2026-07-11

- Corrigido: nos editores de código (Script e o modo JSON de parâmetros), o texto selecionado agora fica destacado visualmente. Antes a seleção funcionava, mas ficava invisível.

#### [0.71.0] — 2026-07-11

- Os parâmetros das automações "Chamado por Workflow" e dos Scripts agora aceitam **estruturas aninhadas**: um parâmetro do tipo **Objeto** pode conter outros campos dentro dele (por exemplo, um "Endereço" com "Cidade" e "Estado"). Essas estruturas aparecem naturalmente no preenchimento e nas sugestões automáticas de quem usa a automação ou o script, campo por campo.
- Cada parâmetro pode ter um **valor padrão**: se, na hora de executar, o campo vier vazio, o sistema usa automaticamente o valor padrão definido.
- Para quem prefere, há um novo modo **JSON (avançado)** de cadastrar os parâmetros: em vez de montar campo a campo na tela, você descreve toda a estrutura de uma vez em um editor de texto, com validação antes de salvar. O resultado é idêntico ao modo visual.
- No editor visual, cada parâmetro agora tem um botão **Clonar**, que cria uma cópia dele logo abaixo — já com um nome numerado e trazendo junto todos os campos internos, no caso de objetos.

#### [0.70.0] — 2026-07-11

- Nova tela **Processador de Dados**: cole um texto livre ou envie um PDF (o sistema lê a primeira página automaticamente), escolha qual inteligência artificial usar e execute uma automação já com os campos preenchidos a partir do conteúdo. Um botão detecta por IA quais automações combinam com o texto, e a tela acompanha cada etapa da execução — mostrando sucesso ou falha, com um atalho direto para a aba de Execuções quando algo dá errado. Disponível para administradores e advogados do escritório.

#### [0.69.1] — 2026-07-10

- Corrigido: quando um e-mail de intimações trazia **várias publicações do mesmo processo**, o sistema registrava apenas uma. Agora cada intimação vira um registro próprio, sem perder as demais — e o reprocessamento do mesmo e-mail continua sem gerar duplicatas.

#### [0.69.0] — 2026-07-10

- O editor de código dos Scripts foi modernizado: agora tem realce de sintaxe, sugestões automáticas enquanto você digita (incluindo as funções `fn.`, a consulta `query` e os parâmetros de `input`), destaque de erros e formatação automática do código. Um botão "Formatar" arruma a indentação a qualquer momento, e há um interruptor para ligar ou desligar a formatação automática — sua preferência fica salva.

#### [0.68.0] — 2026-07-10

- A tela de Script agora traz um guia integrado de como usar a consulta ao banco de dados: explicação de cada configuração, a lista de operadores disponíveis e exemplos prontos para copiar, facilitando montar consultas sem precisar decorar o formato.

#### [0.67.2] — 2026-07-10

- Quando um Script devolve uma saída do tipo "Referência a entidade", os passos seguintes agora conseguem acessar as propriedades dela pelo autocomplete (ex: `input.pessoa.nome`), e não apenas a referência inteira.

#### [0.67.1] — 2026-07-10

- Os botões de salvar e excluir na tela de edição de Script agora seguem o mesmo visual discreto das demais telas.

#### [0.67.0] — 2026-07-10

- Os Scripts agora podem **consultar os cadastros do escritório** diretamente (clientes, processos, prazos e cadastros personalizados), sem precisar de um passo de busca antes. A pesquisa respeita sempre o escritório atual e tem limites de tempo e de quantidade para manter tudo rápido e seguro.

#### [0.66.0] — 2026-07-10

- Nova área de **Scripts**: agora é possível criar pequenos scripts reutilizáveis para processar dados com regras personalizadas, definindo os campos que ele recebe e os que ele devolve.
- As automações ganharam um novo passo do tipo **Script**: basta escolher um script já criado e preencher os campos de entrada. O que o script devolve fica disponível para os passos seguintes.
- Os scripts rodam em um ambiente isolado e seguro, sem acesso à internet ou aos seus dados, e podem usar as mesmas funções já disponíveis nas expressões.

#### [0.65.0] — 2026-07-10

- A leitura automática das intimações recebidas por e-mail ficou bem mais precisa. O sistema agora reconhece corretamente os formatos do PJe, do Projudi, das Publicações Online e do Recorte Digital da OAB — incluindo e-mails com **várias intimações**, em que cada processo vira um registro separado.
- Textos com acentos (ç, ã, é…) e caracteres especiais deixam de aparecer corrompidos: número do processo, partes, classe, vara e o resumo da notificação são extraídos como devem.
- A inteligência artificial passou a ser acionada apenas como último recurso e somente quando o e-mail realmente contém um número de processo — evitando análises desnecessárias em mensagens sem conteúdo jurídico.

#### [0.64.0] — 2026-07-09

- Nas automações disparadas ao salvar um registro, agora é possível distinguir com clareza se foi uma **inclusão** ou uma **alteração**: o evento traz o campo "Tipo da mudança" com o valor "created" (novo registro) ou "updated" (registro existente). Antes era preciso deduzir isso pela presença dos dados anteriores.

#### [0.63.0] — 2026-07-09

- A função `interpolate` do construtor de expressões agora aceita valores por posição: escreva `{0}`, `{1}` no texto e informe os valores na ordem, sem precisar montar um objeto. O modo por nome de campo continua disponível.

#### [0.62.1] — 2026-07-09

- Corrigida uma mensagem de erro incorreta ao usar as funções `object`, `and`, `or`, `coalesce`, `min`, `max` e `concat` no construtor de expressões, que indicava um limite inexistente de argumentos.

#### [0.62.0] — 2026-07-09

- Uma automação agora pode disparar outra. Ao criar uma automação, escolha o gatilho "Chamado por outro workflow" e defina os parâmetros que ela espera receber (textos, números, datas, listas ou até uma referência a um Processo, Cliente e afins). Em outra automação, use o passo "Chamar Workflow", selecione a automação de destino e preencha esses parâmetros — os dados são entregues prontos, com as informações relacionadas já carregadas para uso nos próximos passos.

#### [0.61.0] — 2026-07-09

- Nas expressões de automação, agora é possível montar um objeto de dados combinando informações de diferentes campos e também remover um campo de um objeto — assim você prepara exatamente as informações que o próximo passo precisa receber.

#### [0.60.3] — 2026-07-09

- Os campos de seleção agora abrem para cima quando estão perto do rodapé da tela, e a lista rola normalmente mesmo com muitas opções — não é mais preciso digitar uma busca para alcançar os últimos itens. Também deixaram de aparecer cortados "por baixo" da tela quando usados dentro de janelas e painéis.

#### [0.60.2] — 2026-07-09

- Aprimorada a validação de nomes de campos customizados no Form Design: agora são aceitos apenas nomes totalmente compatíveis com JavaScript (letras minúsculas, números, underscore e $), e palavras reservadas da linguagem são bloqueadas. Nomes de campos gerados automaticamente agora usam underscore em vez de hífen (exemplo: `data_nascimento` em vez de `data-nascimento`), garantindo uso direto em automações e integrações.

#### [0.60.1] — 2026-07-09

- Aprimorada a validação de nomes de variáveis e saídas em automações: agora são aceitos apenas nomes compatíveis com JavaScript (letras, números, underscore e $) e palavras reservadas da linguagem são bloqueadas, garantindo que as automações funcionem corretamente.

#### [0.60.0] — 2026-07-09

- Novo passo de automação "Buscar Registros": suas automações agora podem pesquisar clientes, processos, contratos, financeiro, listas e cadastros personalizados do escritório e usar os dados encontrados nos passos seguintes.
- A busca é montada de forma visual — escolha a tabela, os filtros, os campos que deseja trazer (inclusive campos relacionados, como o nome do cliente de um contrato) e a ordenação — e sempre respeita os dados do seu escritório.

#### [0.59.4] — 2026-07-09

- As automações agora carregam de forma confiável os campos customizados de um registro vinculado (ex.: um campo personalizado do cliente de um contrato). Quando esse campo ainda não foi preenchido, a automação continua normalmente, sem ser interrompida por erro.

#### [0.59.3] — 2026-07-09

- Corrigido um problema nas automações que impedia acessar campos mais internos de um registro vinculado (por exemplo, a cidade do endereço do cliente de um contrato). Agora esses dados são buscados automaticamente quando a automação precisa deles.

#### [0.59.2] — 2026-07-09

- Corrigido um problema que impedia usar datas de eventos (por exemplo, a data de um contrato ou processo) em fórmulas de automação, como somar dias a uma data recebida.

#### [0.59.1] — 2026-07-09

- Publicação de eventos das automações mais leve: os dados vinculados passam a ser buscados apenas quando alguma automação realmente precisa deles, reduzindo processamento em toda gravação de registro.

#### [0.59.0] — 2026-07-09

- As automações agora conseguem usar dados de registros vinculados em vários níveis (ex.: processo → contrato → cliente), incluindo listas (polo ativo, contratantes), telas personalizadas e os dados anteriores à alteração.
- Execução das automações mais eficiente: os dados vinculados são buscados de uma só vez e reaproveitados entre automações do mesmo evento.
- Caminhos de campo inválidos em automações agora aparecem como aviso no histórico de execução, em vez de falharem em silêncio.
- Removidos registros técnicos que expunham dados de clientes nos logs internos do servidor.

#### [0.58.0] — 2026-07-08

- O editor de automações agora sugere campos passo a passo ao digitar, navegando pelos vínculos entre registros (ex.: processo → contrato → cliente), incluindo campos de telas personalizadas.
- Expressões com caminhos de campos inexistentes passam a ser sinalizadas na hora, em vez de falharem silenciosamente na execução.
- Nas condições das automações, campos de listas configuráveis (área, status, tipo etc.) agora oferecem a seleção dos valores cadastrados, em vez de digitação livre.
- Corrigido: os campos sugeridos para automações de telas personalizadas apontavam para um caminho que não existia nos dados do evento.

#### [0.57.3] — 2026-07-08

- Base interna que entende os vínculos entre registros (processo → contrato → cliente), preparando o preenchimento automático de campos aninhados nas automações.

#### [0.57.2] — 2026-07-08

- Unificação interna das definições de entidades, vínculos e listas do sistema em um catálogo único, tornando as automações e a auditoria mais consistentes e preparando melhorias no editor de automações.

#### [0.57.1] — 2026-07-08

- Melhoria interna na consistência entre o aplicativo e o servidor, garantindo que as automações e a auditoria usem sempre as mesmas definições de dados.

#### [0.57.0] — 2026-07-08

- As condições das Automações agora suportam lógicas complexas: combine regras com E/OU, agrupe condições dentro de condições (ex: "(A e B) ou C") e inverta qualquer regra ou grupo com NÃO. O botão "Agrupar" envolve as regras existentes de um grupo em um subgrupo, facilitando reestruturar a lógica sem recriar nada.
- Uma condição agora também pode ser uma expressão pura, escrita direto no editor de expressões, sem precisar escolher campo e operador.
- A aba Condições ganhou um diagrama lógico: uma visualização gráfica que mostra a estrutura das regras de forma clara, alternável com o editor. No próprio diagrama é possível alternar E/OU clicando no selo do grupo, negar ou remover regras e adicionar novas condições, expressões e grupos; para mudar campo, operador ou valor, um atalho leva direto ao cartão correspondente no editor, que rola até ele e o destaca por alguns segundos.
- Condições e grupos agora podem ser recolhidos nas duas visualizações: recolhido, o cartão mostra um resumo em uma linha (campo, operador e valor), facilitando trabalhar com lógicas grandes.
- O editor de expressões dentro das condições voltou a sugerir os campos do evento ao digitar "event.".

#### [0.56.0] — 2026-07-08

- A aba Steps das Automações ganhou uma visualização em fluxo: o gatilho aparece no topo e cada passo é um cartão conectado por linhas, mostrando ícone, nome, tipo, ordem e se está ativo.
- Agora é possível reordenar os passos arrastando e soltando os cartões na visualização em fluxo.
- Um botão de adição no fim do fluxo permite incluir um novo passo diretamente na sequência.
- Um seletor permite alternar entre a visualização em fluxo e a lista tradicional — a escolha fica memorizada.
- Corrigida a barra de rolagem que aparecia no meio da tela nas abas de Automações; agora ela fica na borda direita, como esperado.

#### [0.55.0] — 2026-07-08

- Novo tema exclusivo **Themis**, criado especialmente para escritórios de advocacia: tons de bordô institucional, dourado envelhecido e fundo marfim, com tipografia serifada clássica que remete a peças jurídicas.
- O tema Themis está disponível em duas versões — clara e noturna — com as mesmas cores e a mesma identidade, para trabalhar com conforto de dia ou à noite.
- As cores de status de processos, contratos, prazos e pessoas foram harmonizadas dentro do tema Themis, deixando toda a interface visualmente uniforme e elegante.
- Ajustes internos de estabilidade no editor de automações.

#### [0.54.2] — 2026-07-08

- Aprimorada a aparência visual da aba de Condições nas automações: os botões de opção agora seguem o tema do sistema, com design moderno e consistente, e o botão de excluir condição aparece apenas com contorno sutil, ficando destacado somente ao passar o mouse.

#### [0.54.1] — 2026-07-07

- Otimização interna no carregamento do catálogo de steps de workflows, para melhor desempenho após deploys.

#### [0.54.0] — 2026-07-07

- Adicionado o passo "Saída do Workflow" para workflows, permitindo definir exatamente quais dados serão retornados ao final da execução, facilitando o controle do que cada automação produz como resultado.

#### [0.53.1] — 2026-07-07

- Melhorada a experiência de edição de condições em automações: agora você edita as condições livremente e clica no botão "Salvar" quando quiser salvar as alterações, igual à aba "Geral". O botão "Salvar" só fica habilitado quando há mudanças pendentes, e a notificação de sucesso aparece apenas ao salvar.

#### [0.53.0] — 2026-07-07

- Lançado o construtor visual de condições para automações: agora é possível definir quando um workflow deve executar com base em comparações de campos do evento. Configure múltiplas condições que devem ser atendidas simultaneamente (operador E/AND), usando os campos da entidade do evento e operadores como "igual a", "maior que", "contém", entre outros. Valores de comparação podem ser fixos, expressões dinâmicas (usando funções como `today()`, `now()`) ou outros campos do evento.
- A aba "Condições" da tela de automação agora oferece uma interface intuitiva para escolher entre "Sempre executar" ou "Executar apenas quando condições forem atendidas", eliminando a mensagem de recurso futuro.

#### [0.52.1] — 2026-07-07

- Melhorada a visualização de execuções de automações: agora cada step exibe seu ícone, um badge de status (SUCCESS, ERROR, WARN) e uma barra de progresso visual mostrando o resultado de todos os steps de uma só vez. Steps com erro são expandidos automaticamente, facilitando a identificação rápida de problemas sem precisar abrir um por um.

#### [0.52.0] — 2026-07-07

- Adicionado campo de nome personalizado nos steps de automações: agora é possível dar um nome único a cada step, facilitando a identificação quando há múltiplos steps do mesmo tipo no mesmo workflow. O nome personalizado aparece em todos os lugares onde o step é exibido, incluindo na seleção de saídas de steps anteriores e nos logs de execução.

#### [0.51.0] — 2026-07-07

- Melhorada a validação de expressões em automações: o editor agora valida automaticamente o número de parâmetros de cada função, indicando quando faltam ou sobram argumentos. As regras de validação agora vem diretamente do servidor, garantindo consistência e eliminação de duplicação de código.
- Otimizado o desempenho do editor de expressões: eliminadas operações repetitivas que tornavam a digitação lenta, especialmente com muitas funções disponíveis.
- Adicionada proteção contra falhas no carregamento de funções: o autocomplete agora funciona mesmo se houver problemas na comunicação com o servidor.

#### [0.50.6] — 2026-07-07

- Resolvida a causa raiz do travamento ao digitar "interpolate" no editor de expressões: a função estava faltando na lista de validação, causando execução excessiva de cálculos durante a digitação. Além disso, otimizado o cálculo de autocomplete para todas as funções, reduzindo significativamente a carga de processamento.

#### [0.50.5] — 2026-07-07

- Resolvido definitivamente o travamento ao digitar "interpolate" ou outras funções no editor de expressões: o cálculo de posição do menu de sugestões agora é assíncrono e otimizado, permitindo digitação fluida mesmo com muitas funções disponíveis.

#### [0.50.4] — 2026-07-07

- Corrigido definitivamente o travamento ao digitar a função "interpolate" no editor de expressões: a posição do menu de sugestões agora é calculada de forma otimizada e sem loops infinitos, garantindo fluidez mesmo com muitas funções disponíveis.

#### [0.50.3] — 2026-07-07

- Corrigido o travamento do navegador ao selecionar a função "interpolate" no editor de expressões: a lista de sugestões agora é calculada de forma mais eficiente, evitando recálculos desnecessários que tornavam o editor lento.

#### [0.50.2] — 2026-07-07

- Corrigida a seleção de saídas de ações dinâmicas em automações: quando uma ação anterior define variáveis ou saídas com nomes personalizados, elas agora aparecem corretamente na lista de opções para uso em ações subsequentes.

#### [0.50.1] — 2026-07-07

- Corrigida a posição do menu de sugestões de funções e variáveis no editor de expressões: quando há poucas opções, o menu agora aparece logo abaixo do cursor, em vez de saltar para cima da tela.

#### [0.50.0] — 2026-07-07

- Simplificada a arquitetura de carregamento das automações: o catálogo de ações disponíveis agora é obtido diretamente do servidor, sem persistência intermediária, tornando o sistema mais rápido e confiável.
- O catálogo de ações é carregado apenas uma vez por sessão e mantido em memória, reduzindo o tempo de abertura de telas de automação.

#### [0.49.1] — 2026-07-07

- Corrigido o autocomplete de expressões para exibir corretamente as variáveis dinâmicas (criadas via "Definir Variável") ao digitar "input.", além dos outputs estáticos dos steps.
- O autocomplete agora sempre sugere os contextos "event", "input" e "output" ao começar a digitar, facilitando a descoberta das opções disponíveis.

#### [0.49.0] — 2026-07-07

- O sistema de workflows agora suporta outputs dinâmicos: steps como "Definir Variável" geram saídas com nomes definidos apenas durante a execução, permitindo que você use diretamente "input.minhaVariavel" nos steps seguintes sem precisar referenciar nomes fixos de outputs.
- O autocomplete de expressões agora detecta automaticamente qualquer step que gere outputs dinâmicos (não apenas "Definir Variável"), tornando o sistema extensível para futuros steps como "Script TypeScript".

#### [0.48.0] — 2026-07-07

- O editor de workflows agora permite restringir o tipo de origem de dados para cada campo de configuração de um step (por exemplo, o nome de uma variável deve ser sempre um valor fixo, não podendo vir de expressões ou do evento), garantindo consistência e evitando erros de configuração.
- Campos de texto em steps podem agora ter validação por padrão (regex), exibindo mensagens de erro personalizadas quando o formato digitado não está correto — útil para nomes de variáveis, códigos e outros campos com formato específico.
- O autocomplete de expressões agora sugere automaticamente as variáveis definidas por steps anteriores (via "Definir Variável"), facilitando o reuso de valores calculados ao longo do workflow sem precisar memorizar os nomes.

#### [0.47.7] — 2026-07-07

- Corrigida a forma como o autocomplete de expressões sugere campos ao digitar "input.": agora mostra corretamente os outputs de todos os steps anteriores de forma direta (ex: "clienteId", "valorTotal"), refletindo exatamente como o servidor mescla os dados durante a execução do workflow.

#### [0.47.6] — 2026-07-07

- O editor de expressões em workflows agora oferece sugestões inteligentes ao digitar "event.old." (mostrando os campos disponíveis com valores antigos) e "input." (exibindo automaticamente as saídas dos steps anteriores), facilitando a construção de expressões dinâmicas sem precisar consultar documentação externa.

#### [0.47.5] — 2026-07-07

- O editor de expressões agora documenta e sugere automaticamente mais de 50 operadores matemáticos e lógicos já disponíveis no sistema (como +, -, *, /, ==, !=, sin, cos, sqrt, log, etc.), facilitando a criação de expressões complexas sem precisar decorar a sintaxe.

#### [0.47.4] — 2026-07-07

- As melhorias nas mensagens de erro de expressões agora funcionam tanto na validação em tempo real (enquanto digita) quanto na execução efetiva dos workflows, garantindo consistência e clareza em toda a plataforma.

#### [0.47.3] — 2026-07-07

- A validação em tempo real no editor de expressões agora mostra mensagens muito mais claras e úteis, como "Falta fechar 1 parêntese" ou "Expressão incompleta. Verifique se faltam argumentos", em vez de mensagens técnicas como "unexpected TEOF: EOF".

#### [0.47.2] — 2026-07-07

- As mensagens de erro em expressões de workflow agora são muito mais descritivas: identificam o campo que falhou, mostram a expressão usada e dão sugestões práticas de correção. Por exemplo, ao tentar usar "today() + 5", o sistema indica que a forma correta é "addDays(today(), 5)".

#### [0.47.1] — 2026-07-07

- O editor de expressões agora oferece validação mais rigorosa, detectando erros de sintaxe, funções com número incorreto de argumentos e parênteses não balanceados. O IntelliSense foi expandido para sugerir snippets comuns (como formatação de data brasileira e valores padrão), mostrar categorias de funções e assinaturas, além de reconhecer contextos como `input.` e `output.` para facilitar a construção de expressões.

#### [0.47.0] — 2026-07-07

- Adicionadas 40+ funções de expressão para workflows, cobrindo operações com datas (formatação, diferença, extração de partes), textos (substituição, divisão, pesquisa), números (arredondamento, mínimo/máximo, média), arrays (primeiro, último, contém), lógica (and, or, not, isEmpty, coalesce) e validação brasileira (CPF, CNPJ, e-mail com formatação).

#### [0.46.9] — 2026-07-07

- A função `addDays` agora está disponível nas expressões de workflow, permitindo somar dias a uma data de forma explícita (exemplo: `addDays(today(), 5)`).

#### [0.46.8] — 2026-07-07

- O motor de avaliação de expressões nos workflows foi modernizado para usar uma biblioteca especializada, tornando-o mais seguro, rápido e confiável.

#### [0.46.7] — 2026-07-07

- As funções de expressão disponíveis nos workflows agora são carregadas automaticamente do servidor, eliminando a necessidade de atualizar o frontend sempre que uma nova função for adicionada.

#### [0.46.6] — 2026-07-07

- Adicionada a função de expressão `getVar` para workflows, permitindo que steps recuperem valores de variáveis definidas anteriormente no fluxo.

#### [0.46.5] — 2026-07-07

- Corrigida a exibição de cores nas opções de severidade ao configurar steps de auditoria em workflows.

#### [0.46.4] — 2026-07-07

- Corrigido um problema crítico que impedia o registro de falhas de renovação de token do Gmail no log de auditoria, garantindo que você seja notificado quando a conexão com o Gmail precisar ser reautorizada.

#### [0.46.3] — 2026-07-06

- Padronizados os botões de salvar e excluir nas telas customizadas, seguindo o mesmo padrão visual das demais telas do sistema para garantir consistência na interface.

#### [0.46.2] — 2026-07-06

- Reorganizado o menu de navegação: as opções "Workflow" (antigo "Automações") e "Form Design" (antigo "Personalização") agora ficam agrupadas no menu do usuário, facilitando o acesso às ferramentas de configuração avançada do sistema.

#### [0.46.1] — 2026-07-06

- Corrigidas inconsistências técnicas que melhoram a estabilidade do editor de expressões e da visualização de logs de execução das automações.

#### [0.46.0] — 2026-07-06

- Adicionado botão para ativar ou desativar steps individuais na lista de steps das automações, permitindo que você mantenha a configuração dos steps mas controle quais são executados sem precisar excluí-los.

#### [0.45.0] — 2026-07-06

- Adicionado suporte a cores do tema nas opções de seleção de workflows: agora é possível usar tokens de cor (como 'success', 'warning', 'danger') em vez de códigos de cor fixos, garantindo consistência visual com o restante do sistema.
- Corrigida a tipagem do campo de severidade no step de notificação de workflows.

#### [0.44.28] — 2026-07-06

- Adicionado comando `npm run deploy:hosting` para fazer deploy apenas do frontend, sem recompilar e fazer deploy das Cloud Functions.

#### [0.44.27] — 2026-07-06

- Corrigida visualização de "Entrada" nos logs de execução de workflows: agora mostra o contexto de entrada do step (output do step anterior ou evento original), em vez dos parâmetros configurados internamente.

#### [0.44.26] — 2026-07-06

- Corrigido enriquecimento de campos customizados em workflows: os campos do registro vinculado agora são espalhados diretamente no objeto, permitindo acesso direto como `event.customValues.tarefa.nome` em vez de `event.customValues.tarefa.values.nome`.

#### [0.44.25] — 2026-07-06

- Adicionados logs detalhados no motor de expressões para rastrear cada etapa da navegação de propriedades em workflows, permitindo diagnóstico preciso quando valores inesperados aparecem em expressões.

#### [0.44.24] — 2026-07-06

- Adicionados logs de diagnóstico detalhados ao sistema de enriquecimento de foreign keys para facilitar a identificação de problemas quando campos de referência não são enriquecidos corretamente em workflows.

#### [0.44.23] — 2026-07-06

- Implementado enriquecimento automático de foreign keys em workflows: campos de referência (tanto fixos quanto customizados) agora são automaticamente enriquecidos com os dados do registro vinculado ao publicar eventos de workflow. Isso permite que expressões como `event.customValues.tarefa.nome` funcionem naturalmente, acessando propriedades do registro referenciado em vez de apenas o ID.
- Criado serviço `FkEnricher` no backend que centraliza a lógica de denormalização de FKs, usando o schema compartilhado (`ENTITY_FK_SCHEMA`) para determinar quais campos enriquecer e quais dados buscar.
- Refatorado `publishWorkflowEventOnEntityChange` para usar o novo serviço de enriquecimento em vez de código hardcoded, tornando a solução escalável para novas entidades e campos customizados.

#### [0.44.22] — 2026-07-06

- Implementado sistema de schema compartilhado entre frontend e backend: criados arquivos `entitySchemas.ts` idênticos em ambas as plataformas, contendo definições de campos customizados, telas, e foreign keys. Adicionado script de verificação automática (`npm run verify-schemas`) que garante sincronização antes de cada commit, evitando divergências e bugs silenciosos entre as duas partes do sistema.

#### [0.44.21] — 2026-07-06

- Corrigido problema crítico em workflows: o objeto de entrada (input) em expressões agora sempre aponta para o registro que disparou a automação (processo, pessoa, contrato, etc.), independentemente de haver steps executados anteriormente. Antes, quando um step anterior executava com sucesso, o input mudava para os dados daquele step, causando erros de referência em expressões.
- Adicionado campo "Nome na base de dados (fieldName)" visível durante a criação e edição de campos customizados, mostrando o nome técnico que deve ser usado em workflows e integrações. O fieldName é gerado automaticamente a partir do nome do campo, mas pode ser editado antes de salvar. Na lista de campos, o fieldName agora aparece junto ao tipo do campo.
- Melhorada a mensagem de erro quando se tenta acessar propriedades de campos de referência em expressões: agora explica que campos do tipo "referência" armazenam apenas o ID do registro vinculado (string), não o objeto completo, orientando o uso correto em workflows.

#### [0.44.20] — 2026-07-06

- Adicionados ícones visuais na tela de edição de steps: o ícone do tipo de step aparece ao lado do título da janela e também ao lado de cada tipo na lista de seleção, facilitando a identificação rápida dos tipos de step disponíveis.

#### [0.44.19] — 2026-07-06

- Corrigido o botão de ação na edição de steps: agora exibe o botão Excluir (em vez de Cancelar) ao editar um step existente, permitindo remover o step diretamente da tela de edição com confirmação de segurança.

#### [0.44.18] — 2026-07-06

- Uniformizado o design dos botões na tela de edição de steps de automação: agora usa ícones elegantes (Salvar e Fechar) em vez de botões com texto, seguindo o padrão visual do resto do sistema.

#### [0.44.17] — 2026-07-06

- Corrigido problema que impedia a abertura da página de Referência de Expressões (tela aparecia vazia).
- Adicionado logging para diagnóstico de problemas na Referência de Expressões.

#### [0.44.16] — 2026-07-06

- Transformada a Referência de Expressões em uma janela independente: agora ao clicar em "Ver funções disponíveis", a referência abre em uma aba separada que pode ser mantida aberta enquanto você trabalha em outras partes do sistema, facilitando a consulta durante a criação de expressões.

#### [0.44.15] — 2026-07-06

- Melhorado o editor de steps de automação com botões de ação visuais: agora os botões de salvar e excluir aparecem como ícones elegantes que mudam de cor ao passar o mouse (verde para salvar, vermelho para excluir).
- Adicionada lista filtrável de funções disponíveis nas expressões: ao clicar em "Ver funções disponíveis", as funções aparecem organizadas em cards visuais com busca por nome e filtro por categoria (Data, Texto, Condicional, Operador), facilitando muito a descoberta e uso correto das funções.

#### [0.44.14] — 2026-07-06

- Campos customizados agora podem ser acessados em expressões de automações usando `event.customValues.seuCampo`, mantendo consistência com a forma como são armazenados no banco de dados.
- Mensagens de erro em automações agora são muito mais descritivas, mostrando qual campo falhou, qual expressão foi usada e o motivo exato do erro.
- Corrigido problema que impedia a visualização de dados de entrada (inputs) no log de execuções quando ocorria erro. Agora todos os campos configurados até o ponto do erro aparecem no log, facilitando muito a identificação do problema.

#### [0.44.13] — 2026-07-06

- Corrigido problema que impedia a visualização de campos customizados ao configurar steps de automações. Agora todos os campos customizados criados para processos, pessoas, contratos e outras entidades aparecem corretamente nas opções de configuração.

#### [0.44.12] — 2026-07-06

- Corrigido erro que impedia salvar automações quando o evento selecionado não requer entidade customizada ou lista. O sistema agora remove corretamente campos opcionais vazios antes de salvar.

#### [0.44.11] — 2026-07-06

- Corrigido problema que impedia a visualização de erros ao salvar, excluir ou modificar automações. Agora todos os erros são registrados no console do navegador, facilitando a identificação e correção de problemas.

#### [0.44.10] — 2026-07-06

- Corrigido problema que impedia expressões nas automações de acessarem dados de steps anteriores usando a sintaxe `input.campo`. Agora é possível usar tanto `input.campo` quanto `output.stepId.campo` nas expressões.
- Corrigida falha que ocultava os dados de entrada quando um step de automação apresentava erro. Agora os dados de entrada são sempre exibidos, facilitando a identificação do problema.

#### [0.44.9] — 2026-07-06

- Reorganizada a visualização de execuções de automações: agora cada execução mostra uma hierarquia clara com cards expansíveis para cada step, contendo a mensagem de resultado, entrada e saída. A "Saída geral" fica destacada ao final, facilitando a compreensão do fluxo e a depuração.

#### [0.44.8] — 2026-07-06

- Aba "Execuções" das automações agora exibe, para cada step bem-sucedido ou falhado, os dados de entrada e saída utilizados. Clique em "▶ Entrada" e "▶ Saída" ao lado de cada log para visualizar o JSON completo, facilitando a depuração e auditoria das automações.

#### [0.44.7] — 2026-07-06

- Aprimorada a documentação técnica do projeto para esclarecer o processo de criação de novas funções no servidor, assegurando que todas as configurações necessárias sejam atualizadas corretamente.

#### [0.44.6] — 2026-07-06

- Expressões em automações agora podem referenciar outputs de steps anteriores usando `output.stepId.campo` (exemplo: `concat("Prazo: ", output.createDeadlineStepId.deadline.description)`).
- Logs de execução de automações agora marcam steps bem-sucedidos com [SUCCESS] ao invés de [INFO], facilitando a identificação visual.
- Aba "Execuções" das automações agora exibe os outputs de cada step de forma elegante: clique em "▶ Outputs (N)" para expandir e ver o JSON completo de cada execução.

#### [0.44.5] — 2026-07-06

- Corrigido o acesso a campos aninhados nos outputs de Steps (como `deadline.description` do Step "Criar Prazo"): agora os valores são corretamente extraídos quando usados em Steps seguintes.
- Mensagens de erro nas automações agora identificam claramente qual Step falhou, facilitando a identificação de problemas na configuração.

#### [0.44.4] — 2026-07-06

- O Step "Criar Prazo" nas automações agora expõe todos os campos do prazo criado como saídas disponíveis para Steps seguintes, incluindo dados do processo e advogado responsável vinculados. Isso permite usar essas informações em próximas etapas da automação.

#### [0.44.3] — 2026-07-06

- O editor de Steps em automações agora abre em uma aba dedicada no workspace, proporcionando mais espaço e conforto para configurar cada etapa. O título da aba mostra o nome da automação, o número de ordem do step e o tipo escolhido.

#### [0.44.2] — 2026-07-06

- Corrigidos os processos internos de publicação de atualizações: agora os deploys de funcionalidades específicas (como automações ou sistema de auditoria) são mais rápidos e confiáveis.
- Adicionada documentação técnica completa sobre organização das funcionalidades do servidor, facilitando manutenções futuras.

#### [0.44.1] — 2026-07-06

- Corrigido problema crítico nas expressões de automações: campos do evento que dispara o workflow (como `event.title` em "Ao salvar: Processo") agora são acessados corretamente, resolvendo o erro que causava valores UNDEFINED nos campos calculados.

#### [0.44.0] — 2026-07-06

- Adicionados eventos de Anotações e Documentos ao catálogo de automações: agora é possível criar regras que reagem quando anotações ou documentos são adicionados/removidos em Processos, Pessoas, Contratos, Prazos e Financeiro.
- O Step "Criar Prazo" nas automações agora retorna o prazo criado completo, incluindo dados do processo e advogado responsável vinculados, para uso em Steps seguintes.

#### [0.43.0] — 2026-07-06

- Implementado sistema completo de eventos para automações: agora todas as entidades (Processo, Pessoa, Contrato, Prazo, Financeiro, Push, Comunicado, Entidades Dinâmicas, Anotações e Documentos) disparam eventos automaticamente ao serem salvas ou excluídas.
- Os eventos incluem o conteúdo antigo (antes da alteração) e dados principais das entidades relacionadas (ex: ao salvar um Prazo, o evento inclui dados do Processo vinculado).
- Campos dinâmicos (personalizados) de todas as entidades agora estão disponíveis nos eventos de automação.

#### [0.42.1] — 2026-07-06

- Corrigido problema de timezone em expressões com datas: `today()` e `today() + N` agora gravam a data correta no timezone local (GMT-3), sem perder 1 dia.

#### [0.42.0] — 2026-07-06

- Corrigida a semântica de expressões: agora use `event.campo` para acessar dados do evento que dispara a automação (ex: `event.area` em "Ao salvar: Processo"), e `input.xxx` para dados de steps anteriores.
- O editor de expressões agora interpreta corretamente acesso a propriedades com ponto, permitindo expressões como `upper(event.title)` funcionarem sem erros.
- Autocomplete de campos do evento atualizado para sugerir `event.` ao invés de `input.`.

#### [0.41.1] — 2026-07-06

- Ao digitar `input.` no editor de expressões, o sistema agora mostra automaticamente os campos disponíveis do evento que dispara a automação, facilitando a referência a dados do gatilho.
- A validação de expressões foi aprimorada: detecta strings não fechadas, campos inexistentes em `input.xxx`, e garante que a expressão só será aceita se estiver sintaticamente correta.

#### [0.41.0] — 2026-07-06

- Ao configurar steps de automação com origem "Expressão", o sistema agora oferece um editor elegante com chaves `{ }`, validação em tempo real (indicador verde/vermelho), sugestões automáticas conforme você digita, e um guia completo de todas as funções disponíveis (datas, textos, condicionais e operadores).

#### [0.40.2] — 2026-07-06

- Nas telas de Automação, Pessoa, Contrato, Processo, Financeiro e Prazo, os botões de Salvar e Excluir do topo agora ficam com contorno discreto e acendem (Salvar em verde, Excluir em vermelho) ao passar o mouse sobre cada um individualmente.

#### [0.40.1] — 2026-07-06

- Corrigido um problema que fazia os cards de step das automações exibirem sem o ícone correspondente.

#### [0.40.0] — 2026-07-06

- A busca rápida (Cmd+K) agora encontra automações pelo nome ou evento, abrindo direto a automação escolhida.
- O editor de texto (em anotações, por exemplo) ganhou a opção "Automação" no menu de "@", permitindo inserir um link para uma automação específica.

#### [0.39.4] — 2026-07-05

- O botão de ativar/inativar na tela de Pessoa agora também muda de cor (verde/vermelho) conforme o estado, igual à automação.

#### [0.39.3] — 2026-07-05

- Corrigido o botão de ativar/inativar automação, que não dava nenhum retorno visual ao ser clicado. Agora ele muda de cor (verde/vermelho) conforme o estado e confirma a ação com uma mensagem.

#### [0.39.2] — 2026-07-05

- A tela de automação agora segue o mesmo padrão das demais telas de cadastro: botão de salvar como ícone no topo, além de copiar link, clonar, ativar/inativar e excluir.

#### [0.39.1] — 2026-07-05

- Adicionado o ícone da entidade ou lista escolhida ao lado do nome, no topo da tela de edição de uma automação.

#### [0.39.0] — 2026-07-05

- Ao configurar um Step de Automação com valor fixo em um campo que referencia Processo, Advogado ou outra entidade, agora aparece uma lista para escolher diretamente o registro desejado, em vez de precisar digitar o identificador manualmente.

#### [0.38.0] — 2026-07-05

- Na Automação, o evento que dispara o gatilho agora mostra o ícone da tela correspondente (Pessoas, Processos, Contratos etc.), com um ícone genérico para "Entidade Customizada" e "Item de Lista". O mesmo ícone passa a aparecer também na listagem de Automações.
- Ao escolher "Entidade Customizada" como gatilho, a lista de entidades agora mostra o ícone configurado para cada uma.
- Ao escolher "Item de Lista" como gatilho, agora é possível indicar exatamente qual lista (ex: "Pessoa:Tipo", "Pessoa:Relacionamento"), evitando ambiguidade entre listas de nomes parecidos em telas diferentes.

#### [0.37.2] — 2026-07-05

- Corrigido: o selo "Desabilitado" também não estava em vermelho na listagem de Fluxos de Trabalho.

#### [0.37.1] — 2026-07-05

- Nova automação de Fluxo de Trabalho já nasce Habilitada. O selo "Desabilitado" agora aparece em vermelho, para ficar mais fácil notar quando uma automação está parada.

#### [0.37.0] — 2026-07-05

- Ao criar uma automação de Fluxo de Trabalho para uma Entidade Customizada, agora é possível escolher qual entidade específica (ex: Contrato de Locação, Imóvel) dispara o gatilho, e os campos dela ficam disponíveis para uso nos passos da automação.

#### [0.36.0] — 2026-07-05

- Ao configurar um valor fixo para o Tipo de Prazo ou a Prioridade num passo "Criar Prazo" de um Fluxo de Trabalho, agora é possível escolher a partir da mesma lista usada na tela de Prazos, em vez de digitar o valor manualmente.

#### [0.35.4] — 2026-07-05

- Corrigido: ao criar um Prazo automaticamente por um Fluxo de Trabalho com data de vencimento fixa, a data gravada estava um dia antes da informada.

#### [0.35.3] — 2026-07-05

- Corrigido: nos Prazos (lista, calendário, painel inicial e tela do prazo), o número/título do processo e o nome do advogado responsável agora acompanham automaticamente qualquer alteração feita depois — antes, renomear o processo ou trocar o advogado não refletia nos prazos já cadastrados. Removido também um campo interno de nome de cliente que nunca era preenchido pelo sistema.

#### [0.35.2] — 2026-07-05

- Corrigido: na lista de Processos, o nome do advogado responsável agora acompanha automaticamente qualquer alteração feita depois — antes, trocar o advogado responsável ou renomeá-lo não refletia nos processos já cadastrados. Também removido um campo interno de etiquetas do Processo que nunca era usado.

#### [0.35.1] — 2026-07-05

- Corrigido: no Financeiro, o nome da pessoa e os números do processo/contrato exibidos em cada lançamento agora acompanham automaticamente qualquer alteração feita depois — antes, uma pessoa, processo ou contrato renomeado não refletia nos lançamentos já cadastrados.

#### [0.35.0] — 2026-07-05

- Adicionada a base de Automações do escritório: agora é possível criar regras que reagem automaticamente a eventos do sistema (como a criação de um prazo) e executam ações como criar um novo prazo, gerar um alerta ou registrar uma auditoria — tudo configurável pela nova tela "Automações", sem precisar de ajuda técnica para cada nova regra.

#### [0.34.0] — 2026-07-05

- Adicionado o tipo de campo "Markdown" na personalização de telas, permitindo criar campos com formatação rica (negrito, itálico, listas, links e destaques coloridos) para documentar informações de forma mais elegante e estruturada.

#### [0.33.0] — 2026-07-05

- Alterações feitas por outros usuários do escritório em Processos, Prazos, Clientes, Financeiro, Contratos e telas personalizadas agora aparecem automaticamente na tela, em tempo real — sem precisar trocar de aba ou atualizar a página.

#### [0.32.0] — 2026-07-05

- O seletor de escritórios no topo do sistema agora inclui uma caixa de pesquisa (quando há mais de três escritórios), facilitando encontrar o escritório desejado digitando parte do nome — especialmente útil para usuários de Suporte e Sistema, que enxergam todos os escritórios cadastrados.

#### [0.31.0] — 2026-07-05

- Adicionado o perfil de acesso "Suporte": um usuário com esse perfil pode entrar em qualquer escritório, mesmo sem ter sido convidado, e atuar nele como administrador — útil para a equipe prestar suporte a um cliente sem depender de convite prévio.
- O perfil "Sistema" também passou a enxergar todos os escritórios no seletor do topo (antes só via a lista completa em Gestão de Acessos) e agora pode atuar como administrador em qualquer um deles.

#### [0.30.0] — 2026-07-05

- A área de Gestão de Acessos agora permite escolher o plano de cada escritório (Solo, Escritório, Professional ou Enterprise), com o limite de usuários sugerido automaticamente — mas ainda ajustável manualmente quando necessário.
- A barra de status passou a exibir, de forma discreta, o plano do escritório e quantos usuários já estão em uso em relação ao limite contratado.

#### [0.29.0] — 2026-07-04

- A tela de Personalização foi reorganizada: agora as telas ficam listadas em um painel lateral e os campos da tela selecionada aparecem ao lado, evitando a longa lista que aparecia antes.
- Os campos personalizados agora também podem ser reordenados arrastando-os diretamente na lista, além das setas de mover para cima/baixo que já existiam.

#### [0.28.1] — 2026-07-04

- Simplificados os botões de "Salvar" e de criação de novo registro nas telas de Pessoas, Contratos, Processos, Prazos, Financeiro, Notícias, Personalização e telas personalizadas: agora aparecem apenas como ícones, com o texto explicativo visível ao passar o mouse.

#### [0.28.0] — 2026-07-04

- No histórico de Auditoria, campos que referenciam outro cadastro (como o cliente de um contrato, as partes de um processo ou uma referência criada em campo personalizado) agora mostram o nome da pessoa, processo ou registro em vez do código interno.

#### [0.27.2] — 2026-07-04

- Corrigida a lista de escritórios na aba "Escritórios" de Gestão de Acessos, que não carregava para usuários do Sistema.

#### [0.27.1] — 2026-07-04

- Corrigido um problema na aba "Dados do Escritório" das Configurações que fazia os campos aparecerem em branco ao abrir a tela.

#### [0.27.0] — 2026-07-04

- O item "Personalização" saiu do menu lateral e passou a ficar no menu do seu avatar, junto com Perfil, Aparência e Gestão de Acessos.

#### [0.26.0] — 2026-07-04

- Ao marcar "Exibir na listagem" em um campo personalizado, agora é possível definir um título exclusivo para ele aparecer no cartão da listagem, diferente do nome usado no formulário. O título é opcional: se for deixado em branco, o valor aparece no cartão sem nenhum título.

#### [0.25.0] — 2026-07-04

- As telas personalizadas agora podem ter etiquetas próprias, do mesmo jeito que Pessoas e Contratos: basta habilitar a opção "Habilitar Etiquetas" ao criar ou editar a tela. Depois disso, é possível gerenciar as etiquetas do registro pelo ícone no cabeçalho, elas aparecem nos cartões da listagem e ficam disponíveis como filtro.

#### [0.24.0] — 2026-07-04

- Os campos personalizados do tipo "Seleção" agora podem ter opções com cor: cada opção recebe uma cor da paleta de etiquetas (ou a cor padrão, se nenhuma for escolhida). A cor aparece ao preencher o formulário, nos cartões da listagem (quando o campo está marcado para "Exibir na listagem") e na barra de filtros (quando marcado como "Disponível como filtro na listagem").

#### [0.23.3] — 2026-07-04

- As opções "Exibir na listagem" e "Disponível como filtro na listagem" dos campos personalizados passaram a valer também nas telas padrão: os campos marcados agora aparecem nos cartões de Pessoas, Processos, Contratos, Financeiro e Prazos, e entram como opções na barra de filtros de cada listagem.

#### [0.23.2] — 2026-07-04

- Registros de telas personalizadas ganharam o botão "Copiar link", que copia o endereço direto do registro para compartilhar com a equipe — igual às telas de Pessoas e Contratos.
- O botão Excluir passou a ser o último da fileira de ações, evitando cliques acidentais.

#### [0.23.1] — 2026-07-04

- Os botões de Clonar, Excluir e Salvar nas telas personalizadas agora exibem apenas o ícone, com o nome da ação aparecendo ao passar o mouse — mesmo padrão das demais telas do sistema.

#### [0.23.0] — 2026-07-04

- Telas personalizadas agora podem ter abas de Anotações e Documentos, ativadas individualmente por tela na área de Personalização — com o mesmo funcionamento das telas de Contratos e Processos.
- As anotações aceitam formatação de texto, e os documentos anexados podem ser classificados por tipo, abertos em nova aba e excluídos por administradores.
- Ao excluir um registro de tela personalizada, suas anotações e documentos (incluindo os arquivos) são removidos junto, e tudo fica registrado na Auditoria.

#### [0.22.0] — 2026-07-04

- Os campos adicionais definidos na área de Personalização agora aparecem nos formulários de Pessoas, Processos, Contratos, Financeiro e Prazos, numa seção "Campos adicionais" ao final de cada formulário.
- Esses campos aceitam os mesmos tipos das telas personalizadas (texto, número, valor, data, sim/não, seleção, CPF/CNPJ/telefone/CEP e vínculos), respeitam a obrigatoriedade definida e têm suas alterações registradas na Auditoria junto com o restante do cadastro.

#### [0.21.0] — 2026-07-04

- A busca rápida (⌘K) agora encontra registros das telas personalizadas pelo título e permite abrir cada tela personalizada diretamente.
- Toda criação, alteração e exclusão de telas personalizadas e de seus registros passa a ser registrada na Auditoria, mostrando exatamente o que era e como ficou — campo a campo.

#### [0.20.0] — 2026-07-04

- As telas personalizadas criadas na área de Personalização agora funcionam de ponta a ponta: aparecem no menu lateral com o ícone escolhido, têm listagem com filtros (incluindo filtros salvos) e formulário completo de cadastro e edição.
- Registros de telas personalizadas podem ser criados, editados, clonados e excluídos (exclusão restrita a administradores), com o mesmo visual e comportamento das demais telas do sistema.
- Campos de seleção das telas personalizadas permitem adicionar novas opções na hora, e campos de vínculo permitem conectar um registro a Pessoas, Processos, Contratos, Financeiro, Prazos ou a outras telas personalizadas.

#### [0.19.0] — 2026-07-04

- Nova área de Personalização (disponível para administradores do escritório): agora é possível criar telas próprias do escritório, escolhendo o nome, o ícone e os campos — com tipos como texto, número, valor em reais, data, sim/não, seleção com opções, CPF/CNPJ/telefone/CEP e vínculo com registros de outras telas.
- Também é possível definir campos adicionais para as telas já existentes (Pessoas, Processos, Contratos, Financeiro e Prazos), que aparecerão nos formulários nas próximas atualizações.
- Cada campo pode ser marcado como obrigatório, agrupado em seções e reordenado livremente; telas personalizadas podem ser desativadas sem perder os dados.

#### [0.18.3] — 2026-07-04

- Corrigido: e-mails de intimação que eram movidos da caixa de entrada logo após a chegada (por exemplo, por uma regra automática do Gmail) deixavam de ser processados pelo sistema.

#### [0.18.2] — 2026-07-03

- Reduzido o nível de acesso solicitado ao conectar uma conta do Gmail: o sistema agora pede apenas permissão de leitura dos e-mails, sem poder alterá-los.

#### [0.18.1] — 2026-07-03

- Corrigido: o botão de excluir etiqueta não aparece mais para usuários sem perfil de administrador do escritório.
- Adicionado um aviso claro quando alguma ação com etiquetas não pode ser concluída, em vez de falhar silenciosamente.

#### [0.18.0] — 2026-07-03

- Lançado o site institucional do Curatino, com apresentação das funcionalidades, planos e uma página de contato — acessível para qualquer visitante, sem precisar de login.
- Corrigido um problema em que um link copiado de um processo, contrato, pessoa, notícia ou lançamento financeiro não abria a tela correspondente ao ser colado na mesma aba do navegador que já estava com o Curatino aberto.

#### [0.17.0] — 2026-07-03

- Agora é possível arrastar um prazo no Calendário para outro dia: prazos pendentes ou vencidos têm a data de vencimento atualizada, e prazos concluídos têm a data de conclusão atualizada.

#### [0.16.2] — 2026-07-03

- Corrigido um problema que fazia a data de vencimento do prazo avançar um dia a cada vez que a tela era salva.

#### [0.16.1] — 2026-07-03

- Corrigido: o menu lateral estava ficando abaixo da nova barra de status fina no rodapé do sistema, em vez de ao lado dela.

#### [0.16.0] — 2026-07-03

- A tela de login agora exige a confirmação de leitura dos Termos de Uso e da Política de Privacidade (por marcação de caixa de seleção) antes de criar uma conta por e-mail ou de continuar com o Google — com aviso caso o usuário tente prosseguir sem aceitar.
- A página de Termos de Uso e Política de Privacidade só exibe o botão "Voltar" quando é aberta a partir da tela de login; ao ser aberta diretamente por um link, ela é exibida sem esse botão.
- Adicionada, na parte inferior do sistema, uma barra fina de status com o nome do escritório em uso, o atalho de teclado da paleta de comandos, o link para os Termos e Privacidade e a versão atual do Curatino.

#### [0.15.0] — 2026-07-03

- Adicionada uma página pública com os Termos de Uso e a Política de Privacidade do Curatino, acessível em "/license" sem necessidade de login. Ela explica, entre outros pontos, que o sistema está em fase beta e que a conferência final de prazos e intimações identificados pelo monitor de e-mails é sempre responsabilidade do advogado.

#### [0.14.0] — 2026-07-03

- Ao dividir a tela em painéis, agora é possível fechar um painel diretamente pelo botão "x" na barra de abas — inclusive um painel vazio, que antes não tinha como ser removido.
- Esse botão fica destacado no painel em uso, facilitando identificar qual painel está ativo ao trabalhar com a tela dividida.

#### [0.13.2] — 2026-07-03

- Agora somente administradores do escritório podem excluir itens de listas auxiliares (tipos de documento, categorias, áreas, fases, status, tipos de pessoa, entre outras) usadas nos formulários de Pessoas, Processos, Contratos, Financeiro, Prazos e Notícias. Incluir novos itens continua liberado para quem já tinha permissão de edição.

#### [0.13.1] — 2026-07-03

- Corrigido: a Auditoria agora registra corretamente quem adicionou um membro ao escritório, em vez de exibir "sistema".

#### [0.13.0] — 2026-07-03

- Corrigido: a Auditoria agora registra corretamente quem excluiu uma Notícia, um comentário de Notícia ou uma Etiqueta de Notícia.
- Ao excluir um Push do Tribunal, os registros de leitura vinculados a ele são limpos automaticamente nos bastidores.

#### [0.12.0] — 2026-07-03

- Corrigido: a Auditoria agora registra corretamente quem excluiu um registro (Pessoa, Processo, Contrato, Prazo, Financeiro, membro do escritório e itens vinculados) — antes, em alguns casos, o sistema podia creditar a exclusão à última pessoa que havia editado o registro.
- Ao excluir uma Pessoa ou um Processo, os processos, prazos e lançamentos financeiros vinculados são removidos automaticamente junto, evitando registros órfãos no sistema.

#### [0.11.0] — 2026-07-03

- A tela de Auditoria agora exibe, ao lado do menu, um aviso com a quantidade de falhas críticas do sistema ainda não vistas — igual ao que já acontece com Notícias e Pushes do Tribunal. Basta abrir a Auditoria para marcá-las como vistas.
- Falhas inesperadas que ocorrem durante o uso do sistema passam a ser registradas automaticamente na Auditoria, ajudando a equipe técnica a identificar e corrigir problemas mais rapidamente.

#### [0.10.2] — 2026-07-03

- Aprimorado o reconhecimento automático de e-mails dos Tribunais Regionais do Trabalho, tornando a identificação mais consistente e já preparada para eventuais novos tribunais.

#### [0.10.1] — 2026-07-03

- Adicionado suporte automático para processar intimações e notificações recebidas de todos os Tribunais Regionais do Trabalho (TRT1, TRT2, TRT3, TRT5 e todos os demais) — o sistema agora reconhece e analisa esses e-mails automaticamente, extraindo informações sobre processos trabalhistas e suas movimentações.

#### [0.10.0] — 2026-07-03

- A tela de Auditoria agora registra um alerta individual e detalhado sempre que uma intimação recebida por e-mail não puder ser interpretada corretamente pelo sistema, sem gerar ruído nas verificações que ocorrem normalmente.

#### [0.9.3] — 2026-07-03

- Otimizada a infraestrutura das Cloud Functions: todas as funções de auditoria agora operam na região South America (São Paulo), eliminando saltos de rede entre regiões e melhorando o desempenho do sistema.

#### [0.9.2] — 2026-07-03

- Corrigido um problema crítico que impedia a leitura de intimações quando o email chegava apenas em formato HTML, sem texto simples — todos os parsers agora analisam ambos os formatos.
- Melhorada a extração de informações de emails em HTML: o sistema agora limpa automaticamente as tags HTML antes de processar o conteúdo, garantindo que nenhum detalhe seja perdido.
- Adicionado teste automatizado para garantir que intimações em HTML puro sejam processadas corretamente pelo parser do TJBA.

#### [0.9.1] — 2026-07-03

- Corrigido um problema no processamento automático de intimações judiciais recebidas por email do TJBA que impedia o sistema de usar inteligência artificial como alternativa quando a leitura automática falhava.
- Melhorada a precisão do reconhecimento de emails do TJBA: o sistema agora identifica mensagens do PJe da Bahia com mais confiança, evitando confusões com outros tribunais.
- Adicionados testes automatizados para garantir que o processamento de emails do TJBA continue funcionando corretamente em futuras atualizações.

#### [0.9.0] — 2026-07-03

- Novos escritórios agora nascem com o próprio dono como único membro permitido; para liberar mais vagas, o administrador do sistema aumenta o limite na aba "Escritórios" de Gestão de Acessos.
- A criação da conta de um novo usuário (perfil e escritório inicial) passou a ser feita de forma mais segura e confiável nos bastidores, eliminando um cenário raro em que o escritório podia ficar incompleto.
- Reforçada a segurança do sistema: usuários comuns não conseguem mais listar todos os cadastros do sistema nem alterar informações de outros usuários.

#### [0.8.0] — 2026-07-02

- A tela de Gestão de Acessos agora tem duas abas: "Usuários" (como antes) e "Escritórios", nova, onde o administrador do sistema pode pesquisar todos os escritórios e definir quantos membros cada um pode ter.
- Ao atingir o limite de membros de um escritório, a aba "Membros" das Configurações do Escritório passa a bloquear a adição de novas pessoas, mesmo que duas tentativas aconteçam ao mesmo tempo em computadores diferentes.

#### [0.7.0] — 2026-07-02

- Adicionada a ação "Clonar" nas telas de Pessoa, Contrato, Processo e Financeiro: cria um novo registro a partir dos dados atuais, pronto para ajustes, sem copiar anotações ou documentos.

#### [0.6.2] — 2026-07-02

- A tela de Auditoria agora avisa o administrador do sistema que os registros de Notícias, Comentários e Etiquetas de Notícias só aparecem com o filtro Escritório em "Todos os Escritórios".

#### [0.6.1] — 2026-07-02

- Corrigido um problema que impedia o registro de auditoria para Membros, Etiquetas e Pushes do Tribunal em alguns casos.

#### [0.6.0] — 2026-07-02

- A Auditoria agora também registra a alteração e a exclusão de Pushes do Tribunal, além da criação, alteração e exclusão de Notícias, Comentários de Notícias e Etiquetas de Notícias.

#### [0.5.1] — 2026-07-02

- Padronizado o campo "Valor da Causa", na tela de Processos, para exibir e digitar valores em reais com o mesmo formato usado no Financeiro.

#### [0.5.0] — 2026-07-02

- Adicionada a tela de Auditoria, para consultar automaticamente quem criou, alterou ou excluiu registros de Pessoas, Processos, Contratos, Prazos, Financeiro, Membros, Notas, Documentos e Etiquetas do escritório — com filtros por entidade, ação e severidade, e histórico guardado por 90 dias.

#### [0.4.4] — 2026-07-02

- Corrigido: ao comentar, editar ou excluir um comentário em uma notícia, os demais usuários agora veem na hora o status voltar para "não lida", sem precisar recarregar a página.

#### [0.4.3] — 2026-07-02

- Correção interna de estabilidade nas cores do sistema, sem impacto visível no dia a dia.

#### [0.4.2] — 2026-07-02

- O botão "Marcar como não lida" agora também aparece na listagem de Notícias, direto no card de cada notícia lida.
- Corrigido o contador de notícias não lidas (no topo e no menu lateral), que não refletia quando uma notícia própria era marcada como não lida.

#### [0.4.1] — 2026-07-02

- Adicionado o botão "Marcar como não lida" na tela de uma notícia, para você sinalizar que quer voltar a vê-la depois.

#### [0.4.0] — 2026-07-02

- A tela de Notícias agora abre já filtrada pelas notícias não lidas, para você ver primeiro o que ainda não viu.
- Quando alguém comenta, edita ou exclui um comentário em uma notícia, os demais usuários que já haviam lido essa notícia voltam a vê-la como não lida, para não perderem a novidade na conversa.

#### [0.3.0] — 2026-07-02

- Adicionada a aba Documentos às notícias, para anexar arquivos como PDFs e imagens diretamente à notícia — mesmo padrão já usado em Pessoas, Processos, Contratos e Financeiro.

#### [0.2.0] — 2026-07-02

- O campo Categoria das notícias agora aceita categorias personalizadas: além das opções padrão, é possível criar novas categorias direto na tela de criação/edição de notícias e removê-las quando não forem mais necessárias.

#### [0.1.5] — 2026-07-02

- Corrigidas as cores dos gráficos (painel principal, análise de prazos e financeiro), que estavam muito claras e destoando das cores do tema escolhido.
- As etiquetas de legenda dos gráficos (tipos de prazo e categorias financeiras) agora mostram a cor como um discreto marcador lateral quando selecionadas, em vez de preencher toda a etiqueta.

#### [0.1.4] — 2026-07-02

- Ampliada a paleta de cores disponíveis para etiquetas, agora com 13 opções em vez de 8.

#### [0.1.3] — 2026-07-02

- Corrigido um erro que impedia a abertura do Dashboard Financeiro quando o filtro de Etiquetas era exibido.

#### [0.1.2] — 2026-07-02

- Corrigido o card "Distribuição por Categoria" do Dashboard Financeiro, que mostrava as opções Receitas e Despesas com a mesma cor.

#### [0.1.1] — 2026-07-02

- Ajustadas as cores de receitas e despesas no Financeiro para tons mais vivos e fáceis de distinguir, inclusive nos gráficos e indicadores do painel.

#### [0.1.0] — 2026-07-02

- Adicionadas Etiquetas ao Financeiro: agora é possível criar etiquetas coloridas e aplicá-las aos lançamentos, exibi-las na tela do lançamento e filtrar a lista de lançamentos por etiqueta — o mesmo recurso já disponível em Pessoas, Contratos e Processos.

#### [0.0.9] — 2026-07-02

- Adicionada a aba de Documentos na tela de Financeiro: agora é possível anexar recibos, notas fiscais e outros arquivos diretamente a cada lançamento.
- O tipo de cada documento anexado (Contrato, Recibo, Nota Fiscal, etc.) agora é compartilhado entre as telas de Pessoa, Processo, Contrato e Financeiro — criando ou removendo um tipo em uma tela, ele passa a valer em todas.
