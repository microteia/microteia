import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A raiz do repositório, a partir da localização deste módulo. A profundidade é a mesma compilado
 * (`cli/lib/shared/`) e em teste (`cli/src/shared/`), então um único cálculo serve aos dois.
 */
const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, '..', '..', '..');

/**
 * A raiz do CONSOLE: `cli/` dentro do repositório, e a própria pasta do pacote quando ela é montada por
 * `pack-console`. Vale nos dois porque a profundidade de `shared/` até ela é a mesma (`cli/lib/shared`,
 * `cli/src/shared` em teste, `<pasta>/lib/shared` no pacote) — o mesmo motivo do cálculo acima.
 *
 * É por aqui que o `unpack` acha o `CONSOLE-VERSIONS.md`: o histórico do Console viaja com o binário do
 * Console, e não com o pacote do kernel. Ao contrário de `repoRoot`, este caminho continua verdadeiro
 * fora do repositório.
 */
export const consoleRoot = resolve(here, '..', '..');

/**
 * A versão do CONSOLE, deliberadamente independente do `version` do produto: ela diz o que a
 * ferramenta sabe fazer, e é contra ela que o `minimumCliVersion` do manifesto é conferido. Um
 * pacote novo pode exigir um Console mais novo sem que o número do produto signifique nada aqui.
 *
 * Semver do lado da FERRAMENTA: major quando um comando muda de contrato, minor quando ganha
 * capacidade, patch quando muda o que ele escreve sem que o pacote passe a depender disso. Em
 * `2.0.0`: o `deploy` deixou de aceitar `--kernel` (o pacote passa a chegar pelo `unpack`), e as
 * configurações de backend saíram de `.microteia/` para a raiz da instalação — um Console anterior
 * gravaria a credencial no lugar que o upgrade apaga. `unpack` e `plugin-init` são aditivos e
 * sozinhos pediriam só o minor. Em `2.0.1`: o `.gitignore` da instalação passa a descartar os
 * `examples/`, que o `unpack` reescreve e ninguém versiona. Em `2.0.2`: o `AGENTS.md` e o
 * `AUTHORING.md` que ele escreve passam a cobrar versão, entrada de histórico e teste a cada
 * alteração de extensão. Em `2.1.0`: as Cloud Functions que o ESCRITÓRIO escreve deixam de ser
 * montadas e esquecidas — as de `functions/` sobem no `deploy`, as de `extensions/<plugin>/functions/`
 * sobem pelo provisionamento (e `manifest.backend.functions` pode nomeá-las, que era o que o
 * `create function` já mandava escrever e o `provision` recusava), cada diretório pode declarar as
 * próprias dependências npm, e os `defineString` delas entram no `.env.<projectId>`. Em `2.1.1`: o
 * `extensions/` gerado ganha `npm run sdk:refresh`, porque `npm install` NÃO traz o SDK novo — o
 * caminho do tarball não leva versão e o lock guarda a impressão digital do anterior, então o npm diz
 * "up to date" e o escritório segue escrevendo contra um contrato que a instalação não tem mais. Em
 * `2.1.2`: a recusa de uma function reivindicada passa a nomear as DUAS origens possíveis — o pacote e
 * o `extensions/<pasta>/functions/` do escritório —, porque dizer só "o pacote não a contém" manda
 * procurar no lugar errado justamente no caso mais comum. Em `2.1.3`: a montagem deixa os arquivos de
 * TESTE fora do artefato. O `predeploy` do pacote compila `custom/` com o `tsc`, e um `import` de
 * `vitest` ali é `Cannot find module` — a compilação falha e leva embora o deploy de TODAS as functions,
 * não só das da extensão que trouxe o teste. O `AGENTS.md` manda escrever teste ao lado da function;
 * era este lado que faltava. Em `2.1.4`: o `unpack` preserva `functions/node_modules` MOVENDO em vez de
 * copiando — o `cp` recursivo de ~250 pacotes estourava o limite de descritores do processo no macOS
 * (`ENFILE: file table overflow`), de forma intermitente e apontando um diretório qualquer de dentro de
 * uma dependência. A cópia nunca teve para que existir: a origem é apagada em seguida. Em `2.1.5`: o carimbo
 * `backendState.appliedAt` passou a ser gravado como DATA (`timestampValue`) e não como texto — o
 * `stringValue` chegava à tela como string com o tipo de `Date`, e derrubava o botão de atualizar a
 * extensão na gravação seguinte. Em `2.2.0`: o `sourceFile` de uma view passa a aceitar LISTA, e o
 * `AUTHORING.md` que este Console escrevia ganhou a seção que explica a fusão. Em `2.3.0`: ele deixa de
 * escrever documento nenhum em `extensions/`. `AGENTS.md`, `AUTHORING.md`, `tsconfig.json` e `.mcp.json`
 * descrevem o que o KERNEL sabe fazer, e passaram para o SDK, que viaja no mesmo pacote daquelas
 * capacidades — enquanto saíam daqui, um Console de duas versões atrás escrevia, em silêncio, a
 * documentação de outro contrato. O `plugin-init` semeia e delega; o `unpack` traz o SDK novo e manda
 * ele reescrever, que é o gatilho que não existia: aqueles arquivos eram escritos UMA vez e nunca mais.
 * O refresh do SDK perdeu o `--no-save` que tinha: com ele o pacote novo é extraído e o
 * `package-lock.json` fica no anterior, então o `npm install` seguinte reinstala o antigo e desfaz o
 * refresh — em silêncio, que é justamente o que ele existe para evitar. E instala pelo caminho RELATIVO
 * ao diretório, porque o npm reescreve a dependência com o caminho que recebe, e um absoluto no
 * `package.json` mataria a portabilidade que o relativo existe para dar.
 *
 * Em `2.4.0`: o índice composto de uma extensão passa a sobreviver à troca de kernel. Ele era registrado
 * só no `firestore.indexes.json` de dentro de `.microteia/install/`, que o `unpack` apaga inteiro — e o
 * pacote traz apenas a baseline, porque o que uma extensão reivindica sai dela para não viajar até quem
 * não a instalou. O resultado era o `microteia deploy` PERGUNTANDO, no meio de um upgrade, se podia
 * apagar do projeto o índice de toda extensão instalada; e o aviso de índice órfão, que lia a mesma
 * memória, emudecia justamente ali. A memória mudou para `backend.indexes` do `microteia.yaml`, na raiz,
 * e o `unpack` devolve ao arquivo o que ela lembra antes de qualquer comando poder publicá-lo. No mesmo
 * passo, o `kernel.version` do `microteia.yaml` deixa de mentir entre desempacotar e publicar: ele é
 * gravado pelo `unpack`, e `kernel.deployed` — novo — é o que o `deploy` carimba. E `--version` responde
 * as três, porque quem pergunta a versão quase nunca quer a da ferramenta.
 *
 * Em `2.5.0`: a function que ficou para trás numa região abandonada deixa de travar o deploy em
 * silêncio. Trocar a região de uma Cloud Function não move nada — o Firebase cria a nova e deixa a
 * antiga —, e a partir dali o `firebase deploy --only functions:<nome>` recusa: o filtro `--only`
 * casa por id e ignora região, então a cópia velha entra no plano como algo a apagar, e apagar exige
 * uma confirmação que um deploy sem terminal não tem como dar. O `deploy` e o `provision` agora
 * conferem isso ANTES de subir, e `--prune` remove as cópias. Junto vieram as duas razões de o
 * defeito ter levado tanto tempo para ser lido: o motivo impresso era o aviso de descontinuação do
 * Runtime Config — a única coisa que o `firebase` manda pelo stderr, enquanto o erro sai pelo stdout,
 * e a busca era pela última linha casada —, e a segunda passada repetia as oito functions para
 * receber palavra por palavra a mesma recusa. O aviso virou UMA nota no fim, o motivo passou a ser
 * escolhido por quanto informa, e a repetição ficou só para a falha que repetir pode consertar.
 *
 * Ela NÃO acompanha o `version` do produto, e não é obrigada a andar junto do `MINIMUM_CLI_VERSION`:
 * este último só se move quando o PACOTE passa a depender de algo que o Console faz.
 *
 * **A narrativa acima para na `2.5.0`, e é de propósito.** De `2.6.0` em diante a entrada de cada
 * versão é escrita em `cli/CONSOLE-VERSIONS.md` — em inglês, no modelo do git —, porque aquele arquivo
 * viaja com o Console e chega à raiz da instalação a cada `unpack`. Um histórico dentro de um comentário
 * de código nunca chegou a quem instala. Este bloco fica sendo o que ele já era antes de crescer: a
 * política de semver da ferramenta, mais o registro do que motivou as versões até a `2.5.0`.
 */
export const CLI_VERSION = '2.11.0';
