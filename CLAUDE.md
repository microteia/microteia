# CLAUDE.md — Microteia: An AI-First Business Application Platform (PAIFD)

> Manual operacional para o Claude Code. É curto de propósito: contém o que fazer **em toda sessão**.
> A referência detalhada (regras Firestore, pipelines, padrões por feature) vive em `ARCHITECTURE.md`.
> **Regra de ouro:** quando este arquivo e o `ARCHITECTURE.md` divergirem, o `ARCHITECTURE.md` é a fonte de verdade — e deve ser corrigido para eliminar a divergência.

---

## Fundamento Arquitetural — NÃO-NEGOCIÁVEL

**Este projeto é uma plataforma declarativa capaz de criar aplicações de negócio sem alterar o kernel.**

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

Use o atalho do `package.json` quando existir: `npm run verify` (= `typecheck` + `lint` + `verify-schemas`).

> **Por que `tsc -b --force` e não `tsc --noEmit`?** O root usa *project references* (`tsconfig.app.json` + `tsconfig.node.json`). O `tsc --noEmit` avalia só o tsconfig raiz e **não entra nos projetos referenciados** — havia erro de tipo real em `src/` passando batido nele e só estourando no `npm run build`. O `-b --force` percorre os projetos e não usa o cache incremental (que mascararia arquivos não alterados). Ele não emite nada: os tsconfigs têm `noEmit`.

> **Alterou algo em `functions/`?** O gate do root **não** valida o backend com o tsconfig das functions (mais estrito, `strict`, e que inclui os `*.test.ts` das functions). Um erro de tipo em `functions/src` pode passar no gate do root e só aparecer no build/deploy ou no IDE. Rode **também** `npx tsc -b functions` (ou `npm run build:functions`) antes de commitar mudanças no backend.

> **Schemas compartilhados:** a fonte única vive em `src/domain/schema/` e `src/domain/entities/entitySchemas.ts`; as cópias em `functions/src` são **geradas** por `npm run sync-schemas` — nunca as edite. Ver "Schema Compartilhado Gerado" no `ARCHITECTURE.md`.

---

## Versionamento — NÃO-NEGOCIÁVEL

**Todo commit é precedido, sem exceção, por dois passos:**

1. Incrementar `version` em `package.json` (SemVer: `patch` para correções, `minor` para funcionalidades novas, `major` para mudanças que quebram compatibilidade).
2. Adicionar uma entrada nova no **topo** de `VERSIONS.md` (raiz do projeto) para essa versão.

A entrada em `VERSIONS.md` é **escrita para o usuário comum do escritório**, não para desenvolvedores — e é sempre **diferente** da mensagem de commit do git:

| | Público | Tom |
|---|---|---|
| Mensagem de commit (git) | Desenvolvedores | Técnico, Conventional Commits (`feat:`, `fix:`, `docs:`…) |
| Entrada em `VERSIONS.md` | Usuário do escritório | Elegante, direto, sem jargão de código |

Formato de cada entrada (mais recente no topo do arquivo):

```markdown
## [0.0.9] — 2026-07-02

- Adicionada a aba de Documentos na tela de Financeiro, para anexar recibos e notas fiscais aos lançamentos.
- Corrigido um problema que impedia a análise de intimações recebidas por e-mail.
```

Cada item descreve o **benefício ou a mudança percebida**, não a implementação (nunca cite nomes de arquivo, componente, hook ou camada). Se `VERSIONS.md` não existir, crie-o com esse formato antes da primeira entrada.

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

## Documentação

**Sem comentários dentro do código** — nomes devem ser autoexplicativos. Documentação fica no `ARCHITECTURE.md`. (Exceção: comentário de justificativa de um `eslint-disable-next-line` pontual.)

---

## Multi-tenant — regras da Microteia

- **Tenant selecionado vive em `useTenant().currentTenant`** — todos os stores de dados (Pessoas, Processos, Prazos, Financeiro, etc.) só carregam dados quando `currentTenant` não é `null`.
- **Estrutura Firestore:** `tenants/{tenantId}/persons`, `tenants/{tenantId}/cases`, `tenants/{tenantId}/deadlines`, `tenants/{tenantId}/financials`.
- **Roles por tenant:** `admin`, `lawyer`, `secretary`, `user`. Role global: `SYSTEM` | `SUPPORT` | `USER`.
- **Novo usuário:** ao fazer login pela primeira vez, um tenant padrão "Organização de [displayName]" é criado automaticamente com o usuário como `admin`.
- **Seleção de tenant:** após login (ou ao criar conta), o usuário vê o `TenantSelector`. O último tenant escolhido é salvo em `localStorage` com chave `'microteia:lastTenantId'`.

---

## Ambientes — dev por padrão, produção só explicitamente

Dois projetos Firebase: `microteia-dev` (desenvolvimento) e `microteia` (produção). O seletor é a
variável `TARGET`, que escolhe ao mesmo tempo o projeto e o arquivo de ambiente do bundle.

```bash
npm run deploy:workflow              # -> microteia-dev (padrão)
TARGET=prod npm run deploy:workflow  # -> microteia
```

**Nunca** publique em produção sem que o comando diga `TARGET=prod` (ou use `npm run deploy:prod`).
Não existe `.env` comum na raiz: cada ambiente tem o seu (`.env.dev`, `.env.prod`), justamente para
que uma variável faltando estoure em vez de cair calada na configuração do outro projeto.

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
- [ ] `npx tsc -b --force` sem erros (ou `npm run typecheck`)
- [ ] `npx eslint . --max-warnings 0` sem erros **nem warnings**
- [ ] **Antes de commitar:** `version` incrementada em `package.json` + entrada nova no topo de `VERSIONS.md` (linguagem de usuário, diferente da mensagem de commit)
- [ ] **Nova coleção Firestore ou permissão alterada:** editar `firestore.rules` (raiz) e avisar que precisa de `npm run deploy:rules`
- [ ] **Novo path no Storage:** editar `storage.rules` (raiz) e avisar que precisa de `npm run deploy:rules`
- [ ] **Nova query Firestore:** `where` máximo + `orderBy` no servidor + `limit()` + índice em `firestore.indexes.json` (raiz) e na tabela do `ARCHITECTURE.md`, com aviso de `npm run deploy:indexes`; coleções de crescimento ilimitado exigem paginação por cursor
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