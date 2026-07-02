# CLAUDE.md — Curatino: Escritório de Advocacia Virtual

> Manual operacional para o Claude Code. É curto de propósito: contém o que fazer **em toda sessão**.
> A referência detalhada (regras Firestore, pipelines, padrões por feature) vive em `ARCHITECTURE.md`.
> **Regra de ouro:** quando este arquivo e o `ARCHITECTURE.md` divergirem, o `ARCHITECTURE.md` é a fonte de verdade — e deve ser corrigido para eliminar a divergência.

**Curatino** é um sistema SaaS multi-tenant de gestão de escritórios de advocacia. Cada usuário pertence a um ou mais "escritórios" (tenants). Após o login, o usuário seleciona o escritório em que vai trabalhar. Todos os dados (clientes, processos, prazos, financeiro) ficam em subcoleções do tenant no Firestore: `tenants/{tenantId}/{coleção}/{docId}`.

---

## Bootstrap obrigatório

Antes de qualquer alteração, leia `ARCHITECTURE.md` na raiz do projeto.
Se o arquivo não estiver acessível, pergunte antes de prosseguir.

---

## Gate de qualidade — NÃO-NEGOCIÁVEL

**Nenhum commit sem passar pelas DUAS verificações, nesta ordem:**

```bash
npx tsc --noEmit && npx eslint . --max-warnings 0
```

Por que **duas** e não só `tsc`:

| Ferramenta | Pega | Não pega |
|---|---|---|
| `tsc --noEmit` | erros de **tipo** | Regras dos Hooks, refs, pureza, dependências |
| `eslint . --max-warnings 0` | Regras dos Hooks e do **React Compiler** | erros de tipo |

> Muitos sublinhados vermelhos/amarelos do VSCode **não são erros de TypeScript** — são do ESLint (`eslint-plugin-react-hooks`). Por isso o `tsc` "passa" e o editor continua acusando. O `--max-warnings 0` trata warnings como bloqueantes: é o que zera os sublinhados.

O erro frequente **"Cannot access refs during render"** é a regra `react-hooks/refs` (React Compiler). A correção é **arquitetural** (ver "Hooks, refs e pureza" abaixo), nunca `// @ts-ignore` nem desabilitar a regra no arquivo. Detalhes completos: seção **"Conformidade com ESLint e React Compiler"** do `ARCHITECTURE.md`.

Use o atalho do `package.json` quando existir: `npm run verify` (= `typecheck` + `lint`).

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

## Multi-tenant — regras do Curatino

- **Tenant selecionado vive em `useTenant().currentTenant`** — todos os stores de dados (Clientes, Processos, Prazos, Financeiro) só carregam dados quando `currentTenant` não é `null`.
- **Estrutura Firestore:** `tenants/{tenantId}/clients`, `tenants/{tenantId}/cases`, `tenants/{tenantId}/deadlines`, `tenants/{tenantId}/financials`.
- **Roles por tenant:** `admin`, `lawyer`, `secretary`, `user`. Role global: `SYSTEM` | `USER`.
- **Novo usuário:** ao fazer login pela primeira vez, um tenant padrão "Escritório de [displayName]" é criado automaticamente com o usuário como `admin`.
- **Seleção de tenant:** após login (ou ao criar conta), o usuário vê o `TenantSelector`. O último tenant escolhido é salvo em `localStorage` com chave `'curatino:lastTenantId'`.

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
11. **Campo de data?** Use `<DateInput />` de `ui/DateInput`. **Nunca** `<input type="date">` direto nem outro wrapper. Ver "Componente DateInput" no `ARCHITECTURE.md`.

---

## Checklist após cada alteração

- [ ] Nenhum import viola a hierarquia de camadas
- [ ] View sem lógica/refs lidas; ViewModel sem JSX e com `.current` só em efeitos/handlers; Styles sem lógica
- [ ] Styled-components com prefixo `$` nas props customizadas; zero valor hardcoded (tudo via tema)
- [ ] Nenhum `style={{}}` inline desnecessário; nenhum `className`
- [ ] Nenhum comentário desnecessário no código
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx eslint . --max-warnings 0` sem erros **nem warnings**
- [ ] **Nova coleção Firestore ou permissão alterada:** atualizar "Firestore Security Rules — Conjunto Completo" no `ARCHITECTURE.md` e apresentar o bloco completo ao usuário para colar no Firebase Console
- [ ] **Novo path no Storage:** atualizar "Firebase Storage Rules — Conjunto Completo" e apresentar o bloco
- [ ] **Nova query Firestore:** `where` máximo + `orderBy` no servidor + `limit()` + índice composto documentado; coleções de crescimento ilimitado exigem paginação por cursor
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