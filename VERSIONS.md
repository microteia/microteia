# Notas de Versão — Microteia

> Histórico de novidades, melhorias e correções da Microteia, escrito para quem usa o sistema no dia a dia. Para o histórico técnico de alterações, consulte o log de commits do git.

Cada versão corresponde ao campo `version` de `package.json`. A mais recente fica no topo.

<!-- Nova entrada vai aqui, acima das anteriores, no formato:

#### [0.0.9] — AAAA-MM-DD

- Descrição elegante da mudança, em linguagem simples.
-->

#### [7.40.1] — 2026-08-16

- Registrada a regra de idioma do produto: todo texto que aparece na tela precisa ser traduzível, nasce em inglês e chega com a tradução para português no mesmo momento.

#### [7.40.0] — 2026-08-16

- Corrigido: a Referência de Expressões, o catálogo de Steps e as listas de opções continuavam em inglês mesmo com o Português (Brasil) instalado.
- Na documentação do Step Script, os exemplos deixaram de citar cadastros que hoje pertencem a extensões — as tabelas sugeridas passam a ser as telas realmente instaladas no escritório.

#### [7.39.0] — 2026-08-16

- Corrigido: quem já tinha instalado o Português (Brasil) continuava vendo partes do sistema em inglês — a Referência de Expressões, entre outras. O pacote de idioma ganhou uma versão nova, e o Marketplace passa a oferecer a atualização.
- As últimas mensagens do Processador de Dados e da conexão com o Gmail passaram a acompanhar o idioma escolhido.

#### [7.38.0] — 2026-08-15

- Corrigido: sete textos de exemplo e de sugestão continuavam em português — o identificador da automação, o botão de executar em depuração, campos de Sim/Não e de seleção nos formulários, e a dica das listas em Configurações.

#### [7.37.0] — 2026-08-15

- Corrigido: no histórico de execução das automações, várias mensagens de Step continuavam em português — "Objeto montado", "Campos montados", "Auditoria registrada", entre outras.
- Corrigido: o nome das listas de etiquetas, os títulos do buscador (⌘K) e os rótulos de saída de Step também passaram a acompanhar o idioma escolhido.
- A busca do ⌘K passou a procurar no texto que está na tela.

#### [7.36.0] — 2026-08-15

- Corrigido: na Auditoria aparecia o nome interno da coleção ("contracts") no lugar do nome da tela ("Contrato"). O nome passou a vir sempre da tela instalada, então vale para qualquer extensão, traduzida ou não.
- Com isso, renomear uma tela passa a valer também para os registros de auditoria já gravados.

#### [7.35.1] — 2026-08-15

- Corrigido: na Auditoria, o resumo e o título continuavam mostrando códigos como `{user}` e `{action}` no lugar dos nomes, mesmo depois da correção anterior.

#### [7.35.0] — 2026-08-15

- As opções que já vêm na lista de tipos de documento voltaram a ser exibidas como estão gravadas. Elas são vocabulário da área, não texto do sistema: o escritório renomeia cada uma quando quiser, e uma extensão pode trazer as suas.

#### [7.34.0] — 2026-08-15

- O filtro por entidade da Auditoria passou a listar apenas o que o sistema audita hoje, com o nome que a extensão instalada dá — sem os nomes internos de entidades que já saíram do sistema.
- Duas entidades que faltavam no filtro — Push do Tribunal e Etiqueta de Tela Personalizada — passaram a aparecer.

#### [7.33.1] — 2026-08-15

- Corrigido: na Auditoria, o resumo e o título de cada registro apareciam com códigos como `{user}` e `{action}` no lugar dos nomes.
- Corrigido: o filtro por entidade oferecia a mesma coisa duas vezes — uma com o nome antigo do sistema e outra com o nome da extensão que a descreve hoje. Agora aparece só o nome atual, e os registros antigos passam a ser exibidos com ele também.

#### [7.33.0] — 2026-08-15

- A Auditoria passou a acompanhar o idioma escolhido, inclusive o resumo de cada registro e o nome da entidade alterada.
- Nos registros de alteração, os blocos de dados passaram a ser marcados por sinal — `−` para o valor anterior e `+` para o novo — no lugar das palavras "Antes" e "Depois".
- A busca na Auditoria passou a procurar no texto que está na tela.
- O escritório criado no primeiro acesso passa a se chamar `Nome(e-mail)`, o que também distingue dois usuários de mesmo nome.

#### [7.32.0] — 2026-08-15

- Corrigido: quando um Step falhava ao ler um campo, o motivo aparecia como um código no lugar da frase. Agora a mensagem completa aparece traduzida, com o nome do Step e do campo.

#### [7.31.0] — 2026-08-15

- As mensagens de erro da conexão de inteligência artificial, da conexão com o Google, do cadastro de membros e do escritório passaram a acompanhar o idioma escolhido.
- Os nomes e descrições dos módulos internos do sistema também passaram a ser traduzidos.

#### [7.30.0] — 2026-08-15

- As recusas do Step Script, das gravações e consultas por automação, e do apelido no perfil passaram a acompanhar o idioma escolhido.
- Os nomes dos operadores de expressão que ainda faltavam também foram traduzidos.

#### [7.29.0] — 2026-08-15

- O histórico de execução das automações passou a acompanhar o idioma escolhido: cada linha do log, o resultado de cada Step e as mensagens de erro de expressão.
- As execuções antigas continuam legíveis exatamente como foram gravadas.
- Corrigido: a mensagem amigável para função de expressão inexistente nunca aparecia, porque procurava um texto que o sistema não produzia.

#### [7.28.1] — 2026-08-15

- Os dois pontos de extensão de automação — passo e função de expressão — passaram a ter nome e descrição traduzidos.

#### [7.28.0] — 2026-08-15

- O catálogo de Steps das automações passou a acompanhar o idioma escolhido: o nome e a descrição de cada Step, e os rótulos dos campos que ele pede e das saídas que devolve.

#### [7.27.0] — 2026-08-15

- A Referência de Expressões passou a acompanhar o idioma escolhido: a descrição e a categoria de cada função e operador.
- A busca por função passou a procurar no texto que está na tela, e não mais no texto original.

#### [7.26.0] — 2026-08-15

- Concluída a tradução do sistema: todo texto que o Microteia mostra passou a vir do idioma escolhido, incluindo as mensagens de erro que aparecem ao instalar uma extensão, excluir uma tela, nomear uma lista ou salvar um registro.
- Com isso, instalar um pacote de idioma passa a traduzir o sistema inteiro, e não apenas as telas.

#### [7.25.0] — 2026-08-15

- As mensagens de erro ao montar uma consulta, uma gravação ou os parâmetros de uma automação passaram a acompanhar o idioma escolhido, tanto na tela quanto quando vêm do servidor.
- Corrigido: em oito campos de evento e num rótulo de configuração aparecia um código interno no lugar do texto.

#### [7.24.0] — 2026-08-15

- As listas de opções que já vêm com o sistema — como os tipos de documento — passaram a acompanhar o idioma escolhido, e continuam em ordem alfabética correta em cada idioma.
- O nome do plano do escritório e os nomes dos pontos de extensão também passaram a ser traduzidos.

#### [7.23.0] — 2026-08-15

- O Processador de Dados, a tela de Funções de Dados e a tela de Traduções passaram a acompanhar o idioma escolhido, incluindo as mensagens de andamento e os avisos de erro.
- As contagens em tela — "1 usuário" contra "2 usuários", "1 texto" contra "2 textos" — passaram a concordar corretamente em cada idioma.

#### [7.22.0] — 2026-08-15

- As telas de Gestão de Acessos, Auditoria, Scripts, Referência de Expressões, Telas Personalizadas e Registro passaram a acompanhar o idioma escolhido.
- Na Auditoria, o nome da entidade, a ação e a severidade de cada registro também são traduzidos — inclusive os nomes das telas criadas pelo escritório, que continuam aparecendo como foram escritos.

#### [7.21.0] — 2026-08-15

- As telas de Configurações, Configurações do Escritório (dados, membros e conexão de IA), Meu Perfil e a edição de Step das automações passaram a acompanhar o idioma escolhido.
- Os nomes dos perfis de acesso — Administrador, Advogado, Secretário(a) e Usuário — passaram a ser traduzidos junto com o resto da tela.

#### [7.20.0] — 2026-08-15

- A tela de Script passou a acompanhar o idioma escolhido, inclusive toda a documentação da função de consulta ao banco e o modelo que aparece num script novo.
- Os tipos de parâmetro passaram a ter um nome único em todo o sistema: o mesmo tipo já não aparecia escrito de duas formas entre a tela de Script e a de automações.

#### [7.19.0] — 2026-08-15

- A tela de Ações passou a acompanhar o idioma escolhido: título, filtros, avisos e a confirmação de exclusão.
- As mensagens que aparecem ao criar, importar ou publicar uma extensão agora são exibidas no idioma do usuário, e não mais sempre em português.
- Ao adicionar uma tela em uma extensão, o nome sugerido também respeita o idioma escolhido.
- Correção: alguns rótulos de automações — sentido da ordenação, origem dos dados e o filtro de situação — continuavam em português mesmo com outro idioma ativo.

## [7.18.0] — 2026-08-14

- A tela de Extensões — filtros, selos de situação, ações de instalar e publicar e a revisão de código — passou a acompanhar o idioma escolhido.

## [7.17.0] — 2026-08-14

- A tela de Ações — incluindo as explicações longas sobre fluxos, parâmetros e expressões — passou a acompanhar o idioma escolhido.

## [7.16.0] — 2026-08-14

- As mensagens compartilhadas por várias telas — anotações, documentos, exclusão de registro e execução de ações — passaram a acompanhar o idioma escolhido.

## [7.15.0] — 2026-08-14

- Corrigida a lista de tipos de campo no Form Design, que exibia códigos internos em vez dos nomes.
- Corrigidos os botões que mudam de texto conforme o estado — "Salvar/Salvando", "Ativar/Inativar", "Copiar/Copiado", "Novo Campo/Editar Campo" — que continuavam fixos em português.

## [7.14.0] — 2026-08-14

- A lista de Automações, os gatilhos disponíveis, as formatações prontas dos campos e os nomes dos 266 ícones passaram a acompanhar o idioma escolhido.

## [7.13.0] — 2026-08-14

- Corrigidos mais de duzentos textos que continuavam fixos em português nas telas de Automações, Form Design, criação de extensões e nos componentes da interface — botões, rótulos e mensagens que não acompanhavam o idioma escolhido.

## [7.12.0] — 2026-08-14

- A tela de criação de extensões — incluindo o editor de telas de código e os modelos de exemplo — passou a acompanhar o idioma escolhido.

## [7.11.0] — 2026-08-14

- A tela de Form Design — o desenho das telas, os campos, as máscaras, as validações e os valores calculados — passou a acompanhar o idioma escolhido.

## [7.10.0] — 2026-08-14

- O sistema passou a falar inglês por padrão, e o português virou um pacote de idioma que se instala e se desinstala como qualquer outra extensão. Com o pacote instalado, tudo continua exatamente como estava.
- A paleta de cores das etiquetas, os menus de condição, o editor de expressões, o editor de texto, os filtros de lista e a busca rápida (Ctrl+K) já acompanham o idioma escolhido — inclusive as palavras pelas quais a busca rápida encontra cada item.
- Datas e horários exibidos nas anotações e nos documentos passaram a seguir o idioma e a região configurados, em vez de um formato fixo.
- A tela de entrada no sistema também acompanha o idioma escolhido.
- As páginas de apresentação do produto (início, funcionalidades, preços e contato) foram retiradas do sistema. Quem acessa o endereço principal vai direto para a tela de entrada.
- Os Termos de Uso e a Política de Privacidade passaram a ter tradução própria, separada da tradução do sistema — e já acompanham o idioma escolhido mesmo para quem ainda não entrou na conta.
- Corrigido um problema na tela de Traduções, que marcava como "Sem efeito" um pacote de idioma que estava funcionando normalmente.
- Corrigido o campo de idioma em Configurações, que mostrava "Inglês" mesmo com o sistema exibindo tudo em português.
- Quem ainda não escolheu um idioma passa a ver o sistema no idioma do próprio navegador, quando houver tradução para ele — em vez de o português ser assumido como padrão.
- O idioma escolhido em Configurações passa a valer também nas telas abertas fora do escritório, como os Termos de Uso — antes elas ignoravam a escolha e seguiam o navegador.
- A tela de Automações — o desenho do fluxo, os parâmetros, as condições, as consultas e o histórico de execuções — passou a acompanhar o idioma escolhido.

## [7.8.0] — 2026-08-13

- **Traduzir ficou mais simples: existe um arquivo só.** Antes havia dois arquivos `.json` parecidos e que não se encaixavam — um "modelo de tradução" e uma "extensão de idioma". Agora existe apenas a extensão de idioma: é o que se baixa, é o que se traduz e é o que se importa. O mesmo arquivo funciona tanto na tela de Traduções quanto na de Extensões.
- **O arquivo tem um campo por texto, já preenchido.** Você sobrescreve o que quiser traduzir e deixa o resto como está — o que não for traduzido continua aparecendo no idioma original.
- **O sistema agora impede uma troca perigosa.** Um arquivo de idioma não pode mais tomar o lugar de uma extensão que tem telas e automações (nem o contrário) por coincidência de identificador: em vez de sobrescrever, o sistema recusa e explica o que fazer.
- **A lista de idiomas instalados avisa quando há dois pacotes para o mesmo idioma.** Só um deles vale; o outro passa a aparecer como "Sem efeito", em vez de os dois dizerem "Em uso" e esconderem o problema.
- Para desativar ou remover um idioma, use a tela de Extensões — a tela de Traduções apenas lista, sem duplicar o gesto.
- Corrigido o nome do idioma criado pela tela, que vinha com inicial minúscula.

## [7.7.0] — 2026-08-13

- **Agora é possível traduzir a Microteia para qualquer idioma, sem programar.** A nova tela **Traduções** (no menu, para administradores) entrega um arquivo com todos os textos do sistema — os do próprio Microteia e os das extensões instaladas, na mesma lista. Traduza, devolva o arquivo, e o idioma passa a estar disponível para todo o escritório.
- **O arquivo mostra o texto original ao lado do campo a preencher**, então dá para traduzir sem adivinhar o que cada frase significa — e, ao baixá-lo de novo mais tarde, ele já vem preenchido com o que foi traduzido antes, deixando em branco só o que falta.
- **Texto não traduzido continua aparecendo no idioma original**, nunca em branco. Uma tradução pela metade é utilizável desde o primeiro dia.
- O idioma importado aparece em Extensões como qualquer outro, podendo ser desativado ou removido — e a tela de Traduções lista os idiomas instalados, indicando qual está em uso.

## [7.6.0] — 2026-08-13

- **O português virou um pacote — e por isso qualquer idioma pode existir.** Em Extensões há agora **Português (Brasil)**, com o selo "Do sistema". Instalado, o menu, as abas, a busca do ⌘K e a tela de Configurações aparecem em português exatamente como sempre apareceram; desinstalado, voltam ao inglês. Nada no sistema trata o português de forma especial, que é o que permite acrescentar espanhol, alemão ou qualquer outro do mesmo jeito.
- **Ao subir para esta versão, instale o pacote Português (Brasil)** para manter a interface como está. Sem ele, os textos do menu e das Configurações passam a ser lidos em inglês — o idioma padrão do sistema.
- **A busca das Configurações agora encontra pelo texto que você lê.** Procurar por "idioma" acha a seção Idioma, mesmo que ela tenha outro nome no idioma original.
- Corrigido um problema em que reescrever a frase de uma mensagem de erro podia mudar, sem aviso, o comportamento do sistema ao recusar uma operação — por exemplo ao tentar autorizar uma conta de e-mail sem ser administrador.

## [7.5.0] — 2026-08-13

- **O Microteia deixou de ser um sistema em um idioma só.** Nasce a base para que o sistema seja lido em qualquer língua: em Configurações há agora a seção **Idioma e região**, onde o escritório escolhe o idioma padrão e cada pessoa pode escolher o seu — a preferência pessoal sempre vence a do escritório.
- **Um idioma novo passa a ser uma extensão, como qualquer outra.** Para acrescentar um idioma não é preciso alterar o sistema: basta instalar um pacote de traduções, do mesmo jeito que se instala uma extensão. Ele pode traduzir tanto os textos do próprio Microteia quanto os de outras extensões instaladas, e desinstalá-lo devolve tudo ao idioma original.
- **Datas, valores e ordenação passam a acompanhar o idioma escolhido.** Um escritório em inglês lê as datas e a moeda como se lê em inglês, sem que ninguém precise configurar formato algum. Enquanto nenhum idioma for escolhido, tudo continua exatamente como está hoje.
- Ao montar uma extensão, a tela de autoria agora avisa quando o pacote está ficando grande demais para ser instalado, com a orientação de como dividi-lo — antes esse limite só aparecia como um erro incompreensível na hora de instalar.

## [7.4.0] — 2026-08-13

- **A configuração das intimações mudou de lugar, e agora pertence à extensão de Pushes.** A aba "Push" das Configurações do Escritório deixou de existir: as contas de e-mail monitoradas passam a ser administradas em **Recebimento**, botão no alto da tela "Pushes do Tribunal" (visível para o administrador) — ou pelo ⌘K, procurando por "recebimento", "gmail" ou "e-mail".
- **Os remetentes e os assuntos permitidos agora ficam em Configurações → Pushes do Tribunal.** Continuam valendo exatamente como estavam: nada precisa ser digitado de novo. Ao alterá-los pela primeira vez no lugar novo, é a partir dali que a leitura da caixa passa a se guiar.
- **A autorização da conta de e-mail ficou mais segura.** A permissão concedida ao Google passou a ser trocada e guardada inteiramente no servidor — nenhuma credencial da caixa de e-mail passa mais pelo navegador. Autorizar, reautorizar e revogar continuam do mesmo jeito, com um clique.
- Quem não usa a extensão de Pushes deixa de ver essa configuração, e a tela de Escritório fica com o que é de todo escritório: dados, membros e conexão de IA.

## [7.3.0] — 2026-08-13

- **Os lançamentos financeiros passaram a aparecer no Calendário.** Cada receita ou despesa aparece no dia em que vence — e, depois de paga, no dia do pagamento. O cartão mostra o valor com sinal (verde quando entra, roxo quando sai) e a pessoa do lançamento, e a agenda ganhou filtros por situação e por pessoa do Financeiro.
- **Registrar o pagamento e remarcar um lançamento agora podem ser feitos pela própria agenda.** O botão de registrar pagamento aparece no cartão enquanto a conta está em aberto; arrastar o cartão para outro dia muda o vencimento — ou a data de pagamento, ou a de cancelamento, conforme a situação do lançamento.
- Para pôr na agenda os lançamentos que já existiam, execute a automação **"Sincronizar lançamentos no calendário"**, escolhendo a situação (comece por "Aberto"). Ela pode ser executada quantas vezes for preciso: nenhum lançamento aparece duas vezes.
- A extensão Financeiro passou a exigir a extensão **Calendário** instalada.

## [7.2.2] — 2026-08-13

- **Arrastar um item no Calendário passou a responder na hora.** O cartão vai para o dia novo assim que você o solta, ligeiramente esmaecido enquanto a confirmação não chega — antes ele voltava ao lugar e só saltava depois. Se o movimento for recusado, ele volta imediatamente; e se o sistema decidir uma data diferente da que você soltou, o cartão se ajusta para a data correta.

## [7.2.1] — 2026-08-13

- **Uma extensão que oferece um botão em tela de outra não o perde mais ao ser reexportada.** Ao gerar o arquivo da extensão, os botões que ela pendura no cartão ou no detalhe de uma tela existente viajam junto com os campos — e a tela onde ela só oferece um botão, sem acrescentar campo nenhum, passa a aparecer na lista de artefatos com o resumo do que leva.

## [7.2.0] — 2026-08-13

- **As ações do cartão do Calendário agora são suas.** Elas passaram a sair de "Ações do card na listagem", no Form Design da entidade Calendário — a mesma lista de qualquer outra tela. Você acrescenta, tira e reordena o que aparece no cartão, e as extensões que instalar entram nessa mesma lista, à sua vista. Em Configurações › Calendário fica só o que não tem equivalente em nenhuma tela: a lista de quem responde quando um item é arrastado para outro dia.
- **Extensão que não carregou agora avisa.** Quando uma extensão depende de outra que não está instalada (ou é incompatível), a tela de Extensões passa a mostrar o motivo na linha dela, com o selo "Não carregou". Antes, o único sinal era a tela sumir do menu, sem explicação.

## [7.1.0] — 2026-08-13

- **Os prazos antigos agora entram no Calendário.** Uma automação nova, "Sincronizar prazos no calendário", leva para a agenda os prazos que já existiam antes — os que foram criados depois já entram sozinhos. Ela fica na tela de Automações, com o botão **Executar**: escolha a situação (pendentes, concluídos…) e rode.
- **Pode rodar quantas vezes quiser, sem bagunça.** Cada prazo tem no máximo um compromisso na agenda: executar de novo apenas atualiza o que já está lá, nunca cria repetido. Cada execução cuida de até 100 prazos da situação escolhida — se houver mais, é só rodar de novo, e o resumo ao final avisa.

## [7.0.0] — 2026-08-13

- **O Calendário deixou de ser só a agenda dos prazos.** Ele continua exatamente como você conhece — os dias lado a lado, a rolagem que abre no dia de hoje, a cor da prioridade em cada cartão, arrastar para remarcar —, mas agora qualquer parte do sistema pode marcar compromissos nele. Hoje quem faz isso são os Prazos; amanhã pode ser uma audiência, uma reunião ou o vencimento de uma parcela, sem que a agenda precise ser mudada.
- **Cada compromisso leva ao seu registro.** Clicar num cartão abre direto o registro que o originou — o prazo, o processo, o que for. E o compromisso se mantém sozinho: alterou o prazo, o cartão muda; excluiu o prazo, o cartão some.
- **A agenda ganhou busca e filtros completos**, no mesmo formato do resto do sistema: por situação, por prioridade, por período — e também por processo e por advogado responsável, quando o compromisso vem de um prazo.
- **Arrastar um cartão para outro dia agora respeita a regra de cada tipo de compromisso.** Um prazo pendente que muda de dia tem o vencimento adiado; um já concluído tem a data de conclusão corrigida. Em Configurações › Calendário você vê e ordena quem responde por esse gesto.
- **Novo campo de hora nos cadastros.** Ao montar uma tela, "Hora" entra ao lado de "Data" como tipo de campo, com o seletor próprio.
- Marcar um compromisso como concluído continua a um clique, no próprio cartão — e o botão só aparece no que ainda está pendente.

## [6.0.1] — 2026-08-12

- **A tela de abertura chama-se Dashboard**, e não "Painel", em todo o sistema: no menu, na tela de Configurações e na lista de extensões. Um nome só, no lugar de dois.

## [6.0.0] — 2026-08-12

- **O Painel agora é seu.** A tela de abertura deixou de ser uma peça fixa do sistema e passou a ser montada por você: cada cartão — processos em andamento, pessoas ativas, prazos da semana, prazos vencidos, resumo do financeiro, análise de prazos — pode ser ligado, desligado, reordenado e ter a largura escolhida (1, 2 ou 3 colunas).
- **Nasceu a tela de Configurações.** Um lugar único onde tudo o que aceita ajuste aparece, com busca no topo e duas abas: **Escritório**, onde o administrador define o padrão de todos, e **Usuário**, onde cada pessoa monta o seu por cima — sem alterar o dos demais. Quem prefere ver tudo de uma vez pode alternar para a edição em **JSON**, com o documento inteiro na tela e conferência do que foi digitado.
- **Cada cartão do Painel pertence à extensão que entende do assunto.** Instalar Financeiro faz o resumo financeiro aparecer no Painel; remover a extensão retira o cartão, sem deixar espaço vazio e sem tocar em nenhum lançamento. O mesmo vale para Processos, Pessoas e Prazos.
- **A análise de prazos continua inteira** — os gráficos por tipo, por vencimento ou por conclusão, nos períodos de 7, 15, 30 e 60 dias —, agora como um cartão que você pode posicionar onde quiser, ou desligar.
- **O Painel virou uma extensão.** Ele é instalado e removido como qualquer outra, e passa a ser o lugar onde qualquer extensão nova pode oferecer o seu próprio cartão.

## [5.1.0] — 2026-08-12

- **O Painel Financeiro foi retirado.** A tela de gráficos do Financeiro era a última peça daquele módulo presa ao núcleo do sistema, fora do alcance de quem monta as telas do escritório. Saíram com ela o botão "Painel" da listagem de Financeiro e o atalho "Dashboard" do painel de abertura. Os lançamentos, os filtros, os totais do período e todos os gestos da listagem continuam exatamente como estavam — nenhum dado foi tocado. Relatórios do Financeiro voltarão pelo mesmo caminho de todo o resto: como extensão.

## [5.0.3] — 2026-08-12

- **O contador de notícias não lidas voltou a ser redondo.** Com um número só ele saía achatado, em forma de oval; agora é uma bolinha, e vira pílula quando passa de nove.

## [5.0.2] — 2026-08-12

- **A notícia agora sai das não lidas para todo mundo.** Quem entrou no escritório como usuário comum não conseguia registrar a leitura — o selo ficava preso mesmo depois de abrir a notícia, e nada avisava o motivo. Marcar como lida, curtir e guardar para depois voltaram a valer para qualquer pessoa do escritório, como sempre valeram.
- **Comentar voltou a ser de todo mundo.** Quem só tem acesso de leitura ao escritório pode comentar nas notícias — o mural é o lugar em que todos participam.
- **Gravação recusada agora avisa.** Quando uma ação numa notícia não pode ser gravada, a tela diz — antes falhava em silêncio e o resultado simplesmente não aparecia.
- **O contador de não lidas mudou de lugar:** agora fica ao lado da palavra "Notícias", no alto da tela, e não mais colado ao botão de nova notícia.

## [5.0.1] — 2026-08-12

- **Marcar uma notícia como não lida voltou a funcionar.** O botão tirava a marca de leitura e a própria tela a repunha no instante seguinte: nada mudava, e o contador no menu não voltava. Agora a notícia volta mesmo para as não lidas, e o número ao lado de "Notícias" sobe junto.
- **"Copiar link" de uma notícia agora leva à leitura**, e não à tela de edição — é o mesmo endereço que a busca e as menções já abriam. Vale para qualquer tela que tenha uma tela de leitura própria.
- **A aba "Comentários" saiu do formulário de edição da notícia.** Comentar já se faz na própria notícia, embaixo do texto; a aba repetia a conversa no lugar em que ninguém a procura.

## [5.0.0] — 2026-08-12

- **Notícias agora é uma extensão.** O mural do escritório deixou de fazer parte do núcleo do sistema e passou a ser uma extensão que se instala e se remove — como Processos, Pessoas, Contratos, Prazos, Financeiro e Pushes já são. A tela continua a mesma: o cartão com o autor à esquerda, o resumo, as curtidas, as visualizações e os comentários; a leitura em página inteira, com o conteúdo, as etiquetas, os documentos anexados e a conversa embaixo.
- **O contador de não lidas continua sendo o seu.** O número ao lado de "Notícias", no menu e no alto da tela, conta o que **você** ainda não leu — e desce sozinho assim que você abre cada notícia. Guardar para depois, curtir e marcar como não lida seguem funcionando exatamente como antes, cada um com o seu.
- **Quem publica agora pode excluir o que publicou**, sem depender de um administrador. O mesmo vale para cada comentário: quem escreveu apaga o que escreveu.
- **Uma ação pode aparecer só para o dono do registro.** Ao configurar as ações de uma tela, agora é possível dizer "esta ação só aparece para quem criou o registro" — antes só era possível distinguir por papel (administrador, advogado, secretária).
- **Todo registro passa a guardar quem o criou, com nome e foto**, e não apenas quem o alterou por último. É o que permite uma listagem mostrar o autor de cada item.
- **Importante — as notícias antigas não vêm junto.** A extensão começa vazia: as notícias, os comentários, as etiquetas e os documentos publicados até aqui não são transferidos. As notícias do Sistema, visíveis a todos os escritórios, deixaram de existir — toda notícia agora é do seu escritório.
- **Para voltar a ter Notícias, instale a extensão** em Extensões, no menu do seu avatar.

## [4.6.0] — 2026-08-12

- **Cálculo de datas nas expressões das ações e dos campos.** `addDays` já aparecia na lista de funções e era aceita pelo editor, mas não funcionava na hora de usar: uma ação com `addDays(today(), 15)` no vencimento simplesmente não abria. Agora funciona — e com ela vieram todas as outras funções que faltavam desse lado: `formatDate`, `dateDiff`, `year`, `month`, `day`, `dayOfWeek`, `isWeekend`, `now`, `split`, `join`, `interpolate`, `formatMoney`, `formatCPF`, `formatCNPJ`, `sum`, `avg`, `first`, `last` e `delete`. O que a lista de funções oferece é o que de fato funciona.
- **Erro em expressão deixou de ser invisível.** Quando uma expressão de parâmetro não podia ser calculada, a tela de "Gerar Prazo" (e qualquer outra ação que pergunta antes de disparar) não abria, sem aviso nenhum — o motivo só existia no console do navegador. Agora o formulário abre normalmente, o campo vem em branco para você preencher à mão, e um aviso na tela diz qual parâmetro falhou e por quê, com a mensagem escrita em português: "a função X não existe", "o campo Y não existe nesta tela".
- **A lista de funções deixou de oferecer o que não funciona.** Seis entradas — `and`, `or`, `not`, `abs`, `ceil` e `floor` — apareciam como funções, mas o sistema nunca as executava daquela forma: `and(a, b)` e `or(a, b)` davam erro de sintaxe, e as demais eram atendidas internamente por outro caminho, o que tornava a descrição da lista incorreta. Saíram da lista de funções e continuam disponíveis exatamente como sempre funcionaram, agora descritas do jeito certo: `a and b`, `a or b`, `not a`, `abs(x)`, `floor(x)`, `ceil(x)`.
- **`round` passou a arredondar com casas decimais, como sempre prometeu.** A lista mostrava o exemplo `round(3.14159, 2)`, mas escrevê-lo dava erro. Agora funciona: `round(3.14159, 2)` resulta em `3.14`, e `round(3.7)` continua resultando em `4`.
- **`length` passou a contar campo vazio como zero.** Em um campo sem preenchimento, `length` devolvia **4** — o sistema contava as letras da palavra que usa internamente para "vazio". Uma condição como `length(observacao) > 0` dava verdadeira mesmo com o campo em branco. Agora vazio conta 0, texto conta as letras e lista conta os itens.
- Uma verificação automática passou a conferir, a cada alteração, se toda função anunciada é realmente executável — para que a lista de funções nunca mais prometa o que não entrega.

## [4.5.0] — 2026-08-12

- Ao executar uma automação, ou ao clicar em uma ação que pergunta antes de disparar, um parâmetro que aponta para um cadastro passou a abrir a **lista de registros** para escolher — Processos, Pessoas, Contratos, qualquer tela do escritório. Antes só havia um campo de texto esperando que você soubesse o código do registro de cor.
- Quando o parâmetro aceita **vários** registros, a escolha é múltipla, com as etiquetas do que já foi selecionado.
- Novo tipo de parâmetro: **Lista do escritório**. Em vez de redigitar as opções uma a uma, o parâmetro passa a usar a mesma lista já mantida no escritório (Situação, Área, Tipo, Status…) — e quem executa escolhe dela, com direito a acrescentar uma opção nova ali mesmo.
- Uma extensão que leve uma automação com esse tipo de parâmetro passa a carregar junto a lista de opções que ela pede, para que a automação chegue pronta no escritório que a instalar.
- Corrigido o seletor de entidade dos parâmetros, que oferecia telas cujos registros nunca apareciam para escolher.
- **Gerar prazo** (a partir de uma intimação) e **Criar prazo** passaram a oferecer o **Tipo** e a **Prioridade** que estão cadastrados no escritório, em vez de uma lista fixa de quatro opções escrita dentro da automação. O que você acrescentar na tela de Prazos aparece no formulário no mesmo instante.
- **Corrigida a data que voltava um dia antes.** Uma data digitada em qualquer formulário de automação (o vencimento de um prazo, por exemplo) era gravada como 11/08 quando você escolhia 12/08. Uma data agora é sempre o **dia** que você escolheu, seja ela digitada na tela, preenchida pela inteligência artificial ou calculada por uma automação.
- Pelo mesmo motivo, o **dia carimbado pelas automações** passou a ser o dia certo: concluir um prazo, dar baixa num pagamento ou cancelar um lançamento registravam a véspera.
- Corrigido: o prazo gerado a partir de uma intimação nascia com uma situação que a tela não reconhecia — ele não aparecia no filtro "Pendente" nem recebia cor na listagem. Agora nasce **Pendente**, como o prazo criado por qualquer outro caminho. Os prazos gerados antes desta versão precisam ter a situação corrigida uma vez, abrindo o prazo e escolhendo "Pendente".

## [4.4.0] — 2026-08-12

- No editor de expressões de uma automação, digitar `output.` passou a listar os passos anteriores do fluxo; ao escolher um deles, a lista continua nas saídas daquele passo. Antes o menu repetia as próprias palavras `event`, `input` e `output`, e não havia como descobrir pela tela o que escrever ali.
- O passo de uma automação passou a ter **um só nome**, o **Identificador**, no lugar do antigo "Nome (opcional)". É ele que aparece no fluxo e é por ele que as expressões leem as saídas do passo (`output.buscarProcesso`) — não há mais como o passo se chamar de um jeito na tela e de outro na expressão.
- O identificador é escolhido na criação, já vem sugerido pelo tipo do passo (`query1`, `map2`) e não muda depois, para não quebrar os passos que apontam para ele. Condições e repetições nascem com `condicao1`, `repeticao1`.
- Os passos que você já tem continuam exatamente como estão, com o nome que você deu a eles.
- Copiar uma automação deixou de embaralhar a identidade dos passos: a cópia sai fiel, com as expressões e as ligações entre passos intactas.

## [4.3.2] — 2026-08-12

- Na tela de Pushes do Tribunal, o filtro por situação passou a mostrar o nome que se lê ("Pendente", "Revisado") em vez do código interno — e voltou a filtrar de verdade. A correção vale para qualquer tela cujo campo use uma lista de opções.
- Cada intimação voltou a ocupar a largura inteira da tela, como antes: o corpo do e-mail se lê sem apertar.
- O menu "Ações" deixou de ficar escondido quando a intimação está no pé da lista — agora ele abre para cima quando não há espaço abaixo. Vale para todos os menus do mesmo tipo no sistema.

## [4.3.1] — 2026-08-05

- Corrigido o problema que fazia a tela **"Pushes do Tribunal"** abrir com o aviso de tela não encontrada logo depois de instalar a extensão: o item aparecia no menu e no alto da tela, mas a caixa de intimações não abria e a tela sumia do **Form Design**.
- Quem já instalou a extensão não precisa de nada além de clicar em **"Atualizar"** na tela de Extensões: a tela volta ao lugar, com os campos, o contador e o menu "Ações" completos.

## [4.3.0] — 2026-08-02

- **Os Pushes do Tribunal viraram uma extensão.** A caixa de intimações continua no mesmo lugar, com as mesmas intimações, mas agora é você quem manda nela: dá para acrescentar campos, mudar o que aparece no cartão e criar ações próprias, como já acontece com Pessoas, Processos, Contratos, Financeiro e Prazos.
- O item **"Pushes do Tribunal"** no menu, e o atalho no alto da tela, mostram **quantas intimações ainda esperam triagem** — e o número desce sozinho conforme você as revisa.
- O menu **"Ações"** de cada intimação agora sai da configuração da tela. Além de "Gerar prazo", "Marcar como revisado" e "Arquivar", qualquer ação que você criar aparece ali.
- **"Gerar prazo"** abre o formulário já preenchido: o número do processo e a descrição vêm da própria intimação. Ele encontra o processo pelo número antes de gravar — se o processo não estiver cadastrado, avisa em vez de criar um prazo solto — e marca a intimação como revisada.
- O **corpo do e-mail** passou a ser exibido dentro de uma moldura isolada do sistema. Nada que venha de fora executa aqui dentro, nem quando o remetente parece confiável.
- Uma ação sua pode agora **perguntar antes de executar**, abrindo os campos que o fluxo de trabalho precisa — com o que a tela já sabe responder vindo preenchido.

### O que mudou de comportamento

- O controle de **lido/não lido por pessoa** foi removido, junto com "Marcar todos como lidos". O contador do menu passou a contar as intimações **pendentes**, e a triagem é a situação da própria intimação: Pendente → Revisado → Arquivado.
- O **Dashboard de Pushes** foi removido e será refeito.
- O cartão da intimação mostra **apenas o que é dela**. A fase e o status do processo vinculado, e os prazos gerados, saíram desta versão. O link direto para o processo — e o aviso de "processo não cadastrado" — continuam.
- Excluir uma intimação segue sendo do administrador. Alterá-la passou a ser de administradores e advogados.

## [4.2.0] — 2026-08-02

- **Automações, ações e scripts ganham um identificador legível.** Antes, o que a tela mostrava como identificador era um código do banco (`NehhFXIJ40ZcaCV2SLjT`) sempre que o artefato vinha de uma extensão — enquanto o criado à mão ao lado mostrava um nome. Agora é um nome nos dois casos: a automação de Pessoa passa a se chamar `wf-pessoa-status`, que é como a extensão a nomeia.
- Ao criar uma automação, uma ação ou um script, você pode **escolher o identificador**; em branco, ele é criado a partir do nome. Depois de criado não muda, porque é por ele que as telas, as ações e os pacotes encontram o artefato.
- Na tela de Ação, o campo que se chamava "Identificador" passou a se chamar **"Chave para o fluxo"** — é o que ele sempre foi: o valor que chega ao fluxo de trabalho, e que duas ações podem compartilhar de propósito. O identificador de verdade agora tem campo próprio.
- Exportar uma extensão preserva o identificador de origem dos artefatos, em vez de trocá-lo pelo código local.
- Os artefatos **já instalados continuam com o código antigo** — nada foi renumerado, para não quebrar o que aponta para eles. O nome legível vale para o que for instalado ou criado daqui em diante.

## [4.1.2] — 2026-08-02

- Corrigido: **"Atualizar" uma extensão não atualizava as automações**. A mensagem dizia que tinha atualizado, mas as automações, as ações e os scripts continuavam como na primeira instalação — só desinstalar e instalar de novo trazia a versão nova. Agora atualizar traz tudo.
- A atualização continua preservando o que é seu: os campos que você acrescentou à tela, as ações que configurou e as automações que deixou desligadas seguem como estavam.

## [4.1.1] — 2026-08-02

- Corrigido: a automação **"Criar Prazo"**, ao ser aberta em Automações, mostrava a busca pelo processo como um filtro em branco e marcava a checagem de "processo não encontrado" como se estivesse errada. Ela sempre funcionou — o que estava errado era o que a tela mostrava —, mas quem abrisse para ajustar podia apagar a busca sem perceber. Agora ela abre exatamente como foi escrita.

## [4.1.0] — 2026-08-02

- A extensão **Prazos** passa a instalar a automação **"Criar Prazo"**, que outras automações podem chamar — ela substitui, com vantagem, o passo "Criar Prazo" que existia antes. Em vez de pedir o código interno do processo e do advogado, ela pede o **número do processo** e o **nome do advogado responsável**, encontra os dois e só então cria o prazo.
- Se o processo não for encontrado, a automação **para e avisa**, em vez de criar um prazo solto apontando para um processo que não existe. O mesmo vale para o advogado, quando informado — deixá-lo em branco continua sendo permitido.
- Corrigido: um prazo que vence hoje aparecia como vencido quando tinha sido criado por uma automação. Agora "hoje" é hoje, e "vencido" só a partir do dia seguinte.

## [4.0.0] — 2026-08-01

- **Prazos** passa a ser uma extensão, como já são Pessoas, Processos, Contratos e Financeiro. A tela é a mesma de sempre: o cartão continua com a faixa colorida da prioridade, o número do processo clicável, os dias que faltam para vencer e os selos de situação e prioridade — e a lista continua abrindo nos pendentes, do vencimento mais próximo ao mais distante. Nenhum prazo foi movido.
- Tipo, Prioridade e Status do prazo viram **listas do escritório**: dá para renomear, mudar a cor e acrescentar opções em Configurações, como em qualquer outra lista.
- "Marcar como concluído" continua no cartão e na tela do prazo, agora como uma ação configurável — o escritório pode ajustar quando ela aparece.
- Ao clicar em "Prazos Vencidos" no Painel, ou nos prazos de uma intimação, a lista abre **já filtrada** — o que antes era montado e se perdia pelo caminho. O mesmo vale para os atalhos de Processos e do Financeiro.
- Corrigido: nas listas e nos cartões, o registro vinculado (a pessoa, o processo, o contrato) voltou a aparecer pelo nome, em vez de "Sem título".
- **Atenção, administrador:** o passo de automação "Criar Prazo" foi descontinuado. Automações que o usavam precisam ser refeitas com o passo **Gravar Registro**, escolhendo a tabela "deadlines". Excluir um prazo passa a ser permitido só ao administrador, como já valia nos demais cadastros.

## [3.0.4] — 2026-08-01

- Corrigido: uma data guardada como texto (vinda de importação, script ou automação) deixava de ser reconhecida — o campo aparecia vazio no formulário e o filtro por período a ignorava em silêncio. Agora tanto `15/08/2026` quanto o formato interno são lidos como a mesma data.
- Corrigido: no cartão do Financeiro, o destaque vermelho de lançamento vencido não estava sendo aplicado.

## [3.0.3] — 2026-08-01

- Na busca rápida (⌘K), um **contrato** também é encontrado pelo número, como já acontecia com os processos.

## [3.0.2] — 2026-08-01

- **Pessoas** volta a aparecer na busca rápida (⌘K): dá para procurar uma pessoa pelo nome, abrir o cadastro ou criar uma nova por ali, como já acontecia com Processos e Contratos.
- Na busca rápida, um **processo** também é encontrado pelo número, e não só pelo título. Nas demais telas a busca segue pelo nome do registro.

## [3.0.1] — 2026-08-01

- A aba de um registro aberto passa a mostrar o **nome** dele, e não mais o código: um processo abre como "Ação de Cobrança" em vez do número, um contrato pelo título. É o mesmo nome que a listagem, a busca e as menções já mostravam — o número segue no cabeçalho da tela e no cartão, logo abaixo do nome.

## [3.0.0] — 2026-08-01

- O **Financeiro** deixa de ser uma tela de fábrica e passa a ser uma extensão, como Pessoas, Contratos e Processos. Nenhum lançamento foi movido: a tela, as etiquetas, as listas de Categoria, Status e Forma de Pagamento continuam as mesmas — e o Centro de Custo segue sendo o mesmo dos Contratos. **É necessário instalar a extensão "Financeiro" em Extensões** para o item voltar ao menu.
- Registrar pagamento, estornar e registrar cancelamento passam a ser ações configuráveis do lançamento, e não mais botões fixos: aparecem conforme o status, e o escritório pode ajustá-las como qualquer outra ação.
- A listagem do Financeiro abre no mês corrente e mostra os totais do que está filtrado — recebido, pago, saldo e o previsto do que ainda está em aberto.
- O **Painel Financeiro** continua onde estava, com os mesmos gráficos, e segue acessível pelo próprio Financeiro e pela tela inicial.
- Filtros de data em qualquer tela agora aceitam período: "(de)" e "(até)".

## [2.9.0] — 2026-08-01

- Os filtros de **data** de qualquer tela passam a ser por período: cada campo de data oferece "(de)" e "(até)", e cada ponta funciona sozinha. Antes só era possível filtrar por uma data exata, o que raramente é o que se procura numa listagem.

## [2.8.0] — 2026-08-01

- As telas de **Processo** e **Contrato** passam a usar o mesmo formulário de detalhe das demais telas do sistema. O formulário é idêntico ao anterior — o que muda é que ele agora ocupa a largura toda da área, e passa a ser um só: qualquer ajuste feito no Form Design vale para todos os caminhos que abrem o registro.
- O cartão da listagem de Processos e Contratos continua como era, com as partes, o tempo de trâmite e a vigência.
- Corrigido: o cartão do **Kanban de Processos** abre o processo na tela que o apresenta, em vez de uma aba fixa.
- É necessário atualizar **Processos**, **Contratos** e **Kanban de Processos** em Extensões.

## [2.7.1] — 2026-08-01

- Corrigido: na **Auditoria**, as alterações dos cadastros que viraram extensões apareciam como "Registro" — "Alteração na entidade de Registros" — em vez do nome real. Cada lançamento volta a dizer Pessoa, Processo, Contrato ou o nome da tela criada no escritório, e as notas e documentos aparecem como "Nota de Contrato", "Documento de Pessoa" e assim por diante.
- O nome da entidade na Auditoria passa a ser lido da própria tela: renomeou a tela, os lançamentos antigos já aparecem com o nome novo. Telas criadas pelo escritório também ganham nome próprio, no lugar do rótulo genérico.
- O filtro **Entidade** da Auditoria agora lista as telas do escritório, e não só os cadastros de fábrica.
- Corrigido: nos detalhes de uma alteração, campos que apontam para outro cadastro (o contrato de um processo, por exemplo) voltam a mostrar o nome do registro em vez do código interno.

## [2.7.0] — 2026-08-01

- Corrigido: na **Auditoria**, o botão "Ir para o registro" abria uma tela vazia nos cadastros que passaram a ser extensões (Pessoas, Processos, Contratos). O registro agora é aberto na tela que o apresenta hoje — e continuará certo mesmo que a tela mude de nome amanhã.
- **Processos** e **Contratos** passam a abrir sempre na tela própria da extensão, venha o clique da Auditoria, de uma menção numa anotação ou do cartão de outra tela. Antes, cada caminho podia levar a uma tela diferente. É necessário atualizar as duas extensões em Extensões.
- Corrigido: pedir para abrir um registro de um cadastro cuja extensão foi removida abria uma aba em branco; agora simplesmente não abre.

## [2.6.1] — 2026-08-01

- Uma ação de cartão trazida por uma **extensão** agora aparece na aba "Listagem" do Form Design, ao lado de Copiar link, Duplicar, Etiquetas e Excluir — é lá que se escolhe quais o cartão oferece. Sem isso, a ação da extensão existia mas nenhuma tela conseguia habilitá-la.

## [2.6.0] — 2026-08-01

- As ações do cartão — **Copiar link, Duplicar, Etiquetas, Excluir** e a nova **Desvincular** — deixaram de ser fixas no sistema. Agora são declaradas, como qualquer recurso trazido por uma extensão.
- Na tela de **Ação**, o campo "O que a ação executa" permite escolher entre um **comando do sistema** (copiar link, duplicar, etiquetas, excluir, desvincular) e um fluxo de trabalho. Comandos não precisam de automação nenhuma.
- Nas expressões das Ações, a nova variável `relation` diz o que o registro é para o registro que o contém: nenhum, filho ou relacionado.

## [2.5.0] — 2026-08-01

- Na aba **Processos** de um contrato, o botão de excluir do cartão virou **Desvincular** — ele agora tira o processo daquele contrato em vez de apagar o processo inteiro. Excluir de verdade continua na tela de Processos.
- Corrigido: ao editar um campo de **Referência** no Form Design, a propriedade "Tela vinculada" mostrava "Registro não encontrado", embora o campo estivesse correto e funcionando.
- Nas **Ações**, as expressões "Ocultar quando" e "Desabilitar quando" ganharam a variável `surface`, que diz onde o botão está sendo desenhado: no cabeçalho do registro, no cartão da listagem ou no cartão dentro da aba de outro registro.

## [2.4.1] — 2026-08-01

- Corrigido com urgência um erro na publicação das permissões da versão anterior, que fazia toda gravação em Prazos, Financeiro, Automações, Scripts, Ações e Extensões ser recusada com "permissão insuficiente" — inclusive a instalação da própria extensão de Contratos. É necessário publicar as permissões novamente.

## [2.4.0] — 2026-08-01

- **Contratos agora é uma extensão.** A tela é a mesma, com os mesmos contratos, o mesmo número, as mesmas listas de Tipo, Categoria, Status, Objeto, Banco e Centro de Custo, e as mesmas etiquetas, anotações e documentos — mas passa a ser instalada e atualizada como qualquer outra extensão do escritório. Instale na ordem **Brasil → Pessoas → Contratos → Processos**: cada uma precisa da anterior.
- O **número do contrato** continua sendo sugerido ao criar (duas letras e quatro dígitos, sem repetir um já usado) e continua editável.
- Dentro de um contrato, a aba **Processos** segue mostrando os processos ligados a ele, e criar um processo por ali já o traz vinculado. Para ligar um processo que já existe, use o campo **Contrato** na tela do próprio processo.
- Corrigido: ao criar uma opção nova pelo próprio campo, numa lista que tem cor por item, a opção nascia sem cor nenhuma. Agora ela recebe uma cor da paleta, diferente das que já estão na lista.
- Corrigido: o valor sugerido de um campo (como "Pessoa Física" em Pessoas) não estava aparecendo ao cadastrar.

## [2.3.1] — 2026-08-01

- **Automação agora tem identificador legível.** Ao criar, você escolhe um nome curto (ex: `avisar-cliente`) — ou deixa em branco e ele é criado a partir do nome. É por ele que uma Ação escolhe qual automação executar, e ele não muda depois de criada.
- Na tela de **Ação**, novo campo **"Ligada quando (interruptor)"**: preenchido, o botão passa a mostrar o estado do registro em verde ou vermelho, em vez de só disparar.
- As máscaras de CPF, CNPJ, telefone e CEP saíram por completo do sistema e agora pertencem à extensão **Brasil** — inclusive o formato de cada uma. Nada muda na tela: os campos continuam com a mesma máscara de sempre.

## [2.2.0] — 2026-07-31

- **Nova extensão "Brasil"**: CPF, CNPJ, telefone e CEP com máscara e conferência, mais o preenchimento de endereço pelo CEP. O que valia só para o Brasil saiu do sistema e virou uma extensão — quem opera em outro país não carrega mais regra que não usa, e qualquer cadastro que você criar pode usar esses formatos.
- **Instale "Brasil" junto com "Pessoas":** é dela que vêm o CPF, o CNPJ, o telefone e o CEP do cadastro de pessoas. Sem ela os campos continuam guardando o que já foi digitado, mas sem máscara nem conferência.
- O **Ativar/Inativar** voltou ao cabeçalho da pessoa, como botão que mostra o estado: verde para ativa, vermelho para inativa. Ele aparece só depois que a pessoa é salva — pessoa nova já nasce ativa.

## [2.1.0] — 2026-07-31

- **Pessoas agora é uma extensão**, como já era Processos — com as MESMAS pessoas já cadastradas. Nada mudou de lugar: clientes, partes, contatos, etiquetas, anotações, documentos e os vínculos com processos, contratos, prazos e lançamentos continuam exatamente onde estavam.
- O cadastro segue completo: CPF e CNPJ conferidos na digitação, formulário que se adapta a Pessoa Física ou Jurídica, endereço preenchido pelo CEP e as listas de Tipo, Relacionamento, Estado Civil, Sexo, Nacionalidade, Profissão e Cidade — que passam a ser suas para acrescentar, renomear ou remover.
- **Instale a extensão "Pessoas" antes de atualizar Processos:** Processos usa as pessoas para o advogado responsável e para os polos, e por isso agora depende dela.
- Duas mudanças na tela: o **Ativo/Inativo** virou um campo do formulário, no lugar do botão no topo; e o cabeçalho passa a mostrar o ícone da tela em vez da inicial do nome.
- A menção **@pessoa** nas anotações continua funcionando — agora vem junto com a extensão.
- Corrigido o **Personalizar Telas**: ele oferecia "Pessoas" e "Processos" como telas do sistema mesmo sem as extensões instaladas (com um formulário que não configurava nada) e, depois de instaladas, não as oferecia de jeito nenhum. Agora as duas aparecem na lista e aceitam campos próprios do escritório.
- No **Campo Subtítulo** da configuração de tela, a lista trazia só campos de texto: um campo de seleção já escolhido aparecia como "Registro não encontrado". Agora qualquer campo que caiba numa linha pode ser o subtítulo — seleção e relação inclusive, mostradas pelo rótulo.

## [2.0.5] — 2026-07-31

- **Automações agora podem ser empacotadas junto com a tela que as dispara.** Antes, ao montar uma extensão, uma automação de Processos travava a exportação reclamando de uma tela inexistente.
- Ao instalar uma extensão, o gatilho das automações passa a apontar sempre para a tela certa — inclusive quando a tela chega junto com outra extensão da qual ela depende.
- O sistema passa a avisar, ainda na montagem da extensão, quando duas telas disputariam o mesmo evento ou quando uma tela usaria um evento que já é de Pessoas, Contratos ou Prazos — o que faria automações do escritório dispararem na hora errada.

## [2.0.4] — 2026-07-31

- Corrigido o gatilho das **automações de Processo**: a lista de eventos oferecia "Processos alterado" com um nome que o sistema nunca publicava, e a automação simplesmente não rodava. O evento de Processo volta a ser um só — o mesmo de sempre —, tanto na hora de escolher o gatilho quanto na hora de disparar.
- Automações criadas nesse intervalo podem estar apontadas para o gatilho antigo: abra a automação e escolha novamente **Ao salvar: Processo**.

## [2.0.3] — 2026-07-31

- As **etiquetas dos processos** voltaram a aparecer na listagem e na tela do processo. A tela agora responde pelas próprias etiquetas, em vez de depender de outra configuração estar no lugar.

## [2.0.2] — 2026-07-31

- Corrigido o desaparecimento das **etiquetas dos processos** depois da migração: elas continuavam gravadas, mas não apareciam nem na listagem nem na tela do processo. As listas de opções (Área, Fase, Status…) de qualquer tela instalada por extensão passaram pelo mesmo conserto.

## [2.0.1] — 2026-07-31

- Corrigidas as regras de segurança do banco, que não compilavam após a saída de Processos do sistema e impediam a publicação.

## [2.0.0] — 2026-07-31

- **Processos agora é uma extensão.** A tela deixou de fazer parte do sistema e passou a ser instalada como qualquer outra extensão — os mesmos processos, as mesmas listas, etiquetas, anotações e documentos, sem nenhuma migração de dados.
- Prazos, Financeiro, Contratos, Agenda, Publicações e os painéis continuam mostrando e abrindo os processos normalmente, desde que a extensão **Processos** esteja instalada e ativa no escritório.
- As automações que reagem a processos seguem funcionando com os mesmos gatilhos e os mesmos caminhos de campo.
- Quem pode criar e editar processos continua sendo advogado e administrador.

> **Atenção:** instale (ou mantenha instalada) a extensão **Processos** em cada escritório. Sem ela, as telas que dependem de processos ficam vazias.

## [1.9.1] — 2026-07-31

- Corrigido o erro que deixava a tela de Processos em branco quando algum processo tinha a data de distribuição gravada num formato antigo. A listagem passou a entender esses valores em vez de parar.

## [1.9.0] — 2026-07-31

- A extensão "Processos (clone)" virou a extensão **Processos** — a de verdade, sem cópia e sem apelido. Ela agora traz o cadastro completo: os campos, as listas de Área, Fase, Status, Instância, Vara, Comarca e Juiz **já preenchidas**, as etiquetas, o cartão da listagem e os filtros.
- As listas de opções que vêm com uma extensão são apenas o **ponto de partida**: assim que o escritório acrescenta, renomeia ou remove uma opção, ela é dele — atualizar ou remover a extensão nunca mexe no que foi ajustado.
- Uma tela agora pode definir **quem tem permissão de gravar** nos seus registros. Em Processos, continua valendo o de sempre: advogado e administrador criam e editam, os demais consultam.
- As automações que escutam eventos de Processo continuam funcionando exatamente como antes.

## [1.8.1] — 2026-07-31

- Corrigido o aviso de **Atualização** que ficava aceso para as extensões do sistema mesmo logo depois de instalá-las.
- Na edição de um processo pela extensão **Processos (clone)**, o cabeçalho passou a mostrar o título do processo com o **número logo abaixo**, e a aba passou a levar o número — igual à tela de Processos.
- Na montagem de telas, cada tela ganhou a opção **Campo Subtítulo**: o campo escolhido aparece abaixo do título na tela do registro e dá nome à aba.

## [1.8.0] — 2026-07-31

- As extensões que vêm com o sistema voltaram a aparecer na tela de Extensões, com o selo **Do sistema**: instalam com um clique e já funcionam, sem precisar importar arquivo nem liberar o código. Quando o sistema é atualizado com uma versão nova delas, a linha oferece **Atualizar**.
- Cada extensão voltou a ter a **tela de detalhes**: clique no nome (ou no botão de informação) para ler a descrição completa, com o que ela adiciona ao escritório.
- A extensão **Processos (clone)** foi corrigida e agora mostra o cartão exatamente como a tela de Processos — responsável, área, instância, vara e valor da causa na mesma ordem, com os mesmos ícones.

## [1.7.0] — 2026-07-30

- A extensão **Processos (clone)** passou a trabalhar nos **processos reais do escritório**, e não mais numa cópia separada: os mesmos registros, as mesmas listas de opções (Área, Fase, Status, Vara…), as mesmas etiquetas, anotações e documentos. Criar, alterar ou excluir por ela vale na tela de Processos, e vice-versa.
- A lista dessa extensão ficou igual à tela de Processos: as mesmas linhas do cartão (responsável, área, instância, vara e valor da causa, com ícone), os mesmos filtros, o mesmo quadro de polos e as mesmas etiquetas coloridas.
- Uma extensão agora consegue descrever **por completo** uma tela do sistema — campos, listas de opções, relações, etiquetas, linhas do cartão e filtros — e apresentá-la sobre os dados que já existem. É o passo que abre caminho para telas do sistema serem substituídas por telas de extensão sem migração e sem perder nada.

## [1.6.1] — 2026-07-30

- Na montagem de telas, um campo novo volta a entrar no **fim** da lista de campos, e não no começo.
- Corrigida a reordenação de campos: mover para cima, mover para baixo e arrastar não tinham efeito nenhum — a nova ordem nunca chegava a ser gravada. Agora a ordem escolhida é mantida, e os ajustes do campo movido (como aparecer no filtro ou na listagem) continuam intactos.

## [1.6.0] — 2026-07-30

- O preenchimento automático a partir de uma fonte externa — como o endereço que aparece sozinho ao digitar o CEP — deixou de ser exclusivo dos casos que já vinham prontos. Agora uma extensão pode trazer a sua própria consulta, e ela passa a ficar disponível na lista junto com as demais.
- Ao escolher uma consulta externa na montagem de um campo, o sistema passa a mostrar **para onde o valor digitado será enviado** e quais informações aquela consulta devolve — assim dá para decidir com clareza antes de usar.
- **Mais segurança com extensões:** uma extensão que contenha programação própria e não tenha vindo da loja agora chega desligada. Ela aparece marcada como "código não revisado", e um administrador precisa abrir o conteúdo, ler e liberar. Telas, campos e automações da extensão continuam funcionando normalmente enquanto isso — só a programação fica aguardando.
- A liberação registra quem revisou e quando, e vale para aquele conteúdo exato: se a programação da extensão mudar, ela volta a pedir uma nova revisão.

## [1.5.0] — 2026-07-30

- As opções de **Máscara**, **Formatação pronta** e **Validação pronta** de um campo deixaram de ser uma lista fechada: agora uma extensão pode acrescentar as suas — o RG do seu estado, uma placa de veículo, um código interno do escritório — e elas aparecem para escolher junto com CPF, CNPJ, Telefone e CEP, como se sempre tivessem existido.
- Uma máscara trazida por extensão vale igual em toda parte: no preenchimento da tela, na hora de salvar e também quando o registro é gravado por uma automação.
- Nada muda nos campos já existentes: as opções de sempre continuam no lugar, com os mesmos nomes e o mesmo comportamento.

## [1.4.2] — 2026-07-30

- Na tela de criação de extensões, os campos que a extensão acrescenta a telas existentes passam a ser identificados pelo nome da tela e pelo ícone dela — antes aparecia o código interno de identificação.

## [1.4.1] — 2026-07-30

- **Correção importante:** ao editar uma extensão sua e exportá-la de novo, os ajustes feitos na tela pelo Form Design agora entram no arquivo — antes o pacote saía com a versão antiga da tela, e um campo novo acabava viajando por fora, o que apagava os demais campos na hora de atualizar a extensão.
- As listas de opções e os conjuntos de etiquetas de uma extensão importada deixam de se perder quando ela é reexportada.
- Um campo acrescentado a uma tela que a própria extensão instalou passa a ser incluído na tela, e não mais oferecido como "campo em tela existente" — atualizar a extensão nunca mais remove os campos que já estavam lá.

## [1.4.0] — 2026-07-30

- Agora é possível criar uma extensão a partir de **campos que você acrescentou a uma tela que já existe** — como um campo novo em Pessoas ou numa tela trazida por outra extensão. Antes, só telas criadas por você do zero podiam ser empacotadas.
- Na tela de criação de extensões, esses campos aparecem no grupo "Campos em telas existentes", separado das telas inteiras.
- Ao instalar, a extensão apenas **acrescenta** os campos à tela de destino: título, ícone, menu e os campos que já estavam lá não são tocados, e a tela continua sendo do escritório. Ao remover a extensão, só os campos dela saem — a tela e os registros permanecem.

## [1.3.0] — 2026-07-30

- A tela que uma extensão instala passa a usar o **nome curto** declarado no pacote (`produtos`), e não mais um nome longo com o identificador da extensão na frente. É esse nome que aparece nas automações, nos scripts e nas consultas — agora ele é legível.
- Se o nome já estiver em uso no escritório (por outra tela, por uma lista de opções ou por um conjunto de etiquetas), a tela instalada recebe um sufixo (`produtos_2`), do mesmo jeito que já acontece ao criar duas telas de nome parecido. Nada do que já existia é sobrescrito.
- Extensões já instaladas continuam exatamente onde estão: o nome da coleção é escolhido na primeira instalação e nunca muda sozinho.

## [1.2.1] — 2026-07-30

- **Correção importante:** uma tela criada no Form Design que você exportou como extensão continua sendo sua. Remover a extensão não apaga mais a tela: ela volta a ser editável, com todos os registros no lugar, e instalar a extensão de novo reaproveita a mesma tela — antes o sistema criava uma tela nova e vazia, e os registros ficavam inacessíveis.
- Enquanto uma extensão estiver instalada, a tela que ela usa fica protegida contra exclusão pelo Form Design — remova a extensão primeiro.

## [1.2.0] — 2026-07-30

- As etiquetas das telas personalizadas passam a ter espaço próprio no escritório, como já acontece com as de Processos, Pessoas, Contratos e Financeiro.
- **Correção importante:** excluir uma tela ou remover uma extensão não apaga mais as etiquetas criadas. Elas continuam guardadas e voltam a aparecer assim que a tela for recriada apontando para o mesmo conjunto.
- Telas diferentes agora podem compartilhar as mesmas etiquetas. Ao marcar "Habilitar Etiquetas", o Form Design mostra qual conjunto a tela usa e permite reaproveitar o de outra tela — inclusive o de uma tela do sistema.

## [1.1.0] — 2026-07-30

- As listas de opções dos campos de seleção passam a ter espaço próprio no escritório, igual às listas do sistema (Comarcas, Varas, Áreas do Direito). Antes, as opções de um campo criado no Form Design ou trazido por uma extensão ficavam presas à tela.
- **Correção importante:** remover uma extensão ou excluir uma tela não apaga mais as opções cadastradas. Elas continuam guardadas e voltam a aparecer assim que a lista for recriada com o mesmo nome — nenhum trabalho de cadastro se perde.
- Duas telas diferentes agora podem compartilhar a mesma lista de opções. Ao marcar "permitir que usuários adicionem novas opções", o Form Design mostra qual lista o campo usa e permite escolher uma já existente.
- Em uma automação, uma lista criada no escritório passa a estar disponível como qualquer outra tabela: dá para consultá-la, gravar novas opções e reagir a mudanças nela.
- As opções que já vêm prontas nas listas do sistema (Status do Processo, Fase, Categoria de Contrato e outras) continuam com suas cores e sem o botão de excluir, por fazerem parte do sistema. As cadastradas pelo escritório seguem excluíveis normalmente.

## [1.0.0] — 2026-07-29

- Unificação do modelo de dados: as telas criadas no Form Design e as trazidas por extensões passam a guardar seus registros do mesmo jeito que as telas do sistema — cada tela com seu próprio espaço e cada campo no seu próprio lugar. Quem olha os dados não distingue mais o que veio do sistema, de uma extensão ou do próprio escritório.
- Os campos que você acrescenta a Pessoas, Processos, Contratos, Prazos e Financeiro deixam de ficar num compartimento separado: passam a conviver lado a lado com os campos originais.
- Campos do sistema ficaram totalmente configuráveis. Antes só era possível ajustar rótulo, seção, ordem e algumas regras de tela; agora também obrigatoriedade, formatação, validação e valor calculado — e o que você configura vale igualmente nas automações, não só na tela.
- Automações: o gatilho passa a apontar direto para a tela desejada (por exemplo, "Ao salvar: Médico"), sem o passo extra de escolher a entidade depois de escolher o evento. Nas condições e nos passos, os campos da tela aparecem na lista principal, sem precisar navegar por um agrupamento à parte.
- Fim de uma restrição: uma tela criada no Form Design agora pode virar uma extensão — e vice-versa — sem qualquer conversão de dados.
- Campos de data passam a ser guardados como data de verdade em qualquer tela, e não mais como texto nas telas personalizadas. Com isso, uma automação disparada por uma tela do Form Design ou de extensão já pode fazer contas com a data recebida — somar prazos, comparar vencimentos — exatamente como faz com as telas do sistema.

> **Atenção:** esta versão muda a forma como os dados são gravados. Telas e campos criados antes dela precisam ser recriados. Automações que reagiam a telas personalizadas devem ter o gatilho escolhido de novo.

## [0.151.0] — 2026-07-26

- Iniciada a transição do produto de Microteia para Microteia: o sistema agora se apresenta como uma plataforma de serviço (PaaS) para criar aplicações de negócio de forma declarativa, não limitada apenas a escritórios de advocacia.
- Atualizada a identidade visual e textual do sistema para refletir o novo posicionamento como Microteia.

## [0.150.21] — 2026-07-26

- Reforçado que toda evolução do núcleo do sistema deve ampliar sua capacidade de ser estendido sem modificação, nunca vinculá-lo a situações específicas.

## [0.150.20] — 2026-07-26

- Estabelecido fundamento arquitetural da plataforma: o sistema é construído de forma declarativa, permitindo criar novas funcionalidades sem modificar o núcleo central do código.

## [0.150.19] — 2026-07-26

- Adicionado botão de maximizar nos modais de edição de código (telas e inicialização), permitindo usar toda a tela para programação confortável.

## [0.150.18] — 2026-07-26

- Adicionado "Código de inicialização" como primeiro item fixo na árvore de conteúdo, abrindo um modal amplo e confortável para programação ao ser clicado.

## [0.150.17] — 2026-07-26

- Reorganizado o conteúdo da criação de extensões em uma árvore única estilo Explorer do VSCode, com visual mais compacto e natural, incluindo as telas de código integradas à estrutura.

## [0.150.16] — 2026-07-26

- Os grupos de conteúdo (Telas, Ações, Automações e Scripts) na criação de extensões agora são exibidos em formato de árvore colapsável, permitindo expandir e recolher cada seção para melhor organização visual.

## [0.150.15] — 2026-07-26

- Aprimorado o template de código de inicialização de extensões com exemplos práticos de como registrar comandos no Command Palette (⌘K) com busca dinâmica e menções @ no chat com sugestões interativas.

## [0.150.14] — 2026-07-26

- Ao criar uma nova extensão, o código de inicialização agora vem com exemplos comentados mostrando como registrar comandos e menções, facilitando o início do desenvolvimento.

## [0.150.13] — 2026-07-26

- Adicionadas dicas explicativas que aparecem ao passar o mouse sobre os botões de salvar e exportar na tela de criação de extensões.

## [0.150.12] — 2026-07-26

- Botões de salvar e exportar na tela de criação de extensões agora aparecem no topo da página, com destaque visual ao passar o mouse.

## [0.150.11] — 2026-07-26

- Corrigido IntelliSense do editor de extensões: alterada a extensão do arquivo de modelo do Monaco de `.ts` para `.tsx`, permitindo que o TypeScript reconheça e valide corretamente a sintaxe JSX (elementos HTML e componentes React).

## [0.150.10] — 2026-07-25

- Corrigido IntelliSense do editor de extensões: removido import inválido que quebrava reconhecimento de módulos, e adicionado React.createElement para suporte completo a JSX no modo clássico.

## [0.150.9] — 2026-07-25

- Alterado o modo JSX do editor de extensões para o modo clássico React (com import automático de React), garantindo compatibilidade total do TypeScript com elementos HTML e componentes React em todas as telas de código.

## [0.150.8] — 2026-07-25

- Reconfigurado o compilador TypeScript do Monaco Editor de forma global: agora o suporte a JSX é inicializado antes de qualquer editor ser criado, garantindo que elementos HTML e componentes React sejam reconhecidos corretamente em todas as telas de código.

## [0.150.7] — 2026-07-25

- Corrigido o compilador TypeScript do editor de extensões: agora reconhece JSX corretamente, eliminando os erros "Cannot find name 'div'" e erros de tipo ao usar componentes React.

## [0.150.6] — 2026-07-25

- Corrigido IntelliSense do editor de extensões: o namespace JSX agora está no escopo global correto, permitindo que elementos HTML e componentes React sejam reconhecidos em todas as telas de código abertas.

## [0.150.5] — 2026-07-25

- Corrigido IntelliSense do editor de extensões: os componentes agora são reconhecidos corretamente ao escrever JSX, sem erros de tipo ao usar `<InfoBanner />`, `<Button />`, `<div>` e outros elementos.

## [0.150.4] — 2026-07-25

- Corrigido IntelliSense do editor de extensões: agora os elementos HTML (div, span, button) são reconhecidos corretamente e os componentes podem ser usados como tipos sem erro.

## [0.150.3] — 2026-07-25

- Corrigido o IntelliSense do editor de extensões: agora reconhece elementos HTML (div, span, button) e mostra os tipos corretos dos componentes, eliminando erros de lint durante a edição de código.

## [0.150.2] — 2026-07-25

- Corrigido o IntelliSense do tema no editor de extensões: agora todas as cores estão disponíveis no autocompletar, incluindo as cores de status de processos, contratos, pessoas, fases, KPIs, providers de IA e outras — antes só apareciam as cores básicas.

## [0.150.1] — 2026-07-25

- O editor de código das extensões agora tem **IntelliSense completo**: ao escrever uma tela de código ou o código de inicialização, o editor sugere automaticamente os componentes disponíveis (Button, Input, Modal…), os hooks de dados (useCases, useEntity…) e as funções de formatação (formatCurrencyBRL, formatCPF…), com a documentação e os tipos de cada um. Isso torna muito mais fácil descobrir o que está disponível e evita erros de digitação ao criar extensões.

## [0.150.0] — 2026-07-24

- Nova extensão de exemplo **"Processos (clone)"**: uma réplica da tela de Processos construída inteiramente como extensão, com seus próprios cards, filtros, etiquetas coloridas de Status e Fase, além dos polos ativo e passivo. Ela traz a própria ficha de processo — que aparece no **Form Design** como qualquer outra e pode ser personalizada — e ao abrir ou criar um registro usa o formulário padrão, com campos, máscaras, validações, notas e documentos. Os dados são totalmente independentes dos Processos do escritório: serve para demonstrar, na prática, o que já é possível montar com o novo recurso de telas por extensão.
- Ao escolher o ícone de uma tela de código na criação de extensões, agora o **desenho do ícone** aparece ao lado do nome, tanto na lista quanto no campo selecionado — antes só o nome era exibido.
- A extensão "Processos (clone)" passou a usar a **própria listagem padrão do sistema**: agora os filtros, as etiquetas coloridas de Status e Fase, as etiquetas do registro e — principalmente — as **ações do cartão** (copiar link, duplicar, gerenciar etiquetas, excluir) vêm da **configuração da tela no Form Design**, e não mais fixas no código da extensão. A extensão só acrescenta o que é exclusivo dela (o número do processo, o tempo em trâmite e os polos ativo/passivo). Assim quem personaliza a tela vê a mudança refletida na hora, sem depender de quem programou a extensão.
- Quem cria extensões agora pode montar **telas de cadastro/edição com layout próprio** reaproveitando os **campos padrão do sistema**: cada campo (texto, moeda, data, seleção com cor, referência etc.) já vem com sua máscara, opções e validação vindas do Form Design — a extensão só decide onde cada campo fica e pode dar comportamentos especiais a um campo específico. É a base para telas personalizadas sem abrir mão da configuração do escritório.
- A extensão "Processos (clone)" ganhou uma **tela de edição própria em duas colunas**: ao abrir ou criar um processo, agora surge um formulário organizado por seções, montado pela extensão, mas com todos os campos, máscaras e validações vindos da configuração da tela — demonstrando de ponta a ponta a criação de telas personalizadas.
- A tela de edição da extensão "Processos (clone)" ficou **idêntica à de qualquer outra tela do sistema**: mesmo cabeçalho (salvar em verde, excluir em vermelho, além de clonar, copiar link e etiquetas), as abas **Dados / Anotações / Documentos**, e as seções e campos no mesmo padrão visual. Além disso, clonar e copiar link agora abrem/geram para a **própria tela da extensão**, e não para uma tela paralela.
- Extensões agora podem **registrar recursos ao carregar o escritório**: a "Processos (clone)" adicionou atalhos na busca rápida (**⌘K / Ctrl+K**) — "Novo processo (clone)", "Abrir Processos (clone)" e a busca dos próprios registros — que abrem as telas da extensão. É a base para extensões estenderem a busca rápida e outros pontos do sistema.
- As menções com **@** no editor de texto (anotações, descrições) agora também incluem os registros trazidos por extensões: digitar **@** e escolher "Processo (clone)" permite buscar e inserir um link para um processo da extensão, do mesmo jeito que já funcionava para Processos, Pessoas e Contratos nativos.
- A tela de **Criar/editar extensão** ganhou um editor de **Código de inicialização**, onde se escreve o código que roda ao carregar a extensão para registrar recursos (comandos do ⌘K, menções @). Antes isso só existia embutido; agora dá para escrever, validar e salvar direto pela tela.
- Na listagem da extensão "Processos (clone)", **duplicar** e **copiar link** de um card agora abrem/geram para a **própria tela da extensão**, e não mais para uma tela paralela.
- Corrigido: as **ações do card e da tela de detalhe** que você configura no Form Design de uma tela trazida por extensão não são mais **perdidas** ao reinstalar ou atualizar a extensão — a sua configuração é preservada.

## [0.149.0] — 2026-07-24

- O recurso de "workflow público" foi descontinuado. Todas as automações agora são **privadas do seu escritório**, seguindo o mesmo princípio de Scripts e Ações. Para compartilhar uma automação com outro escritório, crie uma **Extensão** e selecione apenas a automação desejada — o compartilhamento passa a ser feito por um único caminho, mais organizado e completo.

## [0.148.1] — 2026-07-24

- Na edição de uma extensão, os itens que você criou no próprio escritório não aparecem mais **duplicados** — antes cada tela, ação ou automação surgia duas vezes (uma como "Incluída" e outra como opção marcável). Agora cada item aparece **uma única vez**, já marcado. Os itens que vêm embarcados de uma extensão importada de outro escritório continuam sinalizados como "Incluída".

## [0.148.0] — 2026-07-24

- A tela de **Extensões** foi redesenhada para ficar mais leve e clara. Cada extensão agora aparece **uma única vez**, em uma lista enxuta — não mais repetida em três blocos diferentes.
- As ações (instalar, editar, publicar, ativar, baixar, excluir…) aparecem como ícones discretos que se revelam ao passar o mouse sobre a extensão, deixando a tela limpa.
- Os selos de estado (Instalada, Publicada, Privada, Com código…) ficaram mais sutis, e um filtro rápido no topo permite ver **Todas**, apenas as **Instaladas**, as **Minhas** ou o **Catálogo** público.

## [0.147.0] — 2026-07-24

- Ao **atualizar** uma extensão, agora as mudanças feitas pelo autor nas automações, ações e scripts também chegam até você — antes só as telas eram atualizadas, e esses itens ficavam parados na versão antiga.
- A atualização é inteligente: só substitui um item por uma versão **mais recente**, nunca regride para uma mais antiga, e nunca duplica. Itens compartilhados por mais de uma extensão são atualizados uma única vez, para todas.

## [0.146.2] — 2026-07-24

- Ao instalar uma extensão que traz telas, a tela agora aparece **na hora** no Form Design e no menu — antes só surgia depois de recarregar a página. Ao desinstalar, some da mesma forma.

## [0.146.1] — 2026-07-24

- Ao **editar** uma extensão importada, as telas, ações, automações e scripts que ela traz agora aparecem na tela de edição, marcados como "Incluída" — e podem ser removidos com um clique.
- Corrigido um problema em que salvar ou baixar uma extensão importada **descartava** esses itens, deixando só o código. Agora eles são sempre preservados.

## [0.146.0] — 2026-07-24

- Ao **instalar** uma extensão, agora tudo o que ela traz também é criado no seu escritório: telas, ações e automações passam a aparecer prontas para uso, não só as telas de código.
- Ao **desinstalar**, esses itens são removidos automaticamente — e, se outra extensão também os usava, eles continuam onde estão. Os registros já cadastrados nas telas removidas são preservados.

## [0.145.0] — 2026-07-24

- A tela de **Extensões** foi redesenhada e reorganizada em seções claras: **Minhas Extensões** (o que você cria e edita), **Instaladas** (o que está de fato ligado no escritório) e **Catálogo público** (o que dá para instalar de outros).
- Agora a ideia é simples: você **cria e edita** na sua área privada, **instala** para usar no escritório e **publica** para compartilhar — cada coisa no seu lugar.
- Uma extensão instalada mostra o botão **Atualizar** sempre que a origem (a sua versão ou a pública) estiver mais nova, buscando automaticamente a mais recente.
- No catálogo público, uma extensão de cada identificador aparece **uma única vez**: publicar de novo apenas atualiza a existente, sem duplicar.
- A foto de quem criou a extensão agora aparece corretamente para os demais usuários, e o aviso "Você é o autor" só aparece para o autor de verdade.
- O identificador de uma extensão passa a ser **fixo após a criação**, evitando confusão entre versões.

## [0.144.0] — 2026-07-24

- Agora dá para **instalar** extensões da seção Públicas: elas viram uma **cópia sua** em uma nova seção **Instaladas**, prontas para ativar e usar no seu escritório.
- Como cada instalação é uma cópia independente, se o autor mudar, marcar como obsoleta ou remover a extensão do catálogo, **a sua continua funcionando** — e você pode desinstalá-la quando quiser.
- Quando o autor publica uma **versão nova**, aparece o botão **Atualizar** na sua extensão instalada.
- A seção **Minhas Extensões** passa a mostrar só as que você criou; as que você instalou aparecem em **Instaladas**.

## [0.143.0] — 2026-07-24

- Agora **qualquer escritório pode publicar** suas extensões no catálogo, direto de Minhas Extensões. Extensões **sem código** ficam públicas na hora; as **com código** entram em análise e só ficam públicas depois de **aprovadas por um administrador do sistema**.
- Uma nova seção **Públicas** mostra as extensões aprovadas e disponíveis a todos, com o nome e a foto de quem publicou.
- **Versão protegida:** cada domínio de extensão é único e uma versão publicada não pode ser sobrescrita — para publicar de novo, é preciso **subir a versão**. Extensões saem do catálogo apenas sendo marcadas como **obsoletas** (nunca somem para quem já usa).
- Administradores do sistema ganham uma área de **Moderação** para aprovar, recusar ou marcar como obsoletas as extensões enviadas.

## [0.142.0] — 2026-07-24

- O editor de telas de código agora **já abre com uma boa altura**, sem precisar redimensionar para começar a escrever.
- Corrigido um erro ao **salvar novamente** a mesma extensão; agora, ao salvar, você volta para a tela de Extensões e vê a extensão na lista.
- **Importar um .json** agora cria uma extensão **privada em Minhas Extensões**, da qual você vira o dono — pode editar, ativar no seu escritório e publicar, igual a uma que você criou.
- As extensões em Minhas Extensões passam a mostrar **quem as criou** (nome e foto), como acontece nos Workflows.

## [0.141.0] — 2026-07-24

- O editor de telas de código agora abre em uma **janela ampla**, com o código de um lado e a **pré-visualização ao vivo do outro** — e você pode **arrastar a divisória** para dar mais espaço a um ou a outro, com muito mais conforto para programar.

## [0.140.0] — 2026-07-24

- Suas extensões agora ficam guardadas em **Minhas Extensões**, na tela Extensões: ao criar uma extensão, ela é salva ali (privada e inativa) e você pode **editá-la quando quiser**, sem começar do zero.
- Cada extensão que você criou pode ser **ativada no seu próprio escritório** com um clique — inclusive as que trazem uma tela em código, que passam a funcionar na hora para você.
- Também dá para **baixar** o arquivo da extensão, **excluí-la** ou **publicá-la** no catálogo, tudo a partir da tela Extensões.
- A publicação **saiu da tela de criação** — criar e publicar agora são passos separados, então você nunca mais fica sem poder editar uma extensão já criada.

## [0.139.1] — 2026-07-24

- Corrigido um problema em que uma extensão publicada no catálogo chegava incompleta a quem instalava (perdia telas, automações e a própria tela de código). Agora a extensão publicada é entregue por inteiro.

## [0.139.0] — 2026-07-23

- A tela **Criar extensão** agora permite montar **telas de código**: escreva a sua própria tela num editor, com pré-visualização ao vivo, e inclua-a na extensão.
- Cada tela ganha título, ícone e um endereço próprio no menu; a extensão gerada já sai pronta para baixar e, depois de publicada, aparece como uma tela nova em qualquer escritório.
- O editor avisa na hora se o código não compila, para você corrigir antes de exportar.

## [0.138.0] — 2026-07-23

- Nova visão **Kanban de Processos**, disponível como extensão: um quadro onde cada coluna é uma Fase e cada processo aparece na coluna da sua fase atual.
- Você escolhe quais fases viram coluna e filtra o quadro inteiro por advogado, área ou status.
- Arraste um processo de uma coluna para outra para mudar a fase dele — a mudança é salva na hora, e o cartão usa a cor da fase.
- As colunas e o filtro que você montar ficam salvos só para você, neste navegador. Ative em Extensões.

## [0.137.0] — 2026-07-23

- Tela "Criar extensão" repaginada: itens organizados em cartões por tipo, cada um com seu ícone e um contador de selecionados.
- Ao marcar um item, tudo que ele precisa (por exemplo, a automação de uma ação ou a tela de um relacionamento) é marcado automaticamente e fica travado — se é necessário, não dá para desmarcar por engano.

## [0.136.0] — 2026-07-23

- Extensões que compartilham telas, ações, automações ou scripts em comum não duplicam mais: ao instalar duas extensões com o mesmo item, ele passa a existir uma vez só.
- Remoção com segurança: ao remover uma extensão, os itens que outra extensão instalada ainda usa são preservados — só somem quando nenhuma extensão mais os utiliza.

## [0.135.0] — 2026-07-23

- Atualização de extensões: ao importar uma versão mais recente de uma extensão já instalada, o sistema atualiza no lugar — cria e ajusta as telas novas, remove as que saíram e mantém os seus dados. Os campos que você adicionou por conta própria às telas da extensão são preservados.

## [0.134.1] — 2026-07-23

- Extensões importadas agora mostram o próprio nome e descrição na tela de Extensões, com a marca "Importada".
- O acesso a Extensões saiu do menu lateral e passou para o menu do seu avatar, junto de Form Design, Workflow, Scripts e Ações.

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

- Base para o futuro catálogo de extensões do Microteia: o sistema já sabe registrar quais extensões um escritório instalou, ativou ou removeu. Ainda não há extensões para instalar — isso vem a seguir. Nenhuma mudança visível no uso.

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

- O Microteia agora carrega cada tela sob demanda, no momento em que você a abre. O sistema abre bem mais rápido no primeiro acesso do dia, especialmente em conexões lentas.
- Toda a estrutura de telas, menu e busca rápida (⌘K) passou a funcionar como módulos independentes — a base que permitirá, em breve, instalar novos recursos no escritório sem atualizar o sistema inteiro. Nenhuma tela, atalho ou item de menu mudou de lugar.

## [0.123.4] — 2026-07-22

- Continuação da preparação para as extensões do Microteia: o sistema já sabe reconhecer, conferir e organizar os recursos que serão instalados, recusando com uma explicação clara qualquer extensão incompatível — sem afetar as demais. Nada muda no uso do dia a dia por enquanto.

## [0.123.3] — 2026-07-22

- Início da preparação para as extensões do Microteia: uma base técnica que, nas próximas versões, permitirá instalar novos recursos no escritório sem precisar atualizar o sistema inteiro. Nada muda no uso do dia a dia por enquanto.

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

- Lançado o site institucional do Microteia, com apresentação das funcionalidades, planos e uma página de contato — acessível para qualquer visitante, sem precisar de login.
- Corrigido um problema em que um link copiado de um processo, contrato, pessoa, notícia ou lançamento financeiro não abria a tela correspondente ao ser colado na mesma aba do navegador que já estava com o Microteia aberto.

#### [0.17.0] — 2026-07-03

- Agora é possível arrastar um prazo no Calendário para outro dia: prazos pendentes ou vencidos têm a data de vencimento atualizada, e prazos concluídos têm a data de conclusão atualizada.

#### [0.16.2] — 2026-07-03

- Corrigido um problema que fazia a data de vencimento do prazo avançar um dia a cada vez que a tela era salva.

#### [0.16.1] — 2026-07-03

- Corrigido: o menu lateral estava ficando abaixo da nova barra de status fina no rodapé do sistema, em vez de ao lado dela.

#### [0.16.0] — 2026-07-03

- A tela de login agora exige a confirmação de leitura dos Termos de Uso e da Política de Privacidade (por marcação de caixa de seleção) antes de criar uma conta por e-mail ou de continuar com o Google — com aviso caso o usuário tente prosseguir sem aceitar.
- A página de Termos de Uso e Política de Privacidade só exibe o botão "Voltar" quando é aberta a partir da tela de login; ao ser aberta diretamente por um link, ela é exibida sem esse botão.
- Adicionada, na parte inferior do sistema, uma barra fina de status com o nome do escritório em uso, o atalho de teclado da paleta de comandos, o link para os Termos e Privacidade e a versão atual do Microteia.

#### [0.15.0] — 2026-07-03

- Adicionada uma página pública com os Termos de Uso e a Política de Privacidade do Microteia, acessível em "/license" sem necessidade de login. Ela explica, entre outros pontos, que o sistema está em fase beta e que a conferência final de prazos e intimações identificados pelo monitor de e-mails é sempre responsabilidade do advogado.

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
