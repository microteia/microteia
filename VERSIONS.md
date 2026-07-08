# Notas de Versão — Curatino

> Histórico de novidades, melhorias e correções do Curatino, escrito para quem usa o sistema no dia a dia. Para o histórico técnico de alterações, consulte o log de commits do git.

Cada versão corresponde ao campo `version` de `package.json`. A mais recente fica no topo.

<!-- Nova entrada vai aqui, acima das anteriores, no formato:

#### [0.0.9] — AAAA-MM-DD

- Descrição elegante da mudança, em linguagem simples.
-->

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
