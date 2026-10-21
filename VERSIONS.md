# Notas de Versão — Microteia

> Histórico de novidades, melhorias e correções da Microteia, escrito para quem usa o sistema no dia a dia. Para o histórico técnico de alterações, consulte o log de commits do git.

Cada versão corresponde ao campo `version` de `package.json`. A mais recente fica no topo.

<!-- Nova entrada vai aqui, acima das anteriores, no formato:

#### [0.0.9] — AAAA-MM-DD

- Descrição elegante da mudança, em linguagem simples.
-->

#### [9.137.1] — 2026-10-20

- A publicação de novas versões do sistema ficou bem mais rápida e não trava mais esperando uma confirmação que ninguém pode dar; o que falha é tentado de novo automaticamente, sem atrasar o resto.

#### [9.137.0] — 2026-10-20

- As listas de um modelo de documento agora podem ser ordenadas por mais de um campo — por exemplo, pela data e, no mesmo dia, pela hora. Um relatório de andamento passa a mostrar as movimentações de cada dia na ordem em que aconteceram, e o limite de itens sempre fica com as mais recentes.
- A ordem das listas ficou estável: itens sem o campo de ordenação vão para o fim, e itens empatados aparecem sempre na mesma sequência, a cada geração.
- Na tela de modelos de documento, cada lista ganhou a escolha de sentido (crescente ou decrescente) e o botão "Depois por", para acrescentar um critério de desempate.

#### [9.136.3] — 2026-10-20

- Quando o convidado do portal tenta alterar um registro que acabou de ser excluído pelo escritório, ele agora vê um aviso claro, em vez de o registro ser recriado.

#### [9.136.2] — 2026-10-20

- Corrigido um erro que podia aparecer ao abrir painéis e telas trazidos por extensões, como o Painel.

#### [9.136.1] — 2026-10-20

- Corrigido um erro que impedia o sistema de abrir depois da última atualização.

#### [9.136.0] — 2026-10-20

- O convidado do portal pode corrigir registros, quando o escritório permitir — por exemplo, ajustar o valor de uma nota antes da análise.
- O escritório escolhe quais campos podem ser alterados (sempre entre os que o convidado já vê), em que momento a alteração é permitida (por exemplo, só enquanto o registro está em rascunho) e se o convidado altera só o que ele mesmo criou.
- A quem o registro pertence nunca pode ser alterado pelo convidado.
- No Form Design, a aba "Portal" de cada tela ganhou essas opções de alteração.

#### [9.135.0] — 2026-10-19

- O convidado do portal pode anexar documentos aos registros dele, quando o escritório permitir — por exemplo, o prestador enviando o PDF da nota. Ver documentos não dá, por si só, o direito de anexar.
- Ao anexar, o convidado escolhe o tipo do documento entre os que o escritório definiu para aquela tela, sem poder criar um tipo novo. Ele nunca pode excluir documentos.
- No Form Design, a aba "Portal" de cada tela define se o convidado pode anexar e quais tipos ele pode escolher.

#### [9.134.0] — 2026-10-19

- O portal ganhou uma página inicial, com mensagem de boas-vindas, o menu em blocos e cartões de resumo trazidos pelas extensões.
- No computador, o menu do portal fica em abas no topo; no celular, numa barra fixa embaixo, com "Mais" para o restante.
- Na aba Portal das configurações, o escritório escreve as boas-vindas e escolhe o que aparece no menu e na página inicial, e em que ordem.
- Extensões podem trazer páginas inteiras e cartões para o portal, além de substituir telas.

#### [9.133.0] — 2026-10-19

- Extensões agora podem trazer telas próprias para o portal: a lista ou o registro de uma tela aparece para o convidado do jeito que a extensão desenhou. Essas telas só são enviadas ao convidado quando o escritório confia no código da extensão; caso contrário, o portal mostra a tela padrão.
- Novo exemplo de extensão para quem desenvolve: clientes que acompanham e fazem os próprios pedidos pelo portal.

#### [9.132.0] — 2026-10-19

- O portal passou a mostrar os registros na hierarquia certa: o menu mostra só os principais — como os prestadores de serviço —, e as notas fiscais de cada prestador aparecem dentro dele. A nota criada ali já nasce vinculada ao prestador aberto, sem perguntar.
- O portal ficou bem mais rápido: abre com as informações da última visita enquanto atualiza, e trocar de aba ou abrir um registro não espera mais pela rede.
- Uma falha passageira ao abrir o portal é tentada de novo automaticamente, sem exigir que a pessoa clique em "Tentar de novo".
- Os textos do portal deixaram de aparecer em inglês nas telas de carregamento e de aviso.

#### [9.131.4] — 2026-10-19

- Ao abrir o link de acesso, o portal mostra "Entrando…" em vez de exibir por um instante a tela de login.
- O portal não recarrega mais tudo ao escolher o escritório ou ao entrar nele, e o carregamento contínuo deixou de aparecer a cada tela.
- Quando o portal não consegue carregar, ele diz isso — com um botão para tentar de novo e o código do erro —, em vez de afirmar que a pessoa não tem acesso.
- As telas de aviso do portal aparecem no idioma do convite desde o início.

#### [9.131.3] — 2026-10-19

- O link de acesso ao portal não fica mais parado na tela de confirmação quando a pessoa já está conectada com a conta convidada: ela segue direto para o portal.
- O e-mail com o link de acesso e a página de confirmação passam a vir no idioma de quem fez o convite.

#### [9.131.2] — 2026-10-19

- O portal passa a usar o idioma de quem fez o convite quando nem o convidado nem o escritório escolheram um. Antes, nesse caso, ele seguia o idioma do navegador do convidado, e podia aparecer em inglês para um escritório que usa o sistema em português.

#### [9.131.1] — 2026-10-19

- A aba "Portal" do Form Design agora explica por que uma tela só oferece a opção de receber convidados, e como ligar os registros dela a outra tela para que o convidado possa criá-los.

#### [9.131.0] — 2026-10-18

- O convidado do portal agora também pode enviar registros — um pedido do cliente, uma nota emitida pela empresa. No Form Design, a aba "Portal" de cada tela define se ela aceita esses envios e quais campos o convidado preenche.
- O registro enviado é sempre vinculado ao que já pertence ao convidado, nunca a outra empresa ou cliente, e passa pelas mesmas validações de quando alguém do escritório o cadastra. As automações do escritório podem avisar a equipe a cada envio.

#### [9.130.3] — 2026-10-18

- O portal deixou de aparecer em inglês quando o escritório não escolheu um idioma: nesse caso ele segue o idioma do navegador de quem acessa, inclusive nas datas.

#### [9.130.2] — 2026-10-18

- O link de acesso ao portal agora entra direto: não pede mais para redigitar o e-mail e funciona mesmo quando o navegador já está conectado com outra conta — antes, nesse caso, o portal abria na conta errada.
- O portal, inclusive a página de acesso, passa a aparecer no idioma do escritório, o mesmo das informações que ele mostra.
- Quando a conta não tem acesso ao portal, a tela mostra com qual e-mail a pessoa está conectada e oferece entrar com outra conta. Uma falha ao carregar o acesso também deixou de ser confundida com a falta de convite.

#### [9.130.1] — 2026-10-18

- Quando o convite ao portal é feito mas o link de acesso não consegue ser enviado, a mensagem agora deixa claro que o convidado já está cadastrado, explica o motivo — como o login por link desligado no projeto — e indica como reenviar.

#### [9.130.0] — 2026-10-18

- O Form Design ganhou a aba "Portal": nela se escolhe, sem programar, se uma tela aparece no portal, de quem são os registros dela e quais campos podem ser vistos por quem é de fora. A aba avisa na hora quando a escolha não levaria os registros a ninguém.
- Só quem tem a permissão de gerenciar o portal pode decidir o que uma tela mostra a quem é de fora.
- A lista do portal passou a mostrar o nome do registro apenas quando esse campo foi escolhido para aparecer.

#### [9.129.0] — 2026-10-18

- Novo Portal: o escritório pode convidar pessoas de fora — um cliente, um fornecedor, a empresa atendida por uma prefeitura — para acompanharem, numa tela própria e simples de usar no celular, só os registros vinculados a elas. Cada tela escolhe quais informações saem do escritório; nada além delas é mostrado.
- O convidado entra por um link enviado ao e-mail, sem precisar criar senha, e não ganha um escritório próprio.
- Os convites ficam numa nova aba "Portal" das configurações do escritório, onde é possível convidar, reenviar o link de acesso e revogar o acesso a qualquer momento — a revogação vale na hora.
- Documentos anexados a um registro podem ser compartilhados no portal com um clique, e só os marcados ficam visíveis para o convidado.

#### [9.128.0] — 2026-10-20

- Uma aba dentro de um registro agora pode listar tudo em que ele aparece, mesmo quando o vínculo admite vários registros ao mesmo tempo ou passa por mais de um campo — por exemplo, os processos em que uma pessoa é parte, seja no polo ativo, seja no polo passivo.
- Nessas abas, desvincular tira apenas o registro aberto da lista, mantendo os demais; e o novo cadastro feito a partir da aba já nasce ligado a ele.

#### [9.127.2] — 2026-10-19

- Corrigido um problema que, desde 17/10, deixava de atualizar os campos calculados a partir dos registros filhos — como o resultado e a data do último andamento de um processo — quando a tela pertence a uma extensão. Os registros afetados são recalculados automaticamente após a atualização.
- No editor de telas, a escolha do campo que liga o registro filho ao pai volta a mostrar as opções corretas, em vez de "Registro não encontrado".
- O modelo inicial de documento passa a incluir as listas de registros filhos também nas telas que vêm de extensões.

#### [9.127.1] — 2026-10-19

- Corrigida a autorização de assistentes de IA (OAuth) e a emissão de acesso, que podiam ser recusadas quando o escritório marcava permissões de listas de opções ou etiquetas criadas a partir de uma tela. As permissões oferecidas na escolha agora são sempre as mesmas que o sistema aceita.
- Perfis de acesso passam a valer de fato para essas listas e etiquetas: quem não é dono do escritório e recebeu a permissão consegue usá-las normalmente.
- Uma tela ou lista recém-criada já pode ser incluída num acesso de IA na mesma hora, sem esperar alguns minutos.

#### [9.127.0] — 2026-10-18

- Ao criar uma tela, automação, ação, script ou modelo, quem pode alterar o prefixo do escritório encontra, ao lado dele, um atalho que leva direto à configuração do prefixo. Se o escritório ainda não tem um, o atalho convida a defini-lo antes de criar.

#### [9.126.0] — 2026-10-18

- Cada escritório passa a ter um prefixo próprio, que inicia o nome de toda tela, lista, automação, script, relatório e modelo criado daqui em diante. Assim, o que um escritório exporta nunca se confunde com o que outro criou. O prefixo fica em Configurações e só pode ser trocado por quem tem a permissão para isso.
- Ao instalar uma extensão cujo nome de tela ou de lista já é usado no escritório, a instalação agora é recusada com uma explicação, em vez de criar uma cópia com outro nome.
- Duas extensões diferentes que trazem uma automação com o mesmo nome passam a ter, cada uma, a sua — uma não substitui mais a outra.

#### [9.125.0] — 2026-10-18

- Um documento gerado a partir de dados — como uma procuração montada com a pessoa e o contrato — agora pode ser anexado direto na aba Documentos do registro a que pertence. Na automação, basta dizer em "Pertence a" qual dos registros é o dono do documento.
- Quando esse documento vai para Downloads, o registro de origem fica lembrado: ao anexar o arquivo depois, o registro certo já vem sugerido.

#### [9.124.1] — 2026-10-17

- Corrigido: nos passos de uma automação, o "x" ao lado da origem de um campo agora apaga de fato o valor, deixando o campo vazio como antes de qualquer escolha — em vez de voltar para "Valor fixo".

#### [9.124.0] — 2026-10-17

- Os modelos de documento ganharam pré-visualização: o botão "Pré-visualizar" mostra, numa folha, o documento como ele vai sair — com um registro à sua escolha ou com o exemplo do modelo —, mesmo antes de salvar, e avisa quais campos ficariam vazios.

#### [9.123.0] — 2026-10-17

- A tela Downloads ganhou filtros como as demais telas: busca, quem gerou, se foi uma pessoa, um agente de IA ou uma automação, de qual tela veio, modelo, visibilidade, formato, período e vencimento — e os filtros podem ser salvos.
- Quem gerencia Downloads pode tornar um arquivo público, para que todos os membros o vejam ao lado dos próprios arquivos, e torná-lo privado de novo.
- Um arquivo de Downloads pode ser anexado a um registro: ele passa a ficar de vez na aba Documentos e sai de Downloads.
- Correção: um arquivo visível a todos podia ser excluído por qualquer membro; agora só quem o gerou ou quem gerencia Downloads pode excluí-lo.
- No passo "Gerar Documento" das automações, o campo Registro só aparece quando o modelo escolhido é gerado a partir de um registro; com um modelo que recebe dados, aparecem os campos dos dados.
- Na tela de modelos de documento, um modelo pode receber dados em vez de um registro: você declara as informações que ele espera — com grupos e listas —, dá um exemplo e pode começar o texto a partir delas.

#### [9.122.0] — 2026-10-17

- Modelos de documento agora podem ser preenchidos com dados enviados por uma automação ou por um agente de IA, sem depender de um registro de uma tela — ideal para recibos, propostas e comprovantes montados na hora. O documento vai para Downloads.
- Esses modelos dizem quais informações esperam, inclusive grupos e listas, e avisam quando falta alguma obrigatória. Quando a informação aponta para um registro, como um cliente, o documento lê os dados dele.
- Nas automações, o passo "Gerar Documento" mostra um campo para cada informação que o modelo espera.

#### [9.121.0] — 2026-10-17

- Nova tela **Downloads**: documentos gerados que não precisam ficar guardados no registro — um recibo para entregar, um extrato para enviar — vão para lá, prontos para baixar, e são excluídos sozinhos quando vencem.
- Ao gerar um documento, agora dá para escolher onde salvá-lo: na aba Documentos do registro ou em Downloads. Telas sem a aba Documentos também passam a gerar documentos, direto para Downloads.
- Cada modelo de documento pode dizer para onde vai por padrão e por quantos dias fica em Downloads.
- Nas Configurações, o escritório define por quantos dias os arquivos ficam em Downloads (7, se nada for dito) e quem vê os arquivos gerados por automações: só quem gerencia ou todos.

#### [9.120.0] — 2026-10-17

- A escolha de permissões de um assistente de IA ganhou o botão **Selecionar tudo**, que marca todas as permissões de uma vez. Com uma busca aberta, ele marca só o que a busca encontrou.

#### [9.119.0] — 2026-10-17

- Assistentes de IA conectados ao escritório agora administram os modelos de documento por completo: listam os modelos, leem o texto de cada um, criam modelos novos em Markdown ou Word, personalizam o modelo de uma extensão, restauram o original, desligam, religam, clonam e excluem.
- O assistente aprende a escrever modelos certos de primeira: recebe a explicação completa dos campos, das repetições e das condições, a lista de funções disponíveis e, para cada tela, o campo exato a usar e um modelo inicial pronto.
- Antes de salvar, o assistente é avisado de campos que não existem na tela e de arquivos Word que não podem ser lidos — em vez de descobrir o problema só no documento gerado.
- O assistente pode pré-visualizar o texto de um documento com os dados de um registro antes de gerá-lo, e gerar o documento direto na aba Documentos.
- Corrigido: desligar e religar um modelo do escritório fazia o modelo sumir, e desligar uma cópia personalizada descartava a personalização.

#### [9.118.0] — 2026-10-17

- A tela de Modelos de documento ganhou visual novo: lista com busca e filtros por situação e por tela, cabeçalho com as informações do modelo e botões mais claros para personalizar, desligar e restaurar.
- Quando uma extensão atualiza um modelo que você personalizou, ele passa a aparecer com o aviso "Atualização disponível". Você escolhe entre restaurar a versão nova da extensão ou manter a sua cópia.
- Novo botão "Clonar": cria um modelo novo a partir de qualquer outro, para ter versões diferentes sem mexer no original.
- A marca "Extensão" na lista de modelos agora segue o mesmo padrão das demais telas.

#### [9.117.0] — 2026-10-17

- As listas de Ações, Automações, Scripts e Relatórios passam a indicar, com a marca "Extensão", o que foi trazido por uma extensão. Ao passar o mouse sobre ela, aparece o nome da extensão.
- Em Modelos de documento e no Form Design, passar o mouse sobre a marca de extensão mostra o nome dela, e não mais um código técnico.

#### [9.116.2] — 2026-10-17

- Corrigida a geração de documentos em Processos, Financeiro, Contratos, Prazos e Pessoas, que era recusada com o aviso de que a tela não tinha a aba Documentos — mesmo com a aba ligada. O mesmo valia para anexar e listar documentos pelo assistente de IA.
- Essas telas deixaram de aparecer duas vezes, com o nome técnico em inglês ao lado do nome de verdade, na escolha de permissões dos perfis e nas listas de telas dos modelos de documento e das automações.

#### [9.116.1] — 2026-10-16

- Corrigidos os avisos exibidos depois de executar uma ação: em vez da frase no seu idioma, alguns mostravam um código técnico começando por "@". O mesmo vale para as mensagens que uma ação aponta em campos específicos do formulário.

#### [9.116.0] — 2026-10-16

- O filtro do Calendário ganhou a opção "Origem": escolha uma ou mais — Prazos, Audiências, Tarefas — e a agenda mostra só o que vem delas. A legenda de origem e os filtros salvos seguem a mesma escolha.

#### [9.115.0] — 2026-10-16

- No Calendário, uma informação do cartão pode agora ser um link para outro cadastro: por exemplo, o número do processo de um prazo abre o processo direto, enquanto o clique no restante do cartão continua levando ao prazo.

#### [9.114.1] — 2026-10-16

- Corrigidas as automações cuja condição verifica se uma data do registro foi preenchida: uma data preenchida era tratada como vazia, e a automação nunca chegava a rodar.

#### [9.114.0] — 2026-10-16

- Novo grupo "Favoritos" no menu lateral. Ao passar o mouse sobre um item do menu, aparece um alfinete: clique nele para fixar o item no topo, em Favoritos. Para tirá-lo de lá, use o mesmo alfinete.
- Os favoritos são seus e acompanham você em qualquer computador, separados por escritório. O grupo só aparece quando há ao menos um item fixado.
- Favoritos se comporta como os outros grupos: pode ser recolhido, continua mostrando a tela aberta e soma os avisos dos itens escondidos.

#### [9.113.2] — 2026-10-15

- Corrigido: nas automações com espera, os passos que vêm depois da espera voltam a enxergar os dados dos registros vinculados, como o tribunal do processo.
- Corrigido: uma automação que grava os dados do registro que a disparou não grava mais o registro vinculado inteiro no lugar do vínculo.

#### [9.113.1] — 2026-10-15

- Corrigido um problema em que as automações que copiam um vínculo para outro registro passaram a gravar o registro inteiro no lugar do vínculo. Com isso, as alterações dos prazos voltam a chegar à Agenda, e as parcelas e os eventos do Financeiro voltam a ficar ligados ao processo, ao contrato e à pessoa certos.

#### [9.113.0] — 2026-10-15

- Em Configurações, "Abas do registro" agora reúne todas as abas extras de uma tela: as das telas filhas (como Anexos dentro do Processo) e as que as extensões acrescentam. As duas são ligadas, desligadas e ordenadas do mesmo jeito, numa lista só, e uma pode ficar entre as outras.
- Quem nunca mexeu nessa configuração continua vendo as abas na mesma ordem de antes.
- Dados, Anotações e Documentos continuam sendo definidos no Form Design da própria tela, como sempre.

#### [9.112.0] — 2026-10-15

- Quem cria extensões com ajuda da IA passa a ver os grupos do menu lateral que já existem, como Agenda, antes de criar um novo. Assim uma extensão nova entra no grupo certo em vez de criar um segundo grupo com o mesmo nome.
- A conferência de uma extensão agora avisa quando ela cria um grupo de menu com o nome de um que já existe, e indica qual usar.

#### [9.111.0] — 2026-10-15

- As automações ganham o gatilho **Ao registrar auditoria**: a cada registro na Auditoria causado por uma pessoa, a automação pode olhar a severidade, a ação e a entidade e decidir o que fazer — por exemplo, mandar um e-mail quando aparece um registro crítico.
- Para que uma automação desse tipo nunca dispare a si mesma em sequência sem fim, o que o próprio sistema e as automações registram na Auditoria não a dispara, e os passos que gravariam de volta na Auditoria — como Registrar Auditoria e Excluir Registro — não ficam disponíveis nela.

#### [9.110.0] — 2026-10-15

- A extensão Brasil passa a oferecer o formato **Número de processo CNJ**: o campo ganha a máscara `0000000-00.0000.0.00.0000` e recusa, já na digitação, um número cujo dígito verificador não confere.
- As regras e automações ganham uma conta de dígito verificador capaz de lidar com números longos, como o do processo CNJ e o IBAN, sem perder precisão.

#### [9.109.0] — 2026-10-15

- Os relatórios agora calculam números a partir de outros números do próprio relatório — taxa de êxito, ticket médio, margem, percentual em aberto —, em cada linha, em cada subtotal e no total geral. A razão deixa de ficar por conta de quem lê.

#### [9.108.3] — 2026-10-15

- As automações agora conseguem buscar um registro diretamente pelo identificador dele — por exemplo, um identificador recebido como parâmetro ou guardado em outro registro. Antes, essa busca voltava sempre vazia.

#### [9.108.2] — 2026-10-15

- Corrigido um problema em que uma automação parava com erro ao ler uma informação de algo vazio — por exemplo, o primeiro item de uma busca que não encontrou nada. Agora essa informação simplesmente vem vazia, nas automações e nas telas.
- Nas fórmulas, a função `if` passou a calcular só o caminho escolhido, como já fazia a forma `? :`, e o caminho descartado não causa mais erro.

#### [9.108.1] — 2026-10-15

- Corrigido um problema em que automações deixavam em branco, sem aviso, informações de um registro vinculado quando elas eram usadas dentro de um mapeamento, de um filtro de busca, de uma exclusão ou de uma condição no meio do fluxo.

#### [9.108.0] — 2026-10-15

- O agente de IA conectado ao escritório agora enxerga também as automações que rodam sozinhas — por horário, por data de um registro ou ao gravar — e responde quando cada uma vai rodar e como foi a última vez, inclusive quando foi pulada e por quê.
- O agente deixa de dar como concluída uma automação que está apenas aguardando um tempo para continuar, e passa a dizer quando ela retoma.
- O agente não trata mais como seguro repetir uma automação que gera documento: cada execução anexa um arquivo novo ao registro.
- Quem escreve extensões a partir de regras de negócio agora pode dizer "ao aprovar, gere o documento", e a verificação recusa os casos em que não haveria registro onde anexá-lo.
- Corrigido um problema que impedia o assistente de autoria de declarar uma espera dentro de uma regra.

#### [9.107.0] — 2026-10-15

- Quem escreve extensões agora declara uma ação que só aciona um gesto da plataforma — copiar link, duplicar, excluir — sem precisar inventar uma automação vazia, e a verificação da extensão avisa quando uma ação não executa nada.

#### [9.106.0] — 2026-10-15

- No Form Design, os gestos da plataforma no card — copiar link, duplicar, etiquetas, gerar documento, excluir — passaram para a aba Ações, marcados como da plataforma, ao lado das ações do escritório. Agora dá para ligar, desligar e reordenar cada um, e o card os mostra na ordem escolhida.

#### [9.105.1] — 2026-10-15

- Corrigida a geração de documentos a partir de modelos em telas como Financeiro, Processos e Contratos: o modelo agora é oferecido no registro e gerado sem o aviso de que a tabela não existe, tanto pelo botão Gerar documento quanto pelas automações.

#### [9.105.0] — 2026-10-15

- As regras que desabilitam uma ação agora valem também nos cartões da listagem, da agenda e das notícias, e não só dentro do registro aberto. O botão desabilitado aparece esmaecido e não pode ser clicado.
- Uma regra de ação passa a dar a mesma resposta no cartão e no registro aberto, inclusive quando a condição envolve um campo ainda não preenchido, uma data ou uma caixa de marcação.
- As ações que funcionam como interruptor (ligado/desligado) mostram o estado atual também nos cartões, com a mesma cor do registro aberto.

#### [9.104.0] — 2026-10-14

- As automações agendadas por horário ou por data agora mostram o "Relógio do servidor": quando ela vai rodar de fato, quando rodou pela última vez (com acesso direto à execução) e, se uma execução foi pulada, o motivo.
- A tela avisa quando a automação está inativa, quando ainda não foi agendada e quando o horário que vai valer difere do que foi salvo, para você não precisar esperar o horário para descobrir.

#### [9.103.1] — 2026-10-14

- Corrigido o horário mostrado ao agendar uma automação: o "Fuso do escritório" e as próximas execuções agora mostram o fuso configurado para o escritório, e não o seu fuso pessoal. Antes, a tela podia prometer um horário diferente daquele em que a automação de fato rodava.

#### [9.103.0] — 2026-10-14

- As ferramentas do escritório saíram do menu do seu usuário e agora ficam no menu lateral, organizadas pelo que fazem: "Personalização" reúne Form Design, Modelos de documento e Extensões; "Automação" reúne Workflows, Scripts, Ações e o Processador de dados; e a Gestão de acessos se juntou a "Administração".
- O menu do seu usuário ficou só com o que é seu: o seu perfil e a aparência do sistema.
- O aviso de extensões com atualização disponível agora aparece direto no item Extensões do menu lateral.

#### [9.102.0] — 2026-10-14

- O menu lateral agora se organiza em grupos com título, que se recolhem com um clique. As telas de administração do escritório — Escritório, Configurações, Traduções e Auditoria — ficam juntas em "Administração", e Calendário e Dias úteis em "Agenda".
- Cada pessoa escolhe quais grupos deixar recolhidos, e a escolha fica lembrada no aparelho. O grupo recolhido continua mostrando a tela em que se está, e o título dele avisa quantas pendências ficaram escondidas.

#### [9.101.0] — 2026-10-14

- O escritório que não instalou o Painel não abre mais numa aba vazia: a área de trabalho começa limpa, e a tela inicial passa a ser a que a extensão instalada indicar.

#### [9.100.3] — 2026-10-14

- Corrigidas as páginas de relatórios montadas pelas extensões, como as do Painel e a Pauta de audiências: os filtros voltam a aceitar datas e seleções sem a página piscar, perder o que foi preenchido ou recarregar os relatórios.

#### [9.100.2] — 2026-10-14

- Corrigida a instalação que deixava de publicar as rotinas de manutenção que se repetem sozinhas em caso de falha. Agora elas sobem no mesmo passo que as demais, sem precisar de nenhuma confirmação manual.

#### [9.100.1] — 2026-10-14

- Corrigida uma falha de segurança em que uma pessoa recém-cadastrada podia receber, por engano, acesso a todos os escritórios do sistema. Agora quem se cadastra tem acesso somente ao próprio escritório.

#### [9.100.0] — 2026-10-13

- Corrigido um problema em que um item do menu, trazido por uma extensão, abria uma aba em branco. Agora a extensão não é aceita enquanto o item não levar a uma página de verdade, e uma aba sem conteúdo explica o que aconteceu e qual extensão a abriu.
- Os itens de menu que abrem uma lista de registros continuam funcionando mesmo quando a tela recebe outro nome ao ser instalada no escritório.

#### [9.99.1] — 2026-10-13

- Corrigida a ordem das listas exibidas dentro de um registro: quando uma extensão define a ordem de apresentação, ela passa a valer em qualquer lista da aba, e não só na que tem filtro.

#### [9.99.0] — 2026-10-13

- Nova extensão "Dias úteis": cadastre um ou mais calendários — nacional, estadual, de um cliente ou de um tribunal — e marque, numa grade com os doze meses do ano, os dias que não são úteis. Basta clicar num dia, ou arrastar para marcar um período inteiro, como um recesso.
- Cada calendário guarda os seus próprios anos, e o botão "Copiar para o próximo ano" começa o ano seguinte com as mesmas datas, prontas para revisar os feriados que mudam de dia.
- As fórmulas dos campos, das automações e dos relatórios agora contam dias úteis: somam dias úteis a uma data, contam quantos há entre duas datas e levam um vencimento para o próximo dia útil, combinando quantos calendários forem necessários.
- Uma contagem nunca sai errada em silêncio: se faltar o calendário ou o ano não estiver cadastrado, o registro não é salvo e o aviso diz exatamente o que precisa ser preenchido.

#### [9.98.0] — 2026-10-13

- A tela de modelos de documento ganhou um guia ao lado do texto: como escrever os campos, formatar datas e valores, repetir listas, incluir trechos sob condição e diagramar o documento, com um atalho para a lista completa de funções.
- Novo botão "Começar pela tela": ele escreve um primeiro modelo a partir dos campos da tela escolhida — datas e valores já formatados, vínculos mostrando o nome do registro ligado e as listas relacionadas em tabelas —, pronto para ser ajustado.

#### [9.97.0] — 2026-10-13

- Agora é possível gerar documentos a partir de um registro — procuração, contrato, recibo, notificação, relatório ao cliente. Escolha o modelo e o formato (PDF ou Word), e o arquivo pronto é anexado à aba Documentos do próprio registro.
- Nova tela "Modelos de documento", no menu do usuário: escreva o modelo em texto, com campos que buscam os dados do registro e dos registros ligados a ele, ou envie um arquivo Word com os mesmos campos. Datas e valores saem formatados no padrão do escritório, e o modelo pode repetir listas, como as parcelas de um contrato.
- Os modelos que vêm com as extensões podem ser personalizados: o escritório edita a própria cópia, e pode voltar ao original ou desligar o modelo a qualquer momento.
- Novo passo "Gerar Documento" nas automações, para produzir e anexar o documento sem ninguém precisar abrir o registro.

#### [9.96.0] — 2026-10-13

- O passo "Notificar" das automações agora entrega o aviso de verdade: escolha se ele aparece no sino, chega por e-mail, vira uma notificação no navegador ou fica registrado na Auditoria — ou tudo isso ao mesmo tempo. Automações que já existiam continuam funcionando exatamente como antes.
- Os avisos podem ser enviados para membros escolhidos, para a pessoa indicada num campo do registro ou para todos que têm uma determinada permissão.
- Novo sino no alto da tela, com o número de notificações não lidas. Um clique abre o registro do aviso, e é possível marcar todas como lidas de uma vez.
- Cada pessoa escolhe, em Configurações › Notificações, por quais canais quer ser avisada. Os avisos chegam no idioma de quem os recebe.
- Nova aba "E-mail" nas configurações do Escritório, para cadastrar uma única vez o servidor de e-mail usado nos avisos, com envio de teste.
- As notificações no navegador podem ser ativadas ou desativadas pelo próprio sino.

#### [9.95.2] — 2026-10-12

- A instalação ficou com um passo manual a menos: a limpeza automática do histórico de auditoria passa a ser configurada pela própria publicação, sem precisar ser ligada à mão no console do Firebase.

#### [9.95.1] — 2026-10-12

- O editor de automações não deixa mais colocar o passo "Esperar" dentro de uma condição ou de uma repetição — lugares onde a espera não funciona. Ao tentar arrastá-lo para lá, um aviso explica onde ele pode ficar.

#### [9.95.0] — 2026-10-12

- O assistente que transforma a descrição de um negócio em extensão passa a entender esperas no meio de uma regra, como "ao faturar, criar o lançamento e, dois dias depois, avisar o cliente", e as transforma em automações com o passo "Esperar".

#### [9.94.0] — 2026-10-12

- O assistente que transforma a descrição de um negócio em extensão passa a entender regras como "avisar três dias antes do vencimento" ou "marcar como atrasado no dia seguinte ao prazo", e as transforma diretamente em automações do tipo "Quando uma data chega".

#### [9.93.0] — 2026-10-12

- As automações ganharam o passo "Esperar": a automação pausa por um tempo — 30 minutos, 4 horas, 2 dias — ou até uma data, e depois continua de onde parou. Na lista de execuções, a automação que está esperando mostra quando vai continuar.
- Se a automação for desligada ou excluída durante a espera, ela não continua: a execução aparece como cancelada, com o motivo.

#### [9.92.0] — 2026-10-12

- As automações ganharam o gatilho "Quando uma data chega": escolha um campo de data da tela — um vencimento, um prazo, uma renovação —, quantos dias antes ou depois e a que horas, e a automação roda sozinha para cada registro quando o dia chega. Se a data mudar, ela roda de novo para a nova data; e um registro criado já no dia certo, depois do horário, roda assim que é salvo.

#### [9.91.0] — 2026-10-12

- As automações ganharam um novo gatilho, "Em um horário": escolha quando ela roda — todo dia às 8h, nos dias úteis, todo dia 5 — e ela acontece sozinha, no fuso do escritório. O editor mostra as próximas execuções para você conferir o horário antes de salvar.
- Uma extensão desativada deixa de rodar as automações dela. Antes, desligar a extensão escondia as telas, mas as automações continuavam acontecendo.

#### [9.90.0] — 2026-10-12

- Campos de texto e parâmetros de automação agora aceitam um tamanho mínimo e um tamanho máximo, configuráveis no Form Design e no editor de parâmetros. Um texto fora do limite é recusado com uma mensagem clara antes de ser gravado.
- O guia de criação de extensões teve vários exemplos corrigidos para que funcionem exatamente como estão escritos.

#### [9.89.0] — 2026-10-12

- Os gráficos dos relatórios passam a separar cada número por uma segunda informação — por exemplo, o total de cada mês dividido por cidade, lado a lado ou empilhado. Quando há mais de uma série, o gráfico mostra a legenda com o nome de cada uma.
- Na tela de criação de relatórios, o gráfico ganhou a opção "Quebrado por", e um relatório que já usava essa divisão deixa de perdê-la ao ser salvo de novo.

#### [9.88.0] — 2026-10-12

- Ao conferir uma extensão antes de instalá-la, relatórios e consultas que citam um campo que nenhuma tela conhecida possui passam a ser apontados, com o nome do campo e da tela. Um nome escrito errado deixa de chegar ao escritório como uma coluna vazia.

#### [9.87.0] — 2026-10-12

- Ao marcar um campo como único — ou declarar uma combinação de campos que não pode se repetir — numa tela que já tem registros, o sistema passa a conferir sozinho os registros antigos. Se nenhum se repete, a regra passa a valer para todos, sem que ninguém precise fazer nada.
- Se algum registro antigo repete um valor, quem administra as telas vê na lista quais valores estão repetidos. Basta corrigir ou excluir os registros repetidos: a regra passa a valer assim que nada mais se repete, e a Auditoria registra o resultado.
- Enquanto isso, um valor repetido digitado num registro novo — ou alterado num antigo — já é recusado, e editar qualquer outro campo de um registro antigo continua funcionando normalmente.
- A mesma conferência acontece quando a forma de comparar os valores muda, por exemplo ao passar a ignorar maiúsculas e minúsculas num e-mail.

#### [9.86.0] — 2026-10-12

- Um campo calculado a partir de outros registros — o total dos itens de um pedido, a data do último contato — passa a ser preenchido também nos registros que já existiam quando ele foi criado ou alterado. Antes, ele ficava vazio nesses registros até que algum item deles mudasse.
- Esse preenchimento acontece sozinho, em segundo plano, e não dispara as automações nem enche a Auditoria com uma linha por registro: fica registrado uma única vez, com o resumo do que foi feito.
- Enquanto o preenchimento acontece, ou se algo impedir que ele termine, a lista da tela mostra um aviso explicando o motivo.
- Corrigido: um campo calculado deixava de ser atualizado quando o novo valor não passava numa regra de validação do próprio campo, e continuava mostrando o valor antigo.

#### [9.85.0] — 2026-10-11

- O "hoje" das regras, automações e relatórios passa a ser o dia do escritório: às 22h em Brasília ainda é hoje, e a tela e a automação concordam sobre a data. Antes, a partir das 21h, o sistema já considerava o dia seguinte.
- O fuso horário em Configurações → Idioma e região agora é escolhido numa lista, com a opção "Automático", que usa o horário de Brasília para escritórios em português do Brasil.

#### [9.84.0] — 2026-10-11

- O assistente de IA conectado ao escritório agora consegue ver os arquivos da aba Documentos de um registro — nome, tipo, quem anexou e o link para abrir.
- O assistente também pode anexar arquivos à aba Documentos, já com o tipo de documento, como se o envio tivesse sido feito pela própria tela. O limite de tamanho é o mesmo do envio manual: menos de 20 MB por arquivo.

#### [9.83.0] — 2026-10-11

- Cada cartão do Calendário agora mostra de onde vem — o ícone e o nome da origem, como Prazo ou Título —, inclusive os itens que já estavam na agenda.
- As extensões podem acrescentar um subtítulo ao cartão e escolher quais informações ele mostra.
- Em Configurações › Calendário, é possível escolher quais origens aparecem na agenda. Desligar uma apenas a esconde: ao religar, tudo volta na hora.
- Com mais de uma origem na agenda, uma nova legenda permite filtrar por origem com um clique.

#### [9.82.1] — 2026-10-11

- A apresentação do Acesso de Agente de IA, na tela de Extensões, agora aparece em português.
- A descrição dos temas deixou de aparecer em inglês.

#### [9.82.0] — 2026-10-11

- A autorização para uma extensão executar código ficou mais clara e elegante: em vez de mostrar o código-fonte, a tela pergunta se você confia no autor da extensão. Ela mostra quem a publicou, se esse publicador é verificado e o que a extensão passa a poder fazer no escritório, para que a decisão seja tomada com segurança.

#### [9.81.0] — 2026-10-10

- Extensões que recebem registros automaticamente, como intimações e e-mails, agora podem deixar esses registros fora da busca rápida (⌘K). Assim, ao procurar um processo ou uma pessoa, os resultados não ficam tomados por itens recebidos. A tela continua aparecendo na busca para ser aberta, e os registros seguem acessíveis normalmente pela lista, pelos links e pelas abas.
- Corrigido um problema em que salvar novamente uma extensão em edição apagava o que ela dizia sobre auditoria (quais ações ficam registradas) e sobre os campos que não podem se repetir.

#### [9.80.0] — 2026-10-10

- A tela de Extensões ficou parecida com uma loja de aplicativos: cada extensão aparece com a própria imagem ou ícone, quantos escritórios já a instalaram e a nota média dada por quem a usa, em estrelas.
- Agora é possível avaliar com estrelas as extensões instaladas no escritório, nos detalhes de cada uma — e mudar ou retirar a avaliação quando quiser.
- Extensões de publicadores confiáveis exibem o selo de verificado ao lado do nome do autor. As que vêm com a própria Microteia já trazem o selo; as de outros escritórios recebem-no quando a equipe da Microteia confirma quem as publica. Também é possível filtrar a lista só pelas verificadas.
- A lista de Extensões pode ser ordenada pelas mais instaladas, pelas mais bem avaliadas ou pelo nome.
- Ao criar ou editar uma extensão, agora dá para escolher o ícone dela e enviar uma imagem que a identifique. Corrigido também um problema em que salvar uma extensão editada apagava o ícone que ela já tinha.
- Extensões importadas de um arquivo agora aparecem com o selo "Importada" e não podem mais ser editadas nem baixadas: o código delas pertence a quem as escreveu. Elas continuam podendo ser ativadas, instaladas e publicadas no catálogo. A tela "Criar extensão" fica reservada para reunir e compartilhar as telas, ações, automações e scripts do próprio escritório.

#### [9.79.0] — 2026-10-09

- Ao preparar a pasta de extensões, o escritório agora informa o próprio namespace (por exemplo, `com.suaempresa`), e toda extensão criada ali — pelo assistente de criação ou pela IA — já nasce com esse prefixo. Basta digitar `cobranca` para obter `com.suaempresa.cobranca`, e o sistema avisa quando uma extensão foge do namespace do escritório.

#### [9.78.0] — 2026-10-09

- O agente de IA conectado ao escritório agora consegue consultar a Auditoria: com a permissão de ler a auditoria, ele responde quem criou, alterou ou excluiu um registro e quando, e quais falhas o sistema registrou — filtrando por período, tipo de alteração, gravidade, registro ou usuário.

#### [9.77.0] — 2026-10-09

- Um campo pode agora mostrar o valor do registro filho mais recente — por exemplo, o resultado da última decisão de um processo ou a data do último contato com um cliente. O valor se atualiza sozinho quando um filho é criado, alterado ou excluído, e volta a ficar vazio quando nenhum filho se encaixa mais.
- No Form Design, a nova operação "Valor do mais recente" permite escolher o campo a copiar e por quais campos decidir qual registro é o mais recente.
- As operações de total no Form Design passam a aparecer traduzidas.

#### [9.76.0] — 2026-10-09

- Uma configuração pode oferecer como opções uma lista do próprio escritório (por exemplo, os status de um cadastro) ou os registros de uma tela (por exemplo, as pessoas). As opções acompanham o que o escritório cria e renomeia, com as mesmas cores da lista.
- Essas configurações aceitam uma ou várias escolhas, que aparecem como etiquetas fáceis de remover, uma a uma.
- Quando uma opção escolhida deixa de existir, a configuração continua mostrando-a, marcada como inexistente, para que ela possa ser removida. Nada some sem aviso.
- Quem não tem permissão para ver a tela de onde vêm as opções vê a configuração bloqueada, com o motivo, em vez de uma lista vazia.
- As seleções múltiplas do formulário ganharam um botão para remover cada item escolhido diretamente na etiqueta, inclusive o que não existe mais.

#### [9.75.1] — 2026-10-08

- Corrigido o exemplo de atualização de dados que acompanha o kit de criação de extensões: ele parava logo no primeiro lote em vez de completar os registros antigos.
- Corrigido o guia de criação de extensões, que ensinava a ler o resultado de uma consulta de um jeito que não funciona.

#### [9.75.0] — 2026-10-08

- Um registro criado ou alterado por uma automação disparada por um botão passa a mostrar quem apertou o botão como autor, com o mesmo nome e foto que apareceriam se a pessoa o tivesse digitado. Antes, ele aparecia sem autor.
- Cada registro passa a guardar por onde foi gravado: na tela, por um assistente de IA em nome de alguém, ou por uma automação sem ninguém por trás. Assim dá para saber o que foi digitado e o que a IA registrou, sem precisar de um campo próprio para isso.
- As automações podem usar o nome de quem as disparou, por exemplo para registrar "quem fez" num histórico, e saber se o pedido veio da tela ou de um assistente de IA.
- Ninguém consegue disparar uma automação em nome de outra pessoa, nem fazer um registro digitado passar por gravado pela IA.

#### [9.74.3] — 2026-10-08

- Ao executar uma automação demorada, a tela não diz mais "Falhou" depois de um minuto de espera. Ela passa a mostrar "Em execução", com um atalho para abrir a execução, e troca sozinha para o resultado real quando a automação termina. Enquanto ela não termina, o botão "Executar novamente" fica bloqueado, para não repetir o trabalho.
- O Processador de Dados segue o mesmo caminho: a etapa de execução continua em andamento após um minuto e é atualizada quando a automação termina.
- Quando não for possível acompanhar a execução, a tela diz exatamente isso, em vez de dar a execução como falha.

#### [9.74.2] — 2026-10-07

- Atualizar uma extensão deixou de poder desligar, em silêncio, as automações de outra que dependem dela: se a nova versão parar de avisar sobre algo que outra extensão acompanha, a atualização é recusada e diz qual extensão ajustar antes.

#### [9.74.1] — 2026-10-07

- Uma extensão agora pode reagir ao que acontece em outra da qual depende — por exemplo, ligar as intimações já recebidas a um processo assim que ele é cadastrado. Antes, esse tipo de automação era recusado na instalação.
- Quando a automação escuta algo que nenhuma extensão instalada oferece, o aviso diz exatamente qual evento falta e, quando dá, qual extensão precisa ser declarada.

#### [9.74.0] — 2026-10-07

- Na lista de registros que pertencem obrigatoriamente a outro — como os prazos dentro de um processo —, cada item agora oferece Excluir, e não mais Desvincular, que não tinha como funcionar.
- Telas de registros filhos que também têm menu próprio voltam a permitir criar registros por ali: o campo que liga ao registro principal só fica escondido quando o formulário é aberto de dentro dele.

#### [9.73.0] — 2026-10-07

- Quem cria extensões ganhou um exemplo pronto de aba dentro de um registro: uma linha do tempo dos marcos de cada projeto, que pode ser copiada como ponto de partida.
- O editor avisa mais cedo quando uma extensão usa um recurso de lista com o nome errado, em vez de a tela simplesmente não funcionar.

#### [9.72.0] — 2026-10-07

- Ações agora podem usar informações do registro relacionado: o botão "Gerar prazo" de um push, por exemplo, já abre com o advogado responsável pelo processo vinculado, sem precisar copiar esse dado para dentro do push.
- Os botões de ação também podem aparecer, sumir ou ficar desabilitados conforme o registro relacionado — e nunca mostram informação de um registro que a pessoa não tem permissão para ver.
- Formulários de ação passam a abrir já preenchidos com o valor padrão definido na automação, quando não há outra informação para o campo.

#### [9.71.0] — 2026-10-07

- Extensões agora podem acrescentar abas próprias dentro de um registro — por exemplo, uma aba de Prazos dentro do Processo, com o visual que a extensão escolher. Elas aparecem depois das abas de sempre, apenas em registros já salvos.
- Em Configurações, a nova seção "Abas do registro" permite ao escritório, e a cada pessoa, escolher quais dessas abas aparecem em cada tela e em que ordem.
- Uma aba que lista registros ligados ao registro aberto já cria os novos com esse vínculo preenchido.

#### [9.70.0] — 2026-10-07

- Ao escolher um usuário do escritório num campo, cada nome agora aparece acompanhado do e-mail, para distinguir pessoas com o mesmo nome. Usuários sem nome cadastrado aparecem pelo e-mail, em vez de uma linha em branco.
- A busca desses campos também encontra o usuário por parte do e-mail.
- Campos que permitem escolher vários registros passaram a mostrar a mesma segunda linha de informação que os campos de escolha única já mostravam.

#### [9.69.0] — 2026-10-07

- Um assistente de IA conectado ao escritório agora consegue saber exatamente o que cada automação espera receber: o nome de cada informação, se ela é obrigatória, quais valores são aceitos e um exemplo. Antes ele precisava adivinhar, por tentativa e erro.
- O assistente também pode consultar o que uma automação faz antes de executá-la — o que ela lê e grava, o que devolve no final e se é seguro executá-la duas vezes — e pode fazer um ensaio, que confere tudo sem gravar nada.
- Uma automação chamada pelo assistente com uma informação de nome errado, ou sem uma obrigatória, agora é recusada antes de começar, com a explicação do que faltou. Antes ela rodava sem aquela informação e terminava como se tivesse dado certo.
- As buscas do assistente por data passaram a funcionar como se espera: pedir os registros "a partir de 01/10" traz os registros daquele dia em diante, inclusive pela data de criação, que antes não trazia nada.
- O assistente passa a enxergar os botões de ação de cada tela e o que cada um pede.
- Corrigido: um relatório restrito a uma permissão específica podia ser aberto por quem não tinha essa permissão. Agora ele só aparece — na lista de Relatórios, na busca rápida e para o assistente de IA — para quem pode vê-lo.

#### [9.68.0] — 2026-10-06

- Escolher o que um agente de IA pode fazer ficou bem mais rápido. As permissões agora aparecem agrupadas por tela, com a lista fechada e uma busca em cima — marcar a tela inteira é um clique, em vez de marcar item por item numa lista enorme.
- Ao marcar "Criar", o "Visualizar" daquela tela é marcado junto, porque criar sem poder ver não funciona por completo. Se a permissão que veio junto for desmarcada de propósito, a tela avisa quem precisava dela, em vez de deixar passar calado.
- Vale nas duas telas: ao emitir um acesso em Agentes de IA e ao autorizar um assistente que está entrando com a sua conta.

#### [9.67.0] — 2026-10-06

- Agora é possível conectar o Claude pela web ao escritório entrando com a própria conta, sem copiar e colar token nenhum. Ao conectar, uma tela pergunta quais permissões aquele assistente pode usar, e o acesso aparece na aba Agentes de IA para ser revogado quando você quiser.
- Cada pessoa que conecta passa a ter o próprio acesso. Antes, um escritório que usasse o Claude na web precisava compartilhar um token só entre todos — e todos agiam com as permissões de quem o emitiu.
- O assistente passa a reconhecer as telas pelo nome que elas têm no escritório. Pedir "liste as Pessoas" funcionava em alguns aplicativos de IA e falhava em outros, que só respondiam ao nome técnico da coleção.

#### [9.66.0] — 2026-09-18

- Retirada do sistema uma máquina de instalação de extensões que não era mais usada por tela nenhuma — ela ficava lendo dados do escritório a cada abertura, sem que nada aparecesse a partir disso. Nenhuma extensão instalada é afetada.

#### [9.65.0] — 2026-09-18

- Ao importar uma extensão, agora se escolhe onde ela fica disponível: só neste escritório ou no catálogo que todos os escritórios navegam. Antes, publicar era um segundo passo que ninguém encontrava — e o catálogo só tinha as extensões que já vinham com o sistema.
- Extensão que traz tela em código só vai ao catálogo pela mão de um administrador do sistema, porque esse código passa a rodar no navegador de cada pessoa de cada escritório que a instalar. Extensão sem código continua indo direto, por quem administra o escritório dono dela.
- O botão "Republicar no catálogo" não fica mais aparecendo quando não há nada a republicar. Ele aparece quando a sua cópia difere da publicada, e diz qual versão vai ao catálogo; se a versão não subiu, ele avisa que precisa subir — quem já instalou a extensão só recebe a novidade quando a versão sobe.

#### [9.64.0] — 2026-09-17

- **Agora dá para anexar vários documentos de uma vez.** Ao clicar em Anexar Documento, é possível escolher quantos arquivos quiser — eles aparecem numa lista, e o tipo de cada um é informado na própria linha antes de confirmar o envio. Dá para escolher mais arquivos sem perder os que já estão na lista, e tirar da lista qualquer um que tenha entrado por engano.
- **Se algum arquivo falhar no envio, só ele continua na lista.** Os que subiram já aparecem entre os documentos do registro; o que não subiu permanece na lista com o tipo que já havia sido informado, pronto para tentar de novo — sem precisar procurar o arquivo outra vez.

#### [9.63.0] — 2026-09-10

- **Um agente de IA passou a poder trabalhar dentro do escritório, com as permissões que cada pessoa liberar.** Até aqui a única forma de pedir ajuda a uma inteligência artificial sobre os dados do escritório era descrevê-los à mão, ou montar automação de clique no navegador. Agora existe a extensão **Acesso de Agente de IA**, que o escritório instala se quiser: quem a ativa recebe um endereço de conexão, e cada pessoa emite o próprio acesso escolhendo quais permissões ele pode usar e por quanto tempo vale. Conectado, o assistente descobre sozinho as telas que o escritório tem e passa a pesquisar registros, cadastrar, alterar, excluir, rodar relatório e iniciar automação — cada uma dessas coisas só quando o acesso a libera.
- **Um acesso nunca pode mais do que a pessoa que o emitiu.** As permissões valendo são sempre o cruzamento entre o que o acesso declara e o que a pessoa tem naquele momento: perder um perfil estreita todos os acessos dela na chamada seguinte, sem precisar mexer em nada. O acesso pode ser revogado a qualquer momento e para de funcionar na hora, e quem cuida dos acessos do escritório vê e revoga os de todos.
- **O que o agente grava passa pelas mesmas conferências da tela.** Formato de campo, obrigatoriedade, cálculo automático, o que não pode se repetir, as automações que disparam, os totais que se recalculam e o registro na Auditoria valem igual, venha a gravação da tela ou do agente. O que só existe num formulário aberto — campo que se esconde por condição, por exemplo — não vale ali, e o próprio agente é avisado disso antes de começar.
- **Corrigida uma mensagem de recusa que aparecia com um trecho em branco.** Quando o servidor recusava uma ação por falta de permissão, a frase chegava à tela sem dizer QUAL permissão faltava — aparecia um marcador cru no lugar do nome dela. Agora a permissão aparece por extenso, e isso vale para toda recusa do servidor que precise nomear algo.
- **Excluir um registro pelas automações passou a apagar também as anotações e os documentos dele.** O passo "Excluir Registro" apagava só o registro, e o que estava pendurado nele ficava sem ninguém que o alcançasse. Agora a exclusão pelo servidor faz a mesma limpeza que a exclusão pela tela sempre fez, inclusive dos arquivos guardados.

#### [9.62.0] — 2026-09-09

- **Quem escreve extensões passou a receber uma coletânea de exemplos prontos, um para cada assunto.** Antes vinham seis, e cinco deles eram extensões nossas reaproveitadas — quem procurava como entregar um relatório, rodar código no servidor ou controlar quem vê o quê não encontrava nada e concluía que não dava. Agora são doze, cada um pequeno e sobre um assunto só: relatórios nos quatro formatos, cartões no painel e marcas na barra, permissões, Cloud Functions, duas extensões que cooperam entre si, um campo acrescentado à tela de outra extensão com a conversão dos dados antigos, aparência, formas de entrar no sistema, atalhos e menções, e configurações. Todos chegam sozinhos na próxima atualização da plataforma.
- **O exemplo de código de servidor passou a ser conferido junto com o resto.** O código das funções de nuvem que ele traz é verificado a cada alteração, com as mesmas exigências do restante do sistema — então o que se copia dali já nasce conferido.
- **O assistente de IA passou a saber o que a plataforma faz e ainda não tem exemplo.** Em vez de concluir do silêncio que algo é impossível, ele agora consulta uma lista conferida automaticamente: o que tem exemplo, o que não tem, e o que nenhum exemplo poderia mostrar porque não está ao alcance de uma extensão — com o caminho que existe no lugar.

#### [9.61.0] — 2026-09-09

- **Um relatório passou a poder filtrar por expressão, e não só por campo.** Até aqui o filtro de um relatório comparava um campo com um valor, e havia pergunta comum que ele não conseguia escrever: os lançamentos em que o pago é menor que o valor, os vencidos em relação a hoje, os que atendem uma condição *ou* outra. Agora existe um campo de expressão no desenho do relatório, igual ao que já se usa para esconder um botão ou validar um campo — com as sugestões dos campos da tela escolhida, inclusive os do cadastro relacionado, e a conferência da expressão enquanto se escreve. Um campo que ninguém preencheu é lido como vazio, e um relatório cuja expressão não puder ser respondida avisa em vez de devolver um total menor sem dizer nada.

#### [9.60.1] — 2026-09-07

- **Corrigido: o assistente de IA voltou a mostrar o nome dos itens de uma extensão, em vez do código interno deles.** Ao listar o que uma extensão deixa disponível para as outras, ele exibia a chave interna do texto no lugar do nome — quem acabara de batizar uma automação via um código em vez do nome que deu a ela. E quando ele apontava um problema de referência dentro de uma automação, deixava de dizer em qual passo estava.

#### [9.60.0] — 2026-09-07

- **O assistente de IA passou a saber o que cada extensão de exemplo faz, e qual delas ler.** As extensões que a Microteia entrega como exemplo ficam ao lado das que o escritório escreve, para servirem de leitura — mas quem pedia ajuda a um assistente tinha de abrir cada uma para descobrir do que ela tratava. Agora ele responde, sobre qualquer extensão, o que ela acrescenta ao sistema, quais telas e listas ela traz, o que ela exige do projeto e o que ela deixa disponível para outras extensões — e diz qual exemplo ler para aprender cada recurso.
- **Corrigido: as extensões de exemplo deixaram de ser tratadas como se fossem do escritório.** O assistente as contava como trabalho do próprio escritório, e o efeito pior era silencioso: uma tela de exemplo passava por cima da tela real, e ele passava a sugerir campos que ninguém tem. Agora ele diz quais são de exemplo, onde estão para ler, e responde sobre o que o escritório de fato tem instalado.

#### [9.59.0] — 2026-09-07

- **O aviso de falha crítica na Auditoria passou a aparecer também no alto da tela.** Ele só existia ao lado de Auditoria no menu, e quem estivesse com o menu recolhido não tinha como notar. No alto da tela ele aparece somente quando há falha não vista, e continua se apagando ao abrir a Auditoria, como sempre.

#### [9.58.0] — 2026-09-07

- **A atualização de uma extensão passou a se anunciar, sem que ninguém precise ir olhar.** Enquanto houver extensão em uso com versão nova à espera, o número delas aparece ao lado de Extensões no menu do usuário e num atalho no alto da tela — e nos dois casos ele só desaparece quando a última atualização é aplicada, porque o que ele conta é uma pendência, não uma notícia. Antes a novidade existia em silêncio: só quem abrisse a tela de Extensões ficava sabendo.
- **Clicar nesse aviso já abre a lista recortada pelo que há para atualizar.** Chegar na lista inteira obrigava a refazer à mão o recorte que o aviso acabou de anunciar. Sem nenhuma atualização à espera, a tela continua abrindo sem recorte nenhum.

#### [9.57.1] — 2026-09-06

- **O manual de quem escreve extensões aprendeu as formas de relatório.** O guia e as ferramentas que um assistente de IA consulta descreviam apenas as formas antigas — quem pedisse um relatório agrupado recebia um resumo, que é outra pergunta. Agora eles dizem qual pergunta cada forma responde, quando um gráfico tem o que desenhar, e o que a instalação em uso de fato executa.

#### [9.57.0] — 2026-09-06

- **"Resumo" e "Cruzado" deixaram de virar de cabeça para baixo.** Eles usavam TODOS os campos declarados como níveis de agrupamento: dez campos escolhidos para serem colunas viravam dez linhas recuadas, uma por campo. Agora o agrupamento é uma escolha própria — "Agrupar as linhas por" —, e vale para as três formas: escolha um campo, ou vários, e a ordem em que escolher é a ordem dos níveis.
- **Os campos que a forma escolhida não mostra passaram a ser ditos.** Um resumo mostra só o que o agrupa, e antes os outros campos simplesmente sumiam da tela sem uma palavra. Agora o relatório diz quais são, e o que fazer com eles.
- **Um resumo sem agrupamento nenhum é recusado, com o motivo.** Antes ele abria dizendo "Nenhum dado" sobre um cadastro cheio — o que parece defeito do dado, e não da forma escolhida.

#### [9.56.0] — 2026-09-06

- **O relatório agora agrupa sem perder as colunas.** Escolher "Agrupado" trocava as colunas por uma linha recuada para cada campo, e os registros desapareciam. Na autoria há agora uma escolha própria — "Agrupar as linhas por" — que mantém as colunas como estão e reúne as linhas sob o valor do campo escolhido, com o total de cada grupo abaixo delas.
- **As seções da autoria passaram a dizer o que fazem.** O que se chamava "Agrupamentos" é "Campos", porque é dali que saem as colunas do relatório; o que se chamava "Dobra" é "Como mostrar". E cada opção diz o que entrega: a lista mostra uma linha por registro, o resumo mostra o total de cada grupo sem os registros, e o cruzado põe um campo nas linhas e outro nas colunas.
- **Um relatório novo já começa como lista.** É a forma cujo resultado se explica sozinho — uma linha por registro, uma coluna por campo —, e as outras continuam a um clique.
- **O gráfico passou a desenhar a lista agrupada também**, com os mesmos números que aparecem na tabela ao lado.
- **A exportação da lista agrupada abre em planilha somando.** O valor do grupo vai repetido em cada linha, numa coluna à frente das outras, em vez de virar um título no meio do arquivo — assim a soma de qualquer coluna continua funcionando, e a planilha reagrupa como quiser.

#### [9.55.1] — 2026-09-06

- **O gráfico do relatório voltou a ser desenhado.** Numa lista simples ele saía como uma moldura vazia ao lado de uma tabela cheia — qualquer que fosse a configuração escolhida. Agora o relatório diz, ali mesmo, que uma lista sem agrupamento não tem o que desenhar, e ensina o caminho: mostrá-lo agrupado ou cruzado.
- **A escolha de "No eixo" passou a valer.** Ao agrupar por dois níveis, o gráfico desenhava sempre o de dentro, e escolher o de fora não mudava nada. Agora o gráfico é desenhado pelo agrupamento escolhido.
- **A moldura vazia deixou de aparecer.** Quando não há o que desenhar — nenhum resultado, nenhum número escolhido, um tipo de gráfico que esta versão não conhece —, o espaço do gráfico simplesmente não é ocupado, e a tabela continua mostrando o mesmo dado.

#### [9.55.0] — 2026-09-06

- **Um agrupamento por data voltou a mostrar a data.** Ao executar o relatório, a coluna de uma data aparecia como um texto sem sentido, e o modelo de apresentação escolhido — por mês, por trimestre, por ano — não tinha efeito nenhum sobre ela. Agora a data aparece como data, e cortada no período que foi pedido.
- **Escolher "Valor exato" no agrupamento por data deixou de impedir que o relatório fosse salvo.** A gravação era recusada com uma mensagem técnica sobre um documento que ninguém tinha aberto — e, uma vez escolhido, não havia mais como voltar para "Por mês" ou qualquer outro período: a opção simplesmente sumia da tela.
- **Salvar duas vezes sem sair da tela deixou de criar um relatório novo a cada vez.** Depois da primeira gravação, cada Salvar seguinte criava uma cópia — e a terceira, uma terceira. Agora o segundo Salvar altera o relatório que acabou de ser criado.
- **Os agrupamentos podem ser reordenados**, arrastando ou pelas setas, como já se faz com os campos no desenho das telas. A ordem deles é a ordem dos níveis e a das colunas do relatório; para trocar dois de lugar, era preciso removê-los e declará-los de novo.
- Corrigida a condição dos filtros que o leitor preenche, que aparecia colada ao nome do campo.

#### [9.54.0] — 2026-09-05

- **Um relatório que mostra só os primeiros de uma lista passou a avisar que está mostrando um recorte.** Quando o agrupamento tem um teto de itens, o total geral continua somando tudo — e as linhas visíveis não fecham com ele. Agora o relatório diz que o resultado é parcial na tela, na planilha e na impressão, como já fazia quando a consulta era grande demais.
- **O relatório passou a dizer o que ele pediu e o sistema ainda não faz.** Antes havia detalhes que podiam ser declarados e simplesmente não aconteciam, sem nenhuma explicação em lugar nenhum; agora cada um deles aparece como aviso ao abrir o relatório.
- Melhorada a documentação de quem cria relatórios por extensão, com o filtro que o leitor preenche, o painel formado por vários gráficos e o que o sistema cobra de permissão em cada consulta.

#### [9.53.0] — 2026-09-05

- **Um relatório passou a poder agrupar e filtrar por um campo do cadastro relacionado mesmo quando a relação aponta para VÁRIOS registros.** Antes só era possível escolher o campo quando o relacionamento apontava para um; escolhê-lo numa relação de vários respondia que era preciso informar a posição do item, e o relatório não abria.
- O valor colhido é o de cada apontado: um agrupamento pela cidade dos participantes reúne as cidades de todos eles, um filtro encontra o registro em que qualquer um dos apontados atende, e uma soma soma o número de cada um.
- Um agrupamento por mês, trimestre ou ano continua valendo quando a data vem de vários apontados — antes o corte pedido era ignorado em silêncio e a data aparecia inteira.
- **O filtro "contém" passou a achar pelo PEDAÇO do texto também quando o campo vem de vários registros apontados.** Filtrar o e-mail do polo ativo por "alex" não trazia nada, apesar de existir `alexnaldo.santos@gmail.com`: ali era preciso digitar o e-mail inteiro, e o relatório vinha vazio sem dizer por quê.
- **"Contém" deixou de diferenciar maiúscula de minúscula** — é como o "contém" das automações sempre funcionou, e responder de dois jeitos à mesma palavra era duas verdades sobre o mesmo filtro.

#### [9.52.0] — 2026-09-05

- **Filtrar um relatório por um cadastro relacionado passou a aceitar VÁRIOS escolhidos, mesmo quando o campo guarda um só.** É a mesma escolha múltipla da barra de filtros das listagens: pergunta-se por "qualquer um destes", e não por um de cada vez.
- O mesmo vale para as listas de opções: escolher três situações traz os registros de qualquer uma das três.

#### [9.51.3] — 2026-09-05

- **Filtrar um relatório por um cadastro relacionado voltou a filtrar.** Escolher a pessoa, o cliente ou o processo apontado não restringia nada: o relatório vinha vazio, sem erro e sem aviso — o que se lê como "não existe nenhum assim". Vale para o filtro fixo do relatório e para o que quem abre preenche.
- **Um campo que aceita vários agora deixa escolher vários no filtro.** Onde o cadastro permite mais de uma pessoa no polo ativo, o filtro pedia uma só; agora aceita quantas quiser, e o relatório traz os registros que tenham qualquer uma delas.
- O mesmo passou a valer para as listas de opções de várias escolhas: filtrar por uma delas não trazia nada.

#### [9.51.2] — 2026-09-05

- **Um relatório sobre um cadastro que aponta para vários outros deixou de mostrar `[object Object]`.** Onde antes aparecia esse código no lugar do dado, aparece agora o nome de cada registro apontado, separados por vírgula — na tela e no arquivo exportado.
- Agrupar um relatório por um campo que aponta para outro cadastro voltou a formar um grupo por apontado. Todos caíam num grupo só, e uma contagem de "quantos diferentes" respondia sempre 1.

#### [9.51.1] — 2026-09-05

- **Exportar um relatório em lista simples deixou de baixar uma planilha vazia.** O arquivo saía só com o cabeçalho, mesmo com a tela cheia de registros; agora leva as mesmas linhas que a tela mostra.
- O total dessa exportação passou a vir num bloco próprio, ao final, com o nome de cada número. Alinhado às colunas do registro, ele cairia debaixo da coluna errada — uma soma lida como se fosse outra coisa.

#### [9.51.0] — 2026-09-04

- Nos relatórios, o valor de um filtro passou a ser pedido **no formato do campo escolhido**: uma data no calendário, um sim/não como caixa de marcar, uma lista de opções na própria lista, e um campo que aponta para outro cadastro no registro apontado — com o nome dele, não com um código. Vale nos dois lugares: no filtro fixo, ao montar o relatório, e nos filtros que quem lê preenche ao abrir.
- O filtro fixo já montado passou a ser lido em palavras. Onde antes aparecia o código do registro, aparece agora o nome pelo qual o escritório o conhece.
- **Um filtro sobre um campo de sim/não passou a funcionar.** Ele era gravado como o texto "sim" e nunca encontrava nada — sem erro, sem aviso, apenas um relatório vazio. Agora a pergunta tem três respostas: sim, não, ou não filtrar por isto.
- **Um relatório que pergunta algo a quem o abre deixou de ser executado antes da resposta.** A tela abre com os filtros à espera e um botão de executar; até então, o relatório era refeito a cada letra digitada e o primeiro resultado cobria tudo — justamente o que quem abriu não queria ver.
- Na barra de filtros do relatório, "Aplicar" e "Limpar" viraram os ícones que o resto do sistema já usa para executar e para limpar.

#### [9.50.0] — 2026-09-04

- O escritório passou a poder fazer perguntas aos próprios cadastros. Em **Relatórios**, escolhe-se o cadastro, por onde quebrá-lo (situação, mês, cidade do cliente) e o que contar ou somar — e o número aparece, com subtotal por grupo e total no fim.
- O relatório pode ser mostrado de três formas: uma lista simples, agrupado com subtotais, ou cruzado — agrupamentos nas linhas e nas colunas ao mesmo tempo, para ver o faturamento de cada situação mês a mês numa tabela só.
- Um agrupamento por data escolhe o período: por dia, semana, mês, trimestre ou ano. O corte respeita o fuso do escritório, então uma venda das nove da noite do dia 31 conta no mês em que ela aconteceu.
- Cada relatório pode trazer um gráfico — barras, linha ou rosca — desenhado a partir dos mesmos números da tabela.
- O resultado sai em CSV, pronto para abrir na planilha com acentos no lugar, e a página imprime só o relatório, sem menu nem barra, para virar PDF pelo próprio navegador.
- **Quando um relatório cobre mais registros do que consegue varrer de uma vez, ele diz isso** — na tela, no cabeçalho do arquivo e no papel. Um número parcial que se apresenta como total é pior que número nenhum.
- Um relatório só aparece para quem pode ler os cadastros que ele cobre — inclusive os alcançados por um campo que aponta para outro cadastro. Agrupar por "cidade do cliente" exige poder ver Clientes.
- Uma extensão pode entregar relatórios prontos, e eles aparecem na lista assim que ela é instalada.
- O relatório pode ter um **filtro fixo** — o que ele sempre cobre, e que quem lê não vê nem muda — e também **filtros que quem lê preenche** ao abrir, como um período. Deixados em branco, eles simplesmente não restringem nada.
- O **gráfico** passou a ser escolhido na própria tela de autoria: barras, colunas, linha, área, pizza ou rosca, com a opção de empilhar os números.

#### [9.49.0] — 2026-09-03

- Um campo que aponta para outro cadastro passou a oferecer o caminho até ele. Ao lado do "x" que limpa a escolha, apareceu uma seta discreta: um clique nela abre o registro escolhido na tela que o apresenta, sem perder de vista o formulário em que se estava. Numa venda, chega-se aos dados do cliente sem procurá-lo de novo pelo menu.
- A seta só aparece quando há mesmo para onde ir — quando alguma tela apresenta aquele cadastro e a pessoa tem permissão para vê-lo. Campos de lista de opções, de lista livre e referências a cadastros sem tela continuam como estavam.
- Quando o campo aceita vários cadastros, cada etiqueta escolhida ganha a sua própria seta: dois clientes selecionados são dois caminhos, um para cada um deles.
- O atalho vale também nos formulários apenas de leitura, que é justamente onde mais se quer consultar o registro apontado, e nos parâmetros de fluxos e ações que pedem um registro — um ou vários.

#### [9.48.0] — 2026-09-03

- Os Termos de Uso e a Política de Privacidade deixaram de pressupor um país. Nenhuma lei nacional é eleita: cada parte cumpre a legislação que se aplica a ela, e o escritório responde pelas exigências da própria jurisdição e daquelas onde estão seus usuários e clientes. Uma controvérsia se resolve, de preferência, no domicílio de quem for demandado.
- O documento passou a dizer com clareza o fato que estava faltando: **a Microteia é instalada no projeto Firebase do próprio escritório**. Uma seção nova explica o que decorre disso — o projeto, a cobrança, as credenciais e a região dos dados são do escritório; registros, arquivos, perfis, auditoria e backups permanecem lá dentro, sob controle exclusivo dele; e quem desenvolve o software não tem acesso permanente à instalação, dependendo do acesso temporário que o escritório conceder quando pedir suporte.
- A seção de proteção de dados foi reescrita nesse mesmo sentido: o software não envia registros, documentos nem estatísticas de uso para fora da instalação, e os dados só chegam a serviços de inteligência artificial, e-mail ou integração que o próprio escritório configurou com as credenciais dele. O escritório é o controlador dos dados: é ele que define o que se coleta e por quanto tempo, identifica as leis de proteção de dados que se aplicam a ele e responde aos pedidos de acesso, correção ou exclusão — porque é o único com acesso à informação.
- A seção de segurança agora separa o que o software entrega (controle de acesso por permissão, isolamento entre escritórios, regras aplicadas no servidor e trilha de auditoria) do que só o escritório pode fazer: proteger as credenciais do projeto, revisar perfis e cortar o acesso de quem sai, avaliar uma extensão antes de instalá-la e manter backups cuja restauração já tenha testado. Investigar e comunicar um incidente cabe a quem opera a instalação.
- A propriedade intelectual ficou explícita: o escritório recebe licença não exclusiva e não transferível para instalar e usar o software na própria operação, sem direito de redistribuir, sublicenciar ou oferecê-lo como serviço a terceiros. E cada instalação passa a carregar a versão dos termos que veio com a versão do software que ela roda.

#### [9.47.0] — 2026-09-03

- Os Termos de Uso e a Política de Privacidade passam a descrever o sistema que a Microteia é hoje: uma plataforma em que cada escritório monta a própria aplicação — telas, coleções, formulários, automações e perfis de acesso — e a estende com extensões que ele mesmo ou outra pessoa criou. A redação anterior ainda prometia um sistema de gestão para escritórios de advocacia, com clientes, processos, prazos e monitoramento de intimações, e nada disso é mais o que o sistema faz por conta própria.
- No mesmo documento, a cláusula de cadastro deixou de citar papéis fixos (admin, advogado, secretaria, usuário) e passou a falar dos perfis de acesso que o próprio escritório cria, das permissões que ele concede e do que fazem, em seu nome, as extensões que instala. A de privacidade descreve o conteúdo que o escritório submete à inteligência artificial em lugar do antigo monitor de e-mails, e a de propriedade intelectual diz que uma extensão criada por terceiro pertence a quem a escreveu.
- A data de última revisão da página foi atualizada, e o texto em português acompanha o original em inglês cláusula por cláusula.

#### [9.46.0] — 2026-09-03

- As extensões passam a poder declarar uma **categoria** — "Tema", "Integração", o que fizer sentido para quem a escreveu. É opcional, aparece ao lado da versão na lista de Extensões, e quem cria uma extensão a informa no campo novo da tela de criação.
- As extensões que vêm com o sistema já chegam classificadas: os temas como Tema, o Calendário como Produtividade, o Painel como Análise, as Notícias como Comunicação, o Brasil como Localização e o pacote de português como Idioma. Duas extensões que escrevem a mesma categoria contam como uma só no filtro, mesmo vindo de autores diferentes.
- A aba "Todas" de Extensões ganhou um filtro completo, com os mesmos recortes das demais telas: por texto, ativa ou inativa, privada ou publicada, do sistema, com código, faz parte do sistema, categoria, com atualização disponível e instalada ou não. Achar uma extensão numa lista que só crescia dependia de percorrê-la inteira.

#### [9.45.0] — 2026-09-02

- No passo de uma automação, o campo que aponta para uma automação ou um script de OUTRA extensão passa a dizer POR QUE não achou o que aponta, quando não acha: a extensão dona não está instalada, está instalada e desligada, está instalada e não oferece aquele item, ou o oferece e o item não veio na instalação. Antes a resposta era sempre "Registro não encontrado", que manda procurar no lugar errado — o item não está entre os do escritório, e nunca esteve.
- Reescolher, nesse mesmo campo, o item que já estava escolhido deixou de trocar o vínculo com a extensão dona por um vínculo com a cópia instalada. O vínculo pela extensão é o que sobrevive à dona ser atualizada ou reinstalada.

#### [9.44.0] — 2026-09-02

- O passo de uma automação passa a ter Descrição: um nome livre, escrito na hora de criar ou de editar o passo, e é ele que aparece no cartão do fluxo. Antes o cartão só mostrava o identificador técnico do passo, e a descrição de um passo antigo, que já vinha escrita, não tinha mais como ser alterada.

#### [9.43.3] — 2026-09-02

- Corrigido o passo "Chamar Workflow": uma automação ou um script trazidos por outra extensão apareciam como "Registro não encontrado", ainda que o passo funcionasse — o campo agora mostra o nome do que ele chama.
- A lista de automações a chamar deixou de oferecer automações inativas. Escolher uma delas produzia um passo que só falhava no dia em que alguém dependesse dele.
- Os parâmetros que recebem uma lista deixaram de aparecer no passo com o rótulo por preencher, no lugar do nome do parâmetro.
- Quando uma automação chamada por outra falha, o motivo passa a aparecer no histórico de quem a chamou. Antes só o resultado aparecia, e descobrir o que houve exigia procurar a execução da outra automação pelo horário.

#### [9.43.2] — 2026-09-02

- Corrigida a mensagem que recusa instalar uma extensão que depende de outra ainda não instalada. Ela chegava à tela com os espaços do texto sem preencher — sem dizer qual extensão falta nem qual item dela é usado —, e o mesmo acontecia com as recusas de publicar, importar e salvar uma extensão, e com as de excluir uma tela. Agora cada uma diz o que aconteceu, com os nomes no lugar.

#### [9.43.1] — 2026-09-01

- Corrigido o aviso da tela de Autoria de extensão, que descrevia qualquer pendência de uma automação como se ela dependesse de outra extensão. Agora cada pendência aparece com a explicação dela — inclusive dizendo qual passo e qual campo estão incompletos.

#### [9.43.0] — 2026-09-01

- As permissões dos membros passam a se recompor sozinhas depois de uma atualização do sistema. Antes, uma atualização que mudasse o que uma permissão exige deixava o escritório com o cálculo antigo até alguém apertar um botão em Configurações — e quem não apertasse ficava com telas que ofereciam o que salvar recusava, sem nenhum aviso ligando uma coisa à outra. O botão "Recalcular permissões" foi removido: quem abrir o sistema primeiro depois da atualização já acerta o escritório inteiro.
- Corrigido um grupo de permissões que aparecia com o texto do sistema no lugar do nome, em Perfis de acesso. Acontecia com as listas de opções e os conjuntos de etiquetas cujo nome é montado a partir do nome da tela.
- Removido um grupo repetido de permissões sobre tipos de documento. Ele podia ser marcado num perfil e não fazia efeito nenhum — quem manda ali é a permissão "Gerenciar tipos de documento", que continua onde estava.

#### [9.42.1] — 2026-09-01

- Corrigida a conferência de uma extensão, que não enxergava o que estivesse dentro de uma repetição ou de uma condição. Uma automação que chamava um roteiro ou outra automação de dentro de um laço passava pela conferência sem nenhum aviso, era instalada, e só falhava na primeira vez que rodasse — no escritório de destino, longe de quem a escreveu.
- Pelo mesmo motivo, o que uma extensão usava de outra também deixava de ser reconhecido quando o uso estava dentro de uma repetição: a extensão saía da mesa com um endereço que só valia no computador de quem a montou, e atualizar a extensão de origem deixava de avisar que outra dependia dela.
- O aviso dessa conferência passa a dizer em QUAL passo está o problema, e não só em qual automação. Num fluxo com vários laços, saber apenas o nome da automação ainda deixava a procura por conta de quem lê.

#### [9.42.0] — 2026-09-01

- Quem monta extensões passa a encontrar, no próprio lugar em que a automação é escrita, a lista do que as outras extensões oferecem para uso — com o nome, o tipo e o endereço já pronto para copiar. Antes essa lista só aparecia nas respostas sobre cadastros e campos, que não é onde a pergunta nasce.
- Duas extensões escritas lado a lado passam a se enxergar. Antes, uma extensão nova só descobria o que a outra oferecia depois que ela já estivesse instalada em algum escritório — o que é justamente o contrário da ordem em que o trabalho acontece.
- A conferência de uma extensão passa a apontar, antes de ela sair da mesa, o uso que aponta para algo que a outra extensão não oferece. Esse erro só era descoberto na hora de instalar, no escritório de destino, onde ninguém tem como corrigi-lo. Quando não há como conferir daqui, a resposta diz isso e o que fazer para conferir — em vez de acusar um problema que não se comprovou.

#### [9.41.0] — 2026-09-01

- Quem monta extensões fora do escritório passa a enxergar o que cada extensão instalada oferece para as outras usarem. Antes era possível saber que a extensão estava instalada, mas não descobrir o nome do que havia dentro dela — e o que não se enxerga não se escreve. O retrato do escritório agora traz essa lista, dizendo o nome e o tipo de cada item.
- Esse retrato continua sem levar nada do que as automações fazem por dentro, nem nada que o escritório digitou: ele descreve o que existe, nunca o conteúdo.

#### [9.40.0] — 2026-08-31

- Ao montar uma extensão, uma automação que usa o script ou o fluxo trazido por outra extensão já pode ser empacotada como está. Antes esse uso virava uma pendência impossível de resolver pela tela, e a saída era duplicar o script dentro da sua extensão.
- A tela de criação de extensão avisa, em destaque, quando o pacote passou a depender de outras extensões, dizendo quais — para que ninguém descubra a exigência só quando outro escritório tentar instalar.

#### [9.39.1] — 2026-08-31

- Atualizar uma extensão não apaga mais, em silêncio, a automação, a ação ou o script que outra extensão instalada estava usando. Quando a versão nova deixa de trazer algo que outra extensão aponta, a atualização é recusada e a mensagem diz qual extensão depende daquilo e onde — para que a escolha de seguir em frente seja de quem administra o escritório, e não uma surpresa na primeira vez que a automação rodar.

#### [9.39.0] — 2026-08-31

- Uma extensão passa a poder usar a automação, a ação ou o script que outra extensão já instalou, em vez de carregar uma cópia própria. Quem publica a extensão escolhe o que fica disponível para as outras; o resto continua sendo só dela.
- A instalação avisa na hora quando a extensão de que a outra depende não está no escritório, em vez de deixar o problema aparecer só quando a automação rodar.
- Quando uma automação chama algo de outra extensão e não encontra, a mensagem passa a dizer de qual extensão se trata.

#### [9.38.3] — 2026-08-31

- As falhas de uma automação passam a dizer o que aconteceu. Uma gravação recusada por regra de campo mostrava apenas "Gravação inválida: {detail}", sem informar campo nem motivo; agora a execução aponta o campo e a razão da recusa, no idioma de quem lê. O mesmo vale para exclusões, consultas, Steps de validação e parâmetros obrigatórios.
- O aviso de campos ignorados numa gravação passa a explicar por que cada um foi descartado, em vez de mostrar um código interno no meio da frase.

#### [9.38.2] — 2026-08-31

- Corrigida a documentação do projeto, que ainda descrevia regras revogadas: os papéis fixos por escritório (que deram lugar aos perfis que o próprio escritório cria), o lugar das Cloud Functions escritas pelo escritório e o nome de um comando de autoria de extensões. Quem seguisse o passo a passo antigo escrevia código num diretório que é substituído a cada atualização.

#### [9.38.1] — 2026-08-31

- Corrigido o subtítulo do cabeçalho de um registro quando o campo escolhido aponta para outro registro ou é uma lista de opções: aparecia o código interno do valor, e não o nome — a mesma listagem já mostrava o nome certo. Vale também para o rótulo da aba aberta.
- Corrigidas as opções de Título e Subtítulo do registro, que sumiam da tela de edição de algumas telas. Bastava a tela não ter nenhum campo de texto obrigatório para os três seletores — título, subtítulo e imagem — desaparecerem juntos.
- O campo de título deixa de exigir que seja obrigatório: qualquer campo de texto pode dar nome ao registro, e o que ficar em branco continua aparecendo como "Sem título".

#### [9.38.0] — 2026-08-30

- Toda versão de extensão que o escritório aplica passa a ficar registrada, e um ícone de histórico na lista de Extensões mostra quais foram — com a versão, quem aplicou e quando. Dali é possível voltar a qualquer uma delas, inclusive depois de desinstalar a extensão: aplicar uma versão do histórico a traz de volta como estava. Antes, uma atualização que atrapalhasse o dia a dia só se desfazia se alguém ainda tivesse guardado o arquivo da versão anterior, e uma desinstalação por engano não se desfazia de jeito nenhum.
- São guardadas as dez últimas versões aplicadas de cada extensão. Excluir a extensão apaga o histórico dela junto; desinstalar, não — é o que permite trazê-la de volta depois.

#### [9.37.3] — 2026-08-30

- Corrigido o exemplo de automação que acompanha o material de autoria: as duas mensagens que ele registrava no histórico pediam o registro por um caminho que não existe, e o fluxo parava com erro ao salvar em vez de concluir. Quem se guiasse por ele escreveria a mesma automação quebrada.
- Corrigida a orientação sobre como uma automação alcança o registro que a disparou. Ela dizia o contrário do que a plataforma faz, e era ela que estava sendo seguida.

#### [9.37.2] — 2026-08-30

- Corrigido um problema que deixava botões de ação permanentemente apagados na tela, mesmo quando o registro estava em ordem para receber a ação. Acontecia com as ações que dependem de mais de uma condição, e não havia nada que a pessoa pudesse fazer para liberá-las.
- Corrigida a leitura de condições de automação escritas com "não": elas eram tratadas como sempre verdadeiras, e o fluxo podia seguir adiante em situações em que deveria parar.

#### [9.37.1] — 2026-08-30

- Corrigido o arquivo de configuração criado no diretório das extensões, que deixava de fora do controle de versão o modelo de domínio, o registro das regras de negócio e o enunciado que deu origem a eles. Eram anotações escritas à mão, e quem clonava o diretório noutro computador não as recebia — a mesma decisão precisava ser tomada de novo, e uma regra alterada não tinha como ser comparada com a versão anterior dela.

#### [9.37.0] — 2026-08-29

- Os ícones das telas, dos menus, das abas e dos botões passaram a ser conferidos antes de uma extensão ser instalada. Antes, um ícone escrito errado não acusava nada: a extensão instalava e o lugar dele aparecia com um marcador genérico, sem explicação.
- Corrigido o ícone do botão de uma das extensões de exemplo, que aparecia como marcador genérico.

#### [9.36.2] — 2026-08-29

- Corrigidas as mensagens de erro do formulário de um registro, que apareciam como código interno em vez do texto: o aviso de campo obrigatório e o de valor recusado por uma regra da tela.
- O aviso que aparece ao tentar salvar passa a dizer o campo e o motivo em linguagem comum, no idioma escolhido.

#### [9.36.1] — 2026-08-29

- Corrigido o título das abas de registros filhos na tela de um registro: a aba mostrava o código interno do texto em vez do nome traduzido da tela.
- A mesma correção vale para o título da janela quando uma dessas telas é aberta por conta própria.

#### [9.36.0] — 2026-08-28

- As telas passam a poder declarar o que NÃO pode se repetir nelas. Um campo ganhou a opção "Único", e com ela o sistema recusa o segundo registro com o mesmo CPF, o mesmo código ou o mesmo e-mail — na hora de salvar, e não depois, num relatório de conferência. Antes não havia como pedir isso: dois cadastros idênticos entravam sem qualquer aviso, e só apareciam quando alguém tropeçava neles.
- A recusa aponta o campo e mostra o valor que já está em uso, para que a correção seja imediata.
- A regra vale por igual em toda porta de entrada — o formulário, a importação e as automações —, inclusive quando duas pessoas salvam no mesmo instante.
- Valores que só diferem na aparência podem contar como o mesmo: espaço sobrando, maiúsculas e minúsculas, ou a pontuação de um documento. A tela escolhe como comparar.
- Uma tela pode exigir que a combinação de vários campos não se repita — o item nº 1 de cada pedido, por exemplo.

#### [9.35.0] — 2026-08-28

- A publicação deixou de ser interrompida por causa do código de uma extensão que já foi desinstalada. Antes, se a pasta de uma extensão removida continuasse no computador de quem publica, o comando parava por inteiro — e nada do sistema ia ao ar — mesmo que aquele código não fosse ser publicado. Agora só a parte com problema fica de fora, e o aviso diz qual é.
- Uma função de servidor que ficou no ar depois de a extensão dona ser desinstalada passa a ser encontrada e removida, mesmo quando o registro dela se perdeu. Antes ela seguia respondendo indefinidamente, sem que nenhum comando a mencionasse.

#### [9.34.0] — 2026-08-28

- Uma função de servidor de extensão passa a recusar quem não é do escritório indicado, além de quem não entrou no sistema. Antes ela ficava acessível a qualquer pessoa com acesso ao sistema, mesmo de outro escritório e mesmo depois de a extensão ser desinstalada — a tela desaparecia, o endereço no servidor não. As funções que as extensões trazem agora nascem com essa verificação.

#### [9.33.0] — 2026-08-28

- Um recurso de servidor usado por várias extensões ao mesmo tempo agora pode dizer para quais delas ele existe. Com isso ele passa a funcionar apenas nos escritórios que têm alguma dessas extensões, e é retirado do ar quando nenhuma delas continua instalada — antes ele ficava ativo indefinidamente, mesmo depois de todas saírem, e nada indicava isso a quem cuida do sistema.

#### [9.32.0] — 2026-08-28

- Uma extensão já podia reagir ao salvamento de um registro apenas no escritório que a instalou; agora o mesmo vale para as rotinas que ela executa em horário marcado. Antes não havia forma correta de escrever uma dessas rotinas: ou ela agia em todos os escritórios do sistema, ou não agia em nenhum. O assistente de criação passa a oferecer essa terceira forma, já pronta.

#### [9.31.0] — 2026-08-28

- A tela de Extensões passa a avisar quando sobrou algo no servidor de uma extensão que ninguém mais tem instalada. Até agora essa informação só aparecia para quem administra o projeto, num terminal — e quem desinstalava a extensão nunca ficava sabendo que ainda havia o que retirar. O aviso diz o que sobrou, quando a verificação foi feita e o que pedir a quem cuida do projeto.

#### [9.30.0] — 2026-08-28

- Corrigida uma falha que podia derrubar por alguns minutos um recurso comum a várias extensões. Quando uma extensão declarava como sua uma função que na verdade é compartilhada por toda a instalação, desinstalá-la retirava aquela função do ar — e com ela o funcionamento das outras extensões que dependiam dela. A situação passa a ser recusada, com a indicação do que ajustar.

#### [9.29.0] — 2026-08-28

- Uma extensão que reage ao salvamento de um registro agora só pode fazê-lo no escritório que a instalou. Antes era possível publicar uma extensão cuja reação acontecia em todos os escritórios do sistema, inclusive nos que nunca a instalaram, e nada avisava — o Console passa a recusar a publicação nesse caso, e a apontar a extensão em que o descuido está.

#### [9.28.0] — 2026-08-27

- As rotinas de servidor que uma extensão traz passam a agir apenas nos escritórios que a instalaram. Antes, uma rotina que reage a gravações agia sobre os dados de todos os escritórios do projeto — inclusive os que nunca instalaram aquela extensão, e o que a desinstalou enquanto outro a mantinha. Nesse último caso a rotina não pode nem ser removida, porque alguém ainda depende dela, e não havia nada que impedisse o efeito.
- A desinstalação passa a valer no ato. Antes, mesmo quando a remoção da rotina era possível, ela só acontecia quando um administrador rodava a manutenção no terminal — minutos ou dias depois de alguém ter clicado em Desinstalar.
- Quem escreve extensões ganha o assistente já preparado para isso: ao criar uma rotina que reage a gravações, ela nasce restrita aos escritórios certos, e a documentação de autoria explica por quê.

#### [9.27.0] — 2026-08-27

- Ao desinstalar uma extensão que trazia rotinas de servidor, essas rotinas passam a ser sempre relatadas como sobra, para que o administrador possa removê-las. Antes, quando a extensão desinstalada era a última do escritório a usar servidor, a sobra não era relatada por ninguém e as rotinas ficavam no ar indefinidamente — e uma rotina que reage a gravações continua reagindo, executando o código de uma extensão que ninguém mais tem.
- O relatório dessas sobras passa a dizer de qual extensão cada rotina era, e quantos escritórios do projeto foram consultados para concluir que ninguém mais a usa. É a diferença entre um aviso que ninguém sabe responder e uma decisão que dá para tomar.
- Nenhuma rotina da própria plataforma, nem de uma extensão que continua instalada, pode ser removida por engano nesse processo. Os dois casos existiam e são agora recusados, com o motivo dito na hora.

#### [9.26.1] — 2026-08-27

- Nada muda no sistema. A alteração é na ferramenta com que publicamos as versões: o comando que põe uma versão nova no ar passou a ter um atalho próprio, ao lado dos que montam os pacotes. Era a última etapa da publicação e a única sem atalho — quem a executava digitava o caminho do programa à mão, numa etapa que se roda de vez em quando e onde um caminho errado só aparece depois.

#### [9.26.0] — 2026-08-27

- O assistente que ajuda a escrever extensões passa a definir sozinho a identidade de cada tela que planeja — e essa era a escolha que mais custava errar. Ela é o que faz uma versão nova de uma extensão ATUALIZAR a tela que já está instalada, em vez de instalar uma segunda parecida ao lado dela e deixar os registros na primeira, sem tela nenhuma para abri-los. O erro não aparecia em lugar nenhum: a extensão instalava, funcionava, e o escritório só descobria ao ver duas telas iguais no menu.
- Uma identidade que já existe nunca é recalculada. Renomear o cadastro, reescrever a regra de negócio ou trocar a forma de calcular a identidade no futuro passam a não mexer no que já foi instalado — e uma extensão que tente levar uma identidade diferente da registrada é recusada, dizendo qual é a correta.
- O registro que guarda "o que esta regra de negócio gerou" passa a ser conferido contra o que existe de verdade, e as divergências são ditas em voz alta: um cadastro que a regra criou e o registro não menciona, ou um que o registro menciona e não existe mais. Era a peça de que a identidade das telas depende, e um registro desatualizado devolvia o mesmo defeito de antes na próxima alteração.

#### [9.25.0] — 2026-08-27

- O assistente que ajuda a escrever extensões passa a desenhar também as TELAS, e por regra em vez de por intuição. Antes ele dizia quais cadastros e campos precisavam existir e parava ali: quem decidia o que aparece na listagem, o que pode ser filtrado e qual campo dá nome ao registro era o assistente, de novo, a cada conversa — e a resposta saía diferente cada vez. Agora um cadastro principal rende listagem e ficha, um cadastro que só existe dentro de outro vira aba dele e nunca ganha entrada de menu, uma lista de opções nunca vira tela, o campo calculado nasce somente leitura e a situação do registro aparece na listagem e no filtro.
- Cada ação que uma pessoa aperta passa a nascer junto com a regra que a desabilita: se a regra de negócio diz "não é possível aprovar sem itens", o botão já chega apagado, com o motivo, em vez de a pessoa apertar e receber a recusa depois.
- E o que a regra NÃO decide passa a ser dito com todas as letras, em vez de sorteado: o ícone da tela, a posição dela no menu e, quando as duas colocações fazem sentido, onde a ação aparece. Um plano que escolhe sozinho parece completo, e o custo aparece quando o escritório recebe um ícone que não tem nada a ver com o negócio dele.
- A regra de negócio que originou tudo passa a ser guardada junto do que ela gerou. É o que faz a próxima versão da mesma regra ser uma comparação com a leva anterior: a mesma regra duas vezes não propõe nada, uma regra alterada propõe só o que mudou, e uma regra que deixou de precisar de um cadastro propõe DESATIVÁ-LO — nunca apagar, porque apagar uma tela é decidir o que acontece com os registros dentro dela.
- Colar uma regra de negócio no editor passa a ser um gesto próprio, com a ordem certa embutida: entender, modelar, conferir, planejar. Era a instrução mais importante do processo e vivia num parágrafo de manual — valia para quem tivesse lido o manual.
- As abas de anotações, documentos e etiquetas passam a nascer desligadas, e ligar uma exige dizer por quê. Três abas ligadas por reflexo são três lugares onde se escreve dado que a regra não pediu, e que meses depois ninguém sabe se devia estar ali.
- Uma automação disparada por botão passa a exigir a frase que a descreve. Sem ela a automação funciona quando alguém aperta o botão e fica invisível para a busca por linguagem natural — o único lugar que a escolheria por conta própria —, e nada na tela mostrava a falta.
- Passou a existir uma lista do que o assistente AINDA NÃO sabe pedir à plataforma, conferida automaticamente. Antes uma capacidade sem vocabulário só era descoberta quando alguém tropeçava nela, meses depois; agora ela aparece na lista no dia em que passa a existir.

#### [9.24.0] — 2026-08-27

- Uma regra de negócio que precisa IMPEDIR alguma coisa passa a ser declarada como tal, e separada da que só precisa avisar. Antes as duas eram escritas do mesmo jeito, e a segunda era o que se instalava: "não é possível faturar sem itens" chegava à tela como um aviso depois do fato, porque a verificação acontecia quando o registro já estava gravado. Agora a que barra vive no caminho da gravação, a que avisa vive na automação, e declarar uma no lugar da outra é recusado com o motivo.
- A situação por que um registro tem de estar passando para uma mudança valer volta a ser conferida de verdade em todos os casos, e não só em alguns — inclusive quando a mudança nasce de um botão, que era justamente onde a conferência não tinha como acontecer.
- Uma exclusão deixa de tentar gravar a situação nova no registro que acabou de ser apagado.
- A conferência para de reclamar de uma situação a que só se chega pelo efeito de outro processo — "ao encerrar a turma, toda matrícula dela fica concluída" era acusada de ser uma situação inalcançável, e é a mais comum que existe.

#### [9.23.0] — 2026-08-27

- O assistente que ajuda a escrever extensões passa a modelar também o que ACONTECE, e não só o que existe. Antes ele desenhava os cadastros e parava ali, esperando que alguém voltasse e pedisse "agora crie a automação" — o pedido que nunca chega, porque quem descreve o sistema já descreveu o comportamento na mesma frase: "a venda nasce em rascunho; ao confirmar, reserva estoque; só o gerente cancela venda faturada".
- Cada situação por que um registro passa, o que o move de uma para outra, quem tem permissão e o que precisa continuar verdadeiro passam a ser declarados junto do cadastro e conferidos pela mesma verificação.
- A conferência pega agora os defeitos que só apareciam meses depois, na tela: uma situação para a qual nada leva, uma de onde nada sai sem ser o fim, uma automação que se dispara em laço a cada gravação e uma regra que compara o NOME da situação em vez da identidade dela — esta última funciona no dia em que é escrita e para de funcionar na primeira vez que alguém renomeia a opção, sem nenhum sinal.
- Uma regra que diga "só o gerente" e não diga o que se pergunta ao gerente deixa de passar. E uma restrição de quem-pode presa a uma automação que ninguém dispara — que nunca teria efeito nenhum — é recusada em vez de instalada.
- O que a plataforma não tem passa a ser dito com o motivo, em vez de ser aceito e silenciosamente esquecido: não há agendamento por relógio, e não há como impedir dois registros com o mesmo código. Nos dois casos a resposta traz o caminho que existe de verdade, e diz o que ele não garante.
- As situações que uma extensão traz passam a viajar com ela como ponto de partida: o escritório recebe a lista pronta, em vez de digitar as opções à mão e descobrir que a primeira letra diferente parou todas as automações.

#### [9.22.0] — 2026-08-27

- O assistente que ajuda a escrever extensões passa a poder enxergar o que o escritório realmente tem. Antes ele só conhecia as extensões em edição na pasta de trabalho e as poucas entidades do próprio sistema: uma tela criada no Form Design e uma extensão já instalada simplesmente não existiam para ele, e a conferência que aponta "este campo pertence a outro cadastro" não tinha como funcionar justamente para os cadastros que mais importam.
- Um comando novo tira o retrato do escritório e o entrega ao assistente: ele lista as telas, as listas de opções, as listas de etiquetas e as extensões instaladas. O retrato fica na pasta de trabalho, não é enviado para lugar nenhum e não acompanha o repositório de código, porque carrega nomes de tela e de campo que o escritório digitou.
- O retrato se anuncia como retrato. O assistente diz de onde veio cada cadastro — do sistema, do trabalho em edição ou do escritório —, quando o retrato foi tirado e o que ele deliberadamente não traz. Passado um tempo sem ser atualizado, ele avisa. Um catálogo apresentado como completo quando não é vale menos do que nenhum.
- Um cadastro que exista dos dois lados resolve pelo que está sendo editado, e a diferença é apenas informada. Sem o retrato, tudo continua exatamente como antes.
- O retrato traz a forma dos cadastros e nada do que foi digitado dentro deles: nenhum registro, nenhuma opção de lista, nenhum membro, nenhuma automação e nenhuma senha saem do escritório.

#### [9.21.1] — 2026-08-27

- A conferência do modelo de domínio reprovava modelos CORRETOS. Três sistemas completos — chamados, clínica e escola — foram escritos do zero e reprovados por quatro campos legítimos: o código do chamado no sistema do solicitante, a anotação que o atendente escreve no próprio chamado, a autorização que o convênio devolveu para aquele atendimento e o número de chamada do aluno naquela matrícula. Nos quatro o dado é de quem o declara, e a conferência confundia "fala sobre" com "pertence a". Ela deixou de reprovar por indício: um campo isolado agora é um aviso, e o que continua barrando é a evidência de verdade — dois ou mais dados de identidade de outro cadastro, ou uma chave de ligação guardada como texto solto.
- Um endereço guardado em campos agrupados era acusado de ser "um conceito sem nome", justamente quando o nome estava declarado e o agrupamento tinha sido feito pela própria plataforma. Não é mais.
- Uma duplicação aprovada com justificativa deixa de ser perguntada a cada conversa. O motivo declarado — "este é o preço cobrado no dia" — passa a ser guardado junto do trabalho e reconhecido depois, em vez de a mesma decisão ser tomada de novo toda vez que alguém retoma o assunto.
- O assistente carrega menos coisa para responder o mesmo: metade do que ele mantinha aberto em toda conversa era consulta que não pergunta nada, e passou a ser material de leitura em vez de ferramenta.

#### [9.21.0] — 2026-08-27

- Quem escreve extensões para o escritório passa a ter uma etapa de modelagem antes da criação das telas. Ao pedir "um sistema de vendas com clientes, vendedores, produtos e vendas", o assistente é obrigado a reconhecer que ali há cinco cadastros que se relacionam — e não uma tela só com o nome do cliente escrito dentro de cada venda, que era o resultado mais provável até aqui e que ninguém percebia até a lista de clientes fazer falta.
- O que sai dessa etapa é conferido por regras fixas, não por opinião: campo que pertence a outro cadastro, um cadastro inteiro copiado para dentro de outro, "Produto 1, Produto 2, Produto 3" no lugar de uma lista de itens, e cópia de valor sem justificativa declarada. Duplicar continua permitido quando há razão — o preço cobrado no dia da venda é o exemplo —, desde que a razão esteja escrita.
- O plano que sai daí é comparado com o que o escritório já tem, e nunca propõe recriar o que existe: ele diz o que é novo, o que já está igual e o que não pode mudar. Excluir tela com registros, retipar um campo já preenchido e alterar o formato de um dado gravado passam a ser recusados com a explicação, em vez de acontecerem por engano.

#### [9.20.0] — 2026-08-26

- A lista de Tipos de Documento aparecia sempre como "Documentos: Tipo", em português, em qualquer idioma. Passa a ser traduzida — e o mesmo vale onde ela é oferecida: no gatilho de automação por lista, no seletor de lista de um campo e no de um parâmetro.
- No assistente de expressões, o que descreve cada sugestão — "Lista", "Objeto", "Lista: …" — também estava em português dentro do programa. Agora acompanha o idioma do escritório.

#### [9.19.5] — 2026-08-26

- No assistente de expressões, o grupo das sugestões de campo aparecia sempre em português, e o nome de cada campo sugerido aparecia como código interno. Os dois passam a acompanhar o idioma do escritório.

#### [9.19.4] — 2026-08-26

- Os gatilhos de automação para notas e documentos de um registro tinham o nome escrito em português dentro do programa — "Ao salvar: Nota de …" — e apareceriam assim para quem usasse o sistema em outro idioma. Passam a ser traduzidos como os demais gatilhos.

#### [9.19.3] — 2026-08-26

- "Membro" era a única entidade do sistema cujo nome estava escrito em português dentro do programa, e por isso aparecia em português mesmo para quem usasse o sistema em outro idioma. Passa a ser traduzida como todas as outras.
- Com isso, o nome de uma entidade também deixa de aparecer como código interno no assistente de expressões e no seletor de entidade de um parâmetro — o que já valia para as telas trazidas por extensões.

#### [9.19.2] — 2026-08-26

- A tela de edição de extensão passa a se comportar como as demais: nome, versão, resumo, descrição e o título de uma view mostram o texto traduzido, e revelam o valor original ao serem editados. O identificador continua como está — ele não é um texto que se lê, é o endereço do pacote.
- A árvore "Conteúdo" dessa tela também deixa de mostrar o código interno da tradução. Ela mistura o que o escritório fez com o que já vem embarcado de outra extensão, e metade dela estava ilegível justamente para quem precisa ler a lista inteira para decidir o que entra no pacote.

#### [9.19.1] — 2026-08-26

- Os campos do Form Design passam a se comportar como o resto do sistema: quando o texto de uma tela ou de um campo vem de uma extensão, o formulário mostra o texto traduzido, e revela o valor original só quando se clica para alterá-lo.
- A lista de campos de uma tela, as confirmações de exclusão de tela e de campo e as etiquetas das opções de uma lista também deixam de mostrar o código interno da tradução.

#### [9.19.0] — 2026-08-26

- Os campos que guardam um texto vindo de uma extensão passam a mostrar o texto traduzido, e não mais o código interno da tradução. Ao clicar no campo para alterá-lo, aparece o valor original — é ele que se está mudando —, e ao sair, o texto volta a ser exibido no idioma do escritório. Assim é possível ler a tela e, ao mesmo tempo, renomear o que se quiser sem apagar sem perceber a tradução dos outros idiomas.
- Vale para o nome e a descrição de uma Automação, o título e a pergunta de confirmação de uma Ação, o nome e a descrição de um Script e o nome de um parâmetro.
- Corrigidos mais três lugares que mostravam o código interno da tradução: a aba Ações do Form Design, os nomes dos parâmetros na tela de Ações e o cabeçalho de cada parâmetro de uma Automação.
- O editor de passos de uma Automação também passa a traduzir os campos e as saídas que vêm do fluxo ou do script chamado.

#### [9.18.1] — 2026-08-26

- Corrigidos os textos de Automações, Ações e Scripts que uma extensão traz traduzidos e que apareciam com o código interno da tradução no lugar do nome: a lista, o título da aba, o nome no topo da tela, a confirmação de exclusão, o ⌘K, a menção num texto e os seletores que oferecem um fluxo ou um script.
- O mesmo valia para os botões de ação de um registro, para a pergunta de confirmação antes de agir e para os campos que uma ação pede antes de disparar — todos passam a mostrar o texto no idioma do escritório.
- A busca dessas telas agora procura pelo nome que se lê na tela. Antes, um fluxo instalado por extensão só era encontrado por quem digitasse o código interno dele — ou seja, por ninguém.
- O Processador de Dados passa a entregar ao modelo a descrição dos fluxos já traduzida. Sem isso, a escolha automática do fluxo era feita a partir de um código interno, e não de uma descrição.
- A etiqueta de situação na lista de Automações e o botão "Carregar mais" da Auditoria voltam a acompanhar o idioma escolhido.

#### [9.18.0] — 2026-08-26

- O login corporativo (SSO) passa a ser possível de fato. Quem instala o sistema pode agora indicar extensões que carregam **antes** da tela de entrada — é por elas que o provedor de identidade da organização aparece ali, ao lado ou em lugar do e-mail e senha.
- Pela mesma via, a tela de entrada pode receber a marca da instalação: um aviso, um logotipo, um texto no rodapé.
- Nada indicado dessa forma executa programação própria: só o que é declarado vale. É o que permite pôr um login corporativo no ar sem que o código de ninguém precise ser revisado.
- Indicar uma extensão para antes do login não é o mesmo que instalá-la para uso interno: são duas decisões, e quem quiser as duas coisas faz as duas.

#### [9.17.0] — 2026-08-26

- A tela de entrada deixou de ter os meios de entrada escritos dentro dela. Isso abre o caminho para o **login corporativo (SSO)**: uma instalação passa a poder oferecer a entrada pelo provedor de identidade da própria organização — Microsoft, Google Workspace, ou um servidor OIDC/SAML próprio — ao lado ou em lugar do e-mail e senha.
- Uma instalação que exige login único pode simplesmente não oferecer e-mail e senha. Quando isso acontece, o formulário, o link de criar conta e o de recuperar senha desaparecem juntos — não há mais senha a criar nem a recuperar.
- A entrada pode agora sair da página e voltar, em vez de abrir uma janela. É o único caminho que funciona quando o navegador da organização bloqueia janelas, dentro de um aplicativo embutido ou de um site em moldura.
- Quando a entrada falha, a tela passa a dizer o que aconteceu em mais casos: janela bloqueada pelo navegador, janela fechada antes de terminar, e-mail já cadastrado por outro meio, meio de entrada não habilitado. Antes, boa parte disso voltava para a tela sem uma palavra.
- A tela de entrada também aceita conteúdo de extensão no topo e no rodapé, como o resto do sistema.

#### [9.16.0] — 2026-08-26

- O menu que se abre sob o seu nome, na barra lateral, deixou de ser uma lista fixa: cada item agora vem do módulo dono da tela que ele abre. Na prática, o menu passa a mostrar exatamente o que este escritório tem — e um módulo removido não deixa mais um item que não leva a lugar nenhum.
- Uma extensão pode acrescentar itens a esse menu, apontando para uma tela dela ou para um endereço externo — o manual do escritório, o portal do cliente, o suporte.
- Seis novas regiões do sistema passam a aceitar conteúdo de extensão: acima e abaixo do menu lateral, nos dois lados da barra do alto e nos dois lados da barra de status do rodapé. É por aí que a instalação ganha a cara do escritório — um aviso, um logotipo, um atalho, um indicador próprio.
- Tudo o que aparece nessas regiões e no menu pode ser ligado, desligado e reordenado em Configurações, pelo escritório e por cada pessoa, como já acontecia com os cartões do painel e as abas das telas.

#### [9.15.0] — 2026-08-26

- Uma automação pode agora decidir sozinha qual outra automação atende um texto que chegou de fora — um e-mail, uma descrição escrita à mão — e executá-la já com os dados extraídos desse texto. É o que a tela de Extrator de Dados faz quando alguém cola o texto, clica em detectar e executa; agora isso cabe dentro de um fluxo, e o fluxo começa sozinho.
- Dois passos novos no construtor de automações: **Detectar Automação**, que lê um texto livre e diz qual automação corresponde a ele, e **Extrair Parâmetros**, que transforma o mesmo texto nos campos que a automação escolhida pede. Não encontrar nenhuma automação não interrompe o fluxo: o passo informa que não achou, e quem montou o fluxo decide o caminho — inclusive mandar para conferência de uma pessoa.
- O passo **Chamar Automação** deixa de exigir que a automação chamada seja escolhida na montagem: ela pode vir do resultado de um passo anterior. Os parâmetros também podem chegar em bloco, prontos, e ainda assim qualquer campo pode ser fixado à mão por cima.
- Os passos de IA usam a conexão de IA padrão do escritório sem que nada precise ser informado. Escolher uma conexão específica continua possível, para quando um passo deve usar um modelo diferente dos outros.

#### [9.14.0] — 2026-08-26

- As extensões Calendário e Notícias aparecem com atualização disponível. Nada muda no que as telas fazem: o conteúdo delas foi reorganizado por dentro, e as contas que elas fazem — em que dia um compromisso aparece, quem já leu um aviso, a ordem de uma discussão — passaram a ser conferidas automaticamente a cada alteração, em vez de dependerem de alguém abrir a tela e olhar.
- Quem escreve extensão no escritório passa a ter um exemplo que segue as próprias regras do manual: as duas telas vêm divididas em partes legíveis, com os testes ao lado, e o Painel continua num arquivo só — porque uma tela que só mostra o que já recebeu não tem o que dividir.

#### [9.13.0] — 2026-08-25

- O manual de autoria de extensões passa a dizer como escrever a parte que precisa mesmo de programação: quando dividir uma tela em arquivos separados, como deixar as regras de cálculo fora da tela para que possam ser testadas em um segundo, e por que cor, tamanho e espaçamento têm de vir do tema — senão a extensão deixa de combinar com o escritório no dia em que ele troca de aparência.
- Uma extensão nova já nasce nessa forma: o assistente que a cria agora entrega a tela dividida, com a regra separada e o teste dela pronto para rodar.

#### [9.12.0] — 2026-08-25

- A publicação da plataforma no Firebase do escritório deixou de reenviar as funções de servidor que não mudaram. Antes, toda publicação subia as vinte e oito, uma a uma, mesmo quando a versão nova só trocou algo na tela — e isso levava dezenas de minutos. Agora a plataforma pergunta ao projeto o que ele já roda e publica apenas o que ficou diferente; quando nada mudou no servidor, a publicação termina em minutos.
- Corrigido um caso em que uma função de servidor escrita pelo escritório para uma extensão continuava rodando a versão antiga do código: ela só era republicada quando mudava de nome ou de configuração, nunca quando o código dela mudava.

#### [9.11.1] — 2026-08-25

- Nova logomarca da Microteia, aplicada também nos ícones que aparecem na aba do navegador e no atalho instalado no celular ou na área de trabalho.
- A frase que acompanha o nome do sistema passa a ser "AI-First Application Platform", que é o que a Microteia faz hoje: criar aplicações de negócio de qualquer área, e não só de advocacia.

#### [9.11.0] — 2026-08-25

- As automações criadas por extensão passam a ser conferidas antes de instalar. Antes, um fluxo com um passo escrito errado era aceito, instalado e simplesmente não rodava — sem aviso nenhum. Agora o problema aparece na hora, dizendo qual passo e o que falta nele.
- Adicionada uma extensão de exemplo, Automação pelo exemplo, que mostra uma automação completa funcionando: um fluxo que dispara ao salvar, uma decisão que separa dois caminhos, uma consulta, uma gravação que não duplica ao rodar de novo e um botão que pergunta antes de executar.
- Corrigido o material de apoio de quem cria extensões: ele descrevia uma espera entre passos que a plataforma não executa, e trazia um exemplo de consulta que não encontrava nada.

#### [9.10.0] — 2026-08-25

- Um campo pode agora ter o valor calculado **no momento em que se olha**, e não no momento em que se salva. É o que faltava para responder "está atrasado?" sem mentir: um campo calculado guarda a resposta do dia em que o registro foi gravado, então algo salvo hoje como "em dia" continuaria "em dia" um ano depois. O valor derivado responde sempre sobre o presente.
- Ao criar ou editar um campo no Form Design, o novo espaço "Valor derivado na leitura" fica ao lado do "Valor calculado", com a orientação de quando usar cada um: se a expressão consulta a data de hoje, é derivado.
- O valor derivado aparece na listagem, no card e no formulário como qualquer outro campo, e pode ser usado em filtro e ordenação. Ele não é gravado — e por isso o Form Design recusa usá-lo onde o valor precisaria estar gravado para não envelhecer de novo, explicando o motivo.

#### [9.9.0] — 2026-08-24

- A Microteia passou a ser distribuída por download. Quem instala não precisa mais receber os arquivos por e-mail ou pen drive: o programa de instalação é obtido por um comando único e ele mesmo busca a versão da plataforma, confere se o arquivo chegou inteiro e só então a coloca no lugar.
- Ao perguntar a versão instalada, o programa de instalação agora avisa quando existe uma versão mais nova disponível, e diz o comando que a traz.
- Corrigido: uma versão da plataforma que exigisse um programa de instalação mais recente removia a versão anterior antes de recusar, e o escritório ficava sem nenhuma. Agora a recusa acontece antes, e o que estava funcionando continua no lugar.
- Corrigido: depois de conectar a instalação ao projeto do escritório, o próximo comando sugerido na tela era um que já não existia — quem o seguia recebia uma recusa logo depois do passo que havia dado certo.

#### [9.8.2] — 2026-08-24

- Corrigido: o aviso de campos por preencher da conexão de IA ficava na tela do escritório depois de a janela ser cancelada. Ele agora aparece dentro da própria janela e sai junto com ela.

#### [9.8.1] — 2026-08-24

- Na Conexão de IA, o modelo passou a ser escolhido numa lista de busca, como o provedor — antes era um campo de texto cujo exemplo ("Ex: gpt-4o") parecia um valor já preenchido, e a conexão era salva sem modelo nenhum. Provedores sem lista conhecida continuam aceitando o nome do modelo digitado.
- Ao salvar uma conexão de IA, os campos obrigatórios que ficaram em branco são apontados um a um, embaixo de cada campo. Antes o botão de salvar apenas ficava desligado, sem dizer o que faltava.

#### [9.8.0] — 2026-08-24

- Cada extensão pode agora trazer os próprios termos de licença. Eles ficam atrás do ícone de licença no cartão da extensão, na tela de Extensões, e podem ser lidos antes de instalar — em português, sempre que quem a criou tiver traduzido.
- Os termos das extensões instaladas e ativas passam a aparecer na própria página de Termos de Uso do escritório, logo abaixo dos termos do Microteia. Desinstalar ou desativar uma extensão a retira dali, porque os termos dela deixam de valer.
- A página de Termos de Uso abre agora como uma aba, sem sair do sistema, e pode ser encontrada pela busca rápida.
- A extensão Notícias já vem com os próprios termos de licença. Quem a tem instalada verá a atualização disponível na tela de Extensões.

#### [9.7.2] — 2026-08-24

- Saiu também do topo dos Termos de Uso a tarja que descrevia o monitor de e-mails e a conferência das intimações — o item correspondente do documento já havia sido removido.

#### [9.7.1] — 2026-08-24

- Os Termos de Uso deixaram de trazer o item sobre o monitor de e-mails, intimações e prazos, e os itens seguintes foram renumerados. Também saiu do rodapé o número de inscrição na OAB do responsável — o contato segue pelo nome e pelo e-mail.

#### [9.7.0] — 2026-08-24

- O manual de autoria que acompanha a instalação passou a descrever tudo o que uma extensão pode declarar: os tipos de campo de uma tela, as relações entre telas, a linguagem das expressões e o que cada uma delas alcança, as automações, as ações e os scripts, e as páginas que se descrevem sem uma linha de programação. Antes ele explicava o formato do pacote e deixava o resto para quem já conhecesse o sistema por dentro — e quem escreve extensão não o conhece, nem tem como.
- Quem escreve extensão com a ajuda de um assistente de IA passa a poder perguntar, ali mesmo, a forma exata de qualquer parte de uma extensão e a lista das funções de expressão que a instalação de fato entende. As respostas saem da instalação instalada, não de uma documentação à parte que pode estar velha.
- O guia deixa claro, pela primeira vez, que uma página entregue como código só aparece depois de a extensão dizer onde ela entra — a causa mais comum de uma extensão instalar direito e a tela simplesmente não estar lá.

#### [9.6.2] — 2026-08-23

- Uma tela criada no Form Design aparecia para todo mundo — no menu lateral, na busca rápida e como aba dentro do registro pai —, inclusive para quem não tem permissão de visualizar os registros dela. Quem clicava chegava a uma lista permanentemente vazia, sem explicação. Agora a tela só é oferecida a quem pode ver o que há dentro dela.
- Quem chega a uma dessas telas por um link recebido ou por uma aba que ficou aberta de ontem, e não tem mais acesso a ela, passa a ler o motivo em vez de encontrar uma lista vazia: um aviso dizendo que falta permissão e que ela pode ser pedida a um administrador.

#### [9.6.1] — 2026-08-23

- Corrigido o aviso da tela de Configurações no modo JSON: quando o documento colado não era um objeto, a explicação aparecia sempre em português, mesmo para quem usa o sistema em outro idioma. Agora ela é traduzida como qualquer outro texto da tela.

#### [9.6.0] — 2026-08-23

- Uma extensão que acrescenta um campo à tela de outra extensão passou a poder dizer o que ler aquela tela exige ler junto. Antes, quem via a agenda sem poder ver processos encontrava o compromisso sem o número do processo ao lado — e não havia como a extensão de Prazos declarar essa ligação sem tomar a permissão da Agenda para si. Agora duas extensões podem complementar a mesma tela, cada uma somando o que traz, sem atropelar a outra nem a dona da tela.
- Uma seção da tela de Configurações passou a poder ficar visível só para quem tem a permissão que ela pede, como já acontecia com telas, itens de menu, painéis e abas. Antes, o que uma extensão colocava em Configurações só podia ficar sob a permissão de configurar o escritório inteiro, ou aberto para todo mundo.
- Corrigido um problema no autocomplete de quem escreve extensões: ele oferecia, nos comandos da busca rápida, uma informação de perfil que o sistema deixou de fornecer quando o controle de acesso passou a ser por permissão — e não oferecia a pergunta de permissão, que é a que vale. Quem seguia o autocomplete escrevia uma comparação que nunca dava certo, sem nenhum aviso.
- Corrigido o manual de autoria de extensões, que ensinava a usar um nome que não existe — quem o seguia à risca não conseguia compilar a extensão.

#### [9.5.0] — 2026-08-23

- A instalação passou a receber, ao lado do arquivo de configuração, o histórico de alterações de cada uma das duas peças que ela usa: a plataforma e o programa que a instala. Os dois são reescritos a cada troca de versão, e cada um vem junto com a peça que ele descreve — então nenhum dos dois pode descrever uma versão que não é a que está ali.
- O guia da instalação e o texto de apresentação da pasta passaram a apontar esses dois arquivos, e a instrução de instalação do programa deixou de citar um comando que não existe mais.

#### [9.4.0] — 2026-08-23

- As regras de segurança do banco passaram a ter testes automatizados: 35 verificações que exercitam as regras de verdade, num banco de mentira, provando que ninguém lê nem grava o que não pode — inclusive tentando burlar. Era a última parte do controle de acesso sem rede de proteção.
- Duas bibliotecas antigas de editor de texto que ninguém mais usava saíram do projeto. Além de peso morto, elas impediam qualquer instalação de dependência de concluir.

#### [9.3.4] — 2026-08-23

- `hasPermission` passa a valer também nas expressões de CAMPO — "Ocultar quando" e "Desabilitar quando" de um campo do formulário —, com o mesmo `<entity>` das ações.

#### [9.3.3] — 2026-08-23

- O guia de autoria de extensões passou a explicar como uma extensão declara as capacidades que traz e como pergunta por elas — inclusive os curingas aceitos. Quem escreve extensão declara o que se pode fazer; quem instala decide quem faz.

#### [9.3.2] — 2026-08-23

- **O dono do escritório volta a poder tudo também dentro das expressões.** Uma ação escrita como `!hasPermission("<entity>.delete")` ficava escondida para o próprio dono: o sistema o deixava passar em toda parte, menos ali. Ele agora carrega o curinga que já tinha no servidor, e a mesma pergunta passa a ter a mesma resposta em qualquer lugar — sem precisar criar um perfil só para ele.
- Pelo mesmo motivo, o dono também deixa de ser barrado ao disparar uma automação ou um script num escritório em que as permissões ainda não foram calculadas.

#### [9.3.1] — 2026-08-23

- **`!` passa a significar "não" nas expressões.** Ele era lido como fatorial: `!hasPermission("...")` valia sempre verdadeiro, o editor aceitava a expressão e ela dizia o contrário do que estava escrito — uma ação escondida sem que nada acusasse o motivo.
- **A mensagem de confirmação de uma ação passa a valer também no cartão da listagem.** Ela só era respeitada no cabeçalho do registro; no cartão a ação disparava direto.
- O texto de ajuda e o exemplo das expressões de ação deixaram de citar o antigo "papel do usuário", que não existe mais, e passam a mostrar `hasPermission("<entity>.update")`.

#### [9.3.0] — 2026-08-23

- **A tela de Perfis de Acesso passou a ser uma tela de permissões.** Em vez de abrir perfil por perfil para descobrir quem concede o quê, a lista mostra todas as permissões — agrupadas por recurso, com o identificador ao lado — e, em cada linha, os perfis que a concedem.
- **Clicar numa permissão abre um painel** com todos os perfis do escritório, onde se vincula e desvincula com um clique. A permissão que outra exige aparece marcada e travada, dizendo quem a exige.
- **A busca encontra por recurso, por permissão e por nome de perfil.** Digitar "Financeiro" mostra tudo o que aquele perfil concede.
- **Criar, renomear e excluir perfis** ficam no botão de perfis, no topo. Um perfil nasce vazio: as permissões dele vêm da lista.

#### [9.2.0] — 2026-08-23

- **A tela agora tem um identificador visível, e você o escolhe.** Ao criar uma tela no Form Design, o campo "Identificador" aparece ao lado dos títulos — é ele que nomeia a coleção e as permissões dela (`pet1.read`, `pet1.create`). Ele acompanha o título no plural até você mexer nele, e não muda depois de criada.
- **A lista de permissões mostra o identificador de cada uma**, ao lado do nome legível. É o texto que se escreve dentro de uma expressão.
- **`hasPermission` aceita curingas.** `<entity>.delete` vira a permissão da tela em que a expressão está sendo avaliada — o que faz a mesma ação servir a qualquer cadastro. Também aceita `*.delete` (qualquer recurso), `pet1.*` (qualquer ação) e `pet%.read` (todo recurso começando por "pet").
- Quando "Recalcular permissões" falha, a tela passa a dizer o motivo em vez de uma mensagem genérica.

#### [9.1.0] — 2026-08-23

- **Os botões somem para quem não pode.** Quem só tem "Visualizar" numa tela deixa de ver o botão de novo registro e o de salvar. Antes eles apareciam, e a recusa só chegava depois do clique.
- **Nova função `hasPermission` nas expressões.** Onde já se escreve uma condição — para esconder uma ação, desabilitar um campo ou ramificar uma automação — agora se pode perguntar `hasPermission("financeiro.create")`. A pergunta é pela permissão, nunca pelo perfil: uma extensão a usa sem saber quais perfis existem no escritório que a instalou.
- A mesma função está disponível nos Scripts como `fn.hasPermission(...)`, e enxerga quem apertou o botão.

#### [9.0.3] — 2026-08-23

- Na tela de Perfis de Acesso, a permissão que vem junto com outra já aparece travada de saída. Antes ela parecia disponível, o clique não a desmarcava — a dependência a mantém — e só então ela ficava cinza: o estado aparecia como resultado do clique, e não antes dele.
- A lista de permissões ganhou um campo de busca. Digitar o nome de uma tela mostra as quatro ações dela; digitar o nome de uma permissão mostra só ela.
- As caixas de seleção da tela passaram a ser as mesmas do resto do sistema.

#### [9.0.2] — 2026-08-23

- **Criar, editar e excluir agora exigem visualizar.** Um perfil com "Criar" e sem "Visualizar" era um perfil que não abria a tela: quem grava precisa poder ler. A dependência passou a ser automática, como as demais — marcar "Criar" traz "Visualizar" junto, assinalado e travado.
- **A tela não fica mais girando quando falta permissão.** Uma listagem sem permissão de leitura carregava para sempre; agora ela responde de imediato, vazia.
- **O dono do escritório volta a poder tudo dentro dele desde o primeiro instante**, sem depender de nenhum cálculo em segundo plano ter rodado antes.
- **As listas de opções e os conjuntos de etiquetas são lidos por qualquer membro.** Eles são o vocabulário que as telas mostram: exigir permissão própria deixava a tela meio carregada para quem tinha acesso ao registro mas não à lista que ele cita. Alterá-los continua exigindo permissão.
- Nova ação **Recalcular permissões**, na aba Perfis de Acesso, para reaplicar os perfis a todos os membros depois de uma atualização do sistema.

#### [9.0.1] — 2026-08-23

- Na tela de Perfis de Acesso, as permissões que vêm junto com a escolhida passam a aparecer com o nome do recurso ao lado. Antes, marcar "Editar financeiro" mostrava "Inclui automaticamente: Visualizar, Visualizar" — duas linhas idênticas que não diziam de quê.

#### [9.0.0] — 2026-08-23

- **Os perfis de acesso agora são seus.** O escritório deixa de escolher entre quatro papéis fixos (Administrador, Advogado, Secretária e Usuário) e passa a criar os próprios: "Financeiro", "Recepção", "Advogado Sênior" — o nome e o conteúdo que fizerem sentido para o escritório. A nova aba **Perfis de Acesso**, em Configurações do Escritório, é onde eles nascem.
- **Ao marcar uma permissão, o que ela precisa vem junto.** Marcar "Editar financeiro" traz sozinho "Visualizar financeiro" e "Visualizar pessoas", já assinalados e explicados na tela. Ninguém precisa saber de cor o que depende do quê, e não há como salvar um perfil pela metade.
- **Cada pessoa pode ter mais de um perfil.** Na aba Membros, os perfis de cada pessoa são escolhidos numa lista de seleção múltipla, e o que ela pode fazer é a soma de todos.
- **Toda tela criada no escritório já vem com as quatro permissões dela** — visualizar, criar, editar e excluir —, sem precisar configurar nada. Extensões trazem as próprias permissões e as descrevem em português.
- **A auditoria registra quem mexeu no acesso.** Criar, alterar e excluir um perfil, e mudar os perfis de uma pessoa, aparecem na Auditoria com severidade alta.
- **O acesso de quem não é do escritório continua barrado no servidor.** Mudar a tela no navegador não abre porta nenhuma: quem decide é a regra do banco de dados, que passou a ler as mesmas permissões.
- Ao instalar a Microteia num ambiente novo, o primeiro usuário que entrar recebe o acesso de sistema, e é ele quem concede esse acesso aos demais.
- O perfil global de Suporte deixou de existir.

#### [8.8.1] — 2026-08-22

- Corrigido o erro que impedia o Form Design de abrir em escritórios que têm etiquetas configuradas em alguma tela. A lista de conjuntos de etiquetas montava o próprio nome em cima de si mesma e a tela caía antes de aparecer.
- Como consequência, um texto do sistema que se referencie em círculo deixa de derrubar a tela: ele aparece por extenso, feio mas visível, e o restante da página continua funcionando.

#### [8.8.0] — 2026-08-22

- O guia que a Microteia instala junto com a área de extensões passa a orientar o assistente de IA a **parar e pedir autorização** quando encontrar algo que a plataforma não faz, mas que deveria fazer: um recurso que não tem nada de específico do seu negócio e que qualquer outra extensão precisaria do mesmo jeito.
- Nesse aviso ele diz o que está faltando, como a plataforma poderia oferecer o recurso, por que ele importa e o que o contorno custaria — e só escreve o contorno depois que você decidir. Foi assim que a leitura da situação do formulário numa expressão de campo quase virou um remendo escondido dentro de uma extensão, em vez de virar um recurso da plataforma.
- Para limitações pequenas ou próprias de uma extensão, nada muda: o contorno continua sendo o caminho normal, sem interromper o trabalho.

#### [8.7.0] — 2026-08-22

- No Form Design, as expressões de Ocultar, Desabilitar e Ao alterar de um campo passam a saber em que situação o formulário está aberto. Escreva `isNew` para dizer "só na edição" e `not isNew` para dizer "só na criação" — é assim que um campo de conferência aparece no cadastro e desaparece depois, ou o contrário. Antes a mesma expressão era aceita sem reclamar e simplesmente nunca valia: o campo aparecia sempre.
- Também passa a valer `isDirty`, que diz se algum campo foi alterado e ainda não foi salvo — útil para travar um campo depois da primeira alteração. As duas são as mesmas já disponíveis nas expressões de um botão de ação, com o mesmo significado: quem aprendeu a escrever uma não precisa aprender outra.
- As duas aparecem como sugestão ao digitar, e apenas nos três lugares onde existem de verdade. Em Validação e Valor calculado continuam fora, porque essas duas também são conferidas no servidor.
- A tradução para português acompanha a mudança.

#### [8.6.0] — 2026-08-22

- Nas listas de opções coloridas, a cor de uma opção cadastrada no escritório passa a poder ser alterada. Ao abrir a lista, ao lado do botão de excluir aparece o de cor: um clique abre a mesma paleta usada nas etiquetas, e a escolha vale na hora, em todos os registros que usam aquela opção. Antes a cor era sorteada na criação e só mudava excluindo a opção e cadastrando outra.
- A tradução para português acompanha o novo botão.

#### [8.5.0] — 2026-08-22

- A publicação passa a avisar quando uma função do servidor ficou para trás numa região antiga. Ao mudar a região, a cópia anterior continua existindo — e, além de impedir a publicação da nova, ela dispara em paralelo: cada gravação era registrada duas vezes na auditoria e contada duas vezes nos totais. A publicação agora identifica essas cópias antes de começar, explica o que está acontecendo e remove as antigas quando solicitado.
- Quando algo falha ao publicar, a mensagem exibida passa a ser o motivo da falha. Antes aparecia sempre um alerta técnico do Firebase sobre um recurso que será descontinuado, sem relação com o problema — e a causa real não chegava à tela.
- A publicação deixa de repetir uma tentativa quando repetir não muda o resultado, encerrando em minutos o que antes levava o dobro do tempo para terminar com o mesmo aviso.

#### [8.4.0] — 2026-08-21

- Atualizar a plataforma deixou de pôr em risco a agilidade das telas trazidas por extensões. Ao trocar
  de versão, a instalação perguntava se podia apagar do banco os atalhos de busca criados para as
  extensões instaladas — inclusive de extensões apenas desativadas, que voltariam a ser usadas. Aceitar
  aquela pergunta tornava lentas as telas dessas extensões. A instalação agora se lembra desses
  atalhos e os preserva sozinha, sem perguntar nada.
- Um atalho que sobrou de uma extensão removida passou a ser sempre informado ao fim da manutenção, com
  o comando exato para descartá-lo quando se quiser. Antes ele deixava de ser mencionado justamente nos
  dois momentos em que mais importava: depois de uma atualização da plataforma e quando era a última
  extensão a sair.
- O registro da instalação passou a dizer a verdade sobre qual versão está em uso: ele guardava a
  anterior no intervalo entre receber uma versão nova e publicá-la, e agora mostra as duas — a que está
  pronta e a que está no ar.
- Ao perguntar a versão pela linha de comando, a resposta passou a incluir a versão da Microteia
  instalada, e não apenas a da ferramenta de instalação.

#### [8.3.1] — 2026-08-21

- Corrigida a assistência do editor a quem escreve uma extensão: ao escrever os estilos de uma tela, as
  cores, espaçamentos, fontes e cantos do tema voltam a ser sugeridos enquanto se digita, e um nome que
  não existe no tema passa a ser apontado na hora, em vez de virar um estilo que simplesmente não
  aparece. Valia tanto para o editor de extensões da própria plataforma quanto para quem escreve num
  editor de código instalado no computador. Quem escreve extensões neste computador recebe a correção
  ao atualizar a plataforma da pasta de extensões.

#### [8.3.0] — 2026-08-21

- Removida a extensão de demonstração "Vendas", que acompanhava o código como amostra de autoria. Ela
  não aparecia na lista de extensões e não podia ser instalada, mas descrevia um cadastro de produtos e
  pedidos ligado a um cadastro de pessoas que já não faz parte da plataforma — uma amostra que ensinava
  o caminho errado a quem a lesse. Os exemplos que continuam disponíveis são os que não pressupõem
  nenhum tipo de negócio em particular.

#### [8.2.0] — 2026-08-21

- O material de apoio de quem escreve extensões — o manual, as regras de trabalho e a configuração do
  editor — passa a ser atualizado junto com a plataforma. Antes ele era escrito uma única vez, quando a
  pasta de extensões era criada, e depois disso continuava descrevendo a versão daquele dia: recursos
  novos não apareciam ali, e quem seguia o manual à risca podia estar seguindo instruções antigas sem
  ter como perceber. Agora cada atualização da plataforma reescreve esse material, e ele reflete o que
  o sistema realmente é capaz de fazer naquele momento — inclusive os limites e a lista de recursos
  disponíveis, que passaram a ser lidos do próprio sistema em vez de copiados à mão.
- A pasta de extensões ganhou um lugar que é do escritório e que nada sobrescreve, para anotar as
  decisões, os nomes e as combinações do próprio negócio. Antes esse arquivo era uma cópia do material
  de apoio: qualquer anotação feita nele se perdia na próxima atualização.
- Os arquivos de configuração dessa pasta passaram a ser respeitados. A atualização apenas acrescenta o
  que faltar para a plataforma funcionar e não altera mais nada — ajustes feitos ali, como outra
  ferramenta registrada ou um atalho próprio, sobrevivem. Quando alguma configuração conflita com o que
  a plataforma precisa, ela é mantida como está e o conflito é apontado, com os dois valores, para que a
  decisão seja de quem escreveu.

#### [8.1.0] — 2026-08-21

- Uma tela entregue por extensão pode agora ser escrita em várias partes, em vez de caber num arquivo
  só. Quem escreve a extensão separa a tela, o comportamento e a aparência como faz no resto do
  sistema, e a plataforma junta as partes na hora de empacotar — o que é instalado continua sendo
  exatamente o mesmo. Erros de junção, como um nome usado duas vezes ou uma parte esquecida de fora,
  passam a ser apontados no momento em que a extensão é construída, e não quando alguém abre a tela.

#### [8.0.1] — 2026-08-21

- Corrigido o botão de atualizar uma extensão no Marketplace, que não fazia nada — sem mensagem, sem
  aviso, sem sinal de que algo havia falhado. Acontecia depois de a instalação provisionar as funções
  de servidor de uma extensão pela primeira vez: o registro de que o servidor já estava pronto ficava
  gravado num formato que a tela lia, mostrava corretamente e depois não conseguia gravar de volta.

> Quem cuida da instalação: use a **ferramenta de instalação 2.1.5**. A partir dela esse registro é
> gravado no formato correto na origem, e não só tolerado na leitura.

#### [8.0.0] — 2026-08-20

- As telas de Pessoas, Contratos, Processos, Prazos, Financeiro, Pushes do Tribunal e o Kanban de
  Processos passaram a ser mantidas pelo próprio escritório, e não mais junto com o sistema. Para quem
  usa, nada muda: as telas, os campos, os filtros, as automações e os registros continuam exatamente
  iguais. O que muda é a velocidade — uma alteração numa dessas telas deixa de esperar uma versão nova
  do sistema.
- Quem cuida da instalação passou a poder escrever Cloud Functions próprias e vê-las publicadas de
  verdade: até aqui elas eram preparadas e nunca subiam. Cada uma pode declarar as bibliotecas de que
  precisa, e as credenciais que ela pede aparecem sozinhas no arquivo de configurações, prontas para
  serem preenchidas.
- Uma tela passou a poder dizer quais alterações dela entram na Auditoria. Serve para a tela cujos
  registros chegam de fora, por integração: sem isso, cada registro recebido gerava um lançamento na
  Auditoria e escondia o que as pessoas de fato fizeram.
- O sistema deixou de pedir as credenciais de e-mail do Google a todo escritório. Elas passaram a ser
  pedidas somente por quem instala o recebimento de intimações, no momento em que o instala.

> **Para quem mantém a instalação:** as sete telas acima agora se instalam como extensão, pela tela de
> Extensões. Depois de instalar o recebimento de intimações, rode o comando de aplicação uma vez — ele
> publica as funções de servidor e cria os índices que ela pede. Até então ela aparece como "Backend
> pendente" e fica fora do menu.
>
> Esta versão **exige a ferramenta de instalação 2.1.0 ou mais nova**, e recusa começar com uma anterior.
> Uma ferramenta antiga preparava as funções de servidor de uma extensão e nunca as publicava, deixando a
> extensão pendente para sempre e culpando o sistema pelo que era um problema da própria ferramenta.
>
> Use a **2.1.4**: nela, os arquivos de teste de uma extensão deixam de entrar no pacote publicado (eles
> derrubavam a publicação de todas as funções, não só das dela), e a troca de versão deixa de falhar de
> vez em quando com um erro de "tabela de arquivos cheia" no meio da cópia.

#### [7.62.0] — 2026-08-20

- Os nomes dos passos de automação — Notificar, Buscar Registros, Gravar Registro, Encerrar Fluxo e os demais — passaram a acompanhar o idioma escolhido no escritório. Antes ficavam sempre em português, mesmo para quem usa o sistema em inglês.
- Os avisos que aparecem no histórico de execução de uma automação também passaram a ser traduzidos: quando uma condição não pode ser avaliada, ou quando a gravação de um registro ignora campos que não podem ser escritos, a explicação vem no idioma de quem lê.
- Vários avisos de erro vindos do servidor passaram a ser traduzidos: ao adicionar ou remover uma pessoa do escritório, ao escolher um apelido, ao consultar ou desconectar uma conta do Gmail, ao acionar a inteligência artificial e ao pedir extração de dados sem escolher uma IA.
- Corrigidos dois avisos do cadastro de membros que apareciam como um código interno em vez do texto: o de limite de membros atingido e o de pessoa já pertencente ao escritório.
- Corrigidos vários rótulos que apareciam como código para quem usa o sistema em inglês — os nomes dos campos de membro, das colunas de listas e dos tipos de dado exibidos nas telas de configuração.
- Traduzidos o rótulo de edição de um filtro salvo e o título da confirmação de exclusão nas listas de opções.

#### [7.61.0] — 2026-08-20

- Toda extensão criada pelo assistente de criação nasce agora com o próprio arquivo de notas de versão, já com a primeira entrada escrita e datada — o histórico de uma extensão passa a existir desde a primeira versão, e não a partir do dia em que alguém sente falta dele.
- As instruções entregues a quem escreve extensões (inclusive a um assistente de IA) passaram a exigir três coisas: subir a versão da extensão e registrar o que mudou a cada alteração, escrever testes sempre que possível, e não dar uma tarefa por concluída enquanto houver teste falhando.

#### [7.60.2] — 2026-08-20

- Na instalação da Microteia no Firebase do escritório, a pasta de exemplos de extensão passou a ser descartada do controle de versão: ela é reescrita a cada atualização do sistema e não é conteúdo do escritório.

#### [7.60.1] — 2026-08-20

- Corrigido: um punhado de avisos e rótulos das telas de Automações, Roteiros, Membros e Escritórios aparecia sempre em português, mesmo com outro idioma escolhido — os avisos de erro ao salvar, mover, reordenar ou excluir um passo, os de criar e excluir um roteiro, os de adicionar e remover um membro e o de atualizar o limite de membros, além dos rótulos "Verdadeiro" e "Falso" das condições, do resumo da repetição e das etiquetas de origem ("Cadastro", "Personalizada", "Lista") nos seletores de registro.
- Corrigido: no seletor de registro dos passos que gravam, consultam, validam ou excluem dados, a opção do próprio Escritório aparecia por um código interno em vez do nome.
- Corrigido: a data de uma execução de automação e a data de criação de um escritório apareciam sempre no formato brasileiro, independentemente do idioma escolhido.
- Corrigido: quando a gravação de todas as configurações de uma vez falhava, o aviso mostrado era um código interno em vez da frase.
- O pacote **Português (Brasil)** ganhou os textos novos; quem já o tem instalado verá a atualização oferecida na tela de Extensões.

#### [7.60.0] — 2026-08-20

- Novo tipo de campo: **Arquivo**. Ao montar uma tela, agora é possível criar um campo que recebe um anexo — uma foto, um documento digitalizado, um PDF — definindo quais extensões ele aceita e o tamanho máximo. O arquivo pode ser escolhido antes mesmo de o registro ser salvo, e a prévia da imagem aparece na hora.
- A imagem de um desses campos pode ocupar o lugar do ícone da tela: basta escolher, na configuração da tela, qual campo de arquivo é a **imagem** dela. A foto passa a aparecer no cartão da listagem e no cabeçalho do registro, e quem ainda não tem foto continua com o ícone de sempre.
- Corrigido: trocar a foto de perfil não funcionava — o envio era recusado sem explicação. As fotos já existentes continuam aparecendo normalmente.
- Corrigido: no Form Design, salvar qualquer ajuste numa tela trazida por extensão apagava, em silêncio, informações internas dela — o endereço da aba do registro, o vínculo com a tela pai e a identidade pela qual a atualização da extensão a reconhece. Telas afetadas voltam ao normal na próxima atualização da extensão.
- Corrigido: os avisos do Form Design, da aba de Documentos e da tela de Perfil apareciam sempre em português, mesmo com outro idioma escolhido.
- Corrigido: um conjunto de etiquetas criado junto com uma tela ficava com o nome preso em português e não acompanhava o nome da tela quando ela era renomeada.

#### [7.59.4] — 2026-08-20

- Corrigido: na tela de Extensões, as extensões ainda não instaladas apareciam com o código interno no lugar do nome, do resumo e da descrição — os textos delas só passavam a existir depois de instaladas, justamente quando já não era preciso escolher. Agora cada extensão é apresentada nas próprias palavras desde a lista, e um pacote de tradução instalado continua tendo a última palavra sobre elas.

#### [7.59.3] — 2026-08-20

- Corrigido: em Configurações, "Restaurar padrão" no idioma e na aparência devolvia o campo ao padrão sem mudar a tela — os textos continuavam no idioma anterior e as cores no tema anterior, e só um novo clique numa outra opção fazia efeito. Agora restaurar o padrão vale na hora, como qualquer outra troca.

#### [7.59.2] — 2026-08-20

- Corrigido: no Form Design, as telas trazidas por extensões apareciam com o código interno no lugar do nome, enquanto as telas do sistema apareciam traduzidas — no mesmo painel. O mesmo acontecia na seção do campo, nos seletores de campo título e subtítulo e na escolha de registros filhos.
- Corrigido: o cabeçalho de uma listagem de extensão mostrava o código interno da tela, mesmo com a aba ao lado exibindo o nome certo.
- Corrigido: em Traduções, uma extensão que traz os próprios textos aparecia como um único idioma, somando as contagens do inglês e do português na mesma linha. Agora cada idioma aparece na sua linha, com a contagem correta.
- Corrigido: na tela de Notícias, o Form Design acusava "Registro não encontrado" no campo de subtítulo. O campo existia — apenas não era oferecido na lista — e o aviso sugeria um defeito onde não havia.

#### [7.59.1] — 2026-08-19

- Corrigido: os formulários e as listagens das extensões mostravam códigos internos no lugar dos nomes dos campos — algo como "@com.microteia.news/field.title" onde devia estar "Título". Acontecia em qualquer extensão cujos textos fossem traduzíveis, tanto em português quanto em inglês.
- Corrigido: o título das telas de registro aparecia em português para quem usa o sistema em inglês ("Novo", "Cadastrar", "Filtrar", "Nenhum registro encontrado"), e o mesmo valia para os avisos de registro salvo. Agora acompanham o idioma escolhido, com o nome da tela no lugar certo da frase.
- Corrigido: a busca rápida (⌘K) não encontrava as telas das extensões pelo nome que aparece na tela, e a lista de tabelas nos passos de automação mostrava o código interno da tela em vez do nome.

#### [7.59.0] — 2026-08-19

- O Calendário, o Painel e as Notícias passam a falar o idioma de quem usa o sistema. As três não são de um ramo específico — toda organização tem uma agenda, uma tela de abertura e um mural —, então cada uma agora chega com o texto em inglês e a tradução para português junto, e mostra um ou outro conforme o idioma escolhido. Antes o português estava preso no próprio programa.
- Nomes de mês e de dia da semana no Calendário, e as datas das notícias e dos comentários, passam a seguir o idioma e o formato do país escolhido.
- A busca do ⌘K encontra "Nova notícia" ou "New item" conforme o idioma em uso, e não só pelo termo em português.
- A apresentação de qualquer extensão na tela de Extensões — o texto explicativo, os quadros e os avisos — passa a poder ser traduzida. Antes só o nome e o resumo eram.
- A extensão de Notícias foi renomeada e, por isso, precisa ser instalada de novo: remova a antiga e instale a nova em Extensões. As notícias e os comentários já publicados continuam guardados e voltam a aparecer.
- Nas listas do Calendário e das Notícias que já existem no seu escritório, os nomes das opções continuam como estão — eles passaram a ser seus no momento em que foram criados, e o sistema não os reescreve. Instalações novas já nascem traduzidas.

#### [7.58.1] — 2026-08-19

- Corrigidos avisos falsos do editor na pasta de extensões: os arquivos apareciam com erros sublinhados mesmo estando corretos — o que gerava e ainda gera dúvida sobre o que é problema de verdade. Agora o editor entende tanto os exemplos que acompanham o sistema quanto as extensões novas, e a verificação de tipos passa limpa em todos.
- Ao criar uma extensão com funções de servidor, as bibliotecas necessárias passam a ser declaradas automaticamente, na versão que a instalação usa.

#### [7.58.0] — 2026-08-19

- A pasta da instalação passa a ser documentada onde faz sentido: um **README** próprio do escritório, criado uma vez e nunca reescrito — para descrever o negócio, renomear o que quiser —, e um **MICROTEIA.md** técnico, refeito a cada atualização, sempre correspondendo à versão instalada. As instruções que antes ficavam escondidas dentro da pasta descartável saíram de lá.
- As extensões que acompanham o sistema passam a vir como **código-fonte**, uma pasta cada, e não mais como arquivo pronto. É a melhor referência para quem vai escrever a sua: dá para abrir, ler e gerar o arquivo final a partir dela.
- Criar uma extensão agora é **guiado por perguntas**: o assistente pergunta o que ela vai ter — uma entidade, uma tela em código, funções de servidor — e gera só isso, sem sobras para apagar. Há também um comando para acrescentar uma função de servidor a uma extensão já existente.
- As funções de servidor escritas pelo escritório ganharam lugar próprio: junto da extensão que as usa, ou numa pasta compartilhada quando servem a várias. Antes ficavam dentro da pasta que é refeita a cada atualização. A publicação agora recusa, com explicação, duas funções de mesmo nome — antes uma substituía a outra em silêncio, e o efeito era uma automação que simplesmente parava de acontecer.

#### [7.57.1] — 2026-08-19

- A instrução de configuração da caixa de intimações apontava para um arquivo que não é mais o certo. Agora o próprio instalador informa o caminho exato do arquivo, resolvido para a sua instalação, em vez de repeti-lo em cada texto — que era o motivo de ele ter ficado desatualizado.

#### [7.57.0] — 2026-08-19

- **Correção importante:** as configurações de servidor que o escritório preenche (como as credenciais do Gmail, usadas pela caixa de intimações) eram apagadas ao instalar uma versão nova do sistema — e, pior, as funcionalidades que dependiam delas voltavam ao ar sem valor nenhum, falhando só na hora do uso. Agora essas configurações ficam guardadas junto do arquivo da instalação, fora da pasta que é refeita a cada atualização, e sobrevivem a qualquer troca de versão.
- A pasta da instalação passa a nascer com a proteção que evita enviar essas credenciais para um repositório por descuido.
- Instalar uma versão nova deixou de obrigar a republicar tudo. Agora são dois passos: primeiro trazer a versão nova, depois publicar só o que mudou — o aplicativo, ou o servidor, ou ambos. Além de ser mais rápido, existe agora um momento entre os dois para preencher uma configuração que a versão nova passou a pedir.
- As mensagens passam a dizer exatamente qual arquivo abrir e onde ele está, em vez de um caminho que podia ser confundido com outro parecido.

#### [7.56.0] — 2026-08-19

- Agora é possível criar extensões próprias escrevendo código no editor, com a mesma comodidade de quem desenvolve o sistema: o pacote de instalação passa a trazer um kit de autoria, e um comando prepara a pasta de trabalho já configurada. Quem preferir continua podendo ajustar o arquivo da extensão à mão — o resultado é o mesmo.
- A pasta criada vem com o manual de autoria, exemplos prontos de todas as extensões que acompanham o sistema, e uma conferência que aponta qualquer problema **antes** de a extensão ser distribuída — a mesma conferência que a instalação faria.
- Um assistente de inteligência artificial no editor passa a poder consultar a própria instalação: o que ela oferece, o que uma extensão pode usar e se o que está sendo escrito é válido. Isso torna viável pedir a ele que escreva uma extensão inteira e conferir o resultado sem instalar nada.
- Correções encontradas ao longo desse trabalho, todas em telas que chegam por extensão: a documentação de várias ferramentas de autoria descrevia campos que não existiam, o que levava a erros silenciosos; e a tela de Financeiro deixou de carregar uma lista que nunca era usada.

#### [7.55.0] — 2026-08-19

- Uma credencial de servidor preenchida depois da instalação passa a valer sozinha: ao rodar o provisionamento, apenas os recursos que dependem dela são atualizados, e nada mais é mexido. Antes, o valor ficava gravado no arquivo de configuração sem chegar a quem precisava dele, e a funcionalidade — o recebimento de intimações por e-mail, por exemplo — falhava só na hora de usar, sem indicar o motivo.
- O mesmo vale para a troca de uma credencial já em uso: basta atualizar o valor e provisionar de novo.
- Corrigida a memória do provisionamento, que esquecia o que já havia sido instalado e, de tempo em tempo, refazia trabalho concluído.

#### [7.54.0] — 2026-08-19

- As extensões passam a poder atualizar os dados que já estão no escritório quando ganham uma versão nova. Até aqui uma atualização mudava a estrutura — telas, campos, automações — mas nunca os registros existentes; agora quem escreve a extensão pode incluir uma rotina que preenche, converte ou corrige o que ficou para trás, e ela roda uma única vez, sozinha, na atualização.
- Enquanto essa atualização de dados não é concluída, a extensão fica visivelmente pendente e sai do ar em vez de funcionar pela metade. Na tela de Extensões, o administrador vê o que falta, o motivo de uma tentativa que não deu certo e o botão "Atualizar dados" para executar de novo.
- Instalar uma extensão pela primeira vez continua instantâneo: como não há dados antigos dela no escritório, não há nada a converter.

#### [7.53.2] — 2026-08-18

- Corrigido o motivo de a versão exibida no rodapé continuar a antiga depois de uma atualização: a página era guardada pelo navegador por até uma hora e, com ela, o programa antigo. Agora a página é sempre reconferida, e apenas as partes que nunca mudam seguem guardadas.
- A atualização passou a **conferir**, ao terminar, se o site já está entregando a versão que acabou de ser publicada — e avisa, com o que fazer, quando ainda não está.
- Quando a publicação de uma função de servidor falha, o motivo aparece na mesma hora, junto do nome dela. Antes a falha era anunciada sem explicação, e o motivo se perdia caso a nova tentativa desse certo.

#### [7.53.1] — 2026-08-18

- Durante a instalação, cada função de servidor passou a ser anunciada **antes** de ser publicada, com o tempo que levou. Antes o nome só aparecia depois de pronta, e como a primeira leva alguns minutos, a tela ficava muda e dava a impressão de ter travado.
- A instalação agora avisa, de antemão, que dois alertas do gerenciador de pacotes são esperados e não impedem nada — um deles sobre a versão do Node e outro sobre pacotes descontinuados do próprio provedor.
- Corrigido um alerta da instalação que aparecia como "package: undefined", por falta de um dado de identificação no pacote das funções de servidor.

#### [7.53.0] — 2026-08-18

- Uma extensão que precise de recursos de servidor — como a de Pushes do Tribunal, que recebe intimações por e-mail — passou a declarar isso por conta própria. Quem instala a Microteia num ambiente novo não recebe mais os recursos de extensões que não usa, e nem precisa preparar as credenciais de e-mail de uma caixa de intimações que talvez nunca vá abrir.
- Na tela de Extensões, uma extensão que ainda depende de um passo no ambiente do escritório passou a exibir o aviso "Backend pendente", explicando o que falta e o comando que resolve. Antes ela simplesmente não aparecia no menu, sem nada que dissesse o motivo.
- Corrigidas duas automações que falhariam ao consultar registros: as buscas por situação e vencimento em Prazos e em Financeiro dependiam de um recurso de banco de dados que nunca havia sido criado.
- Removidos três recursos de banco de dados que não eram mais usados por nenhuma consulta desde que o Financeiro passou a ser uma extensão — eles custavam desempenho em cada gravação.

#### [7.52.0] — 2026-08-18

- Corrigido o erro "sem permissão" ao salvar registros em telas trazidas por extensões que não restringem quem pode gravar — Pessoa, Prazo e Notícias eram as afetadas, e o problema aparecia como falha de permissão mesmo para administradores. As telas que restringem papéis nunca foram afetadas.
- Quem instala a Microteia num ambiente próprio passou a poder levar a ferramenta de instalação para qualquer pasta ou máquina, pronta para uso, em vez de precisar do projeto inteiro.

#### [7.51.1] — 2026-08-18

- A preparação de um ambiente novo passou a avisar, antes de tudo, que o projeto precisa estar num plano pago no provedor — sem isso nenhum dos passos seguintes funciona, e a instalação parava sem explicar o porquê.
- Documentado, para quem mantém o sistema, como gerar uma versão instalável da Microteia e como instalá-la e atualizá-la no ambiente de um escritório.

#### [7.51.0] — 2026-08-18

- A instalação passou a conferir, ao final, se o sistema realmente consegue conversar com o servidor a partir do navegador — e, quando não consegue, diz exatamente qual autorização falta e o que fazer para concedê-la. Antes a instalação terminava dizendo que tudo deu certo e o problema só aparecia depois, ao usar o sistema, na forma de uma falha que não indicava a causa.
- A preparação do ambiente passou a avisar, quando a região escolhida não é a padrão do provedor, que as autorizações precisam existir naquela região.

#### [7.50.0] — 2026-08-17

- As configurações do servidor passaram a ser preparadas automaticamente na instalação, a partir do que o próprio sistema declara precisar. Antes bastava uma configuração ausente para impedir a publicação de todas as automações de servidor de uma vez — inclusive as que nada tinham a ver com ela —, com uma mensagem que não indicava a origem do problema. Numa atualização, configurações novas passam a ser acrescentadas sem apagar o que já estava preenchido.

#### [7.49.3] — 2026-08-17

- A preparação de um ambiente novo passou a avisar, antes de começar, que o armazenamento de arquivos precisa ser iniciado no painel do provedor. Sem esse aviso a instalação parava logo no início, com uma mensagem que não deixava claro o que fazer.

#### [7.49.2] — 2026-08-17

- Corrigido o endereço do ambiente de produção nos comandos de publicação, que apontava para um projeto que não é o em uso. Um dos comandos publicava direto em produção mesmo quando não era pedido; agora ele respeita o ambiente escolhido, como todos os outros.

#### [7.49.1] — 2026-08-17

- Documentado, para quem mantém o sistema, como preparar e instalar a Microteia no ambiente de um escritório.

#### [7.49.0] — 2026-08-17

- A instalação da Microteia no ambiente do escritório passou a ser feita por um comando só, que aplica tudo na ordem certa e informa o endereço de acesso ao final.
- As automações de servidor escritas pelo escritório são preservadas quando o sistema é atualizado: a atualização substitui a Microteia e não encosta no que foi acrescentado.
- A instalação lida sozinha com as duas dificuldades conhecidas de um ambiente recém-criado — a publicação em lotes pequenos, para não esbarrar no limite do provedor, e a segunda tentativa que os ambientes novos exigem enquanto se acomodam. Antes eram passos manuais que só quem já tinha tropeçado neles conhecia.

#### [7.48.0] — 2026-08-17

- O escritório passou a poder preparar a própria instalação e ligá-la ao seu ambiente na nuvem, informando apenas o nome do projeto que já é dele. O acesso continua sendo do escritório: a Microteia não guarda nem pede senha, chave ou credencial de ninguém.
- Ao ligar a instalação, o sistema confere o que precisa estar pronto do outro lado e lista, em linguagem direta, o que só pode ser feito pelo painel do provedor — para que nada seja descoberto no meio da instalação.

#### [7.47.0] — 2026-08-17

- A Microteia passou a poder ser empacotada para instalação. Uma versão do sistema pode ser preparada como um pacote fechado, que leva tudo o que é preciso para funcionar num ambiente próprio — inclusive um espaço reservado para as automações de servidor que o escritório venha a escrever, que sobrevivem às atualizações do sistema.
- O pacote é conferido antes de ser fechado: se por engano ele levar consigo o endereço de outro ambiente, a preparação é interrompida em vez de gerar uma instalação que apontaria para o lugar errado.

#### [7.46.0] — 2026-08-17

- A Microteia passou a poder ser instalada no ambiente do próprio escritório. O sistema agora descobre a que instalação pertence no momento em que abre, em vez de já vir preso a um endereço definido antes da entrega — é o primeiro passo para que cada escritório mantenha a sua própria Microteia, com os seus dados sob o seu controle.

#### [7.45.0] — 2026-08-17

- As abas de trabalho agora têm os cantos de cima arredondados e se ligam à página aberta, como as abas de um navegador. A aba em uso é marcada por um traço da cor do sistema no alto, e as réguas que separavam uma aba da outra saíram.
- As linhas que dividem as áreas da tela ficaram discretas: continuam organizando a interface, mas deixaram de disputar atenção com o conteúdo. A divisória entre painéis lado a lado virou um fio, e ao mesmo tempo ficou mais fácil de pegar com o mouse para arrastar.
- O tema Escuro ganhou profundidade: o fundo é mais fundo e as superfícies acima dele são mais bem separadas, o que deixa a cor de destaque mais viva e o texto mais confortável de ler por muito tempo.
- Os temas do catálogo — Indigo, Claude, Teams, Kindle, Themis e Themis Night — receberam o mesmo tratamento nas divisórias, cada um mantendo as suas cores.
- Botões, campos e menus estão com os cantos mais suaves, e a barra de rolagem deixou de aparecer como um traço largo ao lado das listas.
- O sistema passou a usar uma tipografia própria, com melhor legibilidade em telas e um espaçamento entre linhas mais adequado a listas e formulários.
- Corrigida a legibilidade de textos secundários no tema Claro, que estavam claros demais sobre o fundo.

#### [7.44.0] — 2026-08-17

- O campo de CNPJ saiu do cadastro do Escritório. Ele era um documento de um país só, preso num formulário que vale para qualquer lugar — e agora quem precisa dele o acrescenta em Personalizar Telas, no formato do seu país, junto com a inscrição estadual e o que mais o escritório quiser guardar.

#### [7.43.0] — 2026-08-16

- A tela do Escritório virou uma extensão do sistema — sempre presente e impossível de remover, como as aparências Escuro e Claro. Nada muda de lugar: o que muda é o que ela passa a permitir.
- **O cadastro do escritório agora é personalizável.** Em Personalizar Telas, o Escritório aparece na lista como qualquer outro cadastro: dá para acrescentar campos próprios — a inscrição estadual, o número da OAB, o site —, mudar rótulos e reordenar o formulário. Os campos criados aparecem na aba Dados do Escritório e são gravados junto com os demais.
- **As abas do Escritório deixaram de ser fixas.** Uma extensão pode acrescentar a sua aba à tela, e em Configurações → Tela do Escritório o escritório escolhe quais abas aparecem e em que ordem. Uma aba com problema passa a mostrar um aviso no lugar dela, sem derrubar o resto da tela.
- Os textos do Escritório passaram a viajar com a própria tela, já com a tradução para português — não dependem mais do pacote de idioma para serem lidos. É o caminho que toda extensão vai seguir: nasce em inglês e chega traduzida.

#### [7.42.0] — 2026-08-16

- Os temas passaram a ser extensões. O escritório agora começa com dois — **Escuro** e **Claro** — e escolhe entre eles em Configurações → Aparência, com a opção **Automático**, que segue o modo claro ou escuro do próprio computador e acompanha a troca ao anoitecer.
- É possível criar um tema próprio sem programar: em Extensões, baixe o arquivo do Escuro ou do Claro, abra num editor de texto, troque o nome e as cores que quiser e importe de volta. Ele passa a aparecer na lista, ao lado dos demais.
- Os temas Escuro e Claro fazem parte do sistema: aparecem em Extensões, podem ser baixados, e não podem ser removidos nem substituídos — quem quiser variar cria o seu, que fica ao lado.
- As demais aparências que existiam viraram extensões instaláveis: Indigo, Indigo Claro, Claude, Teams, Kindle, Themis e Themis Noturno. Instale as que quiser, remova as que não usar.
- A preferência de tema passou a acompanhar a pessoa, e não o computador: escolha uma vez e ela vale em qualquer máquina. O escritório também pode definir a aparência padrão para quem nunca escolheu.
- As cores de significado de cada área — o verde de processo procedente, o âmbar de contrato aguardando assinatura, as cores de relação com a pessoa — passaram a vir junto com a área que as usa, inclusive os tons especiais que cada tema mostrava. Instalar ou remover uma área leva as cores dela junto, em todas as aparências de uma vez; um tema novo recebe as cores padrão da área.

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
