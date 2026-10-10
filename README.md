# Microteia

Plataforma multi-tenant para **criar aplicações de negócio de forma declarativa**. O núcleo (kernel)
não conhece nenhum domínio: entidades, telas, automações e traduções entram como **plugins e
extensões**, e é isso que permite atender a um escritório de advocacia e a uma loja sem alterar o
núcleo.

Cada organização (tenant) opera isolada: os dados vivem em subcoleções dedicadas no Firestore
(`tenants/{tenantId}/{coleção}/{docId}`). Um usuário pode pertencer a vários tenants e alternar entre
eles após o login.

## Tecnologias

- **Frontend:** React 19 + TypeScript + Vite
- **Estilização:** Styled Components — cor, fonte e espaçamento **sempre** via tema; o tema é uma contribuição de plugin (o núcleo traz `dark` e `light`; os demais vêm do catálogo)
- **Backend:** Firebase (Auth + Firestore + Storage + Functions)
- **Roteamento:** React Router v7
- **Arquitetura:** Clean Architecture + MVVM, sobre um kernel de plugins

## Pré-requisitos

- Node.js 22 — é o runtime das Cloud Functions; use a mesma versão localmente para não divergir do que roda na nuvem
- npm
- Conta Firebase com projeto configurado

## Instalação

1. Clone o repositório:
```bash
git clone <repository-url>
cd microteia
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente. **Não existe `.env` na raiz, e isso é de propósito:** cada
ambiente tem o seu, para que uma variável faltando estoure em vez de cair calada na configuração do
outro projeto.

```bash
cp .env.example .env.dev     # desenvolvimento -> projeto microteia-dev
cp .env.example .env.prod    # produção        -> projeto curatino
```

4. Preencha as credenciais do Firebase de cada ambiente (obtidas com
   `npx firebase apps:sdkconfig web --project <alias>`):

```env
VITE_API_KEY=your_api_key
VITE_AUTH_DOMAIN=your_auth_domain
VITE_PROJECT_ID=your_project_id
VITE_STORAGE_BUCKET=your_storage_bucket
VITE_MESSAGING_SENDER_ID=your_sender_id
VITE_APP_ID=your_app_id
VITE_MEASUREMENT_ID=your_measurement_id
```

A variável `TARGET` escolhe, ao mesmo tempo, o arquivo de ambiente e o projeto Firebase de destino —
`dev` é o padrão em todo comando.

## Executando o projeto

```bash
# Desenvolvimento
npm run dev          # http://localhost:5173 (usa .env.dev)

# Verificação de qualidade (obrigatória antes de commit)
npm run verify       # typecheck (tsc -b --force) + eslint --max-warnings 0
                     # + schemas gerados + extensões + catálogos de mensagens
npm test             # vitest

# Alterou functions/? o gate da raiz NÃO usa o tsconfig (mais estrito) do backend:
npx tsc -b functions

# Build
npm run build              # TARGET=dev por padrão
TARGET=prod npm run build
```

## Deploy (nossos ambientes)

Dois projetos Firebase: `microteia-dev` (desenvolvimento, padrão) e `curatino` (produção). Produção
**nunca** é implícita — exige `TARGET=prod`.

```bash
npm run deploy:hosting          # build + hosting          -> microteia-dev
npm run deploy:rules            # regras Firestore/Storage
npm run deploy:indexes          # índices compostos
npm run deploy:functions        # todas as Cloud Functions
npm run deploy:functions:individual   # uma a uma (o lote estoura a quota de CPU)

TARGET=prod npm run deploy:hosting    # -> curatino
npm run deploy:prod                   # tudo, em produção
```

Regras e índices são **código versionado** (`firestore.rules`, `storage.rules`,
`firestore.indexes.json`): nunca edite pelo Console — o próximo deploy sobrescreve a regra e apaga o
índice não declarado.

Para instalar a Microteia no Firebase de um cliente, o caminho é outro — ver a seção seguinte.

## Distribuição — gerar o pacote e instalar no Firebase do escritório

O deploy acima publica **no nosso** Firebase (`microteia-dev` ou `curatino`). Esta seção é o outro
caminho: a Microteia instalada no projeto Firebase **do escritório**, mantido por ele.

São dois lados, e nenhum comando atravessa a fronteira entre eles:

| Lado Microteia (este repositório) | Lado escritório (máquina de quem instala) |
|---|---|
| `microteia pack` → pacote versionado, **compilado** | `npm i -g @microteia/console` → o instalador |
| `microteia publish` → release + catálogo + npm | `microteia init` → cria a instalação |
| nunca vê o `projectId` do cliente | `microteia connect` → liga ao Firebase dele |
| | `microteia unpack --version latest` → baixa e confere |
| | `microteia deploy` → instala/atualiza |

O `firebase login` é sempre do escritório: o Console não implementa autenticação própria e não guarda
credencial de ninguém.

### O Console (CLI)

O Console é o 4º projeto TypeScript do repositório (`cli/`), compilado para `cli/lib` — que é
gerado, não versionado. Depois de `npm install`:

```bash
npm run build:cli            # compila cli/ -> cli/lib
npx microteia --help         # ou: node cli/lib/index.js --help
```

| Comando | Lado | Para quê |
|---|---|---|
| `microteia pack [--output <dir>] [--skip-verify]` | Microteia | monta o pacote instalável do kernel |
| `microteia pack-console [--output <dir>]` | Microteia | monta o próprio Console para rodar fora do repositório |
| `microteia publish [--kernel-only\|--console-only] [--repo <owner/name>] [--dry-run]` | Microteia | põe no ar o que os dois acima produziram |
| `microteia init [--name <escritório>] [--id <env>] [--force]` | escritório | cria a instalação no diretório atual |
| `microteia connect --project <projectId> [--no-create-web-app]` | escritório | liga a instalação ao Firebase dele |
| `microteia unpack --version <latest\|x.y.z>` | escritório | baixa a versão do catálogo, confere o `sha256` e a põe no lugar, sem publicar nada |
| `microteia unpack --kernel <pacote.tgz>` | escritório | o mesmo, de um arquivo local — para quem não alcança o catálogo |
| `microteia deploy [--only rules,indexes,functions,hosting] [--delay <s>] [--prune] [--all]` | escritório | publica o pacote que está no lugar |
| `microteia provision [--prune] [--delay <s>] [--all]` | escritório | dá às extensões instaladas as functions e os índices que elas exigem |
| `microteia export-catalog --tenant <tenantId> [--output <path>]` | escritório | escreve o que um escritório tem — telas, listas, extensões — para as ferramentas de autoria lerem |
| `microteia plugin-init --namespace <com.acme> [--dir <path>] [--force]` | escritório | prepara `extensions/`, para escrever extensão em TypeScript, abaixo do namespace do escritório |

Na máquina de quem instala ele vem do npm, e não daqui:

```bash
npm i -g @microteia/console     # ou: npx @microteia/console --help
```

Para gerar a pasta que é publicada — outra máquina, uma rede sem npm público, um teste antes de subir:

```bash
npm run pack:console     # -> distributions/console/<versão do Console>/
```

A pasta tem `lib/`, um `package.json`, um README e o `CONSOLE-VERSIONS.md`, pesa ~500 KB e **não
instala nada**: o Console usa só módulos nativos do Node. Ela roda como está (`node lib/index.js
--help`) e é exatamente o que o `publish` manda ao registry.

O `package.json` é a razão de existir um comando em vez de um `cp -R`: o compilado é ESM, e sem
`type: module` o Node só o carrega por adivinhação de sintaxe — que existe a partir do 22.7 e falha
antes dele. E o `CONSOLE-VERSIONS.md` está no `files` por um motivo que não é documentação: o `unpack`
lê aquele arquivo AO LADO do binário que está rodando, para pô-lo na raiz da instalação.

Nessa cópia, os comandos do escritório funcionam; `pack`, `pack-console` e `publish` recusam com
mensagem clara, porque construir e publicar exigem o repositório.

### 1. Gerar uma versão do pacote (lado Microteia)

A versão do pacote **é** a `version` do `package.json`. Então, antes de empacotar, incremente-a e
acrescente a entrada correspondente no `VERSIONS.md` — o mesmo passo de qualquer commit.

```bash
npm run pack:kernel
```

Ele compila o Console e executa, em ordem: `npm run verify`, o build do frontend com
`TARGET=dist`, o build das Cloud Functions, a auditoria do bundle, a montagem e o tarball.

```
distributions/kernel/<versão>/
├── manifest.json                      # legível sem desempacotar; carrega o sha256 do tarball
└── microteia-kernel-<versão>.tgz      # ~7 MB
```

O `manifest.json` de FORA é o único que carrega `tarball: { name, bytes, sha256 }`; o de dentro do
tarball não — um manifesto não pode descrever o arquivo que o contém. É a única diferença entre as duas
cópias, e é o que permite conferir o que foi baixado.

Duas coisas que o `pack` garante, e que são o motivo de ele existir em vez de um `tar` à mão:

- **Nenhum projeto Firebase dentro do bundle.** O build de distribuição usa `TARGET=dist`, para o qual
  **não existe** `.env.dist` — nada é inlinado, e `cli/src/vendor/bundleAudit.ts` aborta o
  empacotamento se achar credencial no artefato.
- **Só compilado viaja.** Sem `src/` (nem do frontend nem das functions) e sem `.js.map`.

O `manifest.json` é derivado do código, não escrito à mão: functions, callables, parâmetros do
backend (`defineString`), região, versão do contrato do kernel e os pré-requisitos manuais.

`--skip-verify` pula só o gate de qualidade (útil ao iterar); `--output <dir>` muda o destino.

#### 1.1 Publicar

```bash
npm run pack:console          # o Console da versão que vai junto
microteia publish --dry-run   # diz o que subiria, e como o catálogo ficaria
microteia publish
```

Ele **não constrói** — quem roda o gate de qualidade é o `pack`. O que ele faz é subir os assets ao
repositório de releases (`gh`), publicar o Console no npm, e escrever o catálogo `kernel/index.json`
**por último**: um índice apontando para um arquivo que não subiu quebra a instalação de todo mundo que
pedir `latest`, enquanto um arquivo que o índice ainda não menciona não quebra nada. Versão já publicada
é recusa — release não se reescreve. Detalhes e o motivo de o catálogo morar numa URL nossa: "O canal de
distribuição" no [ARCHITECTURE.md](./ARCHITECTURE.md).

### 2. Preparar o projeto Firebase do escritório

Na máquina de quem instala: Node.js **22 ou mais novo**, `firebase-tools` autenticado
(`firebase login`) e o `gcloud` autenticado (`gcloud auth login`) — ele é usado no passo do App Engine
e, depois, para o `provision` ler quais extensões o escritório instalou.

> Numa máquina com Node mais novo que 22, o `npm install` das functions avisa `EBADENGINE`. É
> **esperado**: o `engines.node` do pacote descreve o runtime das Cloud Functions (fixo em 22, é por ele
> que o Firebase escolhe onde a function roda), e não a máquina de quem instala. As notas de
> descontinuação que aparecem junto vêm de dependências do próprio Firebase. Nenhuma das duas impede o
> deploy, e o `deploy` avisa disso antes de rodar o npm.

No projeto Firebase, os passos abaixo são de console: **nenhum comando os faz**, e o `connect` imprime
a lista inteira com o motivo de cada um (ela vive no manifesto, em `MANUAL_PREREQUISITES`, e viaja com
o pacote porque quem instala não tem este repositório):

Na mesma ordem em que o `connect` os imprime:

| Passo | Por que não dá para automatizar |
|---|---|
| Plano **Blaze**, antes de tudo | Cloud Functions de 2ª geração não existem no gratuito, e sem billing nem o App Engine nem o bucket do Storage podem ser criados |
| `gcloud app create --region=southamerica-east1 --project=<projectId>` | sem ele o deploy falha com um 404 que não menciona App Engine — e a região é definida uma única vez |
| **Firestore** na mesma região das functions | localização permanente; região divergente faz gatilho nunca disparar |
| **Cloud Storage** iniciado pelo console | habilitar a API não basta: o bucket padrão não existe e nenhum comando de CLI o cria |
| **Authentication → Google** habilitado | sem ele ninguém entra |
| Invocação das callables por `allUsers` — *só se a organização bloquear* | o deploy concede e depois verifica; política de organização pode recusar |
| **TTL** do Firestore em `auditLogs.expiresAt` | não se declara em código nem em rules |
| O que uma extensão instalada pedir (credencial de terceiro, tópico Pub/Sub) | o próprio `provision` imprime a lista, por extensão; credencial nunca é compartilhada entre instalações |

### 3. Instalar (lado escritório)

```bash
npm i -g @microteia/console

mkdir acme && cd acme

microteia init --name "Escritório Acme"
microteia connect --project acme-microteia
microteia unpack --version latest
microteia deploy
```

O `unpack --version` lê o catálogo publicado, baixa, confere `bytes` e `sha256`, e **só então** troca o
que está no lugar — uma recusa (por exemplo, um pacote que exige um Console mais novo) deixa a versão
anterior intacta. Numa máquina sem acesso ao catálogo, nomeie o arquivo:
`microteia unpack --kernel /caminho/microteia-kernel-<versão>.tgz`. O download fica em
`~/.microteia/cache`, fora da instalação, porque `.microteia/` é apagado a cada troca de kernel.

O que fica no diretório:

```
microteia.yaml              # a instalação: nome, ambiente, projectId, região, versão do kernel
.env.<projectId>            # SUAS configurações de backend — credenciais, gitignorado
.gitignore                  # criado junto: este diretório tende a virar um repositório seu
README.md                   # SEU: criado se não existir, e nunca mais reescrito
MICROTEIA.md                # NOSSO: sobreposto a cada `unpack`, carimbado do pacote instalado
KERNEL-VERSIONS.md          # o histórico técnico do kernel — vem dentro do pacote
CONSOLE-VERSIONS.md         # o histórico técnico do Console — vem com o binário
functions/                  # opcional: as Cloud Functions que você escreve (ver §5)
extensions/                 # opcional: as extensões que você escreve (ver §6)
.microteia/                 # DESCARTÁVEL: refeito do pacote + `connect`. Nada seu mora aqui
├── firebase-config.json    # config web lida do projeto do escritório (por `connect`)
└── install/                # o pacote desempacotado — é daqui que o deploy roda
```

**`unpack` e `deploy` são separados de propósito.** Trocar de kernel não obriga a publicar tudo: se
naquela versão só o front mudou, `microteia deploy --only hosting` basta. E entre os dois há o momento
de preencher uma configuração que o pacote novo passou a pedir — que é justamente quando se descobre
que ela existe.

O `unpack` substitui o pacote e escreve no `.env.<projectId>` da raiz as configurações que faltam,
**acrescentando** e nunca sobrescrevendo. O `deploy` carimba `hosting/firebase-config.js` com o projeto
do escritório, copia o `.env.<projectId>` para onde o `firebase-functions` o lê, e publica na ordem:
rules → índices → functions → hosting. As functions sobem **uma a uma** (em lote estouram a quota de CPU do projeto), com uma
segunda passada para as de gatilho, que numa instalação nova falham por propagação de identidade de
serviço. Ao final ele verifica, pelo mesmo caminho do navegador, se as callables respondem — e, se a
permissão de invocação tiver sido recusada, imprime o comando exato de cada uma.

O que sobe aqui é a **baseline**: o que toda instalação precisa. Function e índice que pertencem a uma
extensão ficam de fora até que a extensão seja instalada — ver o passo a seguir.

### 3.1. Extensões que precisam de recursos de servidor

Algumas extensões exigem do projeto Firebase o que nenhuma tela declara: Cloud Function, índice
composto, credencial. Uma que receba e-mail, fale com uma API de terceiro ou consulte por dois campos
ao mesmo tempo é o caso — isso mora no servidor.

A extensão pode trazer as próprias Cloud Functions (em `extensions/<plugin>/functions/`) ou reivindicar
uma que o pacote da plataforma já traz. Nos dois casos a declaração é a mesma, e o efeito é o mesmo:
o artefato só existe no projeto do escritório que instalou a extensão.

Instalar uma dessas pela aplicação não basta: ela aparece na tela de Extensões com o aviso
**"Backend pendente"** e **não** entra no menu. Quem cuida do projeto aplica o que falta:

```bash
microteia provision
```

Ele lê o que os escritórios instalaram, cria os índices, deploya as functions que faltam, avisa dos
parâmetros ainda vazios em `.env.<projectId>` e imprime os passos manuais que cada extensão declara —
criar um cliente OAuth, um tópico do Pub/Sub, o que for. Recarregue a aplicação e a extensão está no ar.

Isto exige o `gcloud` autenticado (`gcloud auth login`): é por ele que o Console lê o que está
instalado. Ele não guarda credencial nenhuma — pede o token a cada execução.

**Preencheu (ou trocou) um valor em `.env.<projectId>`? Rode `microteia provision` de novo.**
Uma Cloud Function só vê o valor do deploy que a carimbou: preencher o arquivo depois não alcança
nenhuma delas, e a feature falha só na hora de usar. O `provision` compara o arquivo com o que já foi
aplicado e redeploya justamente as functions que carregam o parâmetro que mudou — nem a baseline
inteira, nem nada além delas. Não é preciso lembrar o que mudou nem passar flag: ele descobre.

Ao desinstalar uma extensão, `microteia provision` **relata** o que ficou órfão sem apagar nada.
`microteia provision --prune` apaga as functions órfãs; índice nunca é apagado automaticamente, só
listado com o comando (um deploy não remove índice, e apagar o errado custa uma consulta em produção).

### 4. Atualizar uma instalação

```bash
microteia --version              # diz se há versão nova publicada
microteia unpack --version latest
microteia deploy                 # ou --only hosting, --only functions, ...
```

E o Console, que tem versão própria: `npm i -g @microteia/console` de novo, ou `npm outdated -g`. Um
pacote que exija um Console mais novo é recusado pelo `unpack` **antes** de qualquer troca.

O kernel é substituído por inteiro, e o que é do escritório é preservado. Dentro de `.microteia/`,
só `functions/node_modules` atravessa a troca — e ele é cache. **Tudo o que é seu vive FORA de
`.microteia/`** — `.env.<projectId>`, `functions/` e `extensions/` ficam ao lado do `microteia.yaml`,
e é isso que os torna imunes ao `unpack`.

### 4.1. Configurações de backend

Algumas extensões pedem uma credencial ou um identificador do lado do servidor. Elas ficam em
**`.env.<projectId>`, ao lado do `microteia.yaml`** — nunca dentro de `.microteia/`:

```bash
# .env.acme-microteia
GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

O `unpack` descobre esses nomes de duas fontes: os `defineString` do pacote da plataforma e os das Cloud
Functions que o próprio escritório escreveu. A linha tem de existir mesmo vazia — o `firebase-functions`
valida os parâmetros globalmente, então um deles sem valor recusa o deploy de **todas** as functions do
projeto, inclusive as que nada têm a ver com ele.

O `unpack` cria o arquivo e acrescenta o que um pacote novo passou a pedir, sem tocar no que você já
preencheu. O `init` cria o `.gitignore` que o cobre — são credenciais.

**Depois de mudar um valor, rode `microteia provision`.** O valor é carimbado em cada Cloud Function
no deploy DELA, então uma function já no ar continua com o valor anterior até subir de novo; o
`provision` reconhece a mudança (por uma impressão digital em `microteia.yaml`) e recoloca na fila
exatamente as functions que carregam aquele parâmetro.

### 5. Cloud Functions do próprio escritório

O kernel é imutável e se estende por acréscimo — e a fonte delas fica **fora** de `.microteia/`, em
dois lugares que respondem a duas perguntas diferentes:

| Onde | Quando | Sobe em |
|---|---|---|
| `functions/` (ao lado do `microteia.yaml`) | a function é COMUM a várias | `microteia deploy` |
| `extensions/<plugin>/functions/` | a function é DAQUELA extensão | `microteia provision` |

Cada diretório é lido pelo `index.ts` dele, e declara no `package.json` ao lado as dependências npm que
precisar. O `deploy` monta `.microteia/install/functions/custom/src/` a partir dos dois, gera o barril e
o `predeploy` compila **só** o `custom/`; o entrypoint soma kernel e customizado com nomes planos. Dois
diretórios exportando o mesmo nome, ou um nome que colida com function do kernel, é **recusa**: o
customizado é espalhado depois do kernel, então o repetido substituiria em silêncio — e um gatilho do
kernel substituído não falha, simplesmente deixa de acontecer.

Nesta etapa o escritório escreve contra `firebase-functions` e `firebase-admin`, não contra APIs
internas do kernel.

### 6. Extensões escritas pelo próprio escritório, em TypeScript

O sistema instala extensão a partir de um `.json`, mas ninguém precisa escrever `.json`: o pacote leva um
SDK, e com ele o escritório escreve a extensão em TypeScript, no VSCode, com tipos e autocomplete — sem
que o código-fonte do kernel saia daqui (o que viaja é compilado mais `.d.ts`).

```bash
microteia plugin-init --namespace com.acme   # cria "extensions/" ao lado do microteia.yaml
cd extensions
npx microteia-plugin create hello             # vira com.acme.hello
npx tsc --noEmit                              # tipos
npx microteia-plugin check hello/plugin.ts    # o gate
npx microteia-plugin build hello/plugin.ts    # gera hello/com.acme.hello.json
```

O `.json` gerado é importado na tela **Extensões**. Ajuste fino direto nele continua valendo: ele é o
resultado final.

Duas coisas valem a pena saber antes de começar:

- **`check` não é uma aproximação da validação da plataforma — é ela.** A mesma função, as mesmas
  mensagens. Se o `check` passa, o pacote instala.
- **Extensão que traz código (`views`/`startup`) instala inerte.** Um administrador abre a fonte, lê e
  confia; a confiança fica presa àquele código exato, por hash. Trocar um caractere pede confiar de novo.

`extensions/` fica **fora** de `.microteia/` — é do escritório, e o upgrade não o toca, como o
`functions/` da raiz. Mantê-lo em dia é do `unpack`: quando o diretório existe, ele chama
`microteia-plugin sync` sozinho, e uma falha ali avisa sem derrubar a troca de kernel.

O diretório vem com o manual (`AUTHORING.md`), as regras operacionais (`AGENTS.md` — mais um `CLAUDE.md`
que nasce uma vez e passa a ser seu), as extensões de primeira parte como FONTE em `examples/`, e um
`.mcp.json` que registra um servidor MCP: uma IA no editor consulta os pontos de extensão, a API
disponível e a validação **desta** instalação, em vez de um retrato da documentação.

Três políticas convivem ali, e a diferença é de quem é o arquivo: `AGENTS.md`, `AUTHORING.md` e
`examples/` são sobrepostos (prosa nossa); `CLAUDE.md` e `README.md` nascem uma vez e são seus; e
`tsconfig.json`, `.mcp.json`, `.gitignore` e `package.json` são **conciliados** — o `sync` acrescenta o
requisito que falta, nunca altera o que você escreveu, e avisa quando os dois divergem.

Motivo de cada decisão acima: seção **"Distribuição — a Microteia instalável no Firebase do cliente"**
do [ARCHITECTURE.md](./ARCHITECTURE.md).

## Estrutura do Projeto

```
src/
├── kernel/          # O runtime de plugins: PluginHost e registries. NÃO conhece domínio nenhum
├── plugins/         # Os plugins do núcleo (core.*), os temas e o catálogo do marketplace
├── sdk/             # O SDK de autoria de extensão — só depende de domain/
├── domain/          # Entidades, interfaces de repositório, use cases e os schemas compartilhados
├── data/            # Implementações Firebase dos repositórios
├── infrastructure/  # Config do Firebase, DIContainer, eventos, deeplink
├── stores/          # Contextos React globais (Auth, Tenant, Data, Theme…)
├── presentation/    # Páginas e componentes (padrão MVVM por pasta)
├── routes/          # Proteção de rotas
└── shared/          # Tipos e estilos globais

functions/           # Cloud Functions (o kernel do backend é GERADO por sync-schemas)
cli/                 # O Console: pack, init, connect, deploy
scripts/             # Automações de build/deploy e os verificadores do gate
```

A hierarquia de dependência é `domain ← data ← infrastructure ← stores ← presentation`, e nunca ao
contrário.

Para detalhes de arquitetura, padrões de código e regras Firestore, consulte [ARCHITECTURE.md](./ARCHITECTURE.md).

## O que é do núcleo e o que é extensão

O núcleo entrega **capacidades genéricas** — nenhum domínio de negócio:

| Capacidade | O que é |
|---|---|
| **Construtor de telas** | Cria entidades, campos, listas e formulários sem escrever código |
| **Automações** | Workflows com gatilhos, passos, expressões por campo e Scripts em sandbox |
| **Marketplace** | Instala, atualiza e remove extensões por tenant |
| **Escritório** | Membros, papéis, integrações e configurações do tenant |
| **Auditoria** | Trilha de alterações com expiração por TTL |
| **Idiomas e temas** | Ambos como contribuição: o inglês é o idioma-fonte, o resto é pacote |

Os domínios vêm do catálogo, como extensões — e a prova de que o núcleo não depende deles é que a
maioria já não está neste repositório: as sete extensões de escritório de advocacia (Pessoas, Contratos,
Processos, Prazos, Financeiro, Pushes do Tribunal e Kanban de Processos) são mantidas fora dele, pelo
escritório, e nada aqui as nomeia. Ficaram como exemplo de autoria as agnósticas de negócio: Notícias,
Calendário, Dashboard, dados do Brasil e a tradução pt-BR.

## Multi-tenant

- Ao fazer login pela primeira vez, um tenant padrão `[displayName]([email])` é criado automaticamente, e o usuário é o `ownerId` dele — sem nenhum perfil semeado. O nome é montado só com o que o usuário trouxe. O PRIMEIRO usuário do sistema nasce `SYSTEM`.
- O tenant ativo fica em `useTenant().currentTenant`; todos os stores de dados só carregam quando ele não é `null`.
- **Não existe papel por escritório.** O escritório cria os próprios perfis (`tenants/{id}/roles`) e o membro os recebe em `roleIds`; todo código pergunta por PERMISSÃO (`can('screens.manage')`), nunca por papel. As duas exceções não são perfis: o papel global `SYSTEM` (administrador de todos os escritórios) e o dono do escritório (curinga `*`, lido de `Tenant.ownerId`).
- Papel global: `SYSTEM` | `USER` — a única união fechada que resta.
- O último tenant escolhido é salvo em `localStorage` com a chave `microteia:lastTenantId`.

## Autenticação

Firebase Authentication com Google Sign-In.
