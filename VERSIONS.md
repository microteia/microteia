# Notas de Versão — Curatino

> Histórico de novidades, melhorias e correções do Curatino, escrito para quem usa o sistema no dia a dia. Para o histórico técnico de alterações, consulte o log de commits do git.

Cada versão corresponde ao campo `version` de `package.json`. A mais recente fica no topo.

<!-- Nova entrada vai aqui, acima das anteriores, no formato:

#### [0.0.9] — AAAA-MM-DD

- Descrição elegante da mudança, em linguagem simples.
-->

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
