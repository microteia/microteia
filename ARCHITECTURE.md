# Arquitetura do Curatino — Escritório de Advocacia Virtual

> Documento de referência para desenvolvimento e manutenção. Toda nova feature deve seguir este padrão.
>
> **Curatino** é um SaaS multi-tenant de gestão de escritórios de advocacia construído com React + Firebase. Dados de cada escritório (tenant) ficam isolados em subcoleções do Firestore: `tenants/{tenantId}/{coleção}/{docId}`.

---

## Visão Geral

O projeto usa **Clean Architecture + MVVM** com separação estrita em camadas. Cada camada depende apenas das camadas internas — nunca das externas.

```
┌─────────────────────────────────────────────┐
│              Presentation                   │  ← React, Styled Components, MVVM
│   ┌─────────────┬──────────────────────┐   │
│   │   .view     │    .viewmodel        │   │
│   │  (JSX puro) │  (estado + handlers) │   │
│   └─────────────┴──────────────────────┘   │
│                .styles.tsx                  │
├─────────────────────────────────────────────┤
│                 Stores                      │  ← Contextos React globais por domínio
│  TenantStore · PersonStore · CaseStore      │
│  DeadlineStore · FinancialStore · NewsStore │
├─────────────────────────────────────────────┤
│               Domain                        │  ← Regras de negócio, zero dependências
│   entities/ · repositories/ · usecases/    │
├─────────────────────────────────────────────┤
│                 Data                        │  ← Implementações Firebase (subcoleções)
│            data/repositories/              │
├─────────────────────────────────────────────┤
│             Infrastructure                  │  ← Config técnica
│   firebase/config · di/DIContainer          │
│   events/StoreEventEmitter                  │
└─────────────────────────────────────────────┘
```

---

## Schema Compartilhado Gerado — Regra Absoluta

Os metadados de entidades são **compartilhados** entre frontend e Cloud Functions por **geração de código**, não por cópia manual. A fonte única editável vive em `src/`; as cópias em `functions/src/` são **geradas** por `scripts/sync-schemas.cjs` e trazem o cabeçalho "ARQUIVO GERADO — NÃO EDITE".

### Arquivos compartilhados (fonte em `src/`, cópia gerada em `functions/src/`)

| Arquivo | Conteúdo |
|---|---|
| `domain/schema/entityRegistry.ts` | **Fonte única de metadados por entidade**: coleção, `eventPrefix`, labels, `displayNameFields`, `referenceDenormFields`, campos nativos (com `lookupCollection` e `objectFields`), FKs (`FkSpec` com `denormKey` explícito) e flags `supportsCustomFields`/`referenceable`. Exporta `SCHEMA_VERSION`. |
| `domain/schema/lookupRegistry.ts` | Catálogo das coleções de lookup (listas configuráveis) com grupo e labels. |
| `domain/schema/pathResolver.ts` | Gramática única de caminhos: `parsePath`, `stripEventPrefix`, `resolvePath` (valida, tipa o nó e devolve o plano de saltos `FkHop[]`), `suggestNextSegments` (autocomplete) e `getValueAtPath`. `DEFAULT_MAX_FK_DEPTH = 3`, sobreponível por `options.maxFkDepth`. |
| `domain/schema/expressionPaths.ts` | `extractExpressionPaths` — extrai caminhos `event.*` de expressões via expr-eval. |
| `domain/schema/eventCatalog.ts` | Catálogo de eventos do Workflow **derivado do registry** (EntityEvents) ∪ eventos de sistema declarados (`SYSTEM_EVENTS`: notas/documentos, lookup). `eventNameToRoot` produz a raiz de navegação. |
| `domain/schema/hydrationPlan.ts` | Planner puro: caminhos → `FkHop[]` deduplicados em níveis BFS (propaga a chave FK do salto seguinte para os fields do hop pai). |
| `domain/schema/materialize.ts` | Materializer puro: aplica cada `MaterializationMode` (`denormKey` para FKs fixas, `replaceValue` para references de campos customizados) sobre o payload. |
| `domain/entities/entitySchemas.ts` | Tipos (`FieldDefinition`, `ScreenDefinition`, `CustomFieldType`…) e derivações do registry (`ENTITY_FK_SCHEMA`, `CUSTOM_FIELD_ENABLED_ENTITIES`, `BUILTIN_REF_ENTITIES`, `resolveRefEntityCollection`). |

### Regras — NÃO-NEGOCIÁVEIS

- **NUNCA** edite os arquivos gerados em `functions/src/domain/schema/**` nem `functions/src/domain/entities/entitySchemas.ts`. Toda alteração é feita na fonte em `src/` seguida de `npm run sync-schemas`.
- O manifesto de arquivos compartilhados vive em `scripts/sync-schemas.cjs` (`SHARED_FILES`). Novo arquivo compartilhado = adicionar ao manifesto.
- Arquivos de teste (`*.test.ts`) ficam ao lado da fonte e **não** entram no manifesto.
- A geração roda automaticamente em `predev`, `prebuild` e `build:functions`; o gate `npm run verify` executa `verify-schemas` (`sync-schemas --check`), que **falha** se alguma cópia estiver desatualizada.

```bash
npm run sync-schemas    # regenera as cópias em functions/src
npm run verify-schemas  # (--check) falha se houver cópia desatualizada
npm run verify          # typecheck + lint + verify-schemas
```

### Ao adicionar uma nova entidade fixa

1. Adicione a entrada em `ENTITY_REGISTRY` (`src/domain/schema/entityRegistry.ts`): coleção, labels, `displayNameFields`, `referenceDenormFields`, campos nativos (marcando `lookupCollection` nos campos de lista) e FKs com `denormKey` explícito e `denormalizedFields`.
2. `ENTITY_FK_SCHEMA`, o catálogo de eventos, o autocomplete do editor e a hidratação lazy derivam automaticamente do registry.
3. Rode `npm run sync-schemas` e depois `npm run verify`.
4. Ajuste os testes de snapshot em `src/domain/schema/entityRegistry.test.ts` se a mudança for intencional.

### Comando para IA (Claude, Copilot, etc.)

> **Instrução**: "Os schemas compartilhados têm fonte única em `src/domain/schema/` e `src/domain/entities/entitySchemas.ts`. NUNCA edite as cópias em `functions/src` — altere a fonte e rode `npm run sync-schemas`."

---

## Entidades do Domínio

### Coleções Firestore

| Entidade | Coleção Firestore | Tenant-scoped |
|---|---|---|
| `User` | `users/{uid}` | Não |
| `UserProfile` | `userProfiles/{uid}` | Não |
| `AIConnection` | `tenants/{tenantId}/aiConnections/{id}` | Sim |
| `GmailConnection` | `gmailConnections/{id}` | **Não** (mas possui campo `tenantId`) |
| `GmailToken` | `gmailConnections/{connectionId}/tokens/current` | **Não** (mas possui campo `tenantId`) |
| `Tenant` | `tenants/{tenantId}` | — |
| `TenantMember` | `tenants/{tenantId}/members/{uid}` | Sim |
| `Person` | `tenants/{tenantId}/persons/{id}` | Sim |
| `PersonTag` | `tenants/{tenantId}/personTags/{id}` | Sim |
| `PersonNote` | `tenants/{tenantId}/persons/{personId}/notes/{id}` | Sim |
| `PersonDocument` | `tenants/{tenantId}/persons/{personId}/documents/{id}` | Sim |
| `Case` | `tenants/{tenantId}/cases/{id}` | Sim |
| `CaseTag` | `tenants/{tenantId}/caseTags/{id}` | Sim |
| `CaseLookupItem` | `tenants/{tenantId}/caseAreas/{id}`, `casePhases`, `caseStatuses`, `caseInstances`, `caseActionTypes`, `caseCourts`, `caseDistricts`, `caseJudges` | Sim |
| `CaseNote` | `tenants/{tenantId}/cases/{caseId}/notes/{id}` | Sim |
| `CaseDocument` | `tenants/{tenantId}/cases/{caseId}/documents/{id}` | Sim |
| `Contract` | `tenants/{tenantId}/contracts/{id}` | Sim |
| `ContractTag` | `tenants/{tenantId}/contractTags/{id}` | Sim |
| `ContractLookupConfig` | `tenants/{tenantId}/contractTypes/{id}`, `contractCategories`, `contractStatuses`, `contractObjects`, `contractAdjustmentIndexes`, `contractAdjustmentPeriodicities`, `contractCurrencies`, `contractPaymentMethods`, `contractBanks`, `contractCostCenters` | Sim |
| `ContractNote` | `tenants/{tenantId}/contracts/{contractId}/notes/{id}` | Sim |
| `ContractDocument` | `tenants/{tenantId}/contracts/{contractId}/documents/{id}` | Sim |
| `Deadline` | `tenants/{tenantId}/deadlines/{id}` | Sim |
| `DeadlineTypeConfig` | `tenants/{tenantId}/deadlineTypes/{id}` | Sim |
| `Financial` | `tenants/{tenantId}/financials/{id}` | Sim |
| `FinancialTag` | `tenants/{tenantId}/financialTags/{id}` | Sim |
| `FinancialDocument` | `tenants/{tenantId}/financials/{financialId}/documents/{id}` | Sim |
| `FinancialLookupConfig` | `tenants/{tenantId}/financialCategories/{id}`, `financialStatuses` | Sim |
| `DocumentTypeConfig` (compartilhado) | `tenants/{tenantId}/documentTypes/{id}` | Sim |
| `Push` | `tenants/{tenantId}/pushes/{id}` | Sim |
| `PushInteraction` | `pushInteractions/{uid}_{pushId}` | Não |
| `News` | `news/{id}` | Parcial: `tenantId=null` = Sistema (global); `tenantId=string` = Escritório |
| `NewsCategoryConfig` | `tenants/{tenantId}/newsCategories/{id}` | Sim |
| `NewsTag` | `newsTags/{id}` | Não |
| `NewsInteraction` | `newsInteractions/{uid}_{newsId}` | Não |
| `NewsComment` | `newsComments/{id}` | Não |
| `NewsDocument` | `newsDocuments/{id}` | Não |
| `SavedFilter` | `savedFilters/{uid}_{screenKey}` | Não |
| `AuditLog` | `auditLogs/{id}` | Sim (campo `tenantId`, coleção flat) |
| `WorkflowDefinition` | `tenants/{tenantId}/workflow_definitions/{id}` (steps embutidos como array) | Sim |
| `WorkflowEvent` | `tenants/{tenantId}/workflow_events/{id}` (append-only, sem leitura pelo cliente) | Sim |
| `WorkflowExecution` | `tenants/{tenantId}/workflow_executions/{id}` (somente leitura pelo cliente) | Sim |
| `StepDefinition` (catálogo, espelho somente-leitura) | `workflow_step_catalog/{id}` | Não |

### Tipos-chave

```typescript
// Papel global do usuário no sistema
type UserRole = 'SYSTEM' | 'USER';

// Papel do usuário dentro de um escritório específico
type TenantRole = 'admin' | 'lawyer' | 'secretary' | 'user';

// Temas visuais disponíveis
type ThemeMode = 'dark' | 'light' | 'claude' | 'teams' | 'bruma' | 'kindle' | 'curatino' | 'themis' | 'themisDark';
```

### Entidade GmailConnection

Conexões OAuth do Gmail para monitoramento Push de e-mails do escritório. **Armazenadas no nível raiz (não subcoleção de tenant)** para permitir que Cloud Functions busquem conexões por email sem varrer todos os tenants. Somente administradores do tenant podem gerenciar.

```typescript
interface GmailConnection {
  id: string;
  tenantId: string;            // tenant dono desta conexão
  email: string;               // conta Gmail autorizada
  scopes: string[];            // escopos OAuth concedidos
  authorizedBy: string;        // userId que autorizou
  authorizedByName: string;    // nome de exibição
  authorizedAt: Date;
  historyId?: string;          // último historyId processado (Gmail Push)
  expiration?: string;         // data de expiração da watch (Gmail Push)
}
```

Coleção Firestore: `gmailConnections/{id}` (raiz)

**Motivação da estrutura:**
Quando o Gmail envia notificação Pub/Sub com `{ emailAddress, historyId }`, a Cloud Function precisa descobrir **qual(is) tenant(s)** possui esse email. Com a coleção no nível raiz, basta fazer:
```javascript
db.collection('gmailConnections').where('email', '==', emailAddress).get()
```
Com subcoleção por tenant seria necessário varrer **todos** os tenants, o que é impraticável.

**Índice composto necessário:**
```
Coleção: gmailConnections
Campos indexados: email (Ascending), tenantId (Ascending)
```
Crie no Firebase Console → Firestore → Índices.

### Entidade GmailToken

Tokens de acesso OAuth armazenados em subcoleção protegida. **Não retornam na listagem** — acessados apenas por Cloud Functions para renovação e uso.

```typescript
interface GmailToken {
  id: string;
  connectionId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
```

Coleção Firestore: `gmailConnections/{connectionId}/tokens/current` (subcoleção de gmailConnections)

**Fluxo OAuth do Gmail (Authorization Code Flow com Cloud Function):**

O Curatino implementa o **Authorization Code Flow** do Google OAuth para obter tokens de acesso offline (com `refresh_token`). Este é o fluxo correto para SaaS que precisam acessar APIs em background sem o usuário presente.

**Por que NÃO usar `initTokenClient`:**
- `initTokenClient` implementa o **Implicit Flow** (tokens na memória do navegador)
- **Nunca retorna `refresh_token`**, mesmo com `access_type: 'offline'` ou `prompt: 'consent'`
- Inadequado para acesso offline — tokens expiram em 1 hora e não podem ser renovados

**Solução: `initCodeClient` + Cloud Function**

1. **Frontend** (`initCodeClient`):
   - Abre popup OAuth do Google
   - Recebe um **código de autorização** (`response.code`)
   - Envia código para Cloud Function `exchangeGmailCode`

2. **Backend** (Cloud Function):
   - Recebe código do frontend
   - Usa **Client Secret** (seguro no backend) para trocar código por tokens
   - Retorna `{ access_token, refresh_token, expires_in, email, scopes }`
   - **Client Secret nunca exposto ao frontend**

3. **Frontend salva tokens**:
   - Grava em `gmailConnections/{id}/tokens/current`
   - Security Rules: `allow write: if isTenantAdmin(tenantId)` (primeira gravação)
   - Security Rules: `allow read: if false` (nunca lê de volta)

4. **Cloud Functions renovam tokens**:
   - Leem tokens usando Admin SDK (ignora Security Rules)
   - Quando `access_token` expira, usam `refresh_token` para obter novo
   - Atualizam subcoleção `tokens/current` automaticamente

**Configuração necessária:**

```bash
# Firebase Functions (não commitar!)
firebase functions:config:set \
  google.client_id="..." \
  google.client_secret="..." \
  google.redirect_uri="postmessage"

# Frontend (.env)
VITE_GOOGLE_CLIENT_ID=...
```

**Segurança:**
- ✅ `refresh_token` **sempre** retornado (Authorization Code Flow)
- ✅ Client Secret protegido no backend
- ✅ Tokens nunca trafegam de volta ao frontend após salvos
- ✅ Cloud Functions gerenciam renovação sem interação do usuário
- ✅ Subcoleções `tokens/` isoladas (não retornam com `gmailConnections`)

**Prevenção de duplicatas:**
- Ao autorizar email já existente, atualiza tokens da conexão existente (não cria duplicata)
- Lógica de deduplicação no frontend antes de chamar `createGmailConnectionUC` vs `updateGmailTokenUC`
### Entidade Tenant

```typescript
interface Tenant {
  id: string;
  name: string;              // "Escritório Silva & Associados"
  ownerId: string;           // userId do criador/dono
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoURL?: string | null;
  allowedSenders?: string[];
  allowedSubjects?: string[];
  plan: 'solo' | 'office' | 'professional' | 'enterprise'; // valor gravado em inglês; exibição em pt-BR via TENANT_PLAN_LABELS ('Solo'/'Escritório'/'Professional'/'Enterprise'). Padrão 'solo' no bootstrap; só SYSTEM altera depois (aba "Escritórios" de Gestão de Acessos)
  memberLimit: number | null; // null = sem limite; padrão 1 no bootstrap (só o dono); mudar o plano sugere um novo limite (TENANT_PLAN_MEMBER_LIMITS), mas o valor continua editável manualmente; só SYSTEM altera (aba "Escritórios" de Gestão de Acessos)
  memberCount: number;        // denormalizado, mantido pelas Cloud Functions addTenantMember/removeTenantMember/onUserCreated
  createdAt: Date;
  updatedAt: Date;
}
```

### Bootstrap do usuário — Cloud Function `onUserCreated`

Todo o onboarding de um usuário novo (`users/{uid}`, `userProfiles/{uid}` e o tenant próprio com o usuário como `admin`) é feito **inteiramente no servidor**, nunca pelo client:

- `functions/src/infrastructure/handlers/onUserCreated.ts` — trigger `functions.auth.user().onCreate()` (API **v1** do `firebase-functions`; triggers de Auth `onCreate`/`onDelete` ainda não têm equivalente em v2). Dispara automaticamente logo após a criação da conta no Firebase Auth (Google, Facebook ou e-mail/senha — antes mesmo da verificação de e-mail).
- `BootstrapUserUseCase` (`functions/src/domain/usecases/BootstrapUserUseCase.ts`), idempotente: `createUserIfMissing` cria `users/{uid}` (role `USER`) só se ainda não existir — se já existir (reexecução do trigger), a função **retorna sem fazer nada**, para não duplicar tenant; `createUserProfileIfMissing` cria `userProfiles/{uid}` vazio; em seguida cria o tenant (`ITenantRepository.createTenant`, com `memberLimit: 1, memberCount: 0`) e adiciona o próprio usuário como `admin` via `addMemberIfWithinLimit` (mesma transação atômica descrita abaixo) — resultado final: `memberLimit: 1`, `memberCount: 1`. Todo usuário sempre tem exatamente 1 tenant (o seu) ao final do bootstrap; todo tenant sempre tem um `ownerId`.
- **Client não cria mais nada disso.** `users`/`tenants` negam `create` do client nas Security Rules (`allow create: if false`). O `AuthContext` (`src/stores/AuthContext.tsx`) não faz mais `createUserProfile` — em vez disso, `IUserRepository.waitForProvisioning` (`src/data/repositories/FirebaseUserRepository.ts`) abre um `onSnapshot` em `users/{uid}` e só resolve quando o documento existir **e** `tenantIds` não estiver vazio (sinal de que o bootstrap terminou), com timeout de 20s. Para quem já loga há tempos isso resolve quase instantaneamente (documento já existe); no primeiro login, cobre a espera pela Cloud Function. `TenantStore` (`src/stores/TenantStore.tsx`) não cria mais tenant algum — se `getTenantsForUser` retornar vazio nesse ponto (não deveria, dado o `waitForProvisioning`), trata como falha de provisionamento (`initError`) em vez de criar um tenant no client.

### Limite de membros — adição atômica via Cloud Function

`TenantMember` é criado/removido por duas Cloud Functions callable, **não** por escrita direta do client no Firestore (`match /tenants/{tenantId}/members/{memberId}` nega `create`/`delete` para qualquer client nas Security Rules):

- `addTenantMember` (`functions/src/infrastructure/handlers/addTenantMember.ts`): recebe `{ tenantId, userId, role, displayName, email, photoURL }`, exige que o chamador seja admin do tenant (`AddTenantMemberUseCase`) e delega a `FirebaseTenantRepository.addMemberIfWithinLimit` (Admin SDK), que roda uma `db.runTransaction` lendo `tenant.memberCount`/`memberLimit`, valida o limite e escreve o membro + incrementa o contador **na mesma transação**. Se o tenant foi criado antes desta feature (sem `memberCount`), a primeira chamada faz um `count()` na subcoleção `members` como baseline (self-heal). Lança `MEMBER_LIMIT_REACHED` → `HttpsError('resource-exhausted', ...)` quando o limite já foi atingido. O primeiro membro (dono) de um tenant novo **não** passa por aqui — é adicionado pelo bootstrap (`onUserCreated`, ver acima), que chama `addMemberIfWithinLimit` diretamente.
- `removeTenantMember`: simétrica, decrementa `memberCount` (floor em 0) na mesma transação da exclusão.

Rodar a lógica no Admin SDK (em vez de `runTransaction` do client + Security Rules) é o que garante que **duas adições concorrentes** (ex: dois admins em computadores diferentes clicando "Adicionar" para a última vaga) nunca ultrapassem o limite: o protocolo de transação do Firestore serializa as duas chamadas no servidor, e não existe nenhuma escrita direta que um client possa fazer para bypassar a checagem. `updateMemberRole` continua sendo escrita direta do client (não mexe no contador, sem risco de corrida).

Client: `src/data/repositories/FirebaseTenantRepository.ts` chama as duas functions via `httpsCallable` (mesmo padrão de `claimNickname`, ver "Fluxo OAuth do Gmail" para outro exemplo de Cloud Function callable); `resource-exhausted` é convertido em `TenantMemberLimitReachedError` (`src/domain/errors/index.ts`) para o ViewModel de `TenantSettings/MembersTab` mostrar uma mensagem específica e desabilitar o formulário quando `memberCount >= memberLimit`.

### Entidade Person

```typescript
interface Person {
  id: string;
  tenantId: string;
  type: 'Pessoa Física' | 'Pessoa Jurídica';
  name: string;
  cpf?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  address?: PersonAddress | null;
  occupation?: string | null;
  nationality?: string | null;
  maritalStatus?: string | null;
  birthDate?: Date | null;
  notes?: string | null;
  tagIds?: string[];           // IDs das PersonTags aplicadas
  status: 'Ativo' | 'Inativo';
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}
```

### Entidade PersonTag

Tags de tenant para classificação de pessoas. Visíveis a todos os membros do tenant.

```typescript
interface PersonTag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
}
```

Coleção Firestore: `tenants/{tenantId}/personTags/{id}`

### Entidade PersonNote

Anotações vinculadas a uma pessoa. Visíveis a todos os membros. Exclusão restrita a admin.

```typescript
interface PersonNote {
  id: string;
  personId: string;
  tenantId: string;
  text: string;
  createdBy: string;     // userId
  createdByName: string;
  createdAt: Date;
}
```

Coleção Firestore: `tenants/{tenantId}/persons/{personId}/notes/{id}`

### Entidade PersonDocument

Documentos anexados a uma pessoa. Upload vai ao Storage; só o URL é salvo no Firestore. Exclusão restrita a admin.

```typescript
interface PersonDocument {
  id: string;
  personId: string;
  tenantId: string;
  name: string;          // nome original do arquivo
  url: string;           // download URL do Storage
  storagePath: string;   // path no Storage para exclusão
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}
```

Coleção Firestore: `tenants/{tenantId}/persons/{personId}/documents/{id}`
Storage path: `tenants/{tenantId}/persons/{personId}/{timestamp}_{filename}`

### Entidade Case (Processo)

```typescript
interface Case {
  id: string;
  tenantId: string;
  number?: string;         // Número CNJ ou interno
  title: string;
  personId: string;
  personName: string;
  status: 'active' | 'archived' | 'won' | 'lost' | 'settled' | 'suspended';
  area: CaseArea;          // 'civil' | 'criminal' | 'trabalhista' | ...
  phase?: CasePhase;
  court?: string;
  judge?: string;
  opposingParty?: string;
  responsibleLawyerId?: string;    // nome do advogado é resolvido em tempo de renderização via useTenant().members
  contractId?: string | null;      // Contrato vinculado — Contract (único; um Processo pertence a no máximo 1 Contrato); número resolvido via useContractStore()
  parties: CaseParty[];
  description?: string;
  openedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Entidade Contract (Contrato)

```typescript
type ContractLookupKind =
  | 'types' | 'categories' | 'statuses' | 'objects'
  | 'adjustmentIndexes' | 'adjustmentPeriodicities'
  | 'currencies' | 'paymentMethods' | 'banks' | 'costCenters';

interface ContractLookupConfig {
  key: string;
  label: string;
  color?: string;  // usado por 'statuses'
  isStatic?: boolean;
}

interface Contract {
  id: string;
  tenantId: string;
  number: string;                 // "AB1234" — sugerido automaticamente, editável, único por tenant
  title: string;
  type: string;                   // lookup 'types'
  category: string;               // lookup 'categories'
  status: string;                 // lookup 'statuses' (com cor)
  object?: string | null;         // lookup 'objects' (só dinâmico)
  contractorIds: string[];        // Contratante — Pessoa[]
  contracteeIds: string[];        // Contratado — Pessoa[]
  witnessIds: string[];           // Testemunhas — Pessoa[]
  contractorLawyerIds: string[];  // Advogado do Contratante — Pessoa[]
  contracteeLawyerIds: string[];  // Advogado do Contratado — Pessoa[]
  clientId?: string | null;       // Cliente — Pessoa (única)
  responsibleId?: string | null;  // Responsável — Pessoa (única)
  draftedAt?: Date | null;
  signedAt?: Date | null;
  effectiveStart?: Date | null;
  effectiveEnd?: Date | null;
  autoRenewal: boolean;
  renewalDate?: Date | null;
  terminationDate?: Date | null;
  initialValue?: number | null;
  monthlyValue?: number | null;
  totalValue?: number | null;
  adjustmentIndex?: string | null;        // lookup
  adjustmentPeriodicity?: string | null;  // lookup
  currency?: string | null;               // lookup
  paymentMethod?: string | null;          // lookup
  dueDay?: number | null;         // 1-31
  installments?: number | null;
  bank?: string | null;           // lookup (só dinâmico)
  bankAccount?: string | null;    // texto livre "agência / número"
  pixKey?: string | null;
  costCenter?: string | null;     // lookup (só dinâmico)
  tagIds?: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}
```

**Padrão de lookups:** ao contrário de `Case` (um repositório Firebase por kind), `Contract` usa o **padrão genérico de `Person`**: uma única `IContractLookupRepository`/`FirebaseContractLookupRepository` parametrizada por `ContractLookupKind`, com `COLLECTION_NAMES` e `STATIC_DEFAULTS` mapeados por kind. Motivo: `Contract` tem 10 kinds de lookup — replicar o padrão de `Case` geraria 10 pares de interface/implementação redundantes. `ContractLookupStore` guarda os 10 arrays num único `useState<Record<ContractLookupKind, ContractLookupConfig[]>>` internamente, mas expõe getters nomeados individualmente (`typeConfigs`, `categoryConfigs`, etc.) para manter a mesma ergonomia de uso nos ViewModels.

**Valores estáticos por kind:** `types` (13 valores: Prestação de serviços, Compra e venda, Locação, ...), `categories` (15 valores: Cível, Empresarial, ...), `statuses` (8 valores com cor: Em elaboração, Em revisão, Aguardando assinatura, Vigente, Suspenso, Encerrado, Cancelado, Rescindido), `adjustmentIndexes` (INPC, IPCA), `adjustmentPeriodicities` (Anual), `currencies` (Real), `paymentMethods` (À vista, À prazo, Boleto, Cartão de Crédito). `objects`, `banks` e `costCenters` não têm valores estáticos — são só dinâmicos por tenant.

**Cores de status:** tokens `contractStatus*` em `shared/styles/theme.ts` (replicados nos 9 temas, mesmo padrão de `caseStatus*`).

Coleções Firestore: `tenants/{tenantId}/contracts/{id}`, `tenants/{tenantId}/contractTags/{id}`, `tenants/{tenantId}/contractTypes`, `contractCategories`, `contractStatuses`, `contractObjects`, `contractAdjustmentIndexes`, `contractAdjustmentPeriodicities`, `contractCurrencies`, `contractPaymentMethods`, `contractBanks`, `contractCostCenters`.

**Relação Processo ↔ Contrato:** um `Contract` pode ter vários `Case` vinculados, mas cada `Case` pertence a no máximo 1 `Contract`. A chave estrangeira vive no lado "muitos" (`Case.contractId`, sem espelho de número — o número do contrato é resolvido em tempo de renderização via `useContractStore()`, mesmo padrão de `responsibleLawyerId`) — não existe array `caseIds` em `Contract`. A aba "Processos" de `ViewContract` deriva a lista de processos vinculados filtrando `useCaseStore().cases` por `contractId` em memória (via `useMemo`), sem query Firestore adicional nem índice composto, já que `CaseStore` carrega a lista de `cases` do tenant inteira. Vincular/desvincular é um `updateCase(caseId, { contractId })` comum. Ao excluir um `Contract`, `DeleteContractUseCase` desvincula (não exclui) os `cases` filhos antes de apagar o contrato (ver "Cascata de Exclusão").

### Entidade ContractNote

Anotações vinculadas a um contrato. Mesmo padrão de `PersonNote`/`CaseNote`. Coleção: `tenants/{tenantId}/contracts/{contractId}/notes/{id}`.

### Entidade ContractDocument

Documentos anexados a um contrato. Mesmo padrão de `PersonDocument`/`CaseDocument`. Coleção: `tenants/{tenantId}/contracts/{contractId}/documents/{id}`. Storage path: `tenants/{tenantId}/contracts/{contractId}/{timestamp}_{filename}`.

### Componente CurrencyInput — máscara monetária PT-BR

`presentation/components/ui/CurrencyInput.tsx` é um componente reutilizável para campos de valor monetário (usado nos campos "Valor inicial", "Valor mensal" e "Valor total" de `Contract`; disponível para reuso em `Financial` e futuras entidades).

- Props: `value: number | null`, `onChange: (value: number | null) => void`, `placeholder?`, `disabled?`, `id?`.
- Totalmente controlado, sem estado interno: a cada tecla extrai os dígitos do input e os interpreta como centavos (mesmo padrão de apps bancários — digita-se da direita para a esquerda). O texto exibido é sempre `formatCurrencyBRL(value)`.
- Helpers em `utils/formatters.ts`: `formatCurrencyBRL(value)` (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`) e `parseCurrencyDigits(raw)`.
- Reutiliza o styled-component `Input` de `ui/Input.tsx` — nenhum CSS duplicado.

### Componente DateInput — campo de data padrão

`presentation/components/ui/DateInput.tsx` é o **único** componente permitido para campos de data em todo o sistema. Nunca use `<input type="date">` diretamente nem crie outro wrapper — todo formulário, filtro ou edição inline que capture uma data usa `DateInput`.

- Props: `value: string` (formato `YYYY-MM-DD`, o mesmo de `<input type="date">`), `onChange: (value: string) => void`, `disabled?`, `id?`.
- Totalmente controlado, sem estado interno. Exibe um botão de limpar (`×`) quando há valor e o campo não está desabilitado.
- Estilização já usa o tema (`theme.colors.inputBackground`, `theme.colors.border`, etc.) — não duplique o CSS de input de data em outro lugar.
- Ao adicionar uma entidade com campo de data (ex: `dueDate`, `completedAt`, data de vencimento), o formulário correspondente (`.view.tsx`) deve renderizar `<DateInput value={...} onChange={...} />`, com a conversão de/para `Date` feita no ViewModel.

### Componente MarkerChip — badge de seleção com marcador lateral

`presentation/components/ui/MarkerChip/` é o componente padrão para chips coloridos e clicáveis que alternam a visibilidade de uma série/categoria em legendas de gráfico (ex.: tipos de prazo em "Análise de Prazos", categorias em "Distribuição por Categoria" do Financeiro). Substitui o padrão antigo de preencher o badge inteiro com a cor quando selecionado.

- Props: `color: string` (hex ou token resolvido do tema), `active: boolean`, `onClick?: () => void`, `children: React.ReactNode`.
- **Selecionado (`active=true`)**: fundo transparente, sem borda ao redor — a cor aparece só como um marcador discreto na borda esquerda (3px). Texto em `theme.colors.text`.
- **Não selecionado (`active=false`)**: mantém o badge "cheio" tradicional — borda de 1px na cor, fundo transparente, opacidade reduzida (`0.5`), preenchendo com a cor no hover. Esse é o estado "como já era antes" preservado de propósito para diferenciar visualmente o que está oculto.
- Puro átomo de apresentação (sem `useState`/efeitos) — não tem `.viewmodel.tsx`, só `.view.tsx` + `.styles.tsx`, no padrão de `TagIconButton`.
- Ao adicionar uma nova legenda de gráfico com toggle de série, use `<MarkerChip color={...} active={...} onClick={...}>{label}</MarkerChip>` em vez de criar um styled-component de badge ad-hoc.

### Entidade Deadline (Prazo)

```typescript
interface Deadline {
  id: string;
  tenantId: string;
  title: string;
  type: DeadlineType;       // 'judicial' | 'extrajudicial' | 'internal' | 'hearing' | 'meeting'
  caseId?: string;                 // título/número do processo resolvidos em tempo de renderização via useCaseStore()
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  responsibleLawyerId?: string;    // nome do advogado resolvido em tempo de renderização via useTenant().members
  description?: string;
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Entidade Financial (Financeiro)

```typescript
type FinancialType = 'Receita' | 'Despesa';
type PaymentMethod = 'PIX' | 'Transferência' | 'Dinheiro' | 'Cartão' | 'Cheque' | 'Outro';

interface Financial {
  id: string;
  tenantId: string;
  caseId?: string | null;          // número do processo resolvido em tempo de renderização via useCaseStore()
  personId?: string | null;        // nome da pessoa resolvido em tempo de renderização via usePersonStore()
  contractId?: string | null;      // número do contrato resolvido em tempo de renderização via useContractStore()
  type: FinancialType;
  category: string;          // dinâmico via FinancialLookupConfig (kind: 'categories')
  costCenter?: string | null; // dinâmico, reaproveita o mesmo lookup de Centro de Custo de Contract (kind: 'costCenters')
  amount: number;            // Sempre positivo; type determina se é entrada ou saída
  dueDate: Date;
  paymentDate?: Date | null;
  cancelDate?: Date | null;
  status: string;            // dinâmico via FinancialLookupConfig (kind: 'statuses'); valores: 'Aberto', 'Pago', 'Cancelado'
  paymentMethod?: PaymentMethod | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  tagIds?: string[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}
```

`category` e `status` seguem o mesmo padrão Estático + Dinâmico de `Contract` (ver "Valores Estáticos e Dinâmicos"), com lookup próprio (`FinancialLookupConfig`/`FinancialLookupKind`, coleções `financialCategories`/`financialStatuses`). `costCenter` **não** tem coleção própria: reaproveita o lookup `costCenters` de `useContractLookup()`, para que Contratos e Financeiro compartilhem a mesma lista de centros de custo do escritório. `caseId`/`personId`/`contractId` não guardam nome/número espelhado — são resolvidos em tempo de renderização a partir dos respectivos stores (`useCaseStore`/`usePersonStore`/`useContractStore`); ao excluir um `Contract`, os `financials` vinculados são desvinculados (ver "Cascata de Exclusão"). Não há campo de descrição livre: `category` é o identificador principal exibido nos cards e nas abas.

### Entidade FinancialTag

Tags de tenant para classificação de lançamentos financeiros. Mesmo padrão de `PersonTag`/`CaseTag`/`ContractTag`: repositório, usecases (`financialtags/`) e store (`FinancialTagStore`/`useFinancialTagStore`) próprios, sem entidade `Tag` genérica compartilhada.

```typescript
interface FinancialTag {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  createdAt: Date;
  createdBy: string;
}
```

Coleção Firestore: `tenants/{tenantId}/financialTags/{id}`

### Entidade FinancialDocument

Documentos anexados a um lançamento financeiro. Mesmo padrão de `PersonDocument`/`CaseDocument`/`ContractDocument`. Coleção: `tenants/{tenantId}/financials/{financialId}/documents/{id}`. Storage path: `tenants/{tenantId}/financials/{financialId}/{timestamp}_{filename}`.

`type` referencia a `key` de um `DocumentTypeConfig` — o catálogo de tipos de documento (coleção `tenants/{tenantId}/documentTypes`, acessado via `useDocumentTypeLookup()`) é **compartilhado por tenant** entre Pessoa, Processo, Contrato, Financeiro e Notícias: um tipo criado em qualquer uma dessas telas aparece nas demais. O documento em si, porém, é sempre filho de uma única entidade — não há coleção `documents` genérica.

### Entidade NewsDocument

Documentos anexados a uma notícia (aba "Documentos" em `ViewNews`). Mesmo padrão visual e de UX de `PersonDocument`/`CaseDocument`/`ContractDocument`/`FinancialDocument`, mas **não** é filho de subcoleção de tenant: como `News` pode ser do Sistema (`tenantId: null`, visível a todos) ou de um escritório específico, `NewsDocument` segue o mesmo padrão de `NewsComment` — coleção de topo `newsDocuments/{id}` com campo `newsId` apontando para a notícia. Storage path: `news/{newsId}/{timestamp}_{filename}` (também fora do prefixo `tenants/{tenantId}/...`).

```typescript
interface NewsDocument {
  id: string;
  newsId: string;
  name: string;
  type?: string;
  description?: string;
  url: string;
  storagePath: string;
  createdBy: string;
  createdByName: string;
  createdByPhotoUrl?: string;
  createdAt: Date;
}
```

Upload e exclusão exigem a mesma permissão de edição da notícia (`canEdit` em `ViewNews.viewmodel.tsx`: autor, admin do tenant da notícia, ou ADMIN do sistema para notícias do Sistema); leitura é aberta a qualquer autenticado, mesmo padrão de `NewsComment` — ver "Firestore Security Rules" para detalhes.

### Entidade Push

Notificações de e-mail recebidas de tribunais (PJe) processadas automaticamente pela Cloud Function `gmailPush`. Armazenadas por tenant para isolamento de dados. Contém dados processuais extraídos via regex ou IA.

```typescript
interface Push {
  id: string;
  tenantId: string;
  emailId: string;              // ID único do email no Gmail (evita duplicatas)
  from: string;
  to: string;
  subject: string;
  receivedAt: Date;
  emailBodyHtml?: string;
  emailBodyText?: string;
  // Dados processuais extraídos
  processNumber?: string;       // Número CNJ do processo
  court?: string;               // TJBA, TJMA, etc.
  activeParty?: string;         // Polo ativo
  passiveParty?: string;        // Polo passivo
  legalClass?: string;          // Classe processual
  filingDate?: Date;            // Data de distribuição
  distributionType?: string;    // Tipo de distribuição
  processSubject?: string;      // Assunto do processo
  movements?: PushMovement[];   // Movimentações do processo
  status: 'pending' | 'reviewed' | 'archived';
  parsedByAI: boolean;          // true se foi parseado por IA (fallback)
  parsingError?: string;        // Erro de parsing se houver
  createdAt: Date;
  createdBy: string;            // 'system' para pushes criados pela Cloud Function
}

interface PushMovement {
  date: Date;
  type: string;
  description: string;
  documentUrl?: string;
}
```

Coleção Firestore: `tenants/{tenantId}/pushes/{id}`

**Índice composto necessário:**
```
Coleção: pushes (subcoleção de tenants)
Campos indexados: emailId (Ascending), processNumber (Ascending)
```
**Motivo:** Um único email pode conter múltiplas intimações (múltiplos processos). A verificação de duplicação usa `emailId + processNumber` para identificar pushes únicos. Sem este índice, a query com dois `where` falhará.

Crie no Firebase Console → Firestore → Índices.

**Cloud Function:** `gmailPush` (Pub/Sub trigger) processa notificações do Gmail, extrai dados via parsers específicos por tribunal (TJBAEmailParser, TJMAEmailParser), e cria registros de Push. Parsers usam regex para extração estruturada; fallback para IA (GPT/Claude) se regex falhar.

### Entidade PushInteraction

Rastreamento de interação do usuário com pushes (lido/não lido). Estrutura similar a `NewsInteraction` para consistência.

```typescript
interface PushInteraction {
  id: string;               // Formato: {userId}_{pushId}
  userId: string;
  pushId: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}
```

Coleção Firestore: `pushInteractions/{uid}_{pushId}` (raiz)

**Motivação da estrutura raiz:** Permite query eficiente por `userId` para calcular contador de não lidos sem carregar todos os pushes do tenant.

---

## Módulo de Auditoria (Audit Logs)

Trilha de auditoria imutável e automática das principais entidades de negócio do tenant. **Nunca é escrita pelo frontend** — só Cloud Functions (Admin SDK) criam documentos em `auditLogs`; o frontend só lê (tela "Auditoria").

### Entidade AuditLog

```typescript
type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SYSTEM';
type AuditSeverity = 'LOW' | 'HIGH' | 'CRITICAL';
type AuditType = 'AUDIT' | 'ERROR';

interface AuditLog {
  id: string;
  tenantId: string;        // 'SYSTEM' para eventos sem tenant (erro global do pipeline)
  title: string;            // ex: "Alteração na entidade de Pessoas"
  userId: string;
  userName: string;
  photoURL: string;
  action: AuditAction;
  severity: AuditSeverity;  // default 'LOW'
  type: AuditType;          // default 'AUDIT'
  entity: string;           // 'Person' | 'Case' | ... | 'Tenant' | 'SYSTEM'
  entityId: string;
  entityLink?: string;      // deeplink opcional, ex: 'view-case:abc123'
  text: string;             // Markdown (frase + bloco json com o diff)
  createdAt: Date;
  expiresAt: Date;          // createdAt + 30 dias — TTL do Firestore
}
```

Coleção Firestore: `auditLogs/{id}` (raiz, flat — isolamento via campo `tenantId` + Security Rules, não subcoleção).

### Captura automática — Cloud Functions

Em vez de uma Cloud Function por coleção monitorada (o que exigiria ~17 deploys), o Curatino usa **duas triggers com wildcard no nome da coleção**, cada uma com uma tabela de configuração interna (`functions/src/domain/services/auditableEntities.ts`) decidindo o que é auditável — coleções fora da allowlist (lookups, `aiConnections`, etc.) são ignoradas rapidamente:

| Handler | Trigger | Cobre |
|---|---|---|
| `auditFlatEntityChange` | `onDocumentWritten('tenants/{tenantId}/{collection}/{docId}')` | `persons`, `cases`, `contracts`, `deadlines`, `financials`, `members`, `personTags`, `caseTags`, `contractTags`, `financialTags`, `pushes` |
| `auditNestedEntityChange` | `onDocumentWritten('tenants/{tenantId}/{parent}/{parentId}/{sub}/{docId}')` | `notes`/`documents` de `persons`/`cases`/`contracts` (+ `documents` de `financials`) |
| `auditTenantDeleted` | `onDocumentDeleted('tenants/{tenantId}')` | Exclusão do escritório inteiro — sempre `severity: 'CRITICAL'` |
| `auditNewsChange` / `auditNewsCommentChange` / `auditNewsTagChange` | `onDocumentWritten('news/{docId}')` / `'newsComments/{docId}'` / `'newsTags/{docId}'` | Notícias, Comentários de Notícias e Etiquetas de Notícias — ver subseção própria abaixo |
| `backupDeletedAuditLog` | `onDocumentDeleted('auditLogs/{logId}')` | Backup frio no Storage (ver abaixo) |

Uma entrada de `auditableEntities.ts` pode restringir quais ações geram log via `auditActions?: AuditAction[]`. Único caso hoje: `pushes` audita só `['UPDATE', 'DELETE']` — a criação é automática (Cloud Function do webhook do Gmail), então não é um evento administrativo digno de log; a triagem manual do status e a exclusão são.

**Diff e Markdown** (`functions/src/domain/services/auditDiff.ts`): `computeChangedFields` retorna um `FieldDiff { before, after }` com os valores **antigos e novos** de cada campo alterado (UPDATE); `normalizeAllFields` retorna todos os campos do documento (DELETE). Ambos normalizam `Timestamp`/`Date` para o formato brasileiro `dd/mm/aaaa` (ou `dd/mm/aaaa HH:mm` quando o horário não é meia-noite), para o JSON ficar legível em português. `buildAuditText` monta a frase + bloco **Antes:** (UPDATE e DELETE) + bloco **Depois:** (só UPDATE) em \`\`\`json\`\`\`; CREATE não inclui bloco (nada "mudou" ainda).

**Autoria:** CREATE/UPDATE usam os campos denormalizados `updatedBy`/`updatedByName`/`updatedByPhotoURL` (adicionados a `Person`, `Case`, `Contract`, `Deadline`, `Financial`, `PersonTag`, `CaseTag`, `ContractTag`, `FinancialTag`, `TenantMember` — preenchidos pelo frontend a cada update) quando presentes; senão a Cloud Function resolve via `UserProfileLookupService`.

**DELETE tem stamp próprio** (`deletedBy`/`deletedByName`/`deletedByPhotoURL`, mesmo padrão de `updatedBy*`), gravado por um `updateDoc` que antecede o `deleteDoc` — ver `stampDeletionActor` (`src/data/utils/stampDeletionActor.ts`), chamado por todo `Firebase[Entidade]Repository.delete*` das entidades auditadas (flat e nested). O tipo `DeletionActor` (`domain/entities/index.ts`) e o `actor` são montados no Store (via `useAuth()`) para entidades com Store próprio, ou no ViewModel para notes/documents (que não têm Store, chamam o UseCase direto) — nunca no Repository, que não tem acesso a `AuthContext`. As triggers (`auditFlatEntityChange`/`auditNestedEntityChange`) preferem `deletedBy*` do snapshot `before`; só caem no fallback antigo (`updatedBy`/`createdBy`, para flat, ou só `createdBy`, para nested) se o documento não tiver o stamp — caso de documentos já apagados antes desta mudança.

Membro de tenant (`TenantMember`) é removido via Cloud Function callable (`removeTenantMember`), não pelo client — o stamp é gravado direto pelo Admin SDK em `FirebaseTenantRepository.removeMember`, num `update` separado da transação de exclusão (um único commit não aceita `update` e `delete` no mesmo documento — o segundo sobrescreve o primeiro).

**Nome efetivo do usuário — prioridade única em todo o sistema:** `userProfiles.nickname` > `userProfiles.fullName` > `users.displayName` > `users.email`. No frontend isso é `effectiveName`, calculado em `stores/AuthContext.tsx` e usado em **todo** carimbo de autoria (`createdByName`, `updatedByName`, `authorName`, `editedByName`, `authorizedByName`, nome do membro/dono ao criar um tenant) — nunca leia `user.displayName` diretamente para gravar autoria. No backend, `UserProfileLookupService.resolveActor` (`functions/src/data/services/UserProfileLookupService.ts`) espelha exatamente a mesma ordem, lendo `userProfiles/{uid}` e `users/{uid}` em paralelo.

**Severidade:** `DELETE` → `HIGH`; mudança do campo `role` em `members` → `HIGH`; exclusão de `Tenant` → `CRITICAL`; erro não tratado no próprio pipeline → `type: 'ERROR'` + `severity: 'CRITICAL'` (auto-monitoramento, escrito com try/catch próprio que nunca lança — ver `logAuditError`); tudo mais fica no default `LOW`/`AUDIT`.

**Filtro de ruído:** updates onde só mudaram campos de bookkeeping (`updatedAt`, `updatedBy*`) não geram log — evita entradas vazias quando um formulário é salvo sem alteração real.

**Resolução de nomes de FK.** Sem tratamento, um campo que guarda o id de outra entidade (ex: `clientId` de Contrato, `activePoleIds` de Processo, ou um campo personalizado do tipo "Referência" criado no Screen Builder) apareceria no bloco JSON só como id cru — ilegível para o usuário do escritório. `auditFlatEntityChange` resolve isso **no momento da escrita**, antes de `buildAuditText`, chamando `IFkNameEnricherService.enrichDiff(tenantId, collection, screenKey, diff)` (`data/services/FkNameEnricherService.ts`), que:

1. Consulta `STATIC_FK_SCHEMA` (`domain/services/auditFkSchema.ts`) — tabela declarativa dos campos FK "de código" das entidades fixas (ex: `financials.caseId → cases`, `contracts.contractorIds → persons`, `*.tagIds → *Tags`). Só entram aqui campos **sem** um irmão já desnormalizado no próprio diff (`caseId`+`caseNumber` juntos, por exemplo, não precisam de resolução extra).
2. Para coleções que suportam campos personalizados (`persons`, `cases`, `deadlines`, `financials`, `contracts`, `customRecords`), busca o `ScreenDefinition` do `screenKey` (o nome da própria coleção para as fixas; `data.screenKey` para Registros Personalizados) e monta o mesmo tipo de schema para todo `FieldDefinition` com `type === 'reference'` — cobrindo tanto referências a entidades fixas quanto a **outra tela dinâmica** (nesse caso `refEntity` não é uma das 5 chaves fixas, e o alvo cai sempre em `customRecords`, já que todo registro de tela personalizada mora nessa única coleção, diferenciado por `screenKey`).
3. Coleta todos os ids referenciados em `before`/`after`, deduplica por `(coleção, id)` e busca todos de uma vez com `Firestore.getAll(...refs)` — uma única chamada em lote, não uma query por campo.
4. Substitui cada id (ou cada item de um array de ids) pelo nome de exibição (`AuditableEntityConfig.getDisplayName`, a mesma função já usada para nomear a entidade principal do log) — mantendo o id como fallback se o documento referenciado não existir mais (ex: já excluído).

O nome fica **congelado no `text` do log como era no momento do evento** — se a entidade referenciada for renomeada depois, o histórico não muda retroativamente (comportamento correto para uma trilha de auditoria). Coleções sem nenhum campo FK conhecido (`members`, `*Tags`, `pushes`, `screenDefinitions`) não disparam nenhuma leitura extra — `enrichDiff` retorna o diff inalterado assim que a tabela de schema resolvida está vazia.

### Auditoria de Notícias, Comentários de Notícias e Etiquetas de Notícias

`news/{id}`, `newsComments/{id}` e `newsTags/{id}` são coleções **raiz** (fora de `tenants/{tenantId}/...`), então não são cobertas pelas triggers genéricas — ganham três triggers dedicadas em `functions/src/infrastructure/handlers/auditNewsEntityChange.ts`, todas auditando CREATE/UPDATE/DELETE:

- **`tenantId` do log:** `News.tenantId` já existe no documento (`null` = notícia do Sistema, string = notícia do escritório) — usa-se `?? 'SYSTEM'`. `NewsComment` não guarda `tenantId` próprio — a trigger busca o `news/{newsId}` pai para herdar o valor. `NewsTag` não tem conceito de tenant (etiqueta é por usuário) — sempre `'SYSTEM'`. Um log com `tenantId: 'SYSTEM'` só aparece para o papel `SYSTEM` (mesmo mecanismo de "Todas os Escritórios" já usado pelo erro global do pipeline).
- **Ator (CREATE/UPDATE):** nenhuma das três entidades tem um uid de editor denormalizado — `News`/`NewsComment` guardam `authorName`/`authorPhotoURL` na criação e só `editedByName` (sem uid) na edição. O log usa esse nome quando presente; o `userId` do log usa o `userId` do autor original. `NewsTag` não denormaliza nada — sempre resolve via `UserProfileLookupService`.
- **Ator (DELETE):** as três entidades têm o mesmo stamp `deletedBy`/`deletedByName`/`deletedByPhotoURL` das demais entidades auditadas (ver "Autoria de exclusão"), gravado por `stampDeletionActor` antes do `deleteDoc` em `FirebaseNewsRepository`/`FirebaseNewsCommentRepository`/`FirebaseNewsTagRepository`. `resolveNewsActor`/`resolveNewsActorUid` (`auditNewsEntityChange.ts`) preferem esse stamp; só caem para `userId`/`resolveActor` se o documento não tiver `deletedBy` (legado).
- **Filtro de ruído próprio:** além dos campos de bookkeeping padrão, essas triggers ignoram `likeCount`/`likedBy`/`viewCount`/`commentCount` (News) e `likeCount`/`likedBy` (NewsComment) — são escritas de engajamento do usuário (curtir, visualizar, contador de comentários), não uma ação administrativa. Por isso `computeChangedFields`/`normalizeAllFields` aceitam um terceiro parâmetro opcional `extraIgnoredKeys: string[]`.
- **`entityLink`:** `view-news:{id}` para Notícias e para Comentários (aponta para o post pai via `newsId`); Etiquetas não têm link, igual às demais `*Tags`.

### Retenção (TTL) e backup frio

`expiresAt` é calculado como `createdAt + 30 dias`. **Passo manual obrigatório:** habilitar a política de TTL no Firestore Console (Firestore → TTL → coleção `auditLogs`, campo `expiresAt`) — não é configurável via código/regra.

Toda exclusão de um `AuditLog` (manual ou via TTL) dispara `backupDeletedAuditLog`, que salva uma cópia em JSON no Storage antes de ser perdida:
- `tenants/{tenantId}/logs/{entity}/{logId}.json` (um arquivo por log, pasta por entidade)
- `systemLogs/{entity}/{logId}.json` quando `tenantId === 'SYSTEM'`

O upload seta `metadata.metadata.firebaseStorageDownloadTokens` (`crypto.randomUUID()`) manualmente — diferente do SDK client-side (`uploadBytes`, usado em todo o resto do app para anexos), o Admin SDK **não** gera esse token sozinho, e sem ele o botão "Download" do Firebase Console (e `getDownloadURL()`) não consegue montar a URL do arquivo.

### Tela de Auditoria (frontend)

`presentation/pages/AuditLogs/` (MVVM + `AuditLogCard/`, padrão de `News/`+`NewsCard`). Somente leitura — `AuditLogStore` **não usa `onSnapshot`** (desvio deliberado do padrão dos outros stores): como `auditLogs` cresce indefinidamente, a store faz busca paginada por cursor (`limit` + `startAfter`) sob demanda via `IAuditLogRepository.getPage`. Acesso restrito a admin do tenant (e SYSTEM, que vê todos os escritórios via filtro "Todos os Escritórios" — usa `ITenantRepository.getAllTenants()`, exclusivo para SYSTEM). Item de navegação em `WorkspaceSidebar` só aparece para esses papéis (`NavItem.requiresTenantAdmin`). O card usa `MarkdownContent` para renderizar `text`, com "Ver mais/Ver menos" (estado `expandedIds` no ViewModel da página, não no card) e um botão de deeplink quando `entityLink` existe.

**Filtros — só o escopo de escritório vai para o Firestore.** `IAuditLogRepository.getPage` só aceita `tenantId` (+ paginação) — é a **única** query real (`where('tenantId','==',X) + orderBy('createdAt','desc')`), exigindo um **único** índice composto (`auditLogs`: `tenantId` ASC, `createdAt` DESC — ver seção de índices). Os filtros de Entidade/Ação/Severidade/Busca do `CompositeFilter` são aplicados **client-side**, em `AuditLogs.viewmodel.tsx`, sobre a página já carregada — decisão deliberada para não exigir um índice composto por combinação de filtro (`tenantId`+`entity`, `tenantId`+`action`, etc.), o que tornaria o setup inicial muito mais frágil. Trade-off aceito: um filtro pode não encontrar resultados que existem em páginas ainda não carregadas — nesse caso, use "Carregar mais" antes de filtrar.

Abaixo do `CompositeFilter`, um `<InfoBanner variant="info">` fixo avisa sobre a retenção de 30 dias (mesmo padrão de tarja informativa usado em outras telas — nunca `<p>`/`<div>` ad-hoc).

### Registro de falhas do frontend (`IAuditLogService`)

Único canal pelo qual o **frontend** contribui para `auditLogs` — preserva a invariante "nunca é escrita pelo frontend" porque não escreve direto no Firestore: chama a Cloud Function callable `logClientError` (`functions/src/infrastructure/handlers/logClientError.ts`), que valida que o chamador é membro do tenant (`ITenantMemberRepository.isMember`), resolve o autor via `UserProfileLookupService.resolveActor` (nunca confia em nome/foto vindos do cliente) e grava com Admin SDK através do `LogClientErrorUseCase` → `CreateAuditLogUseCase` já existente. `severity: 'CRITICAL'` e `type: 'ERROR'` são fixados no backend, não configuráveis pelo chamador.

**Quando usar:** só para **exceptions não tratadas** — um `catch` genérico de uma operação inesperada (ex: falha ao decodificar uma resposta que deveria ser sempre válida), ou o `ErrorBoundary` global (`presentation/components/layout/AppErrorBoundary/`, que envolve `WorkspaceShell` em `App.tsx` e chama o serviço em `componentDidCatch`). **Nunca** para validação de campo/formulário nem para erros de negócio esperados (ex: "e-mail já cadastrado", limite de membros atingido) — esses continuam usando `notify(...)`.

**Como usar:**
```typescript
const { auditLogService } = useDI();
await auditLogService.logError({
  tenantId: currentTenant.id,
  title: 'Título curto do que falhou',
  entity: 'NOME_DA_ENTIDADE_OU_FRONTEND',
  entityId: opcional,
  entityLink: opcional,
  error, // o Error capturado, ou qualquer valor de um catch
});
```
`FirebaseAuditLogService` (`data/services/FirebaseAuditLogService.ts`) **nunca lança** — qualquer falha na própria chamada é só logada no console — por isso é seguro chamar de dentro de um `catch`/boundary sem `try/catch` adicional (mesmo espírito do `logAuditError` do backend, que "nunca lança").

### Badge de falhas críticas não lidas

Ao lado do item "Auditoria" no `WorkspaceSidebar` aparece um badge com a contagem de logs `severity: 'CRITICAL'` não lidos do tenant atual — mesmo mecanismo visual de News/Pushes (`S.NavBadge`/`S.NavBadgeDot`). Só é controlado leitura/não-lida para `CRITICAL`; os demais tipos de log não têm esse conceito.

Em vez de replicar o padrão de interação por item (`pushInteractions`/`newsInteractions`, um doc por usuário+item com toggle individual), usa-se um **cursor de leitura**: um único doc por `(userId, tenantId)` em `auditLogReadCursors/{userId}_{tenantId}` guardando `lastReadAt`. Não lidas = logs `CRITICAL` do tenant com `createdAt > lastReadAt` (`IAuditLogRepository.subscribeToCriticalUnread`, `onSnapshot` com `limit(100)` como teto de segurança). Abrir a tela de Auditoria (`AuditLogs.viewmodel.tsx`) chama `markAllCriticalAsRead`, que avança o cursor para "agora" e zera o badge — não há como marcar um log individual como não lido de novo. Essa escolha é deliberada: é mais simples, gera menos escritas que um doc por log, e reflete exatamente o comportamento pedido ("marcar como lida ao abrir a tela"), diferente de News/Pushes onde cada item é lido individualmente.

`AuditLogAlertStore`/`useAuditLogAlert` só assina a query de não lidas quando há `currentTenant` **e** o usuário é admin do tenant ou `SYSTEM` — mesma condição de visibilidade do item de menu, e também a única em que a Security Rule de `auditLogs` permite a leitura.

---

## Fluxo Multi-Tenant

```
Login Google
    ↓
AuthContext (onAuthStateChanged)
    ↓
TenantStore.loadTenantsForUser(userId)
    ├── usa collectionGroup('members').where('userId', '==', userId)
    ├── se nenhum tenant → cria automaticamente "Escritório de [displayName]"
    │       com o usuário como TenantMember { role: 'admin' }
    └── salva lista em tenants[]
         ↓
TenantSelector (usuário escolhe qual escritório)
    ↓
setCurrentTenant(tenant)
    ├── persiste tenantId em localStorage['curatino:lastTenantId']
    └── PersonStore, CaseStore, DeadlineStore, FinancialStore
          iniciam onSnapshot() do tenant selecionado
```

---

## RBAC — Controle de Acesso

### Papéis globais

| Role | Descrição |
|---|---|
| `SYSTEM` | Acesso total ao sistema. Gerencia usuários e escritórios na tela de Gestão de Acessos. Age como admin em qualquer tenant, mesmo sem ser membro (ver todos no seletor de tenant). Apenas outro `SYSTEM` pode atribuir esta role. |
| `SUPPORT` | Age como admin em qualquer tenant, mesmo sem ser membro — vê todos os escritórios no seletor de tenant e pode operar seus dados para dar suporte. **Não** tem acesso à tela de Gestão de Acessos (não gerencia roles globais nem plano/limite de escritórios). Só `SYSTEM` atribui esta role. |
| `USER` | Papel padrão atribuído no primeiro login. |

### Papéis por tenant (`TenantRole`)

| Role | Descrição |
|---|---|
| `admin` | Gerencia membros, configura o escritório, acessa tudo. |
| `lawyer` | Cria e edita processos, prazos, financeiro. |
| `secretary` | Cria pessoas e prazos, visualiza processos. |
| `user` | Somente leitura dos dados do escritório. |

### Proteção de telas

1. **Sidebar**: itens filtrados por role em `WorkspaceSidebar.viewmodel.tsx`
2. **ViewModel**: verifica role antes de expor ações destrutivas
3. **Firestore Security Rules**: enforce server-side (ver seção completa abaixo)

---

## Estrutura de Pastas

```
src/
├── domain/
│   ├── entities/
│   │   └── index.ts               # Todas as entidades e tipos do Curatino
│   ├── repositories/
│   │   ├── IAuthRepository.ts
│   │   ├── IUserProfileRepository.ts
│   │   ├── IAIConnectionRepository.ts
│   │   ├── ITenantRepository.ts
│   │   ├── IPersonRepository.ts
│   │   ├── ICaseRepository.ts
│   │   ├── IContractRepository.ts
│   │   ├── IContractTagRepository.ts
│   │   ├── IContractNoteRepository.ts
│   │   ├── IContractDocumentRepository.ts
│   │   ├── IContractLookupRepository.ts   # genérico, parametrizado por ContractLookupKind
│   │   ├── IDeadlineRepository.ts
│   │   ├── IFinancialRepository.ts
│   │   ├── IFinancialTagRepository.ts
│   │   ├── IPushRepository.ts
│   │   ├── IPushInteractionRepository.ts
│   │   ├── INewsRepository.ts
│   │   ├── INewsTagRepository.ts
│   │   ├── INewsInteractionRepository.ts
│   │   ├── INewsCommentRepository.ts
│   │   ├── INewsDocumentRepository.ts
│   │   ├── ISavedFilterRepository.ts
│   │   ├── IWorkflowDefinitionRepository.ts
│   │   ├── IWorkflowExecutionRepository.ts
│   │   └── IStepCatalogRepository.ts
│   └── usecases/
│       ├── auth/
│       ├── userprofile/
│       ├── aiconnections/
│       ├── tenants/
│       ├── persons/
│       ├── cases/
│       ├── contracts/
│       ├── contracttags/
│       ├── contractnotes/
│       ├── contractdocuments/
│       ├── deadlines/
│       ├── financials/
│       ├── financialtags/
│       ├── pushes/
│       ├── pushinteractions/
│       ├── news/
│       ├── newstags/
│       ├── newsinteractions/
│       ├── newscomments/
│       ├── newsdocuments/
│       ├── workflows/
│       ├── workflowexecutions/
│       └── stepcatalog/
│
├── data/
│   ├── repositories/
│   │   ├── FirebaseAuthRepository.ts
│   │   ├── FirebaseUserProfileRepository.ts
│   │   ├── FirebaseAIConnectionRepository.ts
│   │   ├── FirebaseTenantRepository.ts
│   │   ├── FirebasePersonRepository.ts
│   │   ├── FirebaseCaseRepository.ts
│   │   ├── FirebaseContractRepository.ts
│   │   ├── FirebaseContractTagRepository.ts
│   │   ├── FirebaseContractNoteRepository.ts
│   │   ├── FirebaseContractDocumentRepository.ts
│   │   ├── FirebaseContractLookupRepository.ts
│   │   ├── FirebaseDeadlineRepository.ts
│   │   ├── FirebaseFinancialRepository.ts
│   │   ├── FirebaseFinancialTagRepository.ts
│   │   ├── FirebasePushRepository.ts
│   │   ├── FirebasePushInteractionRepository.ts
│   │   ├── FirebaseNewsRepository.ts
│   │   ├── FirebaseNewsTagRepository.ts
│   │   ├── FirebaseNewsInteractionRepository.ts
│   │   ├── FirebaseNewsCommentRepository.ts
│   │   └── FirebaseSavedFilterRepository.ts
│   └── storage/
│       └── FirebaseStorageRepository.ts
│
├── infrastructure/
│   ├── firebase/
│   │   └── config.ts              # Inicialização do Firebase (lê .env)
│   ├── di/
│   │   ├── DIContainer.tsx        # Cria instâncias dos repositórios
│   │   └── useDI.ts               # Hook para consumir o DI
│   ├── events/
│   │   └── StoreEventEmitter.ts   # Pub/sub entre stores
│   └── deeplink/
│       └── deepLinkUtils.ts
│
├── shared/
│   ├── types/index.ts             # Re-exporta aliases de domain/entities
│   └── styles/
│       ├── theme.ts               # Tokens dark/light/claude/teams/bruma/kindle/curatino/themis/themisDark
│       ├── GlobalStyles.ts
│       └── styled.d.ts
│
├── stores/
│   ├── AuthContext.tsx + useAuth.ts
│   ├── ThemeContext.tsx + useTheme.ts
│   ├── TenantStore.tsx + useTenant.ts
│   ├── PersonStore.tsx + usePersonStore.ts
│   ├── CaseStore.tsx + useCaseStore.ts
│   ├── ContractStore.tsx + useContractStore.ts
│   ├── ContractTagStore.tsx + useContractTagStore.ts
│   ├── ContractLookupStore.tsx + useContractLookup.ts
│   ├── DeadlineStore.tsx + useDeadlineStore.ts
│   ├── FinancialStore.tsx + useFinancialStore.ts
│   ├── FinancialTagStore.tsx + useFinancialTagStore.ts
│   ├── PushStore.tsx + usePush.ts
│   ├── PushInteractionStore.tsx + usePushInteraction.ts
│   ├── NewsStore.tsx + useNews.ts
│   ├── NewsTagStore.tsx + useNewsTag.ts
│   ├── NewsInteractionStore.tsx + useNewsInteraction.ts
│   ├── SavedFilterStore.tsx + useSavedFilter.ts
│   ├── WorkspaceStore.tsx + useWorkspace.ts
│   ├── CommandPaletteContext.tsx + useCommandPalette.ts
│   └── NotificationContext.tsx + useNotification.ts
│
└── presentation/
    ├── pages/
    │   ├── Login/
    │   ├── TenantSelector/
    │   ├── Dashboard/
    │   ├── Calendar/
    │   ├── Persons/
    │   ├── ViewPerson/
    │   ├── Cases/
    │   ├── ViewCase/
    │   ├── Contracts/
    │   ├── ViewContract/
    │   ├── Deadlines/
    │   ├── Financials/
    │   ├── Pushes/
    │   ├── DashboardPushes/
    │   ├── News/
    │   ├── AddNews/
    │   ├── ViewNews/
    │   ├── TenantSettings/
    │   ├── AccessManagement/
    │   └── Profile/
    └── components/
        ├── ui/          # Átomos: Button, Badge, Modal, SearchSelect, ...
        └── layout/      # WorkspaceShell, WorkspaceSidebar, TabBar, ...
```

---

## Cloud Functions — Organização e Deploy

### Estrutura

```
functions/
├── src/
│   ├── index.ts                        # Exporta todas as funções (SEM prefixos)
│   └── infrastructure/
│       └── handlers/
│           ├── callAIProxy.ts
│           ├── getUserInfo.ts
│           ├── onUserCreated.ts
│           ├── addTenantMember.ts
│           ├── gmailPush.ts
│           ├── auditFlatEntityChange.ts
│           ├── onWorkflowEventCreated.ts
│           └── workflow/
│               ├── onNoteChange.ts
│               └── onDocumentChange.ts
├── package.json                        # Scripts de build
└── tsconfig.json
```

### Grupos Funcionais

As Cloud Functions são organizadas em **6 grupos** para facilitar deploys seletivos:

| Grupo | Funções | Quando alterar |
|---|---|---|
| **workflow** | Motor de automações | Mais frequente |
| **audit** | Sistema de auditoria | Quando adicionar nova entidade auditada |
| **auth** | Autenticação e usuários | Raras alterações |
| **tenant** | Gestão de membros | Raras alterações |
| **gmail** | Integração Gmail | Quando alterar push notifications |
| **util** | Utilitários gerais | Proxy AI, logs de erro, cascata |

### Regras para Adicionar Nova Cloud Function

**⚠️ OBRIGATÓRIO:** Toda nova Cloud Function **DEVE** ser adicionada ao grupo correto no `package.json` raiz. Functions não incluídas nos scripts de deploy não serão implantadas nos ambientes de produção.

1. **Criar o handler** em `functions/src/infrastructure/handlers/[nome].ts`
2. **Exportar em `functions/src/index.ts`** sem prefixo:
   ```typescript
   export { minhaNovaFuncao } from './infrastructure/handlers/minhaNovaFuncao';
   ```
3. **Adicionar ao grupo correto no `package.json` raiz:**
   - Identificar o grupo funcional (workflow, audit, auth, tenant, gmail ou util)
   - Adicionar a função no script `deploy:[grupo]` correspondente
   - Nome EXATO como exportado no `index.ts` (sem prefixos `auth_`, `workflow_`, etc)
4. **Documentar no `functions/DEPLOY.md`:**
   - Adicionar a função na seção do grupo correspondente
   - Incluir breve descrição do propósito da função
   - Mencionar dependências ou triggers (Firestore, Pub/Sub, onCall, etc)

**Exemplo:** nova função de workflow `executeCustomAction`

```typescript
// functions/src/infrastructure/handlers/executeCustomAction.ts
export const executeCustomAction = onCall(async (request) => {
  // implementação
});

// functions/src/index.ts
export { executeCustomAction } from './infrastructure/handlers/executeCustomAction';
```

**Atualizar `package.json` raiz:**
```json
"deploy:workflow": "npm run build:functions && firebase deploy --only functions:onWorkflowEventCreated,functions:publishWorkflowEventOnEntityChange,functions:onNoteChange,functions:onDocumentChange,functions:getExpressionFunctions,functions:getWorkflowStepCatalog --project curatino"
```

### Deploy

```bash
# Deploy apenas do grupo alterado (mais rápido: 1-2min)
npm run deploy:workflow
npm run deploy:audit
npm run deploy:auth
# ... etc

# Deploy de todas as functions (5-8min)
npm run deploy:functions

# Deploy completo (functions + hosting)
npm run deploy
```

**IMPORTANTE:** O script `deploy:[grupo]` já executa `npm run build:functions` automaticamente — nunca rode deploy sem compilar o TypeScript.

### Checklist ao Criar Cloud Function

- [ ] Handler criado em `functions/src/infrastructure/handlers/`
- [ ] Exportado em `functions/src/index.ts` **sem prefixo**
- [ ] Adicionado ao script `deploy:[grupo]` correto no `package.json` raiz
- [ ] Nome no `package.json` idêntico à exportação do `index.ts`
- [ ] **Documentado em `functions/DEPLOY.md`** na seção do grupo correspondente (workflow, audit, auth, tenant, gmail, util)
- [ ] Se usa triggers Firestore, índices compostos documentados (se necessário)
- [ ] Se altera Security Rules, atualizar seção "Firestore Security Rules" deste arquivo

---

## Padrão MVVM por Pasta

**REGRA OBRIGATÓRIA:** Toda página e todo componente com estado é uma pasta com 3 arquivos.

### `.styles.tsx`
- Exporta o objeto `S` com todos os styled-components
- Zero lógica — apenas CSS-in-JS
- Cores/fontes/espaçamentos **sempre** via tema (`${({ theme }) => theme.colors.primary}`)
- Props customizadas com prefixo `$` obrigatório: `styled.div<{ $active?: boolean }>`

### `.viewmodel.tsx`
- Exporta a interface `[Nome]ViewModel` e o hook `use[Nome]ViewModel()`
- Contém: `useState`, `useMemo`, `useCallback`, `useEffect`, handlers async
- **Zero** JSX
- `ref.current` **apenas** dentro de `useEffect` / `useLayoutEffect` / handlers
- Ao retornar uma `RefObject` na interface, declara com `| null`: `React.RefObject<HTMLInputElement | null>`

### `.view.tsx`
- Chama `use[Nome]ViewModel()` no topo e renderiza exclusivamente o que o ViewModel retorna
- **Zero** `useState`, `useReducer`, `useEffect`, `useRef`, lógica de negócio
- **Nunca lê `ref.current`** — passar `ref={vm.algumRef}` a um DOM element é permitido

**ViewModel é obrigatório** se o componente tem estado, efeitos, refs, callbacks complexos ou acessa Stores/DI.
**Opcional** para componentes que só renderizam props (`Button`, `Badge`, `Card`).

---

## Use Cases — Padrão Factory

```typescript
// Tipo (contrato)
export type CreatePersonUseCase = {
  execute: (tenantId: string, data: Omit<Person, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => Promise<Person>;
};

// Factory
export const makeCreatePersonUseCase = (repo: IPersonRepository): CreatePersonUseCase => ({
  execute: (tenantId, data) => repo.createPerson(tenantId, data),
});
```

**Nomenclatura:** `[Ação][Entidade]UseCase` / `make[Ação][Entidade]UseCase`
**Motivo do factory:** compatibilidade com `erasableSyntaxOnly` do TypeScript.

---

## Valores Estáticos e Dinâmicos — Padrão de Configuração

Para entidades que possuem **valores padrão (estáticos)** e **valores customizados (dinâmicos) por tenant**, use o padrão de **Config com fallback**.

### Quando usar

- A entidade tem valores padrão que devem existir mesmo sem configuração do usuário
- O tenant pode adicionar valores personalizados (mas mantém os padrões)
- Exemplos: áreas processuais, status, fases, instâncias, categorias de notícias

### Estrutura do padrão

#### 1. Tipo de configuração (`domain/entities/index.ts`)

```typescript
export interface CaseAreaConfig {
  key: string;
  label: string;
}

export interface CaseStatusConfig {
  key: string;
  label: string;
  color: string;  // Obrigatório quando há representação visual por cor
}

export interface CasePhaseConfig {
  key: string;
  label: string;
  color?: string; // Opcional quando cor é contextual
}
```

**Regra:** `color` é obrigatório (`color: string`) se todos os valores devem ter cor; opcional (`color?: string`) se é configurável.

#### 2. Interface do repositório (`domain/repositories/I[Entidade]Repository.ts`)

```typescript
import type { CaseAreaConfig } from '../entities';

export interface ICaseAreaRepository {
  getAll(tenantId: string): Promise<CaseAreaConfig[]>;
}
```

#### 3. Implementação Firebase com merge (`data/repositories/Firebase[Entidade]Repository.ts`)

```typescript
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseAreaRepository } from '../../domain/repositories/ICaseAreaRepository';
import type { CaseAreaConfig } from '../../domain/entities';

const DEFAULT_CASE_AREAS: CaseAreaConfig[] = [
  { key: 'Cível', label: 'Cível' },
  { key: 'Criminal', label: 'Criminal' },
  { key: 'Trabalhista', label: 'Trabalhista' },
  { key: 'Tributário', label: 'Tributário' },
  { key: 'Família', label: 'Família' },
  // ... demais valores padrão
];

export class FirebaseCaseAreaRepository implements ICaseAreaRepository {
  async getAll(tenantId: string): Promise<CaseAreaConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'caseAreas');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamicAreas = snap.docs.map((d) => ({
        key:   d.data().key   as string,
        label: d.data().label as string,
      }));
      // Remove valores DEFAULT que foram sobrescritos no Firestore (mesmo key)
      const dynamicKeys = new Set(dynamicAreas.map((a) => a.key));
      const staticAreas = DEFAULT_CASE_AREAS.filter((a) => !dynamicKeys.has(a.key));
      // Retorna estáticos + dinâmicos, ordenados
      return [...staticAreas, ...dynamicAreas].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return DEFAULT_CASE_AREAS;
    }
  }
}
```

**Regras:**
- Constante `DEFAULT_[ENTIDADE]` no topo do arquivo
- **Sempre** retorna merge de valores estáticos + dinâmicos
- Valores dinâmicos (Firestore) sobrescrevem estáticos com mesmo `key`
- `catch` retorna apenas DEFAULT em caso de erro de conexão

#### 4. Registro no DIContainer (`infrastructure/di/DIContainer.tsx`)

```typescript
import { FirebaseCaseAreaRepository } from '../../data/repositories/FirebaseCaseAreaRepository';
// ...
const container = useMemo<DIContainer>(() => ({
  // ...
  caseAreaRepository: new FirebaseCaseAreaRepository(),
  // ...
}), []);
```

#### 5. Uso no Store (`stores/CaseLookupStore.tsx`)

```typescript
const { caseAreaRepository, casePhaseRepository, caseStatusRepository } = useDI();
const [areaConfigs, setAreaConfigs] = useState<CaseAreaConfig[]>([]);

const refresh = useCallback(async () => {
  if (!currentTenant) return;
  const areas = await caseAreaRepository.getAll(currentTenant.id);
  setAreaConfigs(areas);
}, [currentTenant, caseAreaRepository]);
```

Exponha `areaConfigs` (etc.) na interface do Store. **Não** exponha constantes estáticas nem faça merge manual no ViewModel.

#### 6. Uso no ViewModel (`presentation/pages/.../[Nome].viewmodel.tsx`)

```typescript
const { areaConfigs, phaseConfigs, statusConfigs } = useCaseLookup();

const areaOptions = useMemo<FilterOption[]>(() =>
  areaConfigs.map((a) => ({ value: a.key, label: a.label })),
  [areaConfigs],
);

const statusOptions = useMemo<FilterOption[]>(() =>
  statusConfigs.map((s) => ({ value: s.key, label: s.label, color: s.color })),
  [statusConfigs],
);
```

**Proibido:**
- ❌ Constantes hardcoded no ViewModel (`const AREAS = ['Cível', 'Criminal', ...]`)
- ❌ Merge manual de estático + dinâmico
- ❌ Mapas de cores hardcoded (`{ 'Em Andamento': theme.colors.info, ... }`)

**Correto:**
- ✅ Única fonte de dados: configuração do Store
- ✅ Cores vêm do campo `color` da Config
- ✅ Fallback transparente (ViewModel não sabe se é estático ou dinâmico)

### Vantagens do padrão

1. **Fonte única de verdade:** dados sempre vêm do repositório, nunca hardcoded
2. **Merge automático:** tenant novo recebe valores padrão; tenants existentes recebem padrão + customizados
3. **Extensibilidade:** tenant pode criar valores personalizados sem perder os padrão
4. **Sobrescrita por key:** valor dinâmico com mesmo `key` substitui o estático
5. **Manutenibilidade:** alterar padrões = editar a constante DEFAULT no repositório
6. **Consistência:** ViewModels não se preocupam com origem (estática ou dinâmica)

---

## DI Container

`DIContainer.tsx` cria instâncias únicas dos repositórios e as disponibiliza via `useDI()`.

```tsx
const { tenantRepository, personRepository } = useDI();
const createPerson = makeCreatePersonUseCase(personRepository);
await createPerson.execute(tenantId, data);
```

**Para trocar de backend:**
1. Crie `RestPersonRepository` implementando `IPersonRepository`
2. Substitua `new FirebasePersonRepository()` no `DIContainer.tsx`
3. Nenhum outro arquivo muda

---

## Stores — Padrão e Separação

Cada store é **dois** arquivos:

- `stores/[Nome]Store.tsx` — Provider (componente React), exporta **apenas** o Provider
- `stores/use[Nome].ts` — Context, tipo da interface e hook `use[Nome]()`

Arquivos `.tsx` exportam **apenas** componentes React. Hooks e tipos ficam em `.ts`.

### Responsabilidades dos stores do Curatino

| Store | Responsabilidade |
|---|---|
| `AuthStore` | Usuário autenticado, `userRole`, `signIn`, `signOut`, `reloadUserProfile` |
| `TenantStore` | Lista de tenants do usuário, `currentTenant`, `setCurrentTenant`, CRUD de membros |
| `PersonStore` | Pessoas do tenant atual, CRUD de pessoas |
| `PersonTagStore` | Etiquetas de pessoas do tenant atual, CRUD de tags, aplicação de tags em pessoas |
| `CaseStore` | Processos do tenant atual, CRUD de processos |
| `ContractStore` | Contratos do tenant atual, CRUD de contratos |
| `ContractTagStore` | Etiquetas de contratos do tenant atual, CRUD de tags, aplicação de tags em contratos |
| `ContractLookupStore` | Configs estático+dinâmico dos 10 lookups de contrato (tipo, categoria, status, objeto, índice/periodicidade de reajuste, moeda, forma de pagamento, banco, centro de custo) |
| `DeadlineStore` | Prazos do tenant atual, CRUD + `completeDeadline` |
| `FinancialStore` | Receitas/despesas do tenant atual, CRUD + `markPaid` |
| `FinancialTagStore` | Etiquetas de lançamentos financeiros do tenant atual, CRUD de tags, aplicação de tags em lançamentos |
| `PushStore` | Pushes do tribunal do tenant atual, CRUD + `updateStatus` |
| `PushInteractionStore` | Rastreamento de leitura de pushes por usuário |
| `NewsStore` | Notícias do sistema + do tenant atual, CRUD + curtidas |
| `NewsTagStore` | Etiquetas de boletins |
| `NewsInteractionStore` | Leitura, salvos, curtidas por usuário |
| `WorkspaceStore` | Tabs abertas no shell, tab ativa |
| `ThemeStore` | Tema visual com persistência em localStorage (`'curatino-theme'`) |
| `WorkflowStore` | Automações (`WorkflowDefinition`) do tenant atual — CRUD de definição + steps embutidos. Execuções (`WorkflowExecution`) e catálogo de Steps são lidos direto via `useDI()` nas viewmodels de `ViewWorkflow`, sem store próprio (dado local à página, não compartilhado entre telas) |

### Stores que dependem do tenant

`PersonStore`, `CaseStore`, `ContractStore`, `DeadlineStore`, `FinancialStore`, `PushStore`, `WorkflowStore` escutam `currentTenant` via `useTenant()`. Se `currentTenant` for `null`, limpam o estado e não fazem queries.

---

## StoreEventEmitter — Notificação entre Stores

`infrastructure/events/StoreEventEmitter.ts` é um singleton pub/sub. Stores emitem eventos ao mutar dados; stores que dependem desses dados assinam e chamam `refresh()`.

### Eventos registrados

| Evento | Emitido por | Assina |
|---|---|---|
| `PERSONS_UPDATED` | `PersonStore` | — |
| `CASES_UPDATED` | `CaseStore` | `DeadlineStore` (atualiza nomes de processo nos prazos) |
| `CONTRACTS_UPDATED` | `ContractStore` | — |
| `CONTRACT_TAG_UPDATED` | `ContractTagStore` | — |
| `DEADLINES_UPDATED` | `DeadlineStore` | — |
| `FINANCIALS_UPDATED` | `FinancialStore` | — |
| `FINANCIAL_TAG_UPDATED` | `FinancialTagStore` | — |
| `PUSH_UPDATED` | `PushStore` | `PushInteractionStore` (re-sincroniza contadores) |
| `NEWS_UPDATED` | `NewsStore` | `NewsTagStore`, `NewsInteractionStore` |
| `WORKFLOWS_UPDATED` | `WorkflowStore` | — |

### Regra para nova entidade com store próprio

1. Adicione o evento em `StoreEventEmitter.ts`
2. Emita em cada mutação (create/update/delete)
3. Assine eventos dos stores de que depende

---

## Refresh Automático por Visibilidade

**Todo store de dados deve escutar `visibilitychange`** para re-sincronizar com o Firestore quando o usuário volta à aba:

```typescript
useEffect(() => {
  const handle = () => {
    if (!document.hidden && currentTenant) void refresh();
  };
  document.addEventListener('visibilitychange', handle);
  return () => document.removeEventListener('visibilitychange', handle);
}, [refresh, currentTenant]);
```

---

## Cascata de Exclusão

| Entidade excluída | O use case deve remover |
|---|---|
| `Tenant` | Todos os members, persons, cases, deadlines, financials, pushes do tenant |
| `Person` | Todos os `cases` onde a pessoa está em `activePoleIds` ou `passivePoleIds` (cada um cascateando como a linha `Case` abaixo); todos os `financials` onde `personId === id` |
| `Case` | Todos os `deadlines` onde `caseId === id`; todos os `financials` onde `caseId === id` |
| `Contract` | Desvincula (não exclui) todos os `cases` onde `contractId === id`, limpando `contractId`; desvincula (não exclui) todos os `financials` onde `contractId === id`, limpando `contractId` |
| `Deadline` | — (folha) |
| `Financial` | — (folha) |
| `Push` | Todos os `pushInteractions` onde `pushId === id` — **cascata roda no backend** (ver nota abaixo) |
| `PushInteraction` | — (folha) |

`makeDeletePersonUseCase`/`makeDeleteCaseUseCase` (`domain/usecases/persons/DeletePersonUseCase.ts`, `domain/usecases/cases/DeleteCaseUseCase.ts`) implementam a cascata acima, no mesmo padrão factory multi-repositório já usado por `makeDeleteContractUseCase`. `Person` → `Case` usa `ICaseRepository.getCasesByPerson`, que busca por `array-contains` em `activePoleIds` e `passivePoleIds` (duas queries, mescladas e deduplicadas em memória — Firestore não faz OR entre dois campos array numa única query). Todo `delete*` cascateado recebe o mesmo `DeletionActor` do disparo original, para a auditoria creditar corretamente quem excluiu, mesmo nos filhos.

**Exceção — cascata de `Push` roda na Cloud Function, não no use case:** `pushInteractions` é coleção raiz (não tenant-scoped) e sua Security Rule só permite que cada usuário escreva/apague a própria interação (`request.resource.data.userId == request.auth.uid`) — não haveria como o `DeletePushUseCase` do client (rodando como o admin que está excluindo o `Push`, não como cada usuário que leu/interagiu com ele) apagar as interações de outras pessoas. Por isso a cascata é feita por `cascadeDeletePushInteractions` (`functions/src/infrastructure/handlers/cascadeDeletePushInteractions.ts`), um `onDocumentDeleted('tenants/{tenantId}/pushes/{pushId}')` que usa Admin SDK (ignora as regras) para apagar todos os `pushInteractions` daquele `pushId`. `PushInteraction` não é uma entidade auditada (fora da allowlist de `auditableEntities.ts`), então essa cascata não gera entradas em `auditLogs`.

---

## Estilização — Regras

- Styled-components **apenas** em `[Nome].styles.tsx`, exportados no objeto `S`
- Nunca `style={{}}` inline, nunca `className`, nunca `.css`
- Props customizadas com prefixo `$` obrigatório
- **Cor/fonte/tamanho sempre via tema** — nunca hex literal, `rgba()`, valores hardcoded, nem concatenação de opacidade (`${theme.colors.danger}22`). Se faltar um token, adicione-o ao tema — nunca contorne.
- Única exceção: cor vinda de dado externo (ex: cor de tag do Firestore) passa como prop `$color` e aplica diretamente, incluindo variações de opacidade via concatenação.

---

## Fluxo de Dados

**Leitura:**
```
Firebase → Repository → Store (via onSnapshot) → use[Store]() → ViewModel → View
```

**Mutação:**
```
View (evento) → ViewModel (handler) → Store (método) → UseCase → Repository → Firebase
                                     ↑ setState local otimista + emit(EVENTO_UPDATED)
```

---

## Como Adicionar uma Nova Feature

### 1. Entidade nova (ex: `Task`)

1. Adicione a interface `Task` em `domain/entities/index.ts`
2. Crie `domain/repositories/ITaskRepository.ts`
3. Crie use cases em `domain/usecases/tasks/`
4. Crie `data/repositories/FirebaseTaskRepository.ts` (subcoleção `tenants/{tenantId}/tasks`)
5. Registre no `DIContainer.tsx` e em `useDI.ts`
6. Crie `stores/TaskStore.tsx` + `stores/useTaskStore.ts`
7. Adicione `StoreEvents.TASKS_UPDATED` e emita/assine onde necessário
8. Adicione o Provider em `App.tsx`

### 2. Página nova (ex: `Tasks`)

1. Crie a pasta `presentation/pages/Tasks/` com os 3 arquivos MVVM
2. Adicione `{ key: 'tasks', title: 'Tarefas', ... }` em `pageRegistry.tsx`
3. Adicione o item em `WorkspaceSidebar.viewmodel.tsx` > `NAV_ITEMS`
4. Crie `index.ts` re-exportando a View

### 3. Campo novo em entidade existente

1. Atualize a interface em `domain/entities/index.ts`
2. Atualize o repositório Firebase (conversor `fromFirestore`)
3. Atualize o use case de create/update
4. Atualize a UI (ViewModel + View)
5. Atualize as Firestore Security Rules se o campo precisar de proteção

---

## Dependências Principais

| Pacote | Versão | Uso |
|---|---|---|
| `react` | 19 | UI |
| `typescript` | 5.x | Tipagem |
| `vite` | 6.x | Bundler |
| `firebase` | 11.x | Backend (Firestore, Auth, Storage, Functions) |
| `styled-components` | 6.x | CSS-in-JS |
| `react-icons` | 5.x | Ícones (prefixo `Ri`) |
| `date-fns` | 4.x | Manipulação de datas |
| `eslint-plugin-react-hooks` | 6.x | React Compiler rules |

---

## Variáveis de Ambiente

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Nunca commite `.env`. O arquivo `.env.example` documenta as chaves sem valores.

---

## Telas Dinâmicas e Campos Customizados (Personalização)

Recurso que permite ao **admin do tenant** criar telas próprias em runtime e adicionar campos personalizados às telas padrão (Pessoas, Processos, Contratos, Financeiro, Prazos). Página de configuração: `presentation/pages/ScreenBuilder` (chave `screen-builder`, visível só para admin do tenant).

### Modelo de metadados

Um único doc `ScreenDefinition` em `tenants/{tenantId}/screenDefinitions/{screenKey}` descreve tanto telas dinâmicas quanto os campos extras das telas padrão:

- **Tela dinâmica:** `builtin: false`. O doc id (`screenKey`) é o slug do título plural, gerado na criação e imutável. Possui `titleSingular/titlePlural`, `icon` (chave do set curado em `presentation/shared/screenIcons.tsx`), `fields`, `titleFieldKey` (campo texto obrigatório usado como título do registro na aba e no ⌘K), `hasNotes`/`hasDocuments`/`hasTags` (recursos opcionais), `sidebarOrder` e `enabled` (desativa sem excluir).
- **Campos das telas padrão:** `builtin: true` com doc id fixo igual à coleção da entidade (`persons`, `cases`, `contracts`, `financials`, `deadlines`). Criado lazy no primeiro save. Somente `fields` é relevante.

`FieldDefinition`: `key` (slug do label na criação; **imutável** — renomear o label não altera a key, preservando dados e histórico de auditoria), `label`, `type` (`text | textarea | number | currency | date | checkbox | select | masked | reference` — **type também é imutável** após criação), `required`, `order`, `section`, `options` (estáticas, para `select`), `optionsAllowUserAdd`, `multi`, `mask` (`cpf | cnpj | phone | cep`), `refEntity` (coleção padrão ou screenKey dinâmico), `placeholder`, `showInList`, `filterable`.

**Opções dinâmicas de selects** (adicionadas inline por usuários com escrita, padrão `DynamicSelect`) vivem na subcoleção `tenants/{tid}/screenDefinitions/{screenKey}/fieldOptions/{id}` (`{ fieldKey, key, label, createdBy, createdAt }`) — fora do doc da definição para não afrouxar a rule de update (só admin edita a definição) e evitar corrida de escrita no array `fields`.

### Registros das telas dinâmicas

Coleção única `tenants/{tenantId}/customRecords/{id}` com discriminador `screenKey`, `title` denormalizado (valor do `titleFieldKey`, recalculado a cada save) e `values: Record<fieldKey, valor>`. Convenção de tipos em `values` (e em `customValues` das entidades padrão): text/textarea/masked → `string` (masked guarda formatado); number/currency → `number | null`; date → `string 'YYYY-MM-DD'`; checkbox → `boolean`; select/reference single → `string | null`; multi → `string[]`.

Toda tela dinâmica consulta por `where('screenKey','==',X) + orderBy('createdAt','desc') + limit(500)` — exige o índice composto documentado abaixo.

### Camadas

- Conversões e validações puras: `domain/services/customFieldValues.ts` (`slugifyFieldKey`, `ensureUniqueKey`, `buildInitialFormValues`, `formValuesToStoredValues`, `validateRequiredFields`, `resolveRecordTitle`, `sortFieldsByOrder`).
- Repositórios: `FirebaseScreenDefinitionRepository` (upsert preserva `createdAt/createdBy`; delete remove antes as subcoleções `fieldOptions` e `tags` e grava o stamp `deletedBy*`) e `FirebaseCustomRecordRepository`.
- Stores: `ScreenDefinitionStore` (definições + `fieldOptionsByField` + `tagsByScreen`, eventos `SCREEN_DEFINITIONS_UPDATED`) e `CustomRecordStore` (registros por tela, `allRecords` para o ⌘K, eventos `CUSTOM_RECORDS_UPDATED`; depende do `ScreenDefinitionStore` — ordem dos providers em `App.tsx`).

### Anotações e Documentos em telas dinâmicas

- Habilitados por tela via `hasNotes`/`hasDocuments` na definição; aparecem como abas em `ViewDynamicRecord` (padrão idêntico ao `ViewContract`).
- Subcoleções `tenants/{tid}/customRecords/{recordId}/notes|documents`, com `screenKey` **denormalizado em cada doc** (usado pelo link da auditoria nested). Arquivos no Storage em `tenants/{tid}/customRecords/{recordId}/{ts}_{arquivo}` (máx. 20 MB).
- Repositórios `FirebaseCustomRecordNote/DocumentRepository` + use cases `customrecordnotes/`/`customrecorddocuments/` — gerenciados direto no ViewModel (sem store global), tipo de documento via `useDocumentTypeLookup`.
- `DeleteCustomRecordUseCase` cascateia: exclui notas, documentos (incluindo arquivos do Storage) e então o registro.
- Auditoria: pares `customRecords/notes` e `customRecords/documents` no `NESTED_ENTITY_CONFIG`.

Nota: a subcoleção `fieldOptions` (opções dinâmicas de selects) **não** está no `NESTED_ENTITY_CONFIG` — não gera log de auditoria hoje.

### Etiquetas em telas dinâmicas

- Habilitadas por tela via `hasTags` na definição; a tela de detalhe (`ViewDynamicRecord`) exibe um botão "Gerenciar etiquetas" no cabeçalho (mesmo ícone/posição do `ViewPerson`/`ViewContract`), as etiquetas aplicadas como pills abaixo do título, um filtro "Etiqueta" na listagem (`DynamicRecordList`) e as pills no card da listagem — tudo condicionado a `definition.hasTags`.
- Diferente de `PersonTag`/`ContractTag` (tenant-scoped, uma coleção por tela padrão), a etiqueta de tela dinâmica é **exclusiva por `screenKey`**: `CustomRecordTag` (`{ name, color, createdBy, createdAt, ... }`) vive na subcoleção `tenants/{tid}/screenDefinitions/{screenKey}/tags/{id}` — mesmo racional de isolamento do `fieldOptions` (não afrouxar a rule de update da definição).
- `CustomRecord.tagIds?: string[]` guarda as etiquetas aplicadas a cada registro (mesmo padrão de `Person.tagIds`/`Contract.tagIds`); atualizado via `useCustomRecords().updateRecord(recordId, screenKey, { tagIds })`.
- CRUD de etiquetas: `IScreenDefinitionRepository.getTags/createTag/updateTag/deleteTag` (mesmo repositório de `fieldOptions`, por serem ambos filhos de `screenDefinitions`) + use cases `screendefinitions/{Get,Create,Update,Delete}ScreenTagUseCase` + `ScreenDefinitionStore.tagsByScreen`/`createTag`/`updateTag`/`deleteTag`.
- UI reaproveita o componente genérico `ui/TagManager` (já usado por Pessoa/Contrato) via um `TagStoreAdapter` construído em `ViewDynamicRecord.viewmodel` — nenhum componente de UI novo foi necessário.
- Auditoria: par `screenDefinitions/tags` no `NESTED_ENTITY_CONFIG` (`functions/src/domain/services/auditableEntities.ts`), `entityKey: 'CustomRecordTag'`; como o pai já é o próprio `screenKey` (diferente de `customRecords/notes`, que precisa de `screenKey` denormalizado), `getEntityLink` usa `parentId` direto para montar `dyn:{screenKey}` (abre a listagem da tela).

### Auditoria e ⌘K

- `screenDefinitions` e `customRecords` estão na allowlist de `functions/src/domain/services/auditableEntities.ts` ("Tela Personalizada" e "Registro Personalizado"). O link da entidade de um registro usa o `screenKey` do próprio doc (`view-dyn:{screenKey}:{docId}`) — para isso, `getEntityLink` ganhou um 4º parâmetro opcional com os dados do documento, preenchido por `auditFlatEntityChange`.
- O diff de auditoria (`auditDiff.ts`) **achata um nível** os mapas `values` e `customValues`: alterações aparecem como `values.data-de-aniversario` no Antes/Depois, em vez do mapa inteiro.
- Busca no ⌘K: `DynamicRecordCommandProvider` (grupo "Telas Personalizadas") busca registros por título e oferece "Abrir {titlePlural}" por tela; os dados entram no `CommandPaletteAppContext` via `useCustomRecords().allRecords` e `useScreenDefinitions().definitions`.
- **Deploy:** as entradas de allowlist e o flatten do diff exigem deploy das Cloud Functions junto do release correspondente.

### Navegação e renderização

- **tabKeys** (builders/parser em `shared/constants/dynamicScreenKeys.ts`): `dyn:{screenKey}` (listagem), `new-dyn:{screenKey}`, `new-dyn:{screenKey}:clone:{recordId}` e `view-dyn:{screenKey}:{recordId}`. Os três prefixos estão registrados no `pageRegistry` apontando para `DynamicRecordList` e `ViewDynamicRecord`; o título real da aba é definido em runtime via `setTabTitle` (o ícone da aba é o genérico — o ícone escolhido pelo admin aparece no Sidebar).
- **Motor de renderização:** `ui/CustomFieldsSection` renderiza qualquer `FieldDefinition[]` (agrupado por `section`) a partir de `values` + `onChange(fieldKey, value)`. Mapa de tipo→componente: text/number→`Input`, textarea→`Textarea`, currency→`CurrencyInput`, date→`DateInput`, checkbox nativo estilizado, select→`DynamicSelect` (opções estáticas da definição + dinâmicas de `fieldOptions`, com `onAdd`/`onDelete`), masked→`ui/MaskedInput` (novo wrapper das máscaras de `utils/formatters.ts`), reference→`SearchSelect`/`MultiSearchSelect` com opções de `presentation/hooks/useReferenceOptions.ts` (mapeia `refEntity` → registros do store correspondente, incluindo outras telas dinâmicas).
- **Listagem (dinâmica e padrão) — hook `useCustomFieldListing`:** a lógica de `showInList`/`filterable` vive em `presentation/hooks/useCustomFieldListing.ts`. O hook recebe `(screenKey, fields, filterKeyPrefix)` e devolve: `filterDefs` do `CompositeFilter` a partir dos campos `filterable` (select/reference→multiselect, checkbox→Sim/Não, date→date com igualdade exata, demais→texto), o matcher `matchesFilters(values, tokenMap)`, e `cardItems(values)` (pares label/valor dos campos `showInList`, formatados por tipo) renderizados pelo componente `ui/CustomFieldMetaRows`.
- **Listagem dinâmica:** `DynamicRecordList` usa o hook sem prefixo de chave e com `savedFiltersScreenKey = tabKey`; exclui o `titleFieldKey` dos `cardItems`. Tela desativada/excluída renderiza `InfoBanner`, nunca quebra.
- **Listagens padrão:** as cinco listagens builtin (Pessoas, Processos, Contratos, Financeiro, Prazos) obtêm os campos via `getCustomFieldsFor(entityKey)` e usam o hook com `CUSTOM_FIELD_FILTER_PREFIX` (`cf-`) nas chaves dos `FilterDef` — o prefixo evita colisão com os filtros nativos (`status`, `type`, `city`…). Cada ViewModel anexa `...customListing.filterDefs` aos defs nativos, encerra o predicado de filtragem com `customListing.matchesFilters(entidade.customValues, tokenMap)` e expõe `getCustomFieldItems(entidade)`; a View renderiza `<CustomFieldMetaRows items={...} />` no cartão, após o bloco de metadados nativo.
- **Deeplink de registro fora das 500 carregadas:** `ViewDynamicRecord` faz fallback de busca por id (`GetCustomRecordByIdUseCase`).

### Regras de integridade

- **Exclusão de tela é soft-block:** `DeleteScreenDefinitionUseCase` recusa excluir se houver registros (`hasRecords` com `limit(1)`); a alternativa oferecida é desativar (`enabled: false`).
- Toda tela dinâmica nova nasce com um campo `Nome` (`text`, obrigatório) definido como `titleFieldKey`; o ScreenBuilder impede excluir o campo-título ou torná-lo opcional.
- Excluir um campo deixa valores órfãos nos docs — inofensivo: o motor de renderização ignora chaves sem definição correspondente.
- Registro referenciado por campo `reference` que foi excluído: renderiza fallback "—", sem cascata (v1).

---

## Workflow Engine — Motor de Automação (Automações)

Motor de automação genérico, desacoplado de qualquer módulo de domínio, que reage a eventos
publicados por qualquer parte do sistema (`deadline.created`, `process.saved`, `financial.paid`...)
e executa Steps configuráveis pelo builder visual em "Automações". Vive na feature
`workflow_engine`, espelhada em dois lugares que **não compartilham código** — `src/` e
`functions/` são projetos TypeScript separados nesta base, sem import cruzado:

- **`src/`** — só o plano de controle: CRUD de `WorkflowDefinition` (builder visual), leitura
  do histórico de `WorkflowExecution` e do catálogo de Steps. **Nunca executa** um workflow.
- **`functions/`** — o motor de verdade, rodando em Cloud Functions.

### Por que Cloud Functions, e não o `StoreEventEmitter` do cliente

O `StoreEventEmitter` (ver seção própria) é em memória, existe só enquanto a aba está aberta e
não carrega payload — inadequado para automações de negócio, que precisam disparar mesmo sem
ninguém logado. O Event Bus do motor é o próprio Firestore: qualquer módulo publica um evento
gravando um documento em `tenants/{tenantId}/workflow_events`; uma única Cloud Function
(`onWorkflowEventCreated`, modelada sobre `auditFlatEntityChange`) é a única assinante e roda o
motor com Admin SDK. Nenhum módulo importa ou conhece o motor.

### Os "3 anéis" de desacoplamento

1. **Núcleo** (`functions/src/domain/engine/`: `WorkflowExecutor`, `StepRegistry`,
   `ExpressionEngine`, `InputMapping`, `ConditionEvaluator`) — zero import de qualquer módulo
   de domínio nomeado (Prazo, Processo, Financeiro, etc).
2. **Steps-plugin** (`functions/src/infrastructure/workflow/steps/`) — cada Step depende
   exatamente do repositório de domínio que precisa: `CreateDeadlineStep` → `IDeadlineRepository`
   (mínimo, próprio do motor); `NotifyStep`/`RegisterAuditStep` → `IAuditLogRepository` (já
   existente, reaproveitado); `SetVariableStep` → nenhuma dependência externa.
3. **Composition root** (`functions/src/infrastructure/workflow/registerSteps.ts`) — único
   arquivo que conhece o `StepRegistry` **e** os plugins concretos, ligando os dois no cold
   start (`ensureWorkflowStepsRegistered` no DI container). Adicionar um Step novo nunca exige
   alterar o núcleo.

Localização de Step é **sempre** via `stepRegistry.resolve(stepDefinitionId)` — nunca
`switch`/`if` sobre o tipo.

### Ícone de um Step — registrar no whitelist do cliente

O campo `icon` de uma `StepDefinition` é o **nome** de um ícone de `react-icons/ri` (ex:
`'RiFlowChart'`), trafegado como string no catálogo. O cliente resolve esse nome em
`getStepIcon` (`src/presentation/shared/stepIcons.ts`), que mantém um **whitelist explícito**
(imports nomeados) — isso é obrigatório para o tree-shaking: importar o namespace inteiro de
`react-icons/ri` infla o bundle principal em ~394 KB gzip (medido). Por isso, **ao criar um Step
novo ou trocar o `icon` de um existente, registre o ícone escolhido nesse whitelist**. Se não
registrar, o Step cai silenciosamente no ícone padrão (`RiToolsLine`) — nenhum erro é lançado.

### Catálogo de Steps no cliente

`src/` não pode importar os executores de `functions/`. Por isso o composition root também
espelha cada `StepDefinition` (todos os campos exceto `createExecutor`) em
`workflow_step_catalog/{id}` — coleção global, não por tenant, já que o catálogo de Steps
disponíveis é o mesmo para todos os escritórios. O builder (`StepEditorModal`) renderiza a UI
de configuração **exclusivamente** a partir de `InputDefinition[]` lido dali — nunca conhece um
Step por nome (ex: `"CreateDeadline"`).

### InputMapping — 5 tipos, nunca string genérica

Cada campo configurável de um Step é uma de cinco formas, discriminadas por `kind`:
`LiteralInputMapping` (valor fixo), `EventInputMapping` (dot-path no payload do evento),
`ExpressionInputMapping` (roda no `ExpressionEngine`: `today()`, `now()`, `if()`, `concat()`,
`lower()`, `upper()`, `length()`, `+`/`-` em datas — extensível via `FunctionRegistry` próprio,
mesmo padrão do `StepRegistry`), `OutputInputMapping` (lê a saída de um step anterior,
namespaced por `{stepId, outputId}` — não por `stepDefinitionId` — para não colidir quando a
mesma `StepDefinition` é usada duas vezes no mesmo workflow) e `VariableInputMapping` (lê
`context.variables`, escrito por `SetVariableStep`).

### Campo `EntityReference` — seletor de entidade em "Valor fixo"

Um input de Step com `type: 'EntityReference'` (ex: `caseId` e `responsibleLawyerId` do
`CreateDeadlineStep`) declara também `entityType?: string` — a mesma chave usada por
`FieldDefinition.refEntity` nos Custom Fields do ScreenBuilder: `'cases'`, `'persons'`,
`'contracts'`, `'financials'`, `'deadlines'`, `'members'` (usuários do tenant, não é uma
coleção de domínio) ou o `id` de uma `ScreenDefinition` de entidade customizada. Quando o
usuário escolhe mapping "Valor fixo" para esse campo, o `StepEditorModal`
(`renderLiteralControl`) renderiza `EntityReferenceControl`, que resolve as opções via
`useReferenceOptions()` (mesmo hook do `useCustomFieldListing`) filtrado por `entityType` — sem
duplicar a lógica de carregar cada store de entidade. Sem `entityType` declarado, cai no
fallback de texto livre (comportamento anterior).

### Passo "Buscar Registros" (Query) — consulta tipada à base do tenant

O passo `query` (`functions/src/infrastructure/workflow/steps/QueryStep.ts`) permite que um
workflow **pesquise** registros de qualquer cadastro do tenant e use o resultado nos passos
seguintes. É a única capacidade do motor que lê dados fora do payload pré-hidratado — e o faz
como um passo (assíncrono por natureza), não como função de expressão (o `ExpressionEngine` é
síncrono).

**Especificação (`QuerySpec`)** — tipo compartilhado em `src/domain/schema/querySpec.ts`
(sincronizado para `functions/`): `{ table, where: QueryPredicate[], orderBy?, limit, projections }`.
É gravado como valor de um único input de `type: 'Query'` (`allowedMappingKinds: ['Literal']`); os
**valores dos filtros** (`QueryPredicate.value`) são `InputMapping`s aninhados, resolvidos em runtime
via `resolveMapping` (habilita filtro por evento/expressão/variável/saída de step).

**Tabela tipada e validada nos dois lados** — `resolveQueryTable` mapeia o nome para: entidade fixa
(`getEntityByCollection`), tela dinâmica (`ctx.screens` → `customRecords` + filtro `screenKey`) ou
lista/lookup (`isLookupCollection`). `validateQuerySpec` confirma a tabela e cada caminho de
`where`/`orderBy`/`projections` via `resolvePath`. Roda no front (`QueryBuilderControl`, antes de
salvar) e no back (antes de executar) — mesma função.

**Projeção por caminho** (ex: `client.name`, `client.customValues.apelido`, `values.prioridade`)
reaproveita o pipeline de hidratação de FKs: `buildHydrationPlan` + `materializeHops` +
`IWorkflowRecordFetcher`, materializando cada linha do resultado. Os `projections` também limitam
quais FKs são carregadas (evita over-fetch).

**Isolamento e segurança** — o `tenantId` (`context.execution.tenantId`) é SEMPRE injetado no path
(`tenants/{tenantId}/...`), então uma consulta nunca cruza escritórios. Nesta versão não há checagem
de role por usuário: o workflow é tratado como automação de nível administrativo do tenant.

**Estratégia índice-free (evita a exigência de índice composto do Firestore)** — o Firestore exige
índice composto ao misturar `==` com range/`orderBy` em outro campo, ou `array-contains`/`in` com
outro filtro. Como o usuário escolhe campos arbitrários (inclusive `customValues.*`), pré-criar esses
índices é inviável. Por isso:
- **Servidor:** apenas predicados `eq` (mais o `screenKey ==` das telas dinâmicas), servidos por
  índices single-field automáticos → **nunca** exige índice composto. Consultado com
  `limit(MAX_SCAN = 300)`.
- **Memória:** `neq`, ranges (`lt/lte/gt/gte`), `in`, `contains`, `exists`, a **ordenação** e o
  **`limit` final** (cap `MAX_QUERY_LIMIT = 100`) são aplicados sobre a janela varrida — depois da
  materialização, para permitir filtro em caminhos de FK (ex: `client.customValues.apelido`).
- **Trade-off:** ranges/ordenação operam sobre a janela varrida, não sobre a coleção inteira —
  adequado à escala por-tenant. Evolução futura: paginação por cursor.

**Saídas:** `results` (lista de registros materializados), `count` e `first`. Passos seguintes leem
via `output.<stepId>.results` / `.first.client.name` etc. (`dynamicOutputs: runtime-only`).

### Como Adicionar uma Função de Expressão

As expressões (`ExpressionInputMapping`) são processadas pelo `ExpressionEngine` no backend
(`functions/src/domain/engine/expression/`). As funções disponíveis são gerenciadas por um
`FunctionRegistry` extensível — mesmo padrão arquitetural do `StepRegistry` dos Steps. Adicionar
uma nova função **nunca** exige alterar o `ExpressionEngine.ts` nem a `FunctionReference.view.tsx`
do frontend.

#### Padrão de uma Função de Expressão

Toda função de expressão é um objeto que implementa a interface `ExpressionFunction` definida em
`functions/src/domain/engine/expression/FunctionRegistry.ts`:

```typescript
export interface ExpressionFunction {
  name: string;                        // Nome da função (ex: 'today', 'concat')
  call(args: unknown[], context: WorkflowContext): unknown;  // Implementação
  description: string;                 // Descrição em PT-BR para o usuário
  signature: string;                   // Assinatura/sintaxe (ex: 'concat(valor1, valor2, ...)')
  example: string;                     // Exemplo de uso (ex: 'concat("Processo ", "123")')
  category: 'Data' | 'Texto' | 'Condicional' | 'Variável' | 'Operador';
}
```

**Localização:** funções builtin ficam em `functions/src/domain/engine/expression/builtins/`,
agrupadas por categoria (ex: `dateFns.ts`, `stringFns.ts`, `ifFn.ts`).

**Exemplo completo (função `upper`):**

```typescript
import type { ExpressionFunction } from '../FunctionRegistry';

export const upperFn: ExpressionFunction = {
  name: 'upper',
  call: ([value]) => String(value).toUpperCase(),
  description: 'Converte texto para MAIÚSCULAS',
  signature: 'upper(texto)',
  example: 'upper("texto")',
  category: 'Texto',
};
```

**Validação de argumentos:** se a função exige um tipo ou número específico de argumentos, valide
dentro de `call()` lançando `Error` com mensagem descritiva em PT-BR — será capturada pelo
`WorkflowExecutor` e gravada no log da execução.

#### Passos para Adicionar uma Nova Função

1. **Criar o arquivo da função** em `functions/src/domain/engine/expression/builtins/`, seguindo
   o padrão acima. Se for de uma categoria existente (Data, Texto), adicione-a ao arquivo
   correspondente (`dateFns.ts`, `stringFns.ts`); senão, crie um novo arquivo (ex: `mathFns.ts`).

2. **Registrar no motor** em `functions/src/domain/engine/expression/ExpressionEngine.ts`:
   - Importe a função no topo: `import { nomeDaFn } from './builtins/seuArquivo';`
   - Adicione-a ao array de registro: `[todayFn, nowFn, ..., nomeDaFn].forEach(...)`

3. **Pronto!** A função estará disponível automaticamente:
   - **No backend:** `ExpressionEngine` já a resolve via `FunctionRegistry`.
   - **No frontend:** a Cloud Function `getExpressionFunctions` (`functions/src/infrastructure/handlers/getExpressionFunctions.ts`)
     retorna todas as funções registradas; o `ExpressionFunctionStore` (`src/stores/ExpressionFunctionStore.tsx`)
     as carrega na inicialização; e o `ExpressionEditor`, `FunctionReference` e `FunctionReferenceModal`
     renderizam a lista dinamicamente via `useExpressionFunctions()`.

**Não é necessário:**
- ❌ Atualizar arrays hardcoded no frontend (removidos desde v0.46.7)
- ❌ Modificar o `ExpressionEngine.ts` além do import e registro
- ❌ Tocar no `FunctionRegistry.ts` (exceto se precisar adicionar uma nova categoria)

**Deploy:** a Cloud Function `getExpressionFunctions` faz parte do grupo `deploy:workflow`
(`package.json`). Rode `npm run deploy:workflow` (só as functions de automação) ou
`npm run deploy:functions` (todas).

#### Categorias Predefinidas

- **Data:** funções que retornam ou manipulam datas (`today`, `now`, operadores `+`/`-` com
  números de dias)
- **Texto:** transformação e concatenação de strings (`concat`, `lower`, `upper`, `length`)
- **Condicional:** controle de fluxo (`if`)
- **Variável:** acesso ao contexto do workflow (`getVar`)
- **Operador:** operadores matemáticos ou lógicos (`+`, `-` — esses não ficam no `FunctionRegistry`,
  são tratados como tokens especiais pelo `ExpressionEngine`)

Adicionar uma categoria nova: editar o tipo union em `FunctionRegistry.ts` e incluir a string
literal. A UI do frontend (`FunctionReference`, `FunctionReferenceModal`) renderiza badges de
categoria automaticamente a partir dos dados retornados pela API.

### Fluxo de execução

Escrita em `workflow_events` → `onWorkflowEventCreated` dispara → carrega
`WorkflowDefinition`s habilitadas para aquele `eventName` (`findEnabledByEvent`) → para cada
uma: **hidrata o payload** (resolução lazy de FKs, ver abaixo) → avalia a `Condition` → se
`screenKey` estiver definido no `WorkflowDefinition` (só se aplica
a `custom_record.saved`/`custom_record.deleted`, ver abaixo) e não bater com o `screenKey` do
`payload`, ignora a execução sem rodar nenhum step → roda os `steps` em ordem (`order`
crescente), resolvendo os inputs de cada um via `InputMapping` e despachando o executor via
`StepRegistry` → grava um `WorkflowExecution` com `logs[]` em
`tenants/{tenantId}/workflow_executions`. Falha de um step para o restante daquele workflow
(fail-fast, sem retry na v1) mas nunca derruba os demais workflows nem a Cloud Function.

### Resolução lazy de FKs — WorkflowContextHydrator

O payload publicado é **cru** (só os dados do documento). Quem materializa FKs é o
`WorkflowContextHydrator` (`functions/src/domain/engine/WorkflowContextHydrator.ts`), no momento
da execução e **apenas para os caminhos que a automação realmente referencia**:

1. `collectReferencedPaths(definition)` varre a árvore de `Condition` (fieldPath, eventField,
   expressões), os `InputMapping`s `Event` e as expressões dos steps, normalizando as três
   convenções de endereçamento (`event.payload.x`, `event.x`, `x`) via `stripEventPrefix`.
2. `buildHydrationPlan` (compartilhado, `domain/schema/hydrationPlan.ts`) resolve cada caminho
   contra o schema (`resolvePath`) e produz os saltos `FkHop[]` deduplicados em **níveis BFS**
   (1..`maxFkDepth`, default 3). A chave FK do salto seguinte é propagada para os campos do hop
   pai (ex: `contract.client.name` garante `clientId` na materialização de `contract`).
3. Por nível: um `db.getAll` em lote por coleção via `IWorkflowRecordFetcher`
   (`FirestoreWorkflowRecordFetcher`), com `HydrationCache` (`coleção:id`) **compartilhado entre
   todos os workflows do mesmo evento**.
4. `materializeHops` (compartilhado, `domain/schema/materialize.ts`) aplica cada
   `MaterializationMode`: FK fixa materializa sob o `denormKey` (`contractId` → `contract`, com
   os `denormalizedFields` do registry); reference de campo customizado **substitui** o ID em
   `customValues.<key>`/`values.<key>` espalhando os `values` do registro alvo — os mesmos nomes
   do antigo enriquecimento eager, preservando expressões existentes (`event.contract.number`,
   `event.customValues.tarefa.nome`). FKs múltiplas materializam arrays (cap de 50 itens,
   navegáveis por índice: `event.activePole.0.name`); `old.*` também é hidratado.

As `ScreenDefinition`s do tenant vêm do `ScreenDefinitionCache` (`functions/src/data/services/`),
cache em memória da instância com TTL de 5 min + invalidação best-effort quando o trigger de
escrita observa mudança em `screenDefinitions`. Caminho que não resolve no schema gera `WARN`
no log (fim da falha silenciosa); documento inexistente materializa `{ id }`. O log da execução
registra a `SCHEMA_VERSION` usada na hidratação. Profundidade além do limite é rejeitada no
plano e também protegida no editor.

### Publicação automática de eventos

Nenhum módulo de domínio chama `publishEvent()` diretamente. Em vez disso, a Cloud Function
`publishWorkflowEventOnEntityChange` (`onDocumentWritten`, mesmo escopo de
`auditFlatEntityChange`: `tenants/{tenantId}/{collection}/{docId}`) observa a escrita de fora e
publica o evento correspondente — o próprio módulo nem sabe que o motor existe. O mapeamento
coleção → prefixo de evento é **derivado do `ENTITY_REGISTRY`/`LOOKUP_REGISTRY`** em
`functions/src/domain/services/workflowEventEntities.ts`:

| Entidade | Coleção Firestore | Prefixo do evento |
|---|---|---|
| Pessoa | `persons` | `person` |
| Contrato | `contracts` | `contract` |
| Processo | `cases` | `case` |
| Prazo | `deadlines` | `deadline` |
| Financeiro | `financials` | `financial` |
| Push | `pushes` | `push` |
| Entidade Customizada | `customRecords` | `custom_record` |
| Item de Lista (qualquer lookup) | `personTypes`, `caseAreas`, `contractTypes`, `deadlineTypes`, `financialCategories`, etc. (lista fechada em `LOOKUP_COLLECTIONS`) | `lookup` |

Toda entidade tem exatamente dois eventos: `<prefixo>.saved` (criação **ou** atualização — o
motor não distingue as duas) e `<prefixo>.deleted`. O `payload` publicado é `{ id, ...dados_do_documento }`
— os dados de depois da escrita (`saved`) ou de antes (`deleted`), **sem denormalização de FKs**
(a resolução é lazy, na execução — seção "Resolução lazy de FKs").

Coleções fora desse mapa (tags, `members`, `aiConnections`, subcoleções aninhadas como
`notes`/`documents`) são ignoradas — mesmo padrão de allowlist do `auditFlatEntityChange`.

**Catálogo de eventos:** derivado do `ENTITY_REGISTRY` no arquivo compartilhado
`domain/schema/eventCatalog.ts` (fonte em `src/`, cópia gerada em `functions/`) — eventos de
entidade (campos nativos, FKs e caminhos denormalizados derivados de `FkSpec`) ∪ eventos de
sistema declarados (`SYSTEM_EVENTS`: notas/documentos com pai denormalizado do registry, lookup).
`src/domain/services/workflowEventCatalog.ts` é um adapter fino que re-exporta o catálogo — usado
para (1) o seletor de evento na aba Geral, com rótulos em PT-BR (`"Ao salvar: Processo"`) e (2) a
lista de campos do mapping "Do evento". O mesmo catálogo fornece `eventNameToRoot`, a raiz de
navegação usada pelo autocomplete do `ExpressionEditor` e pela hidratação lazy.

**Gatilho de Entidade Customizada — seletor de tela.** Como toda entidade customizada mora na
mesma coleção `customRecords` discriminada por `screenKey`, escolher `custom_record.saved`/
`custom_record.deleted` sozinho não identifica *qual* entidade (ex: "Contrato de Locação" vs
"Imóvel"). Por isso `WorkflowDefinition.screenKey` (opcional, só usado por esses dois eventos)
guarda o id da `ScreenDefinition` escolhida na aba Geral (`ViewWorkflow.view.tsx`, seletor
populado por `useScreenDefinitions().dynamicScreens`). Esse campo cumpre dois papéis: (1) filtro
de execução no backend (seção "Fluxo de execução" acima) e (2) fonte dos campos dinâmicos do
"Do evento" — `getWorkflowEventFields(eventName, dynamicFields)` recebe, só para
`custom_record.*`, os campos da `ScreenDefinition` selecionada mapeados para `values.<fieldKey>`
(calculados em `ViewWorkflow.viewmodel.tsx` a partir de `sortFieldsByOrder(definition.fields)`).
Sem `screenKey` escolhido, a automação roda para qualquer entidade customizada do tenant e o
picker de "Do evento" só oferece `id`/`screenKey` (comportamento anterior, preservado para
compatibilidade com automações já existentes).

### v1 — implementado vs preparado

**Implementado:** `ActionStep` com 4 Steps reais (`CreateDeadlineStep`, `NotifyStep`,
`RegisterAuditStep`, `SetVariableStep`), execução sequencial fail-fast, publicação automática de
eventos `saved`/`deleted` para as 8 entidades da tabela acima, e o sistema completo de condições:
`AlwaysTrue`, `FieldComparison` (com `valueType` literal/expression/eventField), `Expression`
(expressão pura avaliada pelo `ExpressionEngine` e convertida para booleano), `LogicalAnd`,
`LogicalOr` e `Not`, todos aninháveis (`functions/src/domain/engine/ConditionEvaluator.ts`).
O builder visual (`src/presentation/components/ui/ConditionBuilder/`) edita a árvore completa
(grupos E/OU aninhados, negação por nó, comparações e expressões puras) e o
`src/presentation/components/ui/ConditionDiagram/` renderiza a mesma árvore em diagrama — a aba
Condições alterna entre os dois. O diagrama edita a estrutura diretamente na árvore `Condition`
via caminhos de índices (alternar E/OU, negar, remover, adicionar condição/expressão/grupo;
sem `onChange` ele vira somente-leitura); a edição de conteúdo (campo/operador/valor) permanece
no builder, acessível por atalho nos cartões do diagrama. Em `FieldComparison`, tanto `fieldPath`
quanto o valor de `valueType: 'eventField'` usam caminho absoluto no contexto
("event.payload.status") e são resolvidos por `getValueByPath(context, ...)`.
**Preparado só como shape, nunca registrado no `StepRegistry`** (adicionar não exige tocar no
motor): `ConditionStep`, `DelayStep`, `ScriptStep`, `SubWorkflowStep`, retry/compensação/rollback,
execução síncrona.

### Arquivos-chave

- `functions/src/domain/engine/WorkflowExecutor.ts` — orquestrador
- `functions/src/domain/engine/WorkflowContextHydrator.ts` — hidratação lazy de FKs por execução
- `functions/src/domain/engine/expression/ExpressionEngine.ts` — motor de avaliação de expressões
- `functions/src/domain/engine/expression/FunctionRegistry.ts` — registry de funções de expressão
- `functions/src/data/services/FirestoreWorkflowRecordFetcher.ts` — fetch em lote (`db.getAll`) para a hidratação
- `functions/src/data/services/ScreenDefinitionCache.ts` — cache de `ScreenDefinition` (TTL + invalidação)
- `functions/src/infrastructure/handlers/onWorkflowEventCreated.ts` — gatilho do motor (Event Bus)
- `functions/src/infrastructure/handlers/publishWorkflowEventOnEntityChange.ts` — publica os eventos `saved`/`deleted` com payload cru
- `functions/src/infrastructure/handlers/syncWorkflowStepCatalog.ts` — `onCall` que sincroniza `workflow_step_catalog` sob demanda (chamado pelo builder ao abrir uma automação, já que o catálogo não pode depender de um evento real ter ocorrido)
- `functions/src/infrastructure/handlers/getExpressionFunctions.ts` — `onCall` que retorna todas as funções de expressão disponíveis para o frontend
- `functions/src/infrastructure/workflow/registerSteps.ts` — composition root
- `src/domain/schema/` — registry, resolvedor de caminhos, catálogo de eventos, planner e materializer compartilhados (fonte única; ver "Schema Compartilhado Gerado")
- `src/stores/ExpressionFunctionStore.tsx` — store que carrega as funções de expressão do backend
- `src/domain/services/workflowEventCatalog.ts` — adapter fino do catálogo derivado (`domain/schema/eventCatalog.ts`)
- `src/presentation/pages/ViewWorkflow/components/StepEditorModal/` — UI genérica dirigida por `InputDefinition[]`
- `src/presentation/components/ui/ExpressionEditor/` — editor de expressões com autocomplete segmento-a-segmento (`pathRoot` + `suggestNextSegments`) e validação semântica de caminhos
- `src/presentation/shared/useSchemaContext.ts` / `useLookupValues.ts` — pontes dos stores para o resolvedor (screens dinâmicas e valores de lookup)

---

## Firestore Security Rules — Conjunto Completo

> **Copie o bloco abaixo integralmente no Firebase Console → Firestore → Regras.**
> Sempre que uma nova coleção for criada, adicione a regra correspondente E atualize este arquivo.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Funções auxiliares ───────────────────────────────────────────────────

    // Retorna os dados do usuário autenticado na coleção users
    function userData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Verifica se o usuário autenticado é administrador global do sistema
    function isSystemAdmin() {
      return request.auth != null && userData().role == 'SYSTEM';
    }

    // Verifica se o usuário autenticado é SYSTEM ou SUPPORT — ambos agem como
    // admin em QUALQUER tenant, mesmo sem um doc em members/{uid} daquele tenant
    // (usado pela equipe para prestar suporte a um escritório sem precisar de convite).
    function isSystemOrSupport() {
      return request.auth != null && userData().role in ['SYSTEM', 'SUPPORT'];
    }

    // Retorna os dados do membro do tenant
    function memberData(tenantId) {
      return get(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid)).data;
    }

    // Verifica se o usuário é membro do tenant (ou SYSTEM/SUPPORT, que contam como membro de todos)
    function isMember(tenantId) {
      return request.auth != null &&
        (isSystemOrSupport() ||
         exists(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid)));
    }

    // Verifica se o usuário tem role de admin no tenant (ou é SYSTEM/SUPPORT)
    function isTenantAdmin(tenantId) {
      return isSystemOrSupport() || (isMember(tenantId) && memberData(tenantId).role == 'admin');
    }

    // Verifica se o usuário tem role de advogado ou admin no tenant (ou é SYSTEM/SUPPORT)
    function isTenantLawyerOrAdmin(tenantId) {
      return isSystemOrSupport() ||
        (isMember(tenantId) && memberData(tenantId).role in ['admin', 'lawyer']);
    }

    // Verifica se o usuário pode escrever dados no tenant (admin, lawyer, secretary, ou SYSTEM/SUPPORT)
    function canWriteInTenant(tenantId) {
      return isSystemOrSupport() ||
        (isMember(tenantId) && memberData(tenantId).role in ['admin', 'lawyer', 'secretary']);
    }

    // Retorna os dados da notícia relacionada a um NewsDocument
    function relatedNews(newsId) {
      return get(/databases/$(database)/documents/news/$(newsId)).data;
    }

    // Espelha a permissão de edição da notícia (canEdit em ViewNews.viewmodel.tsx):
    // ADMIN do sistema sempre; autor ou admin do tenant para notícias de escritório
    function canEditNewsDocument(newsId) {
      let n = relatedNews(newsId);
      return isSystemAdmin()
        || (n.tenantId != null
            && isMember(n.tenantId)
            && (n.userId == request.auth.uid || isTenantAdmin(n.tenantId)));
    }

    // ─── Usuários ─────────────────────────────────────────────────────────────

    match /users/{userId} {
      allow get: if request.auth != null && request.auth.uid == userId;
      // list: SYSTEM lista livremente (Gestão de Acessos, getUsers() sem limit()).
      // Qualquer outro autenticado só pode rodar consultas com limit() <= 1 — cobre a busca
      // exata por e-mail ao convidar membros (getUserByEmail usa limit(1)) sem permitir
      // dump da coleção inteira (emails/roles de todos os usuários) por um usuário comum.
      allow list: if isSystemAdmin()
        || (request.auth != null && request.query.limit <= 1);
      // O próprio documento é criado pela Cloud Function onUserCreated (Admin SDK,
      // trigger de Auth), nunca pelo client — por isso create é sempre negado aqui.
      allow create: if false;
      // Nenhum campo é editável pelo frontend fora da role, e só por SYSTEM. tenantIds e
      // qualquer outro campo são mantidos pelas Cloud Functions addTenantMember/removeTenantMember
      // (Admin SDK, ignoram estas regras) — o client não tem mais nenhum caminho de escrita
      // cross-user em users/{userId}.
      allow update: if isSystemAdmin();
    }

    // ─── Perfis de usuário ────────────────────────────────────────────────────
    
    match /userProfiles/{userId} {
      allow read: if request.auth != null;
      allow list: if isSystemAdmin()
        || (request.auth != null && request.query.limit <= 1);
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // ─── Nicknames (unicidade) ────────────────────────────────────────────────

    match /nicknames/{nickname} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }

    // ─── Conexões Gmail (Push) — nível raiz ──────────────────────────────────
    // Armazenadas fora de tenants/{tenantId} para permitir query por email
    // na Cloud Function sem precisar varrer todos os tenants.
    // SOMENTE admin do tenant dono pode ler/escrever.

    match /gmailConnections/{connectionId} {
      allow read, update, delete: if request.auth != null
        && isTenantAdmin(resource.data.tenantId);
      allow create: if request.auth != null
        && isTenantAdmin(request.resource.data.tenantId);
      
      // Tokens OAuth: admin pode ESCREVER (autorização inicial), mas NUNCA LER
      // Cloud Functions (Admin SDK) leem/renovam tokens, ignorando estas regras
      match /tokens/{tokenId} {
        allow read: if false;                                // Frontend NUNCA lê tokens
        allow write: if request.auth != null                 // Admin do tenant dono pode salvar
          && isTenantAdmin(get(/databases/$(database)/documents/gmailConnections/$(connectionId)).data.tenantId);
      }
    }

    // ─── Tenants (escritórios) ────────────────────────────────────────────────  

    match /tenants/{tenantId} {
      // Qualquer membro pode ler o tenant
      allow get: if isMember(tenantId);
      // list: SYSTEM e SUPPORT listam a coleção inteira — usado tanto pela aba "Escritórios"
      // de Gestão de Acessos (SYSTEM) quanto pelo seletor de tenant no TopBar, que para esses
      // dois roles exibe todos os escritórios em vez de só os que o usuário é membro.
      // Sem esta regra, getDocs(collection('tenants')) é negado — "get" não cobre consultas de coleção.
      allow list: if isSystemOrSupport();
      // Admin do tenant atualiza os dados do escritório, mas nunca memberCount/memberLimit/ownerId/plan.
      // memberCount só é escrito pelas Cloud Functions addTenantMember/removeTenantMember (Admin SDK,
      // ignora estas regras); memberLimit e plan só por admin global (SYSTEM), na aba "Escritórios" de Gestão de Acessos.
      allow update: if isSystemAdmin()
        || (isTenantAdmin(tenantId)
            && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['memberCount', 'memberLimit', 'ownerId', 'plan']));
      // Tenant é criado pela Cloud Function onUserCreated (Admin SDK, trigger de Auth)
      // junto com o bootstrap do usuário — nunca pelo client.
      allow create: if false;
      allow delete: if false;

      // Conexões de IA do escritório — somente admin lê e escreve
      match /aiConnections/{connectionId} {
        allow read, write: if isTenantAdmin(tenantId);
      }

      // Membros do tenant
      match /members/{memberId} {
        // Membros leem a lista de membros do próprio tenant
        allow read: if isMember(tenantId);
        // Criação e exclusão passam pelas Cloud Functions addTenantMember/removeTenantMember
        // (Admin SDK, ignoram estas regras) — garante que o limite de membros do tenant
        // (memberLimit/memberCount) nunca seja ultrapassado, mesmo por escritas diretas do client
        // ou por duas adições concorrentes (dois admins, dois computadores, ao mesmo tempo).
        allow create, delete: if false;
        // Alteração de role continua direta do client — não mexe no contador de membros.
        allow update: if isTenantAdmin(tenantId);
      }

      // Lookups de pessoa — qualquer membro lê; qualquer membro com escrita cria; só admin deleta
      match /personTypes/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /personOccupations/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /personNationalities/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /personMaritalStatuses/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /personCities/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /personRelationships/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Pessoas
      match /persons/{personId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Anotações da pessoa — criação por qualquer membro com escrita; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*), gravado logo
        // antes do delete (ver "Autoria de exclusão").
        match /notes/{noteId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }

        // Documentos da pessoa — upload por qualquer membro com escrita; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*).
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }
      }

      // Etiquetas de pessoas (tenant-scoped) — qualquer membro com escrita cria; só admin deleta
      match /personTags/{tagId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Etiquetas de processos (tenant-scoped) — qualquer membro com escrita cria; só admin deleta
      match /caseTags/{tagId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Etiquetas de contratos (tenant-scoped) — qualquer membro com escrita cria; só admin deleta
      match /contractTags/{tagId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Lookups de processo — qualquer membro lê; qualquer membro com escrita cria; só admin deleta
      match /caseAreas/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /casePhases/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /caseStatuses/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /caseInstances/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /caseActionTypes/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /caseCourts/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /caseDistricts/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /caseJudges/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Tipos de documento — compartilhado entre pessoas, processos e contratos
      match /documentTypes/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Categorias de notícias do escritório (parte dinâmica do campo Categoria em Notícias)
      match /newsCategories/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Processos
      match /cases/{caseId} {
        allow read: if isMember(tenantId);
        allow create, update: if isTenantLawyerOrAdmin(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Anotações do processo — criação por qualquer membro com escrita; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*).
        match /notes/{noteId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }

        // Documentos do processo — upload por qualquer membro com escrita; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*).
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }
      }

      // Lookups de contrato — qualquer membro lê; qualquer membro com escrita cria; só admin deleta
      match /contractTypes/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractCategories/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractStatuses/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractObjects/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractAdjustmentIndexes/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractAdjustmentPeriodicities/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractCurrencies/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractPaymentMethods/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractBanks/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /contractCostCenters/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Contratos
      match /contracts/{contractId} {
        allow read: if isMember(tenantId);
        allow create, update: if isTenantLawyerOrAdmin(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Anotações do contrato — criação por qualquer membro com escrita; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*).
        match /notes/{noteId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }

        // Documentos do contrato — upload por qualquer membro com escrita; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*).
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }
      }

      // Tipos de prazo (lookup dinâmico por tenant) — qualquer membro com escrita cria; só admin deleta
      match /deadlineTypes/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Prazos
      match /deadlines/{deadlineId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }

      // Financeiro
      match /financials/{financialId} {
        allow read: if isMember(tenantId);
        allow create, update: if isTenantLawyerOrAdmin(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Documentos do lançamento financeiro — upload por qualquer membro com escrita; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*).
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }
      }

      // Etiquetas de lançamentos financeiros (tenant-scoped) — qualquer membro com escrita cria; só admin deleta
      match /financialTags/{tagId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Lookups de financeiro — qualquer membro lê; qualquer membro com escrita cria; só admin deleta
      match /financialCategories/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }
      match /financialStatuses/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);
      }

      // Pushes do Tribunal (notificações de email processadas)
      match /pushes/{pushId} {
        allow read: if isMember(tenantId);
        // Cloud Functions criam pushes (via Admin SDK, ignora estas regras)
        // Membros podem atualizar status; updatedBy* é o carimbo de autoria (auditoria)
        allow update: if isMember(tenantId)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedBy', 'updatedByName', 'updatedByPhotoURL']);
        // Stamp de autoria de exclusão (deletedBy*), gravado logo antes do delete — só quem
        // pode de fato deletar (admin) pode gravar esse stamp.
        allow update: if isTenantAdmin(tenantId)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
          && request.resource.data.deletedBy == request.auth.uid;
        // Somente admin pode deletar
        allow delete: if isTenantAdmin(tenantId);
      }

      // ─── Workflow Engine (Automações) ────────────────────────────────────────
      // Definições de automação — feature administrativa; só admin cria/edita/exclui.
      // `steps` fica embutido no próprio documento (ver "Workflow Engine" no corpo do doc).
      match /workflow_definitions/{workflowId} {
        allow read: if isMember(tenantId);
        allow create, update, delete: if isTenantAdmin(tenantId);
      }

      // Event Bus do motor — qualquer membro com escrita pode publicar um evento;
      // coleção append-only, ninguém lê/edita/exclui pelo client (só a Cloud Function
      // onWorkflowEventCreated, via Admin SDK, que ignora estas regras).
      match /workflow_events/{eventId} {
        allow create: if canWriteInTenant(tenantId);
        allow read, update, delete: if false;
      }

      // Histórico de execução — só a Cloud Function grava (Admin SDK); membros só leem.
      match /workflow_executions/{executionId} {
        allow read: if isMember(tenantId);
        allow write: if false;
      }

      // ─── Telas Dinâmicas (Personalização) ────────────────────────────────────
      // Definições de telas e campos customizados — membro lê; só admin configura
      match /screenDefinitions/{screenId} {
        allow read: if isMember(tenantId);
        allow create, update, delete: if isTenantAdmin(tenantId);

        // Opções adicionadas inline nos selects de campos customizados
        // (mesmo modelo dos lookups: membro com escrita cria; só admin deleta)
        match /fieldOptions/{optionId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow delete: if isTenantAdmin(tenantId);
        }

        // Etiquetas da tela dinâmica (exclusivas por screenKey) — mesmo modelo das
        // demais etiquetas (personTags, contractTags...): membro com escrita cria/edita; só admin deleta
        match /tags/{tagId} {
          allow read: if isMember(tenantId);
          allow create, update: if canWriteInTenant(tenantId);
          allow delete: if isTenantAdmin(tenantId);
        }
      }

      // Registros das telas dinâmicas — mesmo modelo de acesso das entidades padrão.
      // update por canWriteInTenant também cobre o stamp de autoria de exclusão (deletedBy*).
      match /customRecords/{recordId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Anotações do registro — qualquer membro com escrita cria; exclusão só admin.
        // update só é usado para o stamp de autoria de exclusão (deletedBy*).
        match /notes/{noteId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }

        // Documentos do registro — mesmo modelo das anotações
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow update: if isTenantAdmin(tenantId)
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['deletedBy', 'deletedByName', 'deletedByPhotoURL'])
            && request.resource.data.deletedBy == request.auth.uid;
          allow delete: if isTenantAdmin(tenantId);
        }
      }
    }

    // ─── Notícias ─────────────────────────────────────────────────────────────
    // tenantId == null  → notícia do Sistema, visível a todos os autenticados
    // tenantId == X     → notícia do escritório X, visível apenas a membros do tenant

    match /news/{newsId} {
      // Leitura: sistema (tenantId null) → qualquer auth; tenant → somente membros
      allow get: if request.auth != null
        && (resource.data.tenantId == null
            || isMember(resource.data.tenantId));
      allow list: if request.auth != null;

      // Criação: ADMIN pode criar com tenantId null (sistema) ou qualquer tenant;
      //          membro cria somente com tenantId == seu próprio tenant
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid
        && (isSystemAdmin()
            || (request.resource.data.tenantId != null
                && isMember(request.resource.data.tenantId)));

      // Edição de conteúdo: ADMIN edita qualquer; membro edita notícias do próprio tenant
      //         (e somente notícias de tenant, nunca as de sistema)
      // Curtida: qualquer auth que pode ler altera apenas likedBy + likeCount
      // Visualização: qualquer auth que pode ler altera apenas viewCount
      allow update: if request.auth != null
        && (isSystemAdmin()
            || (resource.data.tenantId != null
                && isMember(resource.data.tenantId)
                && (resource.data.userId == request.auth.uid
                    || isTenantAdmin(resource.data.tenantId)))
            || (request.resource.data.diff(resource.data).affectedKeys()
                  .hasOnly(['likedBy', 'likeCount'])
                && (resource.data.tenantId == null
                    || isMember(resource.data.tenantId)))
            || (request.resource.data.diff(resource.data).affectedKeys()
                  .hasOnly(['viewCount'])
                && (resource.data.tenantId == null
                    || isMember(resource.data.tenantId)))
            || (request.resource.data.diff(resource.data).affectedKeys()
                  .hasOnly(['commentCount'])
                && (resource.data.tenantId == null
                    || isMember(resource.data.tenantId))));

      // Exclusão: ADMIN exclui qualquer; admin do tenant exclui do seu tenant
      allow delete: if isSystemAdmin()
        || (request.auth != null
            && resource.data.tenantId != null
            && isTenantAdmin(resource.data.tenantId));
    }

    // ─── Etiquetas de boletins ────────────────────────────────────────────────

    match /newsTags/{tagId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }

    match /newsTagLinks/{linkId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // ─── Interações com boletins ──────────────────────────────────────────────

    match /newsInteractions/{interactionId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      // Update: o dono altera livremente seu próprio registro; qualquer outro
      // autenticado pode SOMENTE resetar isRead para false (nunca para true, nem
      // outros campos) — usado quando alguém comenta/edita/exclui um comentário
      // para que quem já tinha lido a notícia volte a vê-la como não lida.
      allow update: if request.auth != null
        && (resource.data.userId == request.auth.uid
            || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isRead', 'updatedAt'])
                && request.resource.data.isRead == false));
      allow delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }

    // ─── Interações com pushes ────────────────────────────────────────────────

    match /pushInteractions/{interactionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }

    // ─── Comentários de boletins ──────────────────────────────────────────────

    match /newsComments/{commentId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      allow update: if request.auth != null
        && (resource.data.userId == request.auth.uid || isSystemAdmin());
      allow delete: if request.auth != null
        && (resource.data.userId == request.auth.uid || isSystemAdmin());
    }

    // ─── Documentos de boletins ───────────────────────────────────────────────
    // Coleção de topo com campo newsId (mesmo padrão de newsComments) — não é
    // subcoleção de tenant porque News pode ser do Sistema (tenantId null).
    // Leitura segue o mesmo modelo de newsComments (qualquer autenticado): uma
    // regra de "list" não consegue filtrar por notícia individualmente, então a
    // restrição de visibilidade fica a cargo da escrita (só quem edita a
    // notícia anexa documentos a ela).

    match /newsDocuments/{docId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.createdBy == request.auth.uid
        && canEditNewsDocument(request.resource.data.newsId);
      allow delete: if request.auth != null
        && canEditNewsDocument(resource.data.newsId);
    }

    // ─── Filtros salvos ───────────────────────────────────────────────────────

    match /savedFilters/{filterId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }

    // ─── Logs de Auditoria ────────────────────────────────────────────────────
    // Coleção flat na raiz (não subcoleção de tenant). Escrita bloqueada para
    // todos os clientes — somente Cloud Functions (Admin SDK) criam documentos.

    match /auditLogs/{logId} {
      allow read: if request.auth != null && isTenantAdmin(resource.data.tenantId);
      allow write: if false;
    }

    // ─── Cursor de leitura da Auditoria ───────────────────────────────────────
    // Doc id: `${userId}_${tenantId}`. Guarda só `lastReadAt` — usado para
    // calcular o badge de falhas CRITICAL não lidas (ver "Badge de falhas
    // críticas não lidas" no módulo de Auditoria). Mesmo padrão de savedFilters.

    match /auditLogReadCursors/{cursorId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }

    // ─── Catálogo de Steps do Workflow Engine ─────────────────────────────────
    // Coleção flat na raiz, global (não por tenant) — o catálogo de Steps disponíveis é o
    // mesmo para todos os escritórios. Espelho somente-leitura de StepDefinition (sem
    // `createExecutor`), escrito só pelo composition root em functions/ (Admin SDK).
    match /workflow_step_catalog/{stepDefinitionId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

  }
}
```

---

## Firebase Storage Rules — Conjunto Completo

> **Copie o bloco abaixo integralmente no Firebase Console → Storage → Regras.**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // ─── Fotos de perfil de usuário ───────────────────────────────────────────
    // Path: userPhotos/{userId}/{filename}
    match /userPhotos/{userId}/{allPaths=**} {
      // Qualquer usuário autenticado pode ler fotos de perfil
      allow read: if request.auth != null;
      // Somente o próprio usuário pode fazer upload/delete da sua foto
      allow write: if request.auth != null
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024       // máximo 5 MB
        && request.resource.contentType.matches('image/.*');
    }

    // Verifica se o usuário autenticado é SYSTEM ou SUPPORT — ambos agem como
    // admin em qualquer tenant nas regras de Storage abaixo (mesmo racional de
    // isSystemOrSupport() nas regras do Firestore).
    function isSystemOrSupportUser() {
      return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in ['SYSTEM', 'SUPPORT'];
    }
    function isTenantMemberOrElevated(tenantId) {
      return isSystemOrSupportUser()
        || firestore.exists(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid));
    }
    function isTenantAdminOrElevated(tenantId) {
      return isSystemOrSupportUser()
        || firestore.get(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid)).data.role == 'admin';
    }

    // ─── Documentos de processos ──────────────────────────────────────────────
    // Path: tenants/{tenantId}/cases/{caseId}/{filename}
    match /tenants/{tenantId}/cases/{caseId}/{allPaths=**} {
      allow read: if request.auth != null && isTenantMemberOrElevated(tenantId);
      allow write: if request.auth != null
        && isTenantMemberOrElevated(tenantId)
        && request.resource.size < 20 * 1024 * 1024;    // máximo 20 MB
      allow delete: if request.auth != null && isTenantAdminOrElevated(tenantId);
    }

    // ─── Documentos de pessoas ───────────────────────────────────────────────
    // Path: tenants/{tenantId}/persons/{personId}/{filename}
    match /tenants/{tenantId}/persons/{personId}/{allPaths=**} {
      allow read: if request.auth != null && isTenantMemberOrElevated(tenantId);
      allow create: if request.auth != null
        && isTenantMemberOrElevated(tenantId)
        && request.resource.size < 20 * 1024 * 1024;     // máximo 20 MB
      allow delete: if request.auth != null && isTenantAdminOrElevated(tenantId);
    }

    // ─── Documentos de contratos ──────────────────────────────────────────────
    // Path: tenants/{tenantId}/contracts/{contractId}/{filename}
    match /tenants/{tenantId}/contracts/{contractId}/{allPaths=**} {
      allow read: if request.auth != null && isTenantMemberOrElevated(tenantId);
      allow create: if request.auth != null
        && isTenantMemberOrElevated(tenantId)
        && request.resource.size < 20 * 1024 * 1024;     // máximo 20 MB
      allow delete: if request.auth != null && isTenantAdminOrElevated(tenantId);
    }

    // ─── Documentos de lançamentos financeiros ───────────────────────────────
    // Path: tenants/{tenantId}/financials/{financialId}/{filename}
    match /tenants/{tenantId}/financials/{financialId}/{allPaths=**} {
      allow read: if request.auth != null && isTenantMemberOrElevated(tenantId);
      allow create: if request.auth != null
        && isTenantMemberOrElevated(tenantId)
        && request.resource.size < 20 * 1024 * 1024;     // máximo 20 MB
      allow delete: if request.auth != null && isTenantAdminOrElevated(tenantId);
    }

    // ─── Documentos de registros de telas dinâmicas ──────────────────────────
    // Path: tenants/{tenantId}/customRecords/{recordId}/{filename}
    match /tenants/{tenantId}/customRecords/{recordId}/{allPaths=**} {
      allow read: if request.auth != null && isTenantMemberOrElevated(tenantId);
      allow create: if request.auth != null
        && isTenantMemberOrElevated(tenantId)
        && request.resource.size < 20 * 1024 * 1024;     // máximo 20 MB
      allow delete: if request.auth != null && isTenantAdminOrElevated(tenantId);
    }

    // ─── Documentos de boletins ───────────────────────────────────────────────
    // Path: news/{newsId}/{filename}
    // Não é escopado por tenant (News pode ser do Sistema, tenantId null),
    // então a permissão de escrita espelha canEdit de ViewNews.viewmodel.tsx
    // via leitura cruzada do Firestore.
    function newsTenantId(newsId) {
      return firestore.get(/databases/(default)/documents/news/$(newsId)).data.tenantId;
    }
    function newsCreator(newsId) {
      return firestore.get(/databases/(default)/documents/news/$(newsId)).data.userId;
    }
    function isSystemAdminUser() {
      return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'SYSTEM';
    }
    function canViewNews(newsId) {
      let tenantId = newsTenantId(newsId);
      return isSystemAdminUser()
        || (tenantId != null && isTenantMemberOrElevated(tenantId));
    }
    function canEditNews(newsId) {
      let tenantId = newsTenantId(newsId);
      return isSystemAdminUser()
        || (tenantId != null
            && isTenantMemberOrElevated(tenantId)
            && (newsCreator(newsId) == request.auth.uid || isTenantAdminOrElevated(tenantId)));
    }
    match /news/{newsId}/{allPaths=**} {
      allow read: if request.auth != null && canViewNews(newsId);
      allow create: if request.auth != null
        && request.resource.size < 20 * 1024 * 1024        // máximo 20 MB
        && canEditNews(newsId);
      allow delete: if request.auth != null && canEditNews(newsId);
    }

    // ─── Backup frio de Logs de Auditoria ────────────────────────────────────
    // Path: tenants/{tenantId}/logs/{entity}/{logId}.json
    // Escrito somente pela Cloud Function backupDeletedAuditLog (Admin SDK).
    match /tenants/{tenantId}/logs/{entity}/{allPaths=**} {
      allow read: if request.auth != null && isTenantAdminOrElevated(tenantId);
      allow write: if false;
    }
    // Path: systemLogs/{entity}/{logId}.json — logs sem tenant (erros globais do pipeline)
    match /systemLogs/{entity}/{allPaths=**} {
      allow read: if request.auth != null
        && firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'SYSTEM';
      allow write: if false;
    }

    // Bloqueia tudo o mais
    match /{allPaths=**} {
      allow read, write: if false;
    }

  }
}
```

---

## Performance — Queries Firestore

### Regras de query

- **Sempre usar `where` + `orderBy` no servidor** — nunca filtre grandes coleções no cliente
- **`limit()`** obrigatório em coleções que crescem indefinidamente
- **Índices compostos** devem ser documentados abaixo ao serem criados
- Coleções de crescimento ilimitado exigem **paginação por cursor** (`startAfter`)

### Índices compostos necessários

| Coleção | Campos | Direção |
|---|---|---|
| `tenants/{id}/deadlines` | `tenantId` ASC, `dueDate` ASC | Para ordenar prazos por data |
| `tenants/{id}/deadlines` | `status` ASC, `dueDate` ASC | Para filtrar prazos pendentes |
| `tenants/{id}/financials` | `type` ASC, `dueDate` ASC | Para separar receitas/despesas |
| `tenants/{id}/financials` | `personId` ASC, `dueDate` DESC | Para `getFinancialsByPerson` (cascata de exclusão de `Person`) |
| `tenants/{id}/cases` | `status` ASC, `createdAt` DESC | Para listar processos ativos |
| `tenants/{id}/pushes` | `tenantId` ASC, `receivedAt` DESC | Para ordenar pushes por data de recebimento |
| `tenants/{id}/pushes` | `status` ASC, `receivedAt` DESC | Para filtrar pushes por status |
| `news` | `tenantId` ASC, `createdAt` DESC | Para listar notícias por escopo (sistema ou tenant) |
| `members` (collectionGroup) | `userId` ASC | Para descobrir tenants de um usuário |
| `gmailConnections` | `email` ASC, `tenantId` ASC | Para buscar conexões Gmail por email na Cloud Function |
| `auditLogs` | `tenantId` ASC, `createdAt` DESC | Para listar auditoria por escritório, mais recente primeiro |
| `auditLogs` | `tenantId` ASC, `severity` ASC, `createdAt` ASC | Para contar falhas CRITICAL não lidas (badge da Auditoria) |
| `tenants/{id}/customRecords` | `screenKey` ASC, `createdAt` DESC | Para listar registros de cada tela dinâmica |
| `tenants/{id}/workflow_definitions` | `eventName` ASC, `enabled` ASC | Para `findEnabledByEvent` — o gatilho do motor localiza workflows habilitados por evento |
| `tenants/{id}/workflow_executions` | `workflowDefinitionId` ASC, `startedAt` DESC | Para listar execuções de um workflow na aba "Execuções", mais recente primeiro |

---

## Sistema de Deeplinks

Deeplinks permitem compartilhar links diretos para tabs específicas.

### Formato

```
https://curatino.app/view-news:{newsId}
```

### Geração

```typescript
import { generateDeepLink } from '../infrastructure/deeplink/deepLinkUtils';
const link = generateDeepLink(`view-news:${newsId}`);
```

### Resolução

O `App.tsx` lê o path na inicialização e abre a tab correspondente via `WorkspaceStore.openTab(key)`.

---

## Sistema de Notificações

Use sempre `notify()` para feedback ao usuário. Nunca `window.alert` ou `window.confirm`.

```typescript
const { notify } = useNotification();
notify('Pessoa salva com sucesso.', 'success');
notify('Erro ao salvar processo.', 'error');
notify('Prazo vencido amanhã.', 'warning');
```

Para exclusões, sempre use `ConfirmModal` com `isOpen`:

```tsx
<ConfirmModal
  isOpen={vm.confirm.open}
  title="Excluir pessoa"
  message="Esta ação não pode ser desfeita."
  variant="danger"
  onConfirm={vm.runConfirm}
  onCancel={vm.cancelConfirm}
/>
```

---

## CompositeFilter — Filtros com Persistência

O `CompositeFilter` é o componente padrão para listas filtráveis. Usa `screenKey` para persistir filtros no Firestore.

```tsx
<CompositeFilter
  defs={vm.filterDefs}
  tokens={vm.filterTokens}
  onChange={vm.setFilterTokens}
  placeholder="Filtrar pessoas..."
  screenKey="persons"   // chave única por tela para persistência
/>
```

### Definindo filtros no ViewModel

```typescript
const filterDefs = useMemo<FilterDef[]>(() => [
  { key: 'search',  label: 'Busca',   type: 'text',   placeholder: 'Nome, CPF...' },
  { key: 'status',  label: 'Status',  type: 'select', options: STATUS_OPTIONS },
  { key: 'type',    label: 'Tipo',    type: 'select', options: TYPE_OPTIONS },
], []);
```

**Seleção única** → `SearchSelect`; **múltipla** → `MultiSearchSelect`; **nunca** `<select>` nativo.

### Filtro de data única (`type: 'date'`)

`FilterType` inclui `'date'` para filtros de uma única data (ex: Vencimento (de) / Vencimento (até) em `Financials`). Não recebe `options`; o `FilterToken.values` guarda sempre `[dataISO]`. Diferente de `select`/`multiselect`/`text`, o `<input type="date">` de edição aparece **inline na barra principal do filtro** (no lugar do input de busca genérico), não dentro do dropdown — evita o input de texto piscando atrás do calendário. O dropdown abaixo só mostra uma dica e o botão "Aplicar". O chip exibe a data formatada (`dd/mm/aaaa`). Um período (De/Até) é modelado como **dois** `FilterDef` independentes — não como um único filtro de intervalo — para que cada ponta seja editável separadamente. Para pré-popular um período ao abrir a tela (ex: mês corrente), semeie o `useState<FilterToken[]>` inicial no ViewModel — não use `useEffect`, já que é um valor inicial e não uma sincronização:

```typescript
const [filterTokens, setFilterTokens] = useState<FilterToken[]>(() => [
  { key: 'dueDateFrom', values: [toISODate(startOfMonth)] },
  { key: 'dueDateTo', values: [toISODate(endOfMonth)] },
]);
```

O usuário pode remover o chip a qualquer momento como qualquer outro filtro.

---

## Command Palette (Cmd+K)

Acessado via `Cmd+K` (Mac) ou `Ctrl+K` (Windows). Providers registrados em `CommandPaletteRegistry.ts`:

| Provider | Descrição |
|---|---|
| `NavigationCommandProvider` | Navega para páginas do `pageRegistry` |
| `NewsCommandProvider` | Busca boletins pelo título/resumo |
| `PersonCommandProvider` | Busca pessoas por nome/CPF/CNPJ/email/telefone |
| `CaseCommandProvider` | Busca processos por título/número |
| `ContractCommandProvider` | Busca contratos por título/número |
| `SystemCommandProvider` | Alterar tema, acessar perfil, sair |

Para adicionar um provider de nova entidade (ex: Pessoas):
1. Crie `PersonCommandProvider.tsx` implementando `ICommandPaletteProvider`
2. Adicione `persons` no `CommandPaletteAppContext` em `ICommandPaletteProvider.ts`
3. Passe os dados no `CommandPalette.viewmodel.tsx`
4. Registre em `CommandPaletteRegistry.ts`

---

## Conformidade com ESLint e React Compiler

O projeto usa `eslint-plugin-react-hooks` v6+ com as regras do React Compiler. As regras mais frequentes:

### `react-hooks/refs` — "Cannot access refs during render"

**Causa:** `ref.current` lido no corpo do componente/hook (durante render).
**Correção arquitetural:** leia `ref.current` apenas dentro de `useEffect`, `useLayoutEffect`, `useCallback` ou handler.

```typescript
// ✅ CORRETO — lê ref.current no efeito
useEffect(() => {
  const height = containerRef.current?.clientHeight ?? 0;
  setHeight(height);
}, []);

// ❌ ERRADO — lê ref.current durante render
const height = containerRef.current?.clientHeight ?? 0; // no corpo do hook
```

**Falso-positivo comprovado** (ex: viewmodel retorna RefObject para o DOM): suprima **só a linha**:
```
// eslint-disable-next-line react-hooks/refs -- passing ref to DOM element
```

### `react-hooks/set-state-in-effect` — "Calling setState synchronously within an effect"

**Causa:** `setState` chamado no corpo síncrono de um `useEffect`.
**Correção:** mova o setState para dentro de uma função async/callback, ou suprima se for arquiteturalmente necessário (ex: `setLoading(true)` antes de operação async):

```
// eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async operation
setLoading(true);
```

### `react-hooks/exhaustive-deps`

- **Ref em cleanup:** copie `ref.current` para variável local dentro do efeito antes de usar no cleanup
- **Objeto recriado a cada render:** envolva em `useMemo` antes de usar como dependência

---

## Regra de Commit — Gate de Qualidade

**Nenhum commit sem passar pelas DUAS verificações:**

```bash
npx tsc --noEmit && npx eslint . --max-warnings 0
```

| Ferramenta | Pega | Não pega |
|---|---|---|
| `tsc --noEmit` | Erros de **tipo** | Regras dos Hooks, refs, pureza |
| `eslint . --max-warnings 0` | Regras do React Compiler | Erros de tipo |
