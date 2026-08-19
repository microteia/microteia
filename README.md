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
- **Estilização:** Styled Components — cor, fonte e espaçamento **sempre** via tema; o tema é uma contribuição de plugin (o núcleo traz `dark` e `white`; os demais vêm do catálogo)
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
| `microteia pack` → pacote versionado, **compilado** | `microteia init` → cria a instalação |
| nunca vê o `projectId` do cliente | `microteia connect` → liga ao Firebase dele |
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
| `microteia init [--name <escritório>] [--id <env>] [--force]` | escritório | cria a instalação no diretório atual |
| `microteia connect --project <projectId> [--no-create-web-app]` | escritório | liga a instalação ao Firebase dele |
| `microteia deploy --kernel <pacote.tgz> [--only rules,indexes,functions,hosting] [--delay <s>] [--prune]` | escritório | instala ou atualiza |
| `microteia provision [--prune] [--delay <s>]` | escritório | dá às extensões instaladas as functions e os índices que elas exigem |

Para usá-lo fora daqui — outra pasta, outra máquina — não copie `cli/` à mão:

```bash
npm run pack:console     # -> distributions/console/<versão do Console>/
```

A pasta gerada tem `lib/`, um `package.json` e um README, pesa ~200 KB e **não instala nada**: o
Console usa só módulos nativos do Node. Rode com `node lib/index.js --help`; para ter o comando
`microteia` no PATH, aponte um link para o entrypoint, que sai do `pack` já executável e com shebang:

```bash
ln -s "$PWD/lib/index.js" ~/.local/bin/microteia
```

Sem npm e **sem sudo**. O `npm link` também serve, mas só onde o prefixo global do npm pertence ao
usuário — com o Node instalado em `/usr/local` (de root) ele exige `sudo`, que funciona e deixa
arquivos de root no prefixo global. `npm config set prefix ~/.npm-global` resolve pela raiz.

O `package.json` é a razão de existir um comando em vez de um `cp -R`: o compilado é ESM, e sem
`type: module` o Node só o carrega por adivinhação de sintaxe — que existe a partir do 22.7 e falha
antes dele. Nessa cópia, `init`, `connect` e `deploy` funcionam; `pack` e `pack-console` recusam com
mensagem clara, porque construir exige o repositório.

> Publicar o Console (npm, binário) faz parte da entrega por URL/registry, que ainda não existe — ver
> "O que esta etapa NÃO faz" no [ARCHITECTURE.md](./ARCHITECTURE.md).

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
├── manifest.json                      # legível sem desempacotar
└── microteia-kernel-<versão>.tgz      # ~6,5 MB
```

Duas coisas que o `pack` garante, e que são o motivo de ele existir em vez de um `tar` à mão:

- **Nenhum projeto Firebase dentro do bundle.** O build de distribuição usa `TARGET=dist`, para o qual
  **não existe** `.env.dist` — nada é inlinado, e `cli/src/vendor/bundleAudit.ts` aborta o
  empacotamento se achar credencial no artefato.
- **Só compilado viaja.** Sem `src/` (nem do frontend nem das functions) e sem `.js.map`.

O `manifest.json` é derivado do código, não escrito à mão: functions, callables, parâmetros do
backend (`defineString`), região, versão do contrato do kernel e os pré-requisitos manuais.

`--skip-verify` pula só o gate de qualidade (útil ao iterar); `--output <dir>` muda o destino.

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
| OAuth do Google e tópicos Pub/Sub — *só se usar a entrada por Gmail* | credencial nunca é compartilhada entre instalações |

### 3. Instalar (lado escritório)

```bash
mkdir acme && cd acme

microteia init --name "Escritório Acme"
microteia connect --project acme-microteia
microteia deploy --kernel /caminho/microteia-kernel-<versão>.tgz
```

O que fica no diretório:

```
microteia.yaml              # a instalação: nome, ambiente, projectId, região, versão do kernel
.microteia/
├── firebase-config.json    # config web lida do projeto do escritório (por `connect`)
└── install/                # o pacote desempacotado — é daqui que o deploy roda
```

O `deploy` carimba `hosting/firebase-config.js` com o projeto do escritório, escreve
`functions/.env.<projectId>` a partir do manifesto, e publica na ordem: rules → índices → functions
→ hosting. As functions sobem **uma a uma** (em lote estouram a quota de CPU do projeto), com uma
segunda passada para as de gatilho, que numa instalação nova falham por propagação de identidade de
serviço. Ao final ele verifica, pelo mesmo caminho do navegador, se as callables respondem — e, se a
permissão de invocação tiver sido recusada, imprime o comando exato de cada uma.

O que sobe aqui é a **baseline**: o que toda instalação precisa. Function e índice que pertencem a uma
extensão ficam de fora até que a extensão seja instalada — ver o passo a seguir.

### 3.1. Extensões que precisam de recursos de servidor

Algumas extensões exigem do projeto Firebase o que nenhuma tela declara: Cloud Function, índice
composto, credencial. A de **Pushes do Tribunal** é o caso — ela recebe intimações por e-mail, e isso
mora no servidor.

Instalar uma dessas pela aplicação não basta: ela aparece na tela de Extensões com o aviso
**"Backend pendente"** e **não** entra no menu. Quem cuida do projeto aplica o que falta:

```bash
microteia provision
```

Ele lê o que os escritórios instalaram, cria os índices, deploya as functions que faltam, avisa dos
parâmetros ainda vazios em `functions/.env.<projectId>` e imprime os passos manuais de cada extensão
(no caso do Gmail, o cliente OAuth e os tópicos do Pub/Sub). Recarregue a aplicação e a extensão está
no ar.

Isto exige o `gcloud` autenticado (`gcloud auth login`): é por ele que o Console lê o que está
instalado. Ele não guarda credencial nenhuma — pede o token a cada execução.

Ao desinstalar uma extensão, `microteia provision` **relata** o que ficou órfão sem apagar nada.
`microteia provision --prune` apaga as functions órfãs; índice nunca é apagado automaticamente, só
listado com o comando (um deploy não remove índice, e apagar o errado custa uma consulta em produção).

### 4. Atualizar uma instalação

Mesmo comando, pacote novo:

```bash
microteia deploy --kernel /caminho/microteia-kernel-<versão-nova>.tgz
```

O kernel é substituído por inteiro; o que é do escritório é preservado: `functions/custom/`,
`functions/node_modules` e o que já estava preenchido no `functions/.env.<projectId>` (parâmetros
novos são **acrescentados**, não sobrescrevem).

### 5. Cloud Functions do próprio escritório

O pacote reserva um lugar para elas — o kernel é imutável, estende-se por acréscimo:

```
.microteia/install/functions/
├── lib/                    # kernel COMPILADO — não se edita, é trocado no upgrade
└── custom/src/index.ts     # as functions do escritório entram aqui
```

O `predeploy` compila **só** o `custom/`, e o entrypoint soma os dois com nomes planos. Nesta etapa o
escritório escreve contra `firebase-functions` e `firebase-admin`, não contra APIs internas do kernel.

Motivo de cada decisão acima: seção **"Distribuição — a Microteia instalável no Firebase do cliente"**
do [ARCHITECTURE.md](./ARCHITECTURE.md).

## Estrutura do Projeto

```
src/
├── kernel/          # O runtime de plugins: PluginHost e registries. NÃO conhece domínio nenhum
├── plugins/         # Os plugins do núcleo (core.*), os temas e o catálogo do marketplace
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

Os domínios vêm do catálogo, como extensões — e é a prova de que o núcleo não depende deles:
Pessoa, Processo, Prazo, Financeiro, Notícias, Calendário, Dashboard, Kanban de Processos, Contrato,
Vendas, Push do Tribunal, dados do Brasil e a tradução pt-BR.

## Multi-tenant

- Ao fazer login pela primeira vez, um tenant padrão é criado automaticamente, com o usuário como `admin`.
- O tenant ativo fica em `useTenant().currentTenant`; todos os stores de dados só carregam quando ele não é `null`.
- Papéis por tenant: `admin`, `lawyer`, `secretary`, `user`. Papel global: `SYSTEM` | `SUPPORT` | `USER`.
- O último tenant escolhido é salvo em `localStorage` com a chave `microteia:lastTenantId`.

## Autenticação

Firebase Authentication com Google Sign-In.
