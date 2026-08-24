# CLAUDE.md — Microteia: An AI-First Business Application Platform (PAIFD)

> Manual operacional para o Claude Code. É curto de propósito: contém o que fazer **em toda sessão**.
> A referência detalhada (regras Firestore, pipelines, padrões por feature) vive em `ARCHITECTURE.md`.
> **Regra de ouro:** quando este arquivo e o `ARCHITECTURE.md` divergirem, o `ARCHITECTURE.md` é a fonte de verdade — e deve ser corrigido para eliminar a divergência.

---

## Fundamento Arquitetural — NÃO-NEGOCIÁVEL

**Este projeto é uma plataforma declarativa capaz de criar aplicações de negócio sem alterar o kernel.**

**Nenhum nome de negócio entra neste repositório.** Não há `persons`, `cases`, `deadlines`,
`financials`, `pushes`, `contracts` — as sete extensões de escritório de advocacia saíram daqui em
20/08/2026 e são mantidas em `office/extensions/`. Ficaram como exemplo de autoria só as agnósticas:
`brasil`, `calendar`, `dashboard`, `news` e `locale-pt-br`.

Quando algo do kernel PARECER precisar do nome de uma coleção de negócio, a pergunta certa não é qual
nome escrever: é **qual capacidade declarativa está faltando**. Foi assim que `auditActions` nasceu —
`auditableEntities.ts` tinha `pushes` com a lista de ações a auditar, e a saída não era mudar a lista,
era a tela declarar. Ver "As entidades de ESCRITÓRIO não moram aqui" no `ARCHITECTURE.md`.

Toda alteração, toda funcionalidade, todo pensamento sobre o código deve respeitar este princípio fundamental. O kernel é imutável e extensível apenas por meio de declarações (plugins, extensões, contribuições). Nunca modifique o kernel para adicionar regras de negócio específicas de um domínio.

As mudanças no kernel devem ser obrigatoriamente voltadas para prover essa capacidade declarativa e JAMAIS para amarrar o projeto a um caso específico.

---

**Microteia** é um SaaS (Software as a Service) multi-tenant para permitir criar aplicações de negócio de forma declarativa. Cada usuário pertence a um ou mais "tenants" (organizações). Após o login, o usuário seleciona o tenant em que vai trabalhar. Todos os dados ficam em subcoleções do tenant no Firestore: `tenants/{tenantId}/{coleção}/{docId}`.

---

## Bootstrap obrigatório

Antes de qualquer alteração, leia `ARCHITECTURE.md` na raiz do projeto.
Se o arquivo não estiver acessível, pergunte antes de prosseguir.

---

## Gate de qualidade — NÃO-NEGOCIÁVEL

**Nenhum commit sem passar pelas DUAS verificações, nesta ordem:**

```bash
npx tsc -b --force && npx eslint . --max-warnings 0
```

Por que **duas** e não só `tsc`:

| Ferramenta | Pega | Não pega |
|---|---|---|
| `tsc -b --force` | erros de **tipo** | Regras dos Hooks, refs, pureza, dependências |
| `eslint . --max-warnings 0` | Regras dos Hooks e do **React Compiler** | erros de tipo |

> Muitos sublinhados vermelhos/amarelos do VSCode **não são erros de TypeScript** — são do ESLint (`eslint-plugin-react-hooks`). Por isso o `tsc` "passa" e o editor continua acusando. O `--max-warnings 0` trata warnings como bloqueantes: é o que zera os sublinhados.

O erro frequente **"Cannot access refs during render"** é a regra `react-hooks/refs` (React Compiler). A correção é **arquitetural** (ver "Hooks, refs e pureza" abaixo), nunca `// @ts-ignore` nem desabilitar a regra no arquivo. Detalhes completos: seção **"Conformidade com ESLint e React Compiler"** do `ARCHITECTURE.md`.

Use o atalho do `package.json` quando existir: `npm run verify` (= `typecheck` + `lint` +
`verify-schemas` + `build:host-types` + `build:sdk` + `verify-extensions` + `verify-messages`).

> **Mexeu no `firestore.rules`?** Rode **também** `npm run test:rules`. Ele sobe o emulador do
> Firestore, exercita o arquivo REAL de regras e o derruba. Fica FORA do `npm test` de propósito:
> exige um JDK, e um teste que não roda na máquina de quem o herda vira ruído até alguém apagá-lo.
> Sem JDK: `brew install --cask temurin`.

> **A ordem do `verify` não é arbitrária.** `build:sdk` vem ANTES de `verify-extensions` porque o
> compilador de extensão agora É o do SDK (`sdk/lib/sdk/node/compile.js`): sem ele construído, não há
> como gerar os `extension-templates/*.json`. Numa árvore recém-clonada, `sdk/` não existe — ele é
> gerado e está no `.gitignore`.

> **`npm run typecheck` são DOIS projetos:** `tsc -b --force` (app, node, cli) e
> `tsc -p tsconfig.extsrc.json` (as fontes de view das extensões, checadas contra
> `sdk/types/microteia-host.d.ts`). O segundo depende de `npm run build:host-types` ter rodado.

> **Por que `tsc -b --force` e não `tsc --noEmit`?** O root usa *project references* (`tsconfig.app.json` + `tsconfig.node.json`). O `tsc --noEmit` avalia só o tsconfig raiz e **não entra nos projetos referenciados** — havia erro de tipo real em `src/` passando batido nele e só estourando no `npm run build`. O `-b --force` percorre os projetos e não usa o cache incremental (que mascararia arquivos não alterados). Ele não emite nada: os tsconfigs têm `noEmit`.

> **Alterou algo em `functions/`?** O gate do root **não** valida o backend com o tsconfig das functions (mais estrito, `strict`, e que inclui os `*.test.ts` das functions). Um erro de tipo em `functions/src` pode passar no gate do root e só aparecer no build/deploy ou no IDE. Rode **também** `npx tsc -b functions` (ou `npm run build:functions`) antes de commitar mudanças no backend.

> **Schemas compartilhados:** a fonte única vive em `src/domain/schema/` e `src/domain/entities/entitySchemas.ts`; as cópias em `functions/src` são **geradas** por `npm run sync-schemas` — nunca as edite. Ver "Schema Compartilhado Gerado" no `ARCHITECTURE.md`.

---

## Versionamento — NÃO-NEGOCIÁVEL

**Todo commit é precedido, sem exceção, por estes passos:**

1. Incrementar `version` em `package.json` (SemVer: `patch` para correções, `minor` para funcionalidades novas, `major` para mudanças que quebram compatibilidade).
2. Adicionar uma entrada nova no **topo** de `VERSIONS.md` (raiz do projeto) para essa versão.
3. Adicionar a entrada TÉCNICA correspondente no **topo** de `KERNEL-VERSIONS.md` (raiz), **em inglês** — e, se a alteração tocou `cli/`, também no topo de `cli/CONSOLE-VERSIONS.md`, com o `CLI_VERSION` incrementado.

### Três históricos, três leitores — e dois deles são EM INGLÊS

| Arquivo | Quem lê | Idioma | Tom | Sobe quando |
|---|---|---|---|---|
| Mensagem de commit (git) | nós | **português** | Conventional Commits (`feat:`, `fix:`, `docs:`…) | sempre |
| `VERSIONS.md` (raiz) | o usuário do escritório | **português** | elegante, direto, sem jargão de código | `version` do `package.json` |
| `KERNEL-VERSIONS.md` (raiz) | quem mantém ou integra uma instalação | **inglês** | técnico, no modelo do git | `version` do `package.json` |
| `cli/CONSOLE-VERSIONS.md` | idem | **inglês** | técnico, no modelo do git | `CLI_VERSION` |

**Os dois últimos são EM INGLÊS porque são dos PACOTES, e pacote é universal — NÃO-NEGOCIÁVEL.** Eles
viajam para escritórios que podem estar em qualquer lugar: o `KERNEL-VERSIONS.md` dentro do tarball do
kernel, o `CONSOLE-VERSIONS.md` com o binário do Console, e o `unpack` põe os dois na raiz da instalação
a cada troca de versão. É a mesma regra de idioma que já valia para `AUTHORING.md` e `AGENTS.md`: o que é
entregue é produto e fala inglês; o que é comunicação nossa — commit, `VERSIONS.md` da raiz,
`ARCHITECTURE.md`, `CLAUDE.md`, comentário de código — continua em português, e continua sendo o que
melhor serve a quem desenvolve aqui.

**Cada histórico viaja no artefato que ele descreve**, e é isso que impede qualquer um deles de falar de
uma versão que não está instalada. Nunca escreva a alteração do Console no histórico do kernel, nem o
contrário.

O gate cobra sozinho: `changelogs.test.ts` reprova a versão sem entrada, a entrada fora do topo, a
duplicada e a ordem invertida; e `microteia pack` / `pack-console` **recusam empacotar** — antes de
qualquer build — uma versão que o histórico não menciona. Detalhes: "O histórico técnico viaja com o
pacote" no `ARCHITECTURE.md`.

A entrada em `VERSIONS.md` é **escrita para o usuário comum do escritório**, não para desenvolvedores — e é sempre **diferente** da mensagem de commit do git.

Formato de cada entrada (mais recente no topo do arquivo):

```markdown
#### [0.0.9] — 2026-07-02

- Adicionada a aba de Documentos na tela de Financeiro, para anexar recibos e notas fiscais aos lançamentos.
- Corrigido um problema que impedia a análise de intimações recebidas por e-mail.
```

Cada item descreve o **benefício ou a mudança percebida**, não a implementação (nunca cite nomes de arquivo, componente, hook ou camada). Se `VERSIONS.md` não existir, crie-o com esse formato antes da primeira entrada.

Nos dois históricos dos pacotes vale o inverso: ali o item é a implementação, no formato do commit — e o
cabeçalho é o mesmo dos outros históricos do produto, `#### [versão] — AAAA-MM-DD`, mais recente no topo.

```markdown
#### [9.5.0] — 2026-08-23

- feat(cli/unpack): what the change makes possible, and what it cost not to have it.
- fix(cli/pack): what was broken, and what it did to whoever hit it.
```

---

## Hierarquia de camadas — dependências

```
domain ← data ← infrastructure ← stores ← presentation
```

Camadas só dependem das que estão à sua esquerda. **Nunca** ao contrário.

| Camada | O que fica aqui |
|---|---|
| `domain/` | Entidades, interfaces de repositório, use cases |
| `data/` | Implementações concretas dos repositórios (Firebase) |
| `infrastructure/` | Config do Firebase, DIContainer, eventos, deeplink |
| `stores/` | Contextos React globais (Auth, Data, Theme, …) |
| `presentation/` | Pages, Components, estilos |

`sdk/` fica **abaixo** de tudo: só depende de `domain/`, e é `plugins/` que o importa (nunca o
contrário). `src/sdk/node/` é a exceção — é ferramenta de terminal, como `scripts/`, e por isso pode ler
`plugins/messages`. `sdkPurity.test.ts` guarda a distinção.

Antes de criar/editar um arquivo, identifique a camada e confirme que nenhum import viola a hierarquia.

---

## MVVM por pasta — regras absolutas

Toda página e todo componente (exceto átomos simples que só renderizam props) é uma pasta com 3 arquivos:

### `.view.tsx`
- Exporta o componente React; chama `use[Nome]ViewModel()` no topo.
- **Zero** `useState`, `useReducer`, `useEffect`, `useRef`, lógica de negócio ou transformação de dados.
- Renderiza exclusivamente o que o ViewModel retorna.
- **Nunca lê `ref.current`** (passar `ref={vm.algumRef}` é permitido; ler `.current` no JSX, não).

### `.viewmodel.tsx`
- Exporta a interface `[Nome]ViewModel` e o hook `use[Nome]ViewModel(): [Nome]ViewModel`.
- Contém estado, `useMemo`, `useCallback`, `useEffect`, handlers async. **Zero** JSX.
- **Só acessa `ref.current` dentro de `useEffect`/`useLayoutEffect`/handler** — nunca no corpo do hook.

### `.styles.tsx`
- Exporta o objeto `S` com os styled-components. **Zero** lógica.
- Cor, fonte, tamanho, espaçamento e raio **sempre** via tema. Nunca hardcode.

**ViewModel é obrigatório** se o componente tem `useState`/`useEffect`/`useRef`, callbacks complexos, transformação de dados, ou acessa Stores/DI.
**Opcional** para componentes que só renderizam props (`Button`, `Badge`, `Card`).

---

## Hooks, refs e pureza — evita os erros do VSCode

Estas são as regras do React Compiler (`eslint-plugin-react-hooks` v6+). Respeitá-las é o que faz o ESLint passar:

- **`ref.current` só fora do render.** Leia/escreva dentro de `useEffect`, `useLayoutEffect`, `useCallback` ou handler. Precisa de uma medida do DOM para renderizar? Guarde em `state` (atualizado por efeito/`ResizeObserver`) e renderize a partir do `state`.
- **Tipagem de ref em React 19:** `useRef<HTMLInputElement>(null)` → o tipo é `RefObject<HTMLInputElement | null>`. Em interfaces de ViewModel, declare **com `| null`**: `inputRef: React.RefObject<HTMLInputElement | null>`.
- **Sem `setState` no corpo do render** — derive com `useMemo`.
- **Sem função impura no render** (`Math.random`, `Date.now`) — mova para efeito/handler.
- **Não mute retorno de hook** (ex: objeto vindo de `useMemo`) — recrie em vez de mutar.
- **`exhaustive-deps` completo** em `useEffect`/`useMemo`/`useCallback`; se uma função é dependência, envolva-a em `useCallback`.

Falso-positivo comprovado? Suprima **só a linha**, com justificativa:
`// eslint-disable-next-line react-hooks/refs -- motivo`. Nunca o arquivo inteiro.

---

## Estilização — regras absolutas

- Styled-components **apenas** em `[Nome].styles.tsx`, no objeto `S`.
- Nunca `style={{}}` inline (exceto valor dinâmico simples inevitável), nunca `className`, nunca CSS modules/`.css`.
- Props customizadas em styled-components: prefixo `$` obrigatório (`styled.div<{ $active?: boolean }>` → `<S.Item $active />`).
- **Cor/fonte/tamanho/espaçamento sempre via tema** (`${({ theme }) => theme.colors.primary}`). Proibido hex literal, `rgba(...)`, concatenação de opacidade (`...danger}15`), ou objetos de cores hardcoded. Se faltar um token, **adicione-o ao tema** — não burle.
- Cor vinda de dado externo (ex: cor de etiqueta/tag do Firestore) é a única exceção: passe como prop `$color` e aplique direto.

---

## Use Cases — padrão factory

```typescript
export type CreateXxxUseCase = {
  execute: (...args) => Promise<Result>;
};

export const makeCreateXxxUseCase = (repo: IXxxRepository): CreateXxxUseCase => ({
  execute: (...args) => repo.createXxx(...args),
});
```

Nomenclatura: `[Ação][Entidade]UseCase` / `make[Ação][Entidade]UseCase`. Padrão factory por causa do `erasableSyntaxOnly`.

---

## Contextos React — separação para Fast Refresh

Cada contexto é **dois** arquivos:

- `stores/[Nome]Context.tsx` — exporta **apenas o Provider** (componente React).
- `stores/use[Nome].ts` — exporta o `Context`, a interface de tipo e o hook `use[Nome]()`.

Arquivos `.tsx` exportam **apenas** componentes React. Hooks e tipos ficam em `.ts`. (Quebrar isso dispara `react-refresh/only-export-components` no ESLint.)

---

## Idioma — NÃO-NEGOCIÁVEL

**O código e todo texto DENTRO do código são em inglês. Sem exceção.**

### A regra que vale para todo texto novo

Três condições, e as três valem juntas. Texto que falhe em qualquer uma **não entra**:

1. **Todo texto que o usuário lê é traduzível.** Nasce como chave no catálogo, nunca como frase
   solta no código — nem em português, nem em inglês.
2. **O texto padrão é em inglês.** É ele que fica em `src/plugins/messages/`, e é ele que aparece
   para quem não tem tradução instalada.
3. **A tradução para pt-BR é obrigatória, no mesmo commit.** Toda chave nova em
   `src/plugins/messages/` exige a entrada correspondente em `src/plugins/marketplace/localePtBr/`.

**Texto que não puder ser traduzido não pode ser incluído.** Não existe "depois eu traduzo" nem
"esse é pequeno demais": um texto sem chave é um texto que nenhum escritório fora do Brasil verá no
idioma dele, e ele só reaparece quando alguém o encontra na tela — por acaso, meses depois. Se a
frase não cabe no catálogo, o problema é a frase, não o catálogo: reescreva-a até caber, ou não a
mostre.

**Acrescentar texto NÃO é motivo para mexer no kernel.** O mecanismo já existe e cobre todos os
casos — `useT('namespace')` no componente, referência `@namespace/chave` no que é declarativo,
`{ message, messageParams }` no que nasce no domínio ou no backend. Precisar de um caminho novo é
sinal de que o texto está no lugar errado, não de que falta capacidade no núcleo.

O que o gate cobra sozinho, e por que confiar nele em vez da leitura atenta:

| Verificação | O que pega |
|---|---|
| `eslint --max-warnings 0` | frase literal em JSX, atributo, propriedade ou template — em qualquer idioma |
| `npm run verify-messages` | chave usada que não existe, chave pt-BR órfã, chave declarada duas vezes |
| `localePilot.test.ts` | chave publicada em `en` sem par em pt-BR |
| impressão digital do pacote | catálogo alterado sem subir o `version` do pacote de idioma |

Nenhuma dessas quatro é opcional, e nenhuma existe por precaução: cada uma foi escrita **depois** de
o defeito correspondente chegar à tela.

O inglês é o idioma-fonte do produto (`DEFAULT_LOCALE = 'en'`). Português é uma **tradução**, e vive
exclusivamente no pacote `com.microteia.locale-pt-br` — nunca no núcleo.

| O quê | Idioma | Onde vive |
|---|---|---|
| Identificador (variável, função, tipo, arquivo, chave de mensagem) | **inglês** | código |
| Texto que o usuário lê (rótulo, botão, mensagem de erro, placeholder, título) | **inglês** | catálogo `en` em `src/plugins/messages/` |
| Tradução desse texto | português | `src/plugins/marketplace/localePtBr/` |
| Comentário de código, JSDoc | **português** | código |
| Comentário das extensões que viajam como exemplo de autoria | **inglês** | `marketplace/{calendar,dashboard,news}*.ts` e as views delas |
| `ARCHITECTURE.md`, `CLAUDE.md`, `VERSIONS.md`, README | **português** | raiz |
| Histórico técnico dos PACOTES (viaja para o escritório) | **inglês** | `KERNEL-VERSIONS.md` e `cli/CONSOLE-VERSIONS.md` |
| Mensagem de commit, nome de teste (`describe`/`it`) | **português** | git / `*.test.ts` |

A regra separa **produto** de **comunicação**. O produto é falado em inglês porque tem de poder ser
falado em qualquer idioma; a comunicação entre nós continua em português porque é nossa.

**A exceção do comentário tem o mesmo teste:** de quem é o leitor. Calendário, Painel e Notícias são
agnósticas de negócio e viajam no pacote do SDK como exemplo de autoria — quem lê o comentário delas é
o autor de extensão do escritório, não nós, e ali o comentário é documentação de API pela mesma razão
que `extensionTypeDefs.ts` é. As extensões de DOMÍNIO seguem em português. Ver "A extensão AGNÓSTICA de
negócio nasce no idioma-fonte" no `ARCHITECTURE.md`.

**Nunca escreva uma frase em português destinada ao usuário.** Em vez disso:

```ts
// ERRADO
<S.Title>Novo registro</S.Title>
throw new Error('Automação não encontrada.');

// CERTO — a frase nasce em inglês, no catálogo, e a chave é o que aparece no código
const t = useT('core.records');
<S.Title>{t('record.new')}</S.Title>          // CORE_RECORDS_MESSAGES['record.new'] = 'New record'
throw notFound('error.workflow.not-found');   // resolvido no front pelo catálogo
```

Rótulo **declarativo** (manifest, contribuição, catálogo servido pelo backend) não usa `useT`: usa a
referência `@namespace/chave`, resolvida por `useLabel()` no ponto de render. Ver "Idioma — tradução
como contribuição" no `ARCHITECTURE.md`.

**O que NUNCA entra no catálogo:** o que o escritório digitou (nome de tela do Form Design, rótulo de
campo, opção de lista). Isso é dado do tenant, não texto do produto, e passa intacto por `useLabel()`.

**O núcleo não responde por tradução fora do escopo dele — NÃO-NEGOCIÁVEL.** Texto que pertence a um
domínio é traduzido por quem o declara, não pelo kernel. "Tipo de documento" é conceito do kernel;
*Procuração* e *Petição* são vocabulário de um domínio, e não entram no catálogo do núcleo mesmo
quando o valor padrão nasce em código dele. Quem declara o vocabulário responde por ele: a extensão
traduz o que traz, e o que o escritório digitou não se traduz.

A regra vale nos dois sentidos: o núcleo também não deve pedir que o pacote de idioma dele carregue
chave de plugin. Cada extensão contribui o próprio `i18n.messages` — inclusive um pacote que só
traduz, que é uma extensão contribuindo apenas nesse ponto.

---

## Documentação

**Sem comentários dentro do código** — nomes devem ser autoexplicativos. Documentação fica no `ARCHITECTURE.md`. (Exceção: comentário de justificativa de um `eslint-disable-next-line` pontual.)

---

## Multi-tenant — regras da Microteia

- **Tenant selecionado vive em `useTenant().currentTenant`** — todo store de dados só carrega quando `currentTenant` não é `null`.
- **Estrutura Firestore:** `tenants/{tenantId}/{coleção}/{docId}`. O nome da coleção é da TELA que a declara, e o kernel não conhece nenhum: `FirebaseRecordRepository` e `RecordStore` servem qualquer uma.
- **Autorização é por PERMISSÃO, nunca por papel — NÃO-NEGOCIÁVEL.** Não existe papel por tenant: o
  escritório cria os próprios perfis (`tenants/{id}/roles`) e o membro os recebe em `roleIds`. Todo
  código pergunta `can('screens.manage')` (`useAuthorization()` no front, `requirePermission` na
  callable, `can(tenantId, ...)` nas rules) — nunca `role === '...'`. Toda coleção rende
  `<coleção>.read|create|update|delete` de graça; o resto é declarado em `access.permission`. Role
  global: `SYSTEM` | `USER`, e `SYSTEM` é a única união fechada que resta. Ver "RBAC" no `ARCHITECTURE.md`.
- **Novo usuário:** ao fazer login pela primeira vez, um tenant padrão `[displayName]([email])` é criado automaticamente, e o usuário é o `ownerId` dele — o que lhe dá acesso irrestrito DENTRO do próprio escritório, sem perfil nenhum semeado. O nome é montado só com o que o usuário trouxe — sem palavra nossa, não há idioma preso num dado que ele pode renomear. O PRIMEIRO usuário do sistema nasce `SYSTEM`.
- **Seleção de tenant:** após login (ou ao criar conta), o usuário vê o `TenantSelector`. O último tenant escolhido é salvo em `localStorage` com chave `'microteia:lastTenantId'`.

---

## Ambientes — dev por padrão, produção só explicitamente

Dois projetos Firebase: `microteia-dev` (desenvolvimento) e `curatino` (produção). O seletor é a
variável `TARGET`, que escolhe ao mesmo tempo o projeto e o arquivo de ambiente do bundle.

```bash
npm run deploy:workflow              # -> microteia-dev (padrão)
TARGET=prod npm run deploy:workflow  # -> curatino
```

**Nunca** publique em produção sem que o comando diga `TARGET=prod` (ou use `npm run deploy:prod`).
Não existe `.env` comum na raiz: cada ambiente tem o seu (`.env.dev`, `.env.prod`), justamente para
que uma variável faltando estoure em vez de cair calada na configuração do outro projeto.

### SDK de autoria de extensão — o `.json` é o artefato, o `.ts` é a fonte

Extensão é lida por `.json`, mas nunca se escreve `.json`: escreve-se `.ts`, e o compilador gera o
artefato. Três regras seguem daí:

- **Exemplo de extensão que viaja no pacote é a NOSSA fonte**, com os imports reescritos para
  `@microteia/sdk` (`cli/src/vendor/exampleSources.ts`). `exampleSources.test.ts` compila cada um e
  exige o `.json` versionado byte a byte — é o que prova que o barril do SDK basta para escrever as
  nossas próprias extensões. Símbolo novo usado por um plugin de primeira parte precisa estar no barril.
- **Fonte de view e de `startup` mora em arquivo `.tsx`**, em `src/plugins/marketplace/views/<plugin>/`,
  importada com `?raw`. **Nunca** num template literal: ali ela não passa por `tsc` nem por ESLint, e
  foi assim que oito declarações erradas na API curada ficaram anos sem ninguém ver. O `viewSources.test.ts`
  reprova um plugin novo que volte ao template literal.
- **Mexeu na API curada do host (`hostApi.ts`)? Atualize `extensionTypeDefs.ts` na mesma alteração.**
  `hostApiTypeDefs.test.ts` cobra símbolo por símbolo. E o texto ali é **em inglês**: é documentação de
  API entregue ao autor, não comentário nosso.
- **Superfície do SDK é contrato.** Toda alteração em `src/sdk/index.ts` passa por atualizar as duas
  listas de `sdkSurface.test.ts` (símbolos de runtime e tipos) — é onde a decisão fica registrada.
  Se a alteração mexe no que o KERNEL entende de um pacote instalado (ponto de extensão, forma do
  manifest, `impl.kind`), suba também o `KERNEL_VERSION`: minor se aditivo, major se quebra. Símbolo
  que só serve à AUTORIA — `AuthoredPlugin`, `sourceFile`, um construtor novo — não move o
  `KERNEL_VERSION`, porque não chega ao pacote instalado.

- **Afirmação sobre o kernel num documento gerado é DERIVADA, nunca escrita à mão.** Lista de módulos
  curados vem de `microteia-host.d.ts`, pontos de extensão vêm dos arrays, limite de tamanho vem de
  `PACKAGE_MAX_BYTES`. Três listas eram prosa em três arquivos, e acrescentar um `@microteia/*` deixava
  as três incompletas sem reprovar em nada.

Validação de pacote tem **uma porta**: `validatePluginPackage` (`src/sdk/validate.ts`). Nunca monte o
trio `validatePluginManifest` + `validatePackage` + `packageIssues` à mão — era o que havia em quatro
lugares, e uma checagem nova num deles não chegava aos outros.

Detalhes: seção "SDK de autoria" no `ARCHITECTURE.md`.

### Instalação no Firebase do cliente — outro caminho, não este

Os dois ambientes acima são **nossos**. A instalação que roda no projeto do escritório é montada por
`microteia pack` e aplicada por `microteia init` / `connect` / `unpack` / `deploy` (`cli/`). Ela **não**
passa por `TARGET`, **não** usa os scripts `deploy:*` e **não** leva `src/` nenhum — só compilado.

Três regras que valem para toda alteração:

- **Nada de projeto Firebase pode ser compilado dentro do bundle.** A configuração vem de
  `window.__MICROTEIA_CONFIG__`, carimbado na instalação; `import.meta.env` é só o fallback de
  desenvolvimento. `cli/src/vendor/bundleAudit.ts` aborta o empacotamento se achar credencial no
  artefato — se ele reprovar, o defeito é o que foi inlinado, não a verificação.
- **Cloud Function nova entra no manifesto sozinha** (ele lê os exports de `functions/src/index.ts`),
  mas continua obrigada aos grupos `deploy:*` — os dois testes que guardam isso são
  `scripts/deployLists.test.ts` e `cli/src/kernel/manifest.test.ts`.
- **Antes disso, pergunte DE QUEM é a function.** Se ela serve uma extensão, ela entra no
  `manifest.backend` dela e sai da baseline do pacote: só é deployada no projeto do escritório que
  instalou a extensão. Vale igual para índice composto e parâmetro de backend. O `pack` **aborta** se as
  contas não fecharem. Ver "Artefatos de backend por extensão" no `ARCHITECTURE.md`.
- **`functions/custom/` é do escritório.** Nada do kernel escreve lá, e o upgrade preserva o
  diretório inteiro.
- **NADA que uma pessoa digita mora em `.microteia/`.** O `unpack` apaga aquele diretório por inteiro a
  cada troca de kernel — é o que faz o upgrade ser confiável. O que é do escritório fica ao lado do
  `microteia.yaml`: `.env.<projectId>`, `extensions/`, `functions/` e o `README.md` dele. A configuração
  já morou lá dentro, e o resultado foi credencial apagada no upgrade e function redeployada com string
  vazia. Se precisar de um arquivo novo que o escritório edita, o lugar é a raiz — e o que precisa estar
  dentro de `install/` é CÓPIA, montada no deploy.
- **Documento gerado é sobreposto; documento do escritório nasce e não se toca.** `MICROTEIA.md` é
  reescrito a cada `unpack` (e por isso pode carregar versão, caminhos e contagens); `README.md` é criado
  se não existir e nunca mais. Um documento que promete estar atualizado não pode ser editável. Em
  `extensions/` há TRÊS políticas, e a diferença é de quem é o arquivo: `AGENTS.md` e `AUTHORING.md` são
  prosa nossa e são sobrepostos; `CLAUDE.md` e `README.md` são do escritório e nascem uma vez; e
  `tsconfig.json`, `.mcp.json`, `.gitignore` e `package.json` são **conciliados** — o autor escreve
  dentro deles.
- **Arquivo em que o autor escreve nunca é sobreposto — é CONCILIADO.** Acrescenta o requisito que
  falta, não altera o que divergir, e avisa dizendo o que se espera e o que se achou. Sobrepor um
  `tsconfig.json` apaga o `path` dele; um `.mcp.json`, os outros servidores MCP que ele registrou.
  Acertar sozinho é desfazer trabalho em silêncio, que é pior que pedir o ajuste.
- **Texto que descreve o que o KERNEL sabe fazer mora no SDK, nunca no Console.** O Console é versionado
  e distribuído SEPARADAMENTE do kernel: enquanto os guias de `extensions/` saíam de `cli/src/vendor/`,
  um Console de duas versões atrás escrevia a documentação de outro contrato, em silêncio. Eles vivem em
  `src/sdk/node/workspace/`, e `microteia-plugin sync` os reescreve — chamado sozinho pelo `unpack`.

Detalhes: seção "Distribuição — a Microteia instalável no Firebase do cliente" no `ARCHITECTURE.md`.

---

## Firebase — regras e índices ficam em arquivo, nunca no Console

Regras e índices são **código versionado**, referenciados pelo `firebase.json`:

| Arquivo (raiz) | Conteúdo | Deploy |
|---|---|---|
| `firestore.rules` | Security Rules do Firestore | `npm run deploy:rules` |
| `storage.rules` | Security Rules do Storage | `npm run deploy:rules` |
| `firestore.indexes.json` | Índices compostos e `fieldOverrides` | `npm run deploy:indexes` |

**Nunca** edite regras ou crie índices pelo Firebase Console — o próximo deploy sobrescreve a regra e **apaga** o índice não declarado. Criou índice pelo link de erro do console? Registre-o no `firestore.indexes.json` na mesma hora.

O `ARCHITECTURE.md` **não** guarda cópia das regras; a tabela de índices que ele mantém é derivada do JSON e serve só para registrar o motivo de cada um — atualize as duas pontas.

---

## Checklist antes de criar qualquer arquivo

1. **Qual camada?** Verifique a hierarquia e que nenhum import a viola.
2. **Entidade nova?** Siga "Como Adicionar uma Nova Feature" do `ARCHITECTURE.md`.
3. **Página nova?** 3 arquivos MVVM + `<Route>` em `App.tsx`/`pageRegistry` + entrada no Command Palette (se consultável) + link no Sidebar.
4. **Componente novo?** Pasta MVVM em `ui/` ou `layout/` + `index.ts` re-exportando a View. Nunca arquivo solto `Componente.tsx` na raiz de `ui/`.
5. **Entidade de tenant?** Todo repositório recebe `tenantId` e lê/escreve em `tenants/{tenantId}/{coleção}`.
6. **Entidade filha de outra?** Planeje o `Delete[Entidade]UseCase` com cascata **antes** de escrever código (seção "Cascata de Exclusão").
7. **Store próprio?** Planeje o evento no `StoreEventEmitter`, o handler de `visibilitychange` e quais stores assinam o evento.
8. **Lista filtrável?** Use `CompositeFilter` com `screenKey`. Seleção única → `SearchSelect`; múltipla → `MultiSearchSelect`. Nunca `<select>` nativo.
9. **Feedback ao usuário?** Use `notify(...)`; exclusões via `ConfirmModal`. Nunca `window.alert/confirm`.
10. **Tarja/aviso informativo?** Use `<InfoBanner message="..." variant="warning"|"info" />` de `ui/InfoBanner`. **Nunca** crie um `<p>` ou `<div>` estilizado ad-hoc para esse fim. `warning` (padrão) = borda âmbar, para alertas de impacto amplo. `info` = borda primária, para restrições de permissão ou modo somente-leitura.
11. **Campo de data ou hora?** Use `<DateInput />` de `ui/DateInput` e `<TimeInput />` de `ui/TimeInput`. **Nunca** `<input type="date">` / `<input type="time">` direto nem outro wrapper. Ver "Componente DateInput" e "Componente TimeInput" no `ARCHITECTURE.md`.

---

## Checklist após cada alteração

- [ ] Nenhum import viola a hierarquia de camadas
- [ ] View sem lógica/refs lidas; ViewModel sem JSX e com `.current` só em efeitos/handlers; Styles sem lógica
- [ ] Styled-components com prefixo `$` nas props customizadas; zero valor hardcoded (tudo via tema)
- [ ] Nenhum `style={{}}` inline desnecessário; nenhum `className`
- [ ] Nenhum comentário desnecessário no código
- [ ] **Nenhuma frase solta destinada ao usuário, em idioma nenhum**: todo texto novo nasce como chave em inglês no catálogo `en` E ganha a tradução pt-BR no mesmo commit; texto que não puder ser traduzido não entra (ver "Idioma")
- [ ] `npx tsc -b --force` sem erros (ou `npm run typecheck`)
- [ ] `npx eslint . --max-warnings 0` sem erros **nem warnings**
- [ ] **Antes de commitar:** `version` incrementada em `package.json` + entrada nova no topo de `VERSIONS.md` (linguagem de usuário, diferente da mensagem de commit) + entrada técnica **em inglês** no topo de `KERNEL-VERSIONS.md`
- [ ] **Mexeu em `hostApi.ts`?** `extensionTypeDefs.ts` atualizado na mesma alteração, **em inglês** — é o que o autor de extensão lê como API
- [ ] **Fonte de view/startup nova?** Arquivo `.tsx` em `src/plugins/marketplace/views/<plugin>/` + import `?raw`. Nunca template literal
- [ ] **Símbolo novo (ou a menos) em `src/sdk/index.ts`?** As DUAS listas de `sdkSurface.test.ts` atualizadas; `KERNEL_VERSION` só se o pacote INSTALADO muda de forma (ver "SDK de autoria")
- [ ] **Texto novo em `extensions/`?** Mora em `src/sdk/node/workspace/`, nunca em `cli/`; se ele afirma algo sobre o kernel, o número ou a lista é DERIVADA do código, com teste
- [ ] **Mexeu em `cli/`?** `CLI_VERSION` incrementado em `cli/src/shared/paths.ts`, com a entrada técnica **em inglês** no topo de `cli/CONSOLE-VERSIONS.md` (o JSDoc do `CLI_VERSION` guarda só a política de semver e a narrativa até a `2.5.0` — não escreva a entrada nova lá)
- [ ] **Nova coleção Firestore ou permissão alterada:** editar `firestore.rules` (raiz) e avisar que precisa de `npm run deploy:rules`
- [ ] **Novo path no Storage:** editar `storage.rules` (raiz) e avisar que precisa de `npm run deploy:rules`
- [ ] **Nova query Firestore:** `where` máximo + `orderBy` no servidor + `limit()` + índice em `firestore.indexes.json` (raiz) e na tabela do `ARCHITECTURE.md`, com aviso de `npm run deploy:indexes`; coleções de crescimento ilimitado exigem paginação por cursor
- [ ] **Índice de coleção de EXTENSÃO:** além da raiz, declarar em `manifest.backend.indexes` da extensão dona — sem isso o índice viaja para quem não instalou a extensão, e o `pack` reprova a divergência
- [ ] **Alterou uma extensão do catálogo embutido (`src/plugins/marketplace/`, temas incluídos)?**
      Suba o `manifest.version` DELA e registre o par novo em `VERSAO_CONFERIDA`
      (`scripts/extensionTemplates.test.ts`) — sem isso o Marketplace nunca oferece a atualização, e
      quem já instalou fica na cópia velha sem sintoma nenhum. Depois, `npm run build:extensions`.
- [ ] **Extensão que muda o FORMATO de dado já gravado:** declarar a rotina em `package.migrations` — ela roda uma vez por escritório, no sandbox, e nunca escreve o nome da coleção à mão (use `input.collections`). Ver "Migração de dados de extensão" no `ARCHITECTURE.md`
- [ ] **Novo Store:** tem `visibilitychange`, emite evento em cada mutação e assina eventos dos stores de que depende
- [ ] **Entidade com relação pai/filho:** `Delete[Entidade]UseCase` cascateia filhos; o método do Store atualiza estado local + emite os eventos corretos

---

## Fluxo de dados — referência rápida

**Leitura:** `Firebase → Repository → Store (use cases) → use[Store]() → ViewModel → View`
**Mutação:** `View (evento) → ViewModel (handler) → Store (método) → UseCase → Repository → Firebase`, com `setState` local otimista no Store.

---

## Para trocar o backend

1. Criar `[Novo]XxxRepository` implementando `IXxxRepository`.
2. Substituir `new FirebaseXxxRepository()` no `DIContainer.tsx`.
3. Nenhum outro arquivo precisa mudar.