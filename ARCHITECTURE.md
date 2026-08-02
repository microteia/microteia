# Arquitetura da Microteia — Plataforma de Aplicações de Negócio (SaaS)

> Documento de referência para desenvolvimento e manutenção. Toda nova feature deve seguir este padrão.
>
> **Microteia** é um SaaS (Software as a Service) multi-tenant construído com React + Firebase. A plataforma permite criar aplicações de negócio de forma declarativa. Dados de cada tenant (organização) ficam isolados em subcoleções do Firestore: `tenants/{tenantId}/{coleção}/{docId}`.

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
│  TenantStore · RecordStore · LookupStore    │
│  TagStore · PushStore · NewsStore           │
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
| `AIConnectionSecret` | `tenants/{tenantId}/aiConnections/{id}/secrets/current` | Sim (chave de API — nunca trafega para o frontend) |
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
| `Script` (código reutilizável do Step "Script") | `tenants/{tenantId}/scripts/{id}` | Sim |

### Tipos-chave

```typescript
// Papel global do usuário no sistema
type UserRole = 'SYSTEM' | 'USER';

// Papel do usuário dentro de um escritório específico
type TenantRole = 'admin' | 'lawyer' | 'secretary' | 'user';

// Temas visuais disponíveis
type ThemeMode = 'dark' | 'light' | 'claude' | 'teams' | 'bruma' | 'kindle' | 'microteia' | 'themis' | 'themisDark';
```

### Entidade AIConnection

Conexões de IA do escritório (`tenants/{tenantId}/aiConnections/{id}`). Somente administradores do tenant leem e escrevem.

A **chave de API nunca fica no documento da conexão** — ela vive na subcoleção `secrets/current` (campo `apiKey`), no mesmo padrão de `gmailConnections/{id}/tokens/current`:

- O documento da conexão guarda apenas `name`, `provider`, `model`, `temperature`, `maxTokens`, `isDefault` e o booleano `hasApiKey` (indica ao frontend que já existe chave cadastrada, sem revelá-la).
- O frontend **escreve** a chave (cadastro e troca) e **nunca a lê** — a regra do Firestore em `secrets/{secretId}` é `allow read: if false`.
- As Cloud Functions leem a chave pelo Admin SDK (`FirebaseAIConnectionRepository` em `functions/src`, método privado `readApiKey`), que ignora as Security Rules. Enquanto houver conexões antigas, `readApiKey` cai de volta no campo legado `apiKey` do documento da conexão; ao editar a conexão e informar uma chave nova, o frontend grava o segredo e remove o campo legado (`deleteField()`).
- Ao editar sem preencher o campo de chave, a chave atual é mantida. Excluir a conexão apaga primeiro `secrets/current`.

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
Deploy: `firebase deploy --only firestore:indexes` (configurado em `firestore.indexes.json`).

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

O Microteia implementa o **Authorization Code Flow** do Google OAuth para obter tokens de acesso offline (com `refresh_token`). Este é o fluxo correto para SaaS que precisam acessar APIs em background sem o usuário presente.

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

### `TenantMember` não é entidade de domínio — não use como alvo de FK

`members` existe **exclusivamente** para autenticação (quem entra no tenant e com qual papel) e para auditoria (`createdBy`/`updatedBy`/`completedBy`, e o `auditFlatEntityChange`). Nenhum campo de negócio referencia `members`: campos como "Advogado responsável" (o do Processo e o do Prazo) e "Responsável" (`Contract.responsibleId`) são FKs para **`persons`**, com `denormalizedFields: ['name', 'type', 'email']`. Um responsável é uma Pessoa do escritório, exista ou não uma conta de login correspondente — e continua válido depois que o membro sai do tenant.

Registros gravados antes dessa correção guardam um `userId` de membro nesses campos; o valor não resolve mais para uma Pessoa e aparece como **valor órfão sinalizado** no `SearchSelect`, até ser reapontado manualmente para a Pessoa correta.

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
  responsibleLawyerId?: string | null; // FK para Pessoa; nome resolvido em tempo de renderização via usePersonStore()
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

**Relação Processo ↔ Contrato:** um `Contract` pode ter vários `Case` vinculados, mas cada `Case` pertence a no máximo 1 `Contract`. A chave estrangeira vive no lado "muitos" (`Case.contractId`, sem espelho de número — o número do contrato é resolvido em tempo de renderização via `useContractStore()`, mesmo padrão de `responsibleLawyerId`) — não existe array `caseIds` em `Contract`. A aba "Processos" de `ViewContract` deriva a lista de processos vinculados filtrando `useCaseStore().cases` por `contractId` em memória (via `useMemo`), sem query Firestore adicional nem índice composto, já que `CaseStore` carrega a lista de `cases` do tenant inteira. Vincular/desvincular é um `updateCase(caseId, { contractId })` comum. Ao excluir um `Contract`, os `cases` vinculados **não** são alterados — o `contractId` fica apontando para um contrato inexistente (órfão) e simplesmente deixa de resolver o número na tela (ver "Cascata de Exclusão").

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

### Prazos — declarado por extensão

`deadlines` não está no `entityRegistry.ts`. Quem descreve a coleção é a extensão **Prazos**
(`com.microteia.prazo`, `dataCollection: 'deadlines'`, `eventPrefix: 'deadline'`), com 8 campos em 3
seções e três listas de opções (`deadlineTypes`, `deadlinePriorities`, `deadlineStatuses`) com as
opções de partida. Ver "Prazos sai do kernel".

### Financeiro — declarado por extensão

`financials` não está no `entityRegistry.ts`. Quem descreve a coleção é a extensão **Financeiro**
(`com.microteia.financeiro`, `dataCollection: 'financials'`, `eventPrefix: 'financial'`,
`tagCollection: 'financialTags'`, `writeRoles: ['admin', 'lawyer']`), com 14 campos em 4 seções e
quatro listas de opções com as opções de partida. Ver "Financeiro sai do kernel".

### Etiquetas e documentos do Financeiro

As etiquetas vivem em `tenants/{tenantId}/financialTags/{id}` e os documentos em
`tenants/{tenantId}/financials/{financialId}/documents/{id}` (Storage:
`tenants/{tenantId}/financials/{financialId}/{timestamp}_{filename}`) — as duas coleções são
DECLARADAS pela extensão (`tagCollection`, `hasDocuments`), e servidas pelo repositório e pelo store
genéricos, como os de qualquer tela.

`type` de um documento referencia a `key` de um `DocumentTypeConfig` — o catálogo de tipos (coleção
`tenants/{tenantId}/documentTypes`) é **compartilhado por tenant** entre todas as telas que anexam
documentos: um tipo criado em qualquer uma aparece nas demais.

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
Deploy: `firebase deploy --only firestore:indexes` (configurado em `firestore.indexes.json`).

**Motivo:** Um único email pode conter múltiplas intimações. A query de deduplicação (`getByEmailIdAndProcessNumber`) usa `emailId + processNumber` e precisa deste índice. **Um mesmo processo pode aparecer várias vezes no mesmo e-mail** (publicações/documentos diferentes) — por isso a query retorna **todos** os candidatos e o `CreateOrUpdatePushUseCase` desempata por uma `notificationKey` por intimação (URL do documento; na falta dela, composição de `court`/`processSubject`/`activeParty`/data). Assim cada intimação vira um push próprio, mantendo a idempotência no reprocessamento.

**Cloud Function:** `gmailPush` (Pub/Sub trigger) processa notificações do Gmail, extrai dados via parsers específicos por formato e cria registros de Push. Um único e-mail pode conter várias intimações (uma por processo) — cada parser retorna um array e a Cloud Function cria um Push por item.

**Pipeline de extração (`functions/src/data/services/`):**

1. **Decodificação do corpo (`GmailService`).** Cada parte MIME é decodificada respeitando o `charset` declarado (`iso-8859-1`/`windows-1252` → `latin1`; senão `utf-8`) e o percurso é recursivo (cobre `multipart/alternative` dentro de `multipart/mixed`). Isso evita mojibake em e-mails Latin-1 (Projudi, PJe).
2. **Utilitário compartilhado (`parsers/emailParsingUtils.ts`).** Fonte única para: `decodeHtmlEntities` (entidades nomeadas + numéricas), `htmlToText`, `labeledValue` (rótulo→valor, mesma linha ou linha seguinte, tolerante a acento/mojibake e ancorado ao início da linha), `formatCNJ`/`findCNJ`/`hasCNJ` e parsing de datas (BR e por extenso). Todo parser reutiliza esses helpers — não há mais `cleanHtml` duplicado por parser.
3. **Parsers por formato (`parsers/*.ts`).** `ProjudiTJBAEmailParser` (texto, 1 intimação), `TJBAEmailParser` (PJe Push, 1 processo + tabela de movimentações), `PublicacoesOnlineParser` e `RecorteDigitalEmailParser` (agregadores do DJEN/TJBA, **N** intimações por e-mail, com formatos textuais distintos), além de `TJMAEmailParser`, `TRTEmailParser` e o genérico `CNJEmailParser`. Cada parser se auto-filtra por assinatura de conteúdo.
4. **Detecção (`EmailParserService`).** Primeiro por remetente (`parserByEmail`/`parserByPattern`); se não casar, por **conteúdo** (percorre os parsers e aceita o primeiro que extrair dados — vários remetentes compartilham o mesmo formato de tribunal). O `CNJEmailParser` genérico fica por último para não sequestrar e-mails.
5. **Fallback de IA (com portão de CNJ).** Só é acionado se nenhum parser extraiu dados **e** o conteúdo contém ao menos um número CNJ (`hasCNJ`) — evita chamadas (e custo) de IA em e-mails sem informação jurídica. A IA é provider-agnóstica (credenciais do tenant) e retorna **todos** os processos do e-mail (não só o primeiro). Sem CNJ, gera um Push `status: 'fault'` com a mensagem "Sem número de processo (CNJ) — IA não acionada".

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

Em vez de uma Cloud Function por coleção monitorada (o que exigiria ~17 deploys), a Microteia usa **duas triggers com wildcard no nome da coleção**, cada uma com uma tabela de configuração interna (`functions/src/domain/services/auditableEntities.ts`) decidindo o que é auditável — coleções fora da allowlist (lookups, `aiConnections`, etc.) são ignoradas rapidamente:

| Handler | Trigger | Cobre |
|---|---|---|
| `auditFlatEntityChange` | `onDocumentWritten('tenants/{tenantId}/{collection}/{docId}')` | `members`, `*Tags`, `pushes`, `screenDefinitions` — **e toda coleção de tela declarada** (`persons`, `cases`, `contracts`, `deadlines`, `financials`, as do Form Design…) |
| `auditNestedEntityChange` | `onDocumentWritten('tenants/{tenantId}/{parent}/{parentId}/{sub}/{docId}')` | `notes`/`documents` de qualquer registro de tela declarada (+ `documents` de `financials`, `tags` de `screenDefinitions`) |
| `auditTenantDeleted` | `onDocumentDeleted('tenants/{tenantId}')` | Exclusão do escritório inteiro — sempre `severity: 'CRITICAL'` |
| `auditNewsChange` / `auditNewsCommentChange` / `auditNewsTagChange` | `onDocumentWritten('news/{docId}')` / `'newsComments/{docId}'` / `'newsTags/{docId}'` | Notícias, Comentários de Notícias e Etiquetas de Notícias — ver subseção própria abaixo |
| `backupDeletedAuditLog` | `onDocumentDeleted('auditLogs/{logId}')` | Backup frio no Storage (ver abaixo) |

**Quem dá nome à entidade auditada:** a tabela do código só descreve o que é do kernel. Para toda coleção que não é reservada nem fixa, `resolveFlatEntityConfig`/`resolveNestedEntityConfig` (`auditableEntities.ts`) resolvem a identidade pela declaração do TENANT — `resolveEntity(ctx, collection)`, a mesma resolução que a tela e a automação usam —, tirando dela o título no singular e no plural e os campos que dão nome ao registro (`displayNameFields`). É por isso que o log diz "Contrato" no dia em que Contrato deixa de ser do kernel e vira extensão; enquanto a identidade vinha de uma lista fixa, o mesmo log dizia "Registro". Sem tela que descreva a coleção (extensão desinstalada, coleção órfã), sobra o rótulo genérico. As telas vêm do `ScreenDefinitionCache` (TTL de 5 min), e só são lidas quando a coleção não é fixa.

O que o log GRAVA em `entity` é a **coleção** (`contracts`, `contracts#notes` para a subcoleção), nunca o título: a coleção é o que o filtro casa e não muda quando a tela é renomeada. O rótulo é resolvido a cada exibição por `entityLabel(entity, dynamicScreens)` (`presentation/pages/AuditLogs/auditLogLabels.ts`), que também alimenta as opções do filtro por entidade (`entityFilterOptions`); `ENTITY_LABELS` continua no arquivo para os logs anteriores à migração, que guardam `Person`/`Case`/`Contract`.

Uma entrada de `auditableEntities.ts` pode restringir quais ações geram log via `auditActions?: AuditAction[]`. Único caso hoje: `pushes` audita só `['UPDATE', 'DELETE']` — a criação é automática (Cloud Function do webhook do Gmail), então não é um evento administrativo digno de log; a triagem manual do status e a exclusão são.

**Diff e Markdown** (`functions/src/domain/services/auditDiff.ts`): `computeChangedFields` retorna um `FieldDiff { before, after }` com os valores **antigos e novos** de cada campo alterado (UPDATE); `normalizeAllFields` retorna todos os campos do documento (DELETE). Ambos normalizam `Timestamp`/`Date` para o formato brasileiro `dd/mm/aaaa` (ou `dd/mm/aaaa HH:mm` quando o horário não é meia-noite), para o JSON ficar legível em português. `buildAuditText` monta a frase + bloco **Antes:** (UPDATE e DELETE) + bloco **Depois:** (só UPDATE) em \`\`\`json\`\`\`; CREATE não inclui bloco (nada "mudou" ainda).

**Autoria:** CREATE/UPDATE usam os campos denormalizados `updatedBy`/`updatedByName`/`updatedByPhotoURL` (preenchidos pelo frontend a cada update, em todo registro de tela e nos membros do tenant) quando presentes; senão a Cloud Function resolve via `UserProfileLookupService`.

**DELETE tem stamp próprio** (`deletedBy`/`deletedByName`/`deletedByPhotoURL`, mesmo padrão de `updatedBy*`), gravado por um `updateDoc` que antecede o `deleteDoc` — ver `stampDeletionActor` (`src/data/utils/stampDeletionActor.ts`), chamado por todo `Firebase[Entidade]Repository.delete*` das entidades auditadas (flat e nested). O tipo `DeletionActor` (`domain/entities/index.ts`) e o `actor` são montados no Store (via `useAuth()`) para entidades com Store próprio, ou no ViewModel para notes/documents (que não têm Store, chamam o UseCase direto) — nunca no Repository, que não tem acesso a `AuthContext`. As triggers (`auditFlatEntityChange`/`auditNestedEntityChange`) preferem `deletedBy*` do snapshot `before`; só caem no fallback antigo (`updatedBy`/`createdBy`, para flat, ou só `createdBy`, para nested) se o documento não tiver o stamp — caso de documentos já apagados antes desta mudança.

Membro de tenant (`TenantMember`) é removido via Cloud Function callable (`removeTenantMember`), não pelo client — o stamp é gravado direto pelo Admin SDK em `FirebaseTenantRepository.removeMember`, num `update` separado da transação de exclusão (um único commit não aceita `update` e `delete` no mesmo documento — o segundo sobrescreve o primeiro).

**Nome efetivo do usuário — prioridade única em todo o sistema:** `userProfiles.nickname` > `userProfiles.fullName` > `users.displayName` > `users.email`. No frontend isso é `effectiveName`, calculado em `stores/AuthContext.tsx` e usado em **todo** carimbo de autoria (`createdByName`, `updatedByName`, `authorName`, `editedByName`, `authorizedByName`, nome do membro/dono ao criar um tenant) — nunca leia `user.displayName` diretamente para gravar autoria. No backend, `UserProfileLookupService.resolveActor` (`functions/src/data/services/UserProfileLookupService.ts`) espelha exatamente a mesma ordem, lendo `userProfiles/{uid}` e `users/{uid}` em paralelo.

**Severidade:** `DELETE` → `HIGH`; mudança do campo `role` em `members` → `HIGH`; exclusão de `Tenant` → `CRITICAL`; erro não tratado no próprio pipeline → `type: 'ERROR'` + `severity: 'CRITICAL'` (auto-monitoramento, escrito com try/catch próprio que nunca lança — ver `logAuditError`); tudo mais fica no default `LOW`/`AUDIT`.

**Filtro de ruído:** updates onde só mudaram campos de bookkeeping (`updatedAt`, `updatedBy*`) não geram log — evita entradas vazias quando um formulário é salvo sem alteração real.

**Resolução de nomes de FK.** Sem tratamento, um campo que guarda o id de outra entidade (ex: `clientId` de Contrato, `activePoleIds` de Processo, ou um campo personalizado do tipo "Referência" criado no Screen Builder) apareceria no bloco JSON só como id cru — ilegível para o usuário do escritório. `auditFlatEntityChange` resolve isso **no momento da escrita**, antes de `buildAuditText`, chamando `IFkNameEnricherService.enrichDiff(tenantId, collection, screenKey, diff)` (`data/services/FkNameEnricherService.ts`), que:

1. Consulta `STATIC_FK_SCHEMA` (`domain/services/auditFkSchema.ts`) — tabela declarativa dos campos FK "de código" das entidades fixas (ex: `financials.caseId → cases`, `contracts.contractorIds → persons`, `*.tagIds → *Tags`). Só entram aqui campos **sem** um irmão já desnormalizado no próprio diff (`caseId`+`caseNumber` juntos, por exemplo, não precisam de resolução extra).
2. Busca o `ScreenDefinition` de id igual à própria coleção e monta o mesmo tipo de schema para todo `FieldDefinition` com `type === 'reference'`, indexado pela chave do campo (que mora na raiz do documento). `refEntity` é sempre o nome da coleção alvo — fixa ou de tela, sem tradução.
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
    ├── persiste tenantId em localStorage['microteia:lastTenantId']
    └── RecordStore, LookupStore, TagStore
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
│   │   └── index.ts               # Todas as entidades e tipos da Microteia
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
│       ├── theme.ts               # Tokens dark/light/claude/teams/bruma/kindle/microteia/themis/themisDark
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
    │   ├── Contracts/
    │   ├── ViewContract/
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
"deploy:workflow": "npm run build:functions && firebase deploy --only functions:onWorkflowEventCreated,functions:publishWorkflowEventOnEntityChange,functions:onNoteChange,functions:onDocumentChange,functions:getExpressionFunctions,functions:getWorkflowStepCatalog --project microteia"
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

**Todo comando acima vai para DESENVOLVIMENTO por padrão.** Ver "Dois ambientes" abaixo.

---

## Dois ambientes — `microteia-dev` e `microteia`

| Alvo | Projeto Firebase | Quando |
|---|---|---|
| `dev` (padrão) | `microteia-dev` | Desenvolvimento e testes |
| `prod` | `microteia` | Produção |

### Um único seletor: `TARGET`

`TARGET` escolhe **ao mesmo tempo** o projeto do Firebase (via alias do `.firebaserc`) e o modo do
Vite — que decide qual arquivo de ambiente entra no bundle. Os dois andam juntos de propósito:
separá-los permitiria publicar um bundle com credenciais de produção no hosting de desenvolvimento.

```bash
npm run dev                       # servidor local -> microteia-dev
npm run deploy:workflow           # -> microteia-dev
npm run deploy:rules              # -> microteia-dev

TARGET=prod npm run deploy:workflow   # -> microteia
npm run deploy:prod                   # atalho: deploy completo em microteia
npm run deploy:hosting:prod           # atalho: hosting + functions em microteia
```

**O padrão é `dev`, não `prod`.** Um comando digitado sem pensar publica em desenvolvimento; chegar
em produção exige dizer isso explicitamente. O `firebase` imprime o projeto de destino no início de
todo deploy — é a confirmação visual antes de qualquer escrita.

### Arquivos de ambiente — não existe `.env` comum

| Arquivo | Ambiente | No git |
|---|---|---|
| `.env.dev` | microteia-dev | não |
| `.env.prod` | microteia | não |
| `.env.example` | modelo | sim |
| `functions/.env.microteia-dev` | microteia-dev | não |
| `functions/.env.microteia` | microteia | não |

O `.env` da raiz foi **removido de propósito**. O Vite o usaria como fallback de qualquer modo, e
uma variável esquecida no `.env.dev` cairia calada na configuração de produção — o pior erro
possível aqui, porque o app de desenvolvimento passaria a escrever no banco real. Sem fallback, a
falta de qualquer chave estoura em `infrastructure/firebase/config.ts` com o nome do que faltou e
do arquivo a corrigir.

No backend o mecanismo é nativo: o `firebase-functions` carrega sozinho o `.env.<projectId>` do
projeto alvo, então não há nada a configurar além de manter os dois arquivos preenchidos.

### Ao criar um ambiente do zero

```bash
npx firebase apps:sdkconfig web --project dev   # preenche .env.dev
gcloud app create --region=southamerica-east1 --project=microteia-dev
npm run deploy:rules                            # regras do Firestore e do Storage
npm run deploy:indexes                          # índices compostos
npm run deploy:functions --force                # todas as functions (rode duas vezes)
```

Três armadilhas de projeto novo, todas já enfrentadas em `microteia-dev`:

**1. A aplicação do App Engine precisa existir antes das functions.** Sem ela o deploy falha em
`generateUploadUrl` com um 404 dizendo que não conseguiu autenticar o service agent
`gcf-admin-robot` — mensagem que não menciona o App Engine e manda procurar no lugar errado.
A **região do App Engine é definida uma única vez e nunca pode ser alterada**; use a mesma das
functions (`southamerica-east1`), senão o projeto inteiro precisa ser recriado.

**2. O primeiro `deploy:functions` falha nas functions de gatilho.** As identidades de serviço do
Pub/Sub e do Eventarc são criadas *durante* esse primeiro deploy e não propagam a tempo, então toda
function de trigger (`onDocumentWritten`, `onDocumentCreated`, `onUserCreated`) quebra enquanto as
callables sobem normalmente. **Não é erro de configuração: basta repetir o comando.**

**3. Use `--force` na primeira vez** para que o Firebase configure sozinho a política de limpeza do
Artifact Registry. Sem ela, as imagens de container de cada build se acumulam e geram cobrança
mensal crescente. A política aplicada apaga imagens com mais de 24h.

A localização do Firestore precisa bater com a região das functions — gatilhos do Firestore não
funcionam entre regiões diferentes.

Regras, índices e código são os mesmos arquivos versionados dos dois lados — só o projeto de
destino muda. O que **não** é replicado: dados, usuários e as credenciais OAuth do Google (o
`VITE_GOOGLE_CLIENT_ID` e o `GOOGLE_CLIENT_SECRET` precisam ser criados no Console do Google Cloud
do projeto de dev; usar os de produção faria o desenvolvimento ler caixas de e-mail reais).

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

### Responsabilidades dos stores da Microteia

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
| `FinancialStore` | Receitas/despesas do tenant atual, CRUD + `markPaid` |
| `FinancialTagStore` | Etiquetas de lançamentos financeiros do tenant atual, CRUD de tags, aplicação de tags em lançamentos |
| `PushStore` | Pushes do tribunal do tenant atual, CRUD + `updateStatus` |
| `PushInteractionStore` | Rastreamento de leitura de pushes por usuário |
| `NewsStore` | Notícias do sistema + do tenant atual, CRUD + curtidas |
| `NewsTagStore` | Etiquetas de boletins |
| `NewsInteractionStore` | Leitura, salvos, curtidas por usuário |
| `WorkspaceStore` | Tabs abertas no shell, tab ativa |
| `ThemeStore` | Tema visual com persistência em localStorage (`'microteia-theme'`) |
| `WorkflowStore` | Automações (`WorkflowDefinition`) do tenant atual — CRUD de definição + steps embutidos. Execuções (`WorkflowExecution`) e catálogo de Steps são lidos direto via `useDI()` nas viewmodels de `ViewWorkflow`, sem store próprio (dado local à página, não compartilhado entre telas) |

### Stores que dependem do tenant

`RecordStore`, `LookupStore`, `TagStore`, `PushStore`, `WorkflowStore` escutam `currentTenant` via `useTenant()`. Se `currentTenant` for `null`, limpam o estado e não fazem queries.

---

## StoreEventEmitter — Notificação entre Stores

`infrastructure/events/StoreEventEmitter.ts` é um singleton pub/sub. Stores emitem eventos ao mutar dados; stores que dependem desses dados assinam e chamam `refresh()`.

### Eventos registrados

| Evento | Emitido por | Assina |
|---|---|---|
| `PERSONS_UPDATED` | `PersonStore` | — |
| `CONTRACTS_UPDATED` | `ContractStore` | — |
| `CONTRACT_TAG_UPDATED` | `ContractTagStore` | — |
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

**Preservação de edições durante visibilitychange:** O `useEntityDetail` sincroniza valores vindos do Store apenas se `isDirty === false`, garantindo que o formulário não perca as edições do usuário quando o documento é atualizado remotamente ou ao trocar de abas do navegador. Após salvar, `isDirty` é resetado e o próximo update do Store aplica o valor salvo.

---

## Cascata de Exclusão

**Regra atual: não há cascata entre entidades de negócio.** Excluir `Person`, `Case`, `Contract`,
um registro de tela apaga **apenas** o documento alvo. Filhos/relacionados podem ficar órfãos
(ex.: prazos de um processo excluído continuam existindo, apontando para um `caseId` inexistente) — é
uma decisão consciente: a complexidade de manter cascata consistente não compensava. Vincular por FK
não implica exclusão em cascata; um registro órfão simplesmente deixa de resolver o nome/objeto da
referência na tela.

| Entidade excluída | O use case remove |
|---|---|
| `Tenant` | Toda a subárvore do tenant (operação de nível de conta, não coberta pelos `Delete*UseCase` de entidade) |
| Registro de qualquer tela (Pessoa, Processo, Contrato, Prazo, Lançamento…) | — (apenas o próprio documento) |
| `Push` | Todos os `pushInteractions` onde `pushId === id` — **infra, roda no backend** (ver nota abaixo) |
| `PushInteraction` | — (folha) |

`makeDeletePersonUseCase`/`makeDeleteCaseUseCase`/`makeDeleteContractUseCase`
(`domain/usecases/{persons,cases,contracts}/Delete*UseCase.ts`) são hoje factories de **um único
repositório** que apenas chamam `repo.delete[Entidade](tenantId, id, actor)`, repassando o
`DeletionActor` para a auditoria creditar quem excluiu.

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
- **Campos das telas padrão:** `builtin: true` com doc id fixo igual à coleção da entidade. Criado lazy no primeiro save. Somente `fields` é relevante. **Nenhuma entidade do kernel está mais nessa situação** — Prazo foi a última a sair —, então hoje toda tela do Form Design é de extensão ou do próprio escritório; o mecanismo continua para o dia em que o kernel voltar a ter uma tela fixa.

`FieldDefinition`: `key` (slug do label na criação; **imutável** — renomear o label não altera a key, preservando dados e histórico de auditoria), `label`, `type` (`text | textarea | number | currency | date | checkbox | select | masked | reference` — **type também é imutável** após criação), `required`, `order`, `section`, `options` (estáticas, para `select`), `optionsAllowUserAdd`, `multi`, `mask` (`cpf | cnpj | phone | cep`), `refEntity` (coleção padrão ou screenKey dinâmico), `placeholder`, `showInList`, `filterable`.

**Opções de selects vivem numa COLEÇÃO própria do tenant**, apontada por `FieldDefinition.lookupCollection` — `tenants/{tid}/caseCourts/{id}` para um campo do kernel, `tenants/{tid}/medico_especialidade/{id}` para um do Form Design ou de extensão. A forma do documento é a mesma nos dois casos (`{ key, label, color? }`), e é isso que permite migrar uma tela fixa para plugin sem mover dado: a identidade da lista é o NOME da coleção.

A regra que unifica: **`optionsAllowUserAdd: true` exige `lookupCollection`** — lista aberta *é* lista em coleção. O campo `options` inline continua existindo, e só, para lista fechada.

| | Declaração da lista | Regra no Firestore |
|---|---|---|
| Kernel (`caseCourts`) | `LOOKUP_REGISTRY` (código) + defaults em `data/repositories/lookupDefaults.ts` | bloco nomeado; nome em `RESERVED_COLLECTIONS` |
| Tenant (`medico_especialidade`) | documento em `tenants/{tid}/lookupDefinitions/{colecao}` | curinga, via `isDeclaredLookup()` |

O `SchemaContext.lookups` é a **união** das duas — a partir dele nada mais pergunta de onde a lista veio.

> **Por que a declaração do tenant existe.** O curinga das rules autoriza a escrita numa coleção que só existe em runtime consultando um `exists()`; sem um documento a apontar, não haveria o que consultar. E é ela, não os dados, que a desinstalação remove: **as opções cadastradas pelo escritório ficam na coleção**, e voltam a valer quando alguém recriar a lista com o mesmo nome. Antes, `fieldOptions` era subcoleção de `screenDefinitions` e a exclusão da tela apagava tudo.

> **Por que as 30 listas do kernel NÃO ganham documento.** Seriam 30 docs por tenant repetindo o que o código já diz, e cada lista nova no `LOOKUP_REGISTRY` viraria migração de dados (sem backfill, ela nasceria sem declaração e não aceitaria escrita em tenant nenhum). É o mesmo arranjo das entidades: `persons` tem regra nomeada e `medico` passa pelo curinga, mas as duas resolvem pelo MESMO caminho. Quando `cases` virar extensão, suas listas migram de `LOOKUP_REGISTRY` para `lookupDefinitions` e os documentos não se movem.

- Repositório e store são **um só para todas as listas**: `FirebaseLookupRepository` (`collection` como primeiro argumento, defaults de `lookupDefaults.ts`) e `LookupStore`/`useLookups` (`getOptions(collection)`, `addOption`, `removeOption`, `declareLookup`). Substituíram ~30 `Firebase*Repository` idênticos, 14 interfaces e os 7 stores por entidade (`CaseLookupStore` e irmãos).
- `FirebaseLookupDefinitionRepository` cuida das declarações do tenant, com refcount em `ownerPluginIds` — duas extensões podem declarar a mesma lista, e desinstalar uma preserva a declaração.

### Registros das telas — UM modelo só

**Uma tela É uma coleção, e o `id` dela É o nome da coleção:** `tenants/{tenantId}/{screenId}/{recordId}`.
Vale igual para as fixas (`persons`), as de extensão (`produtos`) e as do Form Design
(`medico`). **Todo campo mora na raiz do documento** — não existe mais o mapa `values` das telas
dinâmicas nem o `customValues` das fixas, nem o discriminador `screenKey`, nem o `title`
denormalizado (o nome de exibição sai de `titleFieldKey`, como as fixas usam `displayNameFields`).
Quem abre um documento no Firestore não distingue o que veio do kernel, de uma extensão ou do
próprio escritório.

Convenção de tipos gravados: text/textarea/masked → `string` (masked guarda formatado);
number/currency → `number | null`; date → `string 'YYYY-MM-DD'`; checkbox → `boolean`;
select/reference single → `string | null`; multi → `string[]`.

A listagem consulta `orderBy('createdAt','desc') + limit(500)` — sem filtro implícito e, portanto,
**sem índice composto**. Filtro e ordenação continuam em memória, como antes.

> Consequência aceita: coleções criadas em runtime não podem ter índice composto declarado em
> `firestore.indexes.json`. É o motivo de o motor de workflow usar só igualdades no Firestore e
> ordenar em memória.

### Camadas

- Conversões e validações puras: `domain/services/customFieldValues.ts` (`slugifyFieldKey`, `ensureUniqueKey`, `buildInitialFormValues`, `formValuesToStoredValues`, `validateRequiredFields`, `resolveRecordTitle`, `sortFieldsByOrder`).
- Repositórios: `FirebaseScreenDefinitionRepository` (upsert preserva `createdAt/createdBy`; delete remove antes a subcoleção `tags` e grava o stamp `deletedBy*`) e `FirebaseRecordRepository`/`FirebaseRecordNoteRepository`/`FirebaseRecordDocumentRepository` — **genéricos por coleção**: recebem `collection` como argumento e servem qualquer entidade.
- Use cases genéricos em `domain/usecases/records/` (`Create/Update/Delete/GetById/Get/SubscribeToRecord*`), todos parametrizados pela coleção.
- Stores: `ScreenDefinitionStore` (definições + `tagsByScreen`, eventos `SCREEN_DEFINITIONS_UPDATED`) e `RecordStore` (`recordsByCollection`, `allRecords` para o ⌘K, evento `RECORDS_UPDATED`; assina uma coleção por tela `design`/`plugin` e depende do `ScreenDefinitionStore` — ordem dos providers em `App.tsx`). As 5 entidades fixas seguem com stores tipados próprios nesta etapa; o contrato de leitura e gravação, porém, já é o mesmo.

### Anotações e Documentos em telas dinâmicas

- Habilitados por tela via `hasNotes`/`hasDocuments` na definição; aparecem como abas em `ViewDynamicRecord` (padrão idêntico ao `ViewContract`).
- Subcoleções `tenants/{tid}/{collection}/{recordId}/notes|documents` — a coleção é o caminho, então nada precisa ser denormalizado no doc. Arquivos no Storage em `tenants/{tid}/{collection}/{recordId}/{ts}_{arquivo}` (máx. 20 MB).
- Repositórios genéricos + `useRecordNotesPort`/`useRecordDocumentsPort` (`entityScreen/useRecordPorts.ts`), que prendem a coleção e entregam o mesmo `NotesPort`/`DocumentsPort` das fixas.
- `DeleteRecordUseCase` cascateia: exclui notas, documentos (incluindo arquivos do Storage) e então o registro.
- Auditoria: `getNestedEntityConfig` cai numa configuração genérica de "Nota/Documento de Registro" para qualquer coleção que não seja reservada.

Nota: as coleções de lista (`caseCourts`, `medico_especialidade`…) **não** estão no `NESTED_ENTITY_CONFIG` — não geram log de auditoria hoje.

### Etiquetas em telas dinâmicas

- Habilitadas por tela via `hasTags` na definição; a tela de detalhe (`ViewDynamicRecord`) exibe um botão "Gerenciar etiquetas" no cabeçalho (mesmo ícone/posição do `ViewPerson`/`ViewContract`), as etiquetas aplicadas como pills abaixo do título, um filtro "Etiqueta" na listagem (`DynamicRecordList`) e as pills no card da listagem — tudo condicionado a `definition.hasTags`.
- **A etiqueta vive numa COLEÇÃO do tenant**, apontada por `ScreenDefinition.tagCollection` (e, nas fixas, por `EntityMetadata.tagCollection`): `tenants/{tid}/caseTags/{id}` para Processos, `tenants/{tid}/medico_tags/{id}` para uma tela do Form Design. Mesma forma de documento (`{ name, color, createdBy, createdAt }`) nos dois casos — é o espelho exato do que `lookupCollection` faz num campo, e pelo mesmo motivo: duas telas que apontem para a mesma coleção **compartilham as etiquetas**, e excluir a tela não apaga o que o escritório cadastrou.

| | Declaração do conjunto | Regra no Firestore |
|---|---|---|
| Kernel (`caseTags`) | `EntityMetadata.tagCollection` (código) | bloco nomeado; nome em `RESERVED_COLLECTIONS` |
| Tenant (`medico_tags`) | documento em `tenants/{tid}/tagDefinitions/{colecao}` | curinga, via `isDeclaredTagList()` |

- Um `FirebaseTagRepository` e um `TagStore`/`useTags` servem a TODAS as etiquetas, indexados pelo nome da coleção. Substituíram os 4 repositórios e stores por entidade (`CaseTagStore` e irmãos) e os métodos de etiqueta do repositório de telas. A costura para a UI é `useTagAdapter(entityCollection, tagIdsOf, setRecordTags)` (`shared/entityScreen/useTagAdapter.ts`), que monta o `TagStoreAdapter` que o `TagManager` já consumia — antes cada ViewModel montava o seu, quase idêntico.
- `SchemaContext.tagLists` une os conjuntos do kernel aos do tenant. Ele existe para o **espaço de nomes**: tela, lista de opções e conjunto de etiquetas viram coleção sob o mesmo tenant e passam pelo MESMO `match` curinga, então `screenIdIssue`/`lookupIdIssue`/`tagListIdIssue` recusam um nome que qualquer uma das outras já use.
- `tagIds?: string[]` guarda as etiquetas aplicadas a cada registro (mesmo padrão de `Person.tagIds`/`Contract.tagIds`); atualizado via `useRecords().updateRecord(collection, recordId, { tagIds })`.
- CRUD de etiquetas: `IScreenDefinitionRepository.getTags/createTag/updateTag/deleteTag` (no repositório de telas, por serem filhas de `screenDefinitions`) + use cases `screendefinitions/{Get,Create,Update,Delete}ScreenTagUseCase` + `ScreenDefinitionStore.tagsByScreen`/`createTag`/`updateTag`/`deleteTag`.
- UI reaproveita o componente genérico `ui/TagManager` (já usado por Pessoa/Contrato) via um `TagStoreAdapter` construído em `ViewDynamicRecord.viewmodel` — nenhum componente de UI novo foi necessário.
- Auditoria: par `screenDefinitions/tags` no `NESTED_ENTITY_CONFIG` (`functions/src/domain/services/auditableEntities.ts`), `entityKey: 'ScreenTag'`; como o pai já é o próprio `screenKey` (a subcoleção de tags é filha da própria definição), `getEntityLink` usa `parentId` direto para montar `dyn:{screenKey}` (abre a listagem da tela).

### Auditoria e ⌘K

- `screenDefinitions` está na allowlist nomeada de `functions/src/domain/services/auditableEntities.ts`. Para os REGISTROS, a configuração é derivada sempre que a coleção não é reservada nem tem config própria — é assim que uma tela criada em runtime passa a ser auditada sem tocar em código. Nome da entidade e nome do registro vêm da declaração do tenant (`resolveEntity`); a heurística antiga (`nome`/`name`/`titulo`/`title`) só age quando nenhum `displayNameField` está preenchido. Ver "Quem dá nome à entidade auditada".
- O diff de auditoria (`auditDiff.ts`) **não achata mais nada** — os campos já estão na raiz do documento.
- Busca no ⌘K: `DynamicRecordCommandProvider` (grupo "Telas Personalizadas") resolve o título por `titleFieldKey` e oferece "Abrir {titlePlural}" por tela; os dados entram no `CommandPaletteAppContext` via `useRecords().allRecords` e `useScreenDefinitions().definitions`.
- **Deploy:** as entradas de allowlist e o flatten do diff exigem deploy das Cloud Functions junto do release correspondente.

### Navegação e renderização

- **tabKeys** (builders/parser em `shared/constants/dynamicScreenKeys.ts`): `dyn:{screenKey}` (listagem), `new-dyn:{screenKey}`, `new-dyn:{screenKey}:clone:{recordId}` e `view-dyn:{screenKey}:{recordId}`. Os três prefixos estão registrados no `pageRegistry` apontando para `DynamicRecordList` e `ViewDynamicRecord`; o título real da aba é definido em runtime via `setTabTitle` (o ícone da aba é o genérico — o ícone escolhido pelo admin aparece no Sidebar).
- **Motor de renderização:** `ui/CustomFieldsSection` renderiza qualquer `FieldDefinition[]` (agrupado por `section`) a partir de `values` + `onChange(fieldKey, value)`. Mapa de tipo→componente: text/number→`Input`, textarea→`Textarea`, currency→`CurrencyInput`, date→`DateInput`, checkbox nativo estilizado, select→`DynamicSelect` (opções fixas — as declaradas no campo mais as `isStatic` da lista — e as cadastradas pelo escritório, com `onAdd`/`onDelete`, todas resolvidas por `lookupCollection`), masked→`ui/MaskedInput` (novo wrapper das máscaras de `utils/formatters.ts`), reference→`SearchSelect`/`MultiSearchSelect` com opções de `presentation/hooks/useReferenceOptions.ts` (mapeia `refEntity` → registros do store correspondente, incluindo outras telas dinâmicas).
- **Listagem (dinâmica e padrão) — hook `useCustomFieldListing`:** a lógica de `showInList`/`filterable` vive em `presentation/hooks/useCustomFieldListing.ts`. O hook recebe `(screenKey, fields, filterKeyPrefix)` e devolve: `filterDefs` do `CompositeFilter` a partir dos campos `filterable` (select/reference→multiselect, checkbox→Sim/Não, date→date com igualdade exata, demais→texto), o matcher `matchesFilters(values, tokenMap)`, e `cardItems(values)` (pares label/valor dos campos `showInList`, formatados por tipo) renderizados pelo componente `ui/CustomFieldMetaRows`.
- **Listagem dinâmica:** `DynamicRecordList` usa o hook sem prefixo de chave e com `savedFiltersScreenKey = tabKey`; exclui o `titleFieldKey` dos `cardItems`. Tela desativada/excluída renderiza `InfoBanner`, nunca quebra.
- **Listagens padrão:** as cinco listagens builtin (Pessoas, Processos, Contratos, Financeiro, Prazos) obtêm os campos via `getScreenFieldsFor(collection)` e usam o hook com `CUSTOM_FIELD_FILTER_PREFIX` (`cf-`) nas chaves dos `FilterDef` — o prefixo evita colisão com os filtros nativos (`status`, `type`, `city`…). Cada ViewModel anexa `...customListing.filterDefs` aos defs nativos, encerra o predicado de filtragem com `customListing.matchesFilters(entidade, tokenMap)` e expõe `getCustomFieldItems(entidade)`; a View renderiza `<CustomFieldMetaRows items={...} />` no cartão, após o bloco de metadados nativo.
- **Deeplink de registro fora das 500 carregadas:** `ViewDynamicRecord` faz fallback de busca por id (`GetRecordByIdUseCase`).

### Expressões por campo (validação, desabilitar, ocultar, valor calculado, ao alterar)

Todo campo — `FieldDefinition` (customizado) e `NativeFieldSpec` (fixo) — aceita `logic?: FieldLogic` (`domain/schema/fieldRules.ts`): `validate` (retorna a mensagem de erro ou vazio/null; roda **front e back**), `disabledWhen` e `hiddenWhen` (booleanas, **só front**), `compute` (o **valor** do campo; roda **front e back**) e `onChange` + `onChangeLookup` (preenchem **outros** campos quando este muda; **só front**).

- **Avaliador compartilhado:** `domain/schema/fieldExpression.ts` (fonte única, sincronizado para `functions/`) usa `expr-eval` com um conjunto de funções **puras** cujos nomes espelham o catálogo do Workflow (`if`, `concat`, `lower`, `upper`, `trim`, `length`, `isEmpty`, `coalesce`, `isCPF`, `isCNPJ`, `isEmail`, `onlyNumber`, `contains`, `startsWith`, `endsWith`, `substring`, `replace`, `today`…). Não importa o `FunctionRegistry` do motor de workflow (acoplado a `WorkflowContext`). `evaluateFieldValidation`/`evaluateFieldBoolean` são tolerantes a erro (expressão inválida → sem bloqueio / `false`).
- **Escopo das expressões:** mapa **plano por chave de campo** (nativos e customizados na raiz), montado por `buildRecordFieldScope` (`recordRules.ts`); `value`/`self` = valor do próprio campo. A mesma expressão referencia os campos por `key` nos dois lados.
- **Validação:** `formatAndValidateRecord` (`recordRules.ts`) roda um passo extra que avalia `logic.validate` de cada campo do schema e acrescenta `RuleIssue`. Coexiste com `required` e `FieldRules`. Enforcement automático via o choke point único: front (`recordRulesGate`) e back (`runWorkflowMutation`, `ValidateStep`).
- **Front (desabilitar/ocultar/mensagem inline):** `ui/CustomFieldsSection` avalia por campo `isFieldHidden`/`isFieldDisabled`/`fieldError` de forma reativa; campos ocultos não são renderizados (seção sem campos visíveis some).
- **Campo calculado (`compute`):** campo dinâmico cujo valor é derivado dos demais campos do **próprio registro** — `trim(concat(nome, ' ', sobrenome))`, `quantidade * precoUnitario`, texto composto. A expressão devolve o que devolver (texto, número, data): não é um recurso numérico. `applyComputedFields` (`recordRules.ts`) roda **entre** o `format` das folhas e a validação, dentro de `formatAndValidateRecord` — portanto vale nos quatro caminhos de escrita (front, `UpsertStep`, `upsert()` do Script, callables). O valor é **persistido** no documento, ficando filtrável, ordenável no servidor e visível para queries de workflow.
  - **Ordem:** os computados são ordenados topologicamente pelas dependências extraídas da expressão (`extractFieldExpressionDependencies`), então um computado pode depender de outro. Campos em **ciclo** são descartados sem lançar; o `ScreenBuilder` recusa o ciclo já na autoria.
  - **Payload parcial:** `RecordRulesOptions.baseline` recebe o registro existente e serve de base ao escopo, para que um update que envia só parte dos campos não recompute com dependências ausentes. No back, `runWorkflowUpsert` lê o documento **antes** das regras justamente para isso; no front, `loadRecordBaseline` (`recordRulesGate`) só lê quando a tabela tem algum campo computado. Sem baseline e com dependência ausente, o `expr-eval` lança e o campo é **pulado** — nunca grava lixo por cima de um valor correto.
  - **No formulário:** `computeFieldValues` (mesma avaliação, versão plana) deriva os valores em `CustomFieldsSection` só para exibição — o usuário vê o campo se formando enquanto digita, e ele é sempre somente-leitura (`isFieldDisabled`). Quem persiste é o save.
  - **`skipCompute`:** o Step "Validar Objeto" (`validateSpec.ts`) desliga o compute — ele checa um objeto avulso, não um registro que será gravado.
  - **Agregado sobre filhos:** fora do alcance do `compute` (puro e síncrono, restrito ao próprio registro) — ver "Campos agregados" abaixo. Os dois se compõem: a agregação grava o valor cru, o `compute` monta o texto em cima dele.
- **`onChange` (semear valores ao alterar um campo) — FRONT-ONLY:** expressão que **devolve um objeto**, mesclado no formulário. `object('preco', produto.preco)` — `object(k, v, …)` existe porque `expr-eval` tem literal de array mas não de objeto (mesma razão do status compacto das Actions).
  - **Não é `setValues(...)` com efeito colateral:** o avaliador é puro e compartilhado com as functions; função que muta estado quebraria isso. Com semântica de retorno a expressão continua portável.
  - **Não roda no save, e isso é proposital:** `compute` deriva **sempre**; `onChange` **semeia** um valor que o usuário ainda pode editar (o preço vem do produto, mas pode ser ajustado naquela venda). Rodar no save sobrescreveria a edição.
  - **Nunca reescreve o campo que disparou** o evento — brigaria com a digitação. Garantido em `resolveOnChangePatch` (`domain/schema/fieldChangeSpec.ts`).
- **`onChangeLookup` (busca externa) — FRONT-ONLY:** `{ provider, targetPrefix? }` resolve um `IExternalLookupService` (`domain/services/`) pelo nome, registrado no `DIContainer`. Nasce com `ViaCepLookupService` (`data/services/`), que devolve `{ street, neighborhood, city, state }` e é prefixado por `targetPrefix` (`address` → `address.street`). É a contraparte assíncrona do `onChange`: **as duas produzem um objeto e usam o mesmo caminho de merge**. Disparo com debounce de 400 ms e **guarda de corrida** por sequencial — digitar dois CEPs em sequência aplica só o último. Falha vira `notify(...)`, nunca trava o preenchimento manual.
- **Aplicação no formulário:** `useEntityDetail.mergeValues(patch)` é o meio-termo entre `setFieldValue` (um campo) e `applyValues` (substitui tudo); reusa o `applyResult` de `useScreenActions` (achata caminhos + `setValueByPath`), o mesmo do comando `merge` das Actions. A prop `onMergeValues` do `CustomFieldsSection` é opcional: sem ela, o comportamento é o anterior.

#### Hidratação de referência — a fronteira front/back

No front os registros referenciados já estão em memória (os stores assinam as telas), então um campo de referência é **navegável como objeto**: `produto.preco`. `buildHydratedFieldScope` (`domain/schema/referenceScope.ts`) troca o id pelo registro (`{ id, ...values }`); `useRecordResolver` (`presentation/shared/`) é o resolvedor sobre os stores.

**Isso vale APENAS nos slots front-only.** No backend só existe o id cru, e hidratá-lo exigiria I/O dentro de uma avaliação síncrona:

| Slot | Escopo | Roda no back? |
|---|---|---|
| `hiddenWhen`, `disabledWhen`, `onChange` | **hidratado** (`produto` = objeto) | não |
| `validate`, `compute` | **cru** (`produto` = id) | sim |

Se `validate`/`compute` fossem hidratados só no front, a mesma expressão daria resultados diferentes dos dois lados — um `validate` que passa no front e reprova no back. `referenceScope.ts` e `fieldChangeSpec.ts` ficam **fora de `SHARED_FILES`** justamente por serem front-only.

Compatibilidade com expressões já escritas: referência vazia continua `null`/`''` (não há registro para hidratar), então `isEmpty`/`isNull` seguem corretos — o uso dominante em `hiddenWhen`. O id permanece em `produto.id`. E `contains`/`indexOf` casam por `.id` quando os itens são registros hidratados, mantendo `contains(produtos, '<id>')` funcionando nos dois formatos.

- **Autoria:** `ScreenBuilder` grava `FieldDefinition.logic` via cinco `ExpressionEditor` + o select de provedor externo. O `InfoBanner` do bloco diz onde o vínculo é navegável e onde não é; o autocomplete sugere `campo.subcampo` para os campos de referência.
- **Campos nativos das telas fixas:** a **validação** já vale (o passo lê `entity.fields[].logic.validate`); o **desabilitar/ocultar ao vivo** vale onde os campos nativos são renderizados pelo renderer de Schema (piloto: Pessoas — ver abaixo).

### Campos agregados (valor vindo dos registros filhos)

`FieldDefinition.aggregation?: FieldAggregation` (`domain/schema/fieldRules.ts`) declara que o valor do campo vem de um agregado sobre os **filhos**: `{ from, via, op, field?, filter? }` — tela dos filhos, campo de referência no filho que aponta para este registro, operação (`sum|count|avg|min|max`), campo medido e filtro opcional.

**Por que declarativo e não uma função de expressão** (`sum(children(...))`): a dependência precisa ser conhecida pelo motor para saber *quando* recalcular. Inferir isso do texto de uma expressão é análise estática frágil — falharia em silêncio, deixando o total desatualizado. Declarado, também permite detectar ciclos entre telas na autoria.

- **Spec compartilhado:** `domain/schema/aggregationSpec.ts` (fonte única, gerado para `functions/`). `collectAggregationsFor(ctx, childTable)` é o índice invertido — dado um filho que mudou, quais campos de quais telas agregam sobre ele; `aggregateChildren` aplica filtro e operação; `aggregationCreatesCycle` guarda a autoria.
- **Motor:** `functions/src/domain/services/recomputeAggregates.ts`, disparado por `recomputeAggregatesOnEntityChange` — um `onDocumentWritten` **próprio**, separado de `publishWorkflowEventOnEntityChange` para que uma falha no agregado não derrube a publicação de eventos (e vice-versa).
- **Recompute por requery:** a cada mudança de filho, consulta os irmãos (`queryByEquality`, teto de 500 com warn) e recalcula do zero. Sempre convergente e auto-corretivo — conserta divergências passadas, ao contrário de um delta incremental, que erra para sempre depois de uma escrita perdida.
- **Guarda de recursão — o ponto crítico:** o write do pai dispara `.saved` do pai, que reentra no handler. A cascata termina porque o recompute é **idempotente**: as folhas resultantes são comparadas com o registro atual e, sem diferença real, **nada é gravado** — sem write, sem evento. É isso que substitui um limite de profundidade, e é o que torna seguro o ciclo que antes não tinha freio nenhum (o `JSON.stringify` de `publishWorkflowEventOnEntityChange` sempre difere, porque `updatedAt` é reescrito). Ciclos entre telas (A agrega de B que agrega de A) são recusados na autoria, pois nunca convergiriam.
- **Escopo de recálculo:** só recalcula quando a mudança pode ter mexido no agregado — o pai vinculado mudou, o campo medido mudou, ou existe filtro. Um filho que troca de pai recalcula **os dois** (o antigo, lido de `before`, e o novo).
- **Composição com `compute`:** o patch do agregado passa por `formatAndValidateRecord` com `baseline`, então um campo `compute` que dependa do agregado é recalculado no mesmo write.
- **Limitação conhecida:** o vínculo é por igualdade simples — campo de referência `multi` (que grava um array) não é suportado, pois `queryByEquality` não faz `array-contains`.
- **Escrita:** carimba `updatedBy: 'aggregate-engine'`. O campo agregado é somente-leitura no formulário (`isFieldDisabled`).

### Origem de tela e de campo (`origin`)

`ScreenDefinition.origin` e `FieldDefinition.origin` (`'builtin' | 'plugin' | 'design'`) são a
**única** diferença conceitual que restou. Servem a um propósito só: `builtin` (declarado no
`entityRegistry.ts`) e `plugin` (declarado no pacote da extensão) **não podem ser excluídos** pelo
usuário. Todo o resto — gravação, resolução de caminhos, automações, formulários, auditoria — trata
as três origens de forma idêntica.

| `origin` | Onde é declarado | Entrada em `fields[]` | Excluível |
|---|---|---|---|
| `builtin` | `entityRegistry.ts` (código) | materializada no 1º ajuste, inteira | **não** |
| `plugin` | pacote da extensão, materializado na instalação | declaração completa | **não** |
| `design` | `screenDefinitions/{id}.fields` | declaração completa | sim |

**Um campo do kernel só aparece em `fields[]` depois de editado.** Até lá vive apenas no código. No
primeiro ajuste, o Form Design materializa a declaração INTEIRA no documento — e a partir daí o
documento é a verdade, exatamente como já acontece com `plugin` e `design`. É o que permite ajustar
`rules`, `logic.validate`, `logic.compute`, `required` e `aggregation` de um campo fixo: front e back
resolvem a lista com a MESMA função, então o backend enxerga o ajuste e a gravação por automação
nunca diverge da tela. (A `key` e o `type` seguem fixos: definem como o valor é gravado.)

> Consequência assumida: um campo materializado deixa de acompanhar mudanças futuras do código.
> É o mesmo contrato de uma tela de extensão, e o preço de o documento ser a fonte de verdade.

- **Resolução:** `domain/schema/screenEntity.ts` é o ponto único. `resolveEntity(ctx, collection)`
  devolve um `EntityMetadata` para QUALQUER coleção — a do registro quando existe, senão uma
  sintetizada a partir da tela do tenant; quando existem as duas, os campos são mesclados por chave
  (`resolveEntityFields`). Caminho pontilhado (`address.city`) desce em `objectFields` sem achatar a
  estrutura do documento.
- **Forma canônica:** `NativeFieldSpec`. `FieldDefinition` é a forma de autoria/UI, convertida nos
  dois sentidos por `fieldDefinitionToNativeSpec`/`nativeSpecToFieldDefinition`. `hiddenInForm` vira
  `ui.form: false`, o mesmo sinal que o registro usa para o que nunca vai ao formulário.
- **Lista unificada:** `useEntityFormFields(collection)` → `deriveFormFields(ctx, collection)`. As 5
  telas fixas renderizam **um** `CustomFieldsSection` com todos os campos; `addedFields`
  (`origin !== 'builtin'`) é o que os viewmodels tipados espalham na raiz do payload.
- **Opções por campo:** indexadas pela própria coleção, sem chave separada para campo fixo.
- **Nome da coleção:** `RESERVED_COLLECTIONS` + `screenIdIssue` recusam nomes do sistema e formatos
  inválidos na criação de tela. A lista é espelhada na denylist do `firestore.rules`, e
  `scripts/reservedCollections.test.ts` falha se as duas divergirem.

### A coleção é propriedade da tela, não a identidade dela (`dataCollection`)

**Objetivo do movimento:** o kernel não deve conhecer `cases`, `persons`, `deadlines`,
`contracts` ou `financials` — são entidades de escritório de advocacia, não de uma plataforma. O
destino é que o `entityRegistry` fique só com o que é comum a qualquer aplicação de negócio e que
essas entidades sejam DECLARADAS por extensões. Esta mudança é o primeiro passo, e existe para
responder a uma pergunta: *o que o kernel precisa suportar para que uma entidade nativa possa ser
removida sem perder um único registro?*

A resposta começa por desfazer um acoplamento: até aqui, uma tela **era** a coleção
(`screenDefinitions/{id}` ↔ `tenants/{tid}/{id}`). `ScreenDefinition.dataCollection` separa as duas
coisas — a chave da tela é identidade de UI (abas, deep link, filtros salvos), e a coleção é uma
PROPRIEDADE dela. Com isso, uma tela de extensão pode descrever e operar uma coleção que já existe,
sob qualquer nome.

- **Ponto único:** `domain/services/screenDataCollection.ts` (`screenDataCollection`, `isBoundScreen`).
  Toda leitura, gravação, exclusão, etiqueta, anotação, documento e execução de ação passa por ele.
- **A declaração vale para a COLEÇÃO, não para a tela.** `toSchemaScreens`/`useSchemaContext` indexam
  a tela pela coleção que ela descreve, e `createSchemaContext` MESCLA as declarações quando mais de
  uma tela descreve a mesma (`mergeSchemaScreens`): os campos se somam por chave, com a tela DONA do
  nome (`screenDefinitions/cases`, onde ficam os ajustes do escritório) entrando por último. Rótulos,
  campo-título e etiquetas vêm da dona quando ela existe — uma segunda tela sobre a mesma coleção
  não renomeia a entidade. Na falta dela, valem os da declaração que sobrou: é isso que mantém a
  coleção descrita depois que a entidade sai do kernel.
- **A extensão declara TUDO.** Uma tela ligada a `cases` que herdasse os campos do registro morreria
  junto com ele. Por isso o pacote declara o esquema inteiro — campos, `lookupCollection` (as listas
  de opções são dado do escritório e sobrevivem à desinstalação), relações, seções, `tagCollection`,
  linhas do card e filtros. Hoje as duas declarações (registro e pacote) se sobrepõem sem conflito;
  amanhã sobra só a do pacote.
- **Gravação idêntica.** O repositório genérico recebe a coleção ALVO, então
  `formatAndValidateRecord` resolve os campos por `cases`: data vira `Date` (Timestamp), `type` vira
  array, moeda vira número — o documento sai igual ao que a tela fixa grava. Anotações e documentos
  caem em `tenants/{tid}/cases/{id}/notes|documents`, os mesmos caminhos.
- **Ciclo de vida:** desinstalar a extensão remove a tela; os registros são da coleção e permanecem.
  `DeleteScreenDefinitionUseCase` checa registros na coleção da própria tela, que não existe — a
  exclusão nunca alcança dados de outra entidade.
- **Custo assumido:** enquanto as duas telas coexistirem, o `RecordStore` assina a coleção além do
  store tipado dela (dois listeners sobre `cases`). É o preço de rodar as duas lado a lado.
- **No Form Design, uma porta só por esquema:** a tela ligada some da montagem de telas **enquanto a
  coleção for uma entidade do kernel** — a linha fixa já a configura, e duas portas para o mesmo
  esquema confundiriam. Quando a entidade sai do kernel, a tela ligada passa a ser a única que
  descreve a coleção e aparece normalmente; o documento que leva o nome da coleção não a substitui,
  porque existe só para as rules lerem a permissão (sem campos, sem UI). Nela, os campos são
  resolvidos pela COLEÇÃO, não pela chave da tela.
- **As telas FIXAS do Form Design saem do registro** (`ENTITY_REGISTRY_LIST` filtrado por
  `supportsCustomFields`), nunca de uma lista literal. Uma lista escrita à mão sobrevive à entidade:
  Processo e Pessoa continuaram aparecendo como "tela do sistema" depois de saírem do kernel, sem
  esquema por trás e sem extensão instalada. Derivando, a tela some no dia da saída, e a que a
  substitui aparece pelo caminho normal das telas do escritório.
- **Primeiro consumidor:** `src/plugins/marketplace/processo.ts`.

**Autoria do card, dos filtros e do cabeçalho — o que faltava para uma extensão reproduzir uma tela
fixa.** Declarações que só existiam em código passaram a ter forma de autoria, disponível a qualquer
tela:

| Autoria | Canônico | Efeito |
|---|---|---|
| `FieldDefinition.listIcon` | `ui.list.icon` | o campo vira META-LINHA do card, com ícone |
| `FieldDefinition.listOrder` | `ui.list.order` | posição da linha no card, quando difere da ordem do campo no formulário (no Processo o responsável é a 1ª linha e o 15º campo) |
| `FieldDefinition.filterable` | `ui.filter` | o campo vira filtro do `CompositeFilter` |
| `ScreenDefinition.subtitleFieldKey` | — | campo do SUBTÍTULO: no detalhe (abaixo do título) e na linha sob o título do cartão |

`subtitleFieldKey` complementa o nome com um identificador curto (número do processo, número do
contrato) nos dois lugares em que há espaço para ele. **O rótulo da ABA é sempre o campo-TÍTULO** —
é por ele que o usuário reconhece o registro aberto, e é o mesmo nome que a listagem, a busca e uma
menção mostram; o subtítulo só entra se o título estiver vazio. `RecordDetailSurface` e o detalhe
dinâmico mostram o TÍTULO DO REGISTRO no cabeçalho (com o nome da tela como fallback), em vez do
nome da tela sempre.

Uma relação pode chegar pelos dois lados — como `fk` do registro e como campo `reference` declarado
pela tela. `deriveFormFields`/`deriveListRows` descartam a `fk` quando a chave já veio da tela: a
declaração da tela vence, porque é ela que sobrevive à saída da entidade do kernel.

`deriveListRows(ctx, collection)` monta as linhas a partir de `resolveEntity` — tanto faz se a
declaração veio do registro ou da tela. `RecordListSurface` a usa; `getCardItems` remove do bloco de
campos adicionais o que já virou linha, para não repetir a informação. Campo com `showInList` mas
**sem** ícone continua no bloco de campos adicionais, que é mais rico (rótulo, badges coloridos,
markdown): são duas apresentações diferentes de propósito, e agora as duas são declaráveis.
`deriveBuiltinListRows(entityKey)` é o atalho das telas fixas, que leem o layout direto do código.

**Uma extensão declara a entidade INTEIRA.** O que antes só existia em código do kernel virou
declaração de pacote, e é o que permite a entidade mudar de dono sem mudar nada para quem usa:

| Capacidade | Declaração | Sem ela |
|---|---|---|
| Opções de partida das listas | `lookups[].options` — semeadas **só em lista vazia**, na instalação | um escritório novo instalaria a extensão e não teria nenhuma Área, Fase ou Status |
| Nome dos eventos | `ScreenDefinition.eventPrefix` (`case` → `case.saved`) | a coleção passaria a emitir `cases.saved` e toda automação que escuta `case.*` pararia |
| Quem pode gravar | `ScreenDefinition.writeRoles` (`['admin','lawyer']`), lido pelo curinga das rules | a entidade perderia a restrição que a regra nomeada dava, e qualquer membro com escrita passaria a editar |

Detalhes que valem registrar:

- **Semeadura idempotente por vazio.** `seedLookupOptions` lê a lista antes; qualquer opção presente
  cancela a semeadura. É o que impede reinstalar/atualizar de ressuscitar uma opção que o escritório
  removeu. Enquanto a lista ainda for do kernel (`isLookupCollection`), a declaração do pacote fica
  inerte — o `getAll` do repositório mescla os defaults do código e a lista nunca está "vazia".
- **Prefixo declarado sem custo no caminho quente.** `publishWorkflowEventOnEntityChange` resolve
  pelo registro primeiro (`hasRegistryEventPrefix`); só quando ele não responde consulta o
  `ScreenDefinitionCache` (TTL de 5 min, já carregado pelo motor). Falha na consulta volta à
  convenção — nenhum evento se perde por causa de uma leitura.
- **O prefixo é da COLEÇÃO, não da tela que o declarou.** Duas telas descrevem a mesma coleção: a da
  extensão, que declara `eventPrefix`, e a que leva o nome dela, materializada só para as rules
  lerem a permissão. Quem declara o prefixo prevalece nos dois lados — `mergeSchemaScreens` o
  carrega para a tela mesclada e `declaredEventPrefix` procura **quem declara**, não a primeira tela
  da coleção (a de permissão vem antes na ordem alfabética dos documentos). Deixar a dona do nome
  responder trocaria o nome dos eventos sozinho: o gatilho ofereceria `cases.saved` enquanto o motor
  publica `case.saved`, e nenhuma automação dispararia.
- **`writeRoles` mora no documento da COLEÇÃO.** As rules não têm como procurar "a tela que aponta
  para esta coleção", então a instalação de uma tela com `dataCollection` materializa/atualiza
  `screenDefinitions/{coleção}` com a permissão (`ensureTargetCollectionScreen`), preservando o que
  já existe no documento. O curinga só aplica a checagem quando o documento de tela existe — uma
  lista de opções ou um conjunto de etiquetas passa pelo mesmo `match` e não tem tela.

**Leitura tolerante enquanto há dois escritores.** `data/utils/toDateValue.ts` normaliza o que vem
num campo de data (`Timestamp`, `Date`, texto ISO ou `aaaa-mm-dd`, mapa `{ seconds }`) e devolve
`null` para o resto. A coerção de escrita (`coerceWriteValue`) garante o formato dali para a frente,
mas não reescreve o passado: um documento gravado antes dela — ou por um caminho que não passou pelo
portão — derrubava a listagem inteira com `filedAt.getTime is not a function`. O repositório de
Processo lê por ele; os demais repositórios fixos ganham o mesmo tratamento quando a coleção deles
passar a ter mais de um escritor.

**Processo saiu do kernel — o que a remoção exigiu.** A entidade não existe mais em
`entityRegistry.ts`, nem as oito listas dela em `lookupRegistry.ts`/`lookupDefaults.ts`. Foram
apagados as páginas (`Cases`, `ViewCase`), o `CaseStore`, três repositórios e três interfaces, os
use cases de nota e documento, o tipo `Case` e suas uniões, o plugin `core.cases`, o
`CaseMentionModal` e os deep links `view-case:`/`new-case`. `cases` e `caseTags` saíram de
`RESERVED_COLLECTIONS`, e o `firestore.rules` perdeu a regra nomeada de Processos, as oito de listas
e a de etiquetas — tudo passa pelo curinga, com a permissão vindo de `writeRoles`.

As peças que o kernel ganhou para que as telas ainda nativas continuassem funcionando:

| Peça | Papel |
|---|---|
| `useCollectionRecords` / `useCaseRecords` | leitura tipada de uma coleção que o kernel não declara — o TIPO é do consumidor (`CaseRecord`), e a normalização (texto, lista, data) mora no hook |
| `useOpenRecord(collection, id)` | abre o detalhe do registro pela tela que DESCREVE a coleção; nenhuma tela precisa conhecer a chave de aba de uma extensão |
| `FieldDefinition.refDenormKey` | a relação declarada por tela é navegável pelo nome do registro apontado (`event.contract.client.name`), como as `fks` do registro — é o que preserva as automações do escritório |
| `screenEventEntry` por prefixo | o catálogo resolve `case.saved` pela tela que declara `eventPrefix`, e não pelo nome da coleção |
| `useCollection`/`useUpdateRecord` na ponte | a API das extensões perdeu `useCases`/`useCasePhases`/`useCaseAreas`/`useCaseStatuses`: nenhuma entidade de negócio tem hook próprio no kernel |

Diferenças assumidas em relação ao que o registro fazia:

- **Sem subconjunto denormalizado.** Uma `fk` do registro declarava `denormalizedFields`; a relação
  declarada por tela hidrata o registro inteiro (`fields: 'all'`). É uma leitura só, o mesmo custo.
- **A relação é navegável pelos dois nomes** — `contractId.number` e `contract.number` —, porque a
  chave continua sendo um campo de referência.
- **A tela precisa estar instalada.** Prazos, Financeiro, Agenda, Pushes, Contratos e os painéis
  leem `cases` pelo `RecordStore`, que só assina coleções descritas por alguma tela. Sem a extensão,
  a lista vem vazia e a tela mostra o estado vazio — em vez de dado errado.
- **Etiquetas e listas viraram documento.** `caseTags` e as oito listas passam a ter
  `tagDefinitions`/`lookupDefinitions` próprios, criados na instalação — é o que as rules genéricas
  consultam.

**A tela exibida responde primeiro pelas próprias etiquetas.** `useTagCollection(collection,
declared)` usa o `tagCollection` da tela que está na frente do usuário e só cai na resolução pela
ENTIDADE quando ela não declara nada — que é como duas telas compartilham o mesmo conjunto. A
precedência importa porque a entidade só existe enquanto alguma tela a descreve: uma tela recém
instalada já sabe as próprias etiquetas antes de o resto do contexto estar montado. Foi o que fez as
etiquetas de Processo reaparecerem depois da migração.

**A declaração da TELA basta para assinar coleções auxiliares.** `TagStore` e `LookupStore` assinavam
o registro do kernel mais os documentos de declaração (`tagDefinitions`/`lookupDefinitions`). Com a
entidade fora do kernel, `caseTags` e as oito listas passaram a depender só do documento — e as
etiquetas já vinculadas sumiram da tela, embora continuassem gravadas: ninguém as assinava. Agora os
dois stores derivam também das telas (`screenTagCollections`/`screenLookupCollections`, em
`domain/services/screenDataCollection.ts`): a coleção existe porque uma tela aponta para ela.
Consequência prática: `ScreenDefinitionStoreProvider` subiu na árvore de providers, acima de
`TagStoreProvider`/`LookupStoreProvider`.

**O que continuava no kernel, e por quê:** `deadlines` e `financials` ainda declaravam `caseId` com
`targetCollection: 'cases'`. Uma relação aponta para uma COLEÇÃO — não exige que ela esteja no
registro —, então o vínculo segue válido e some quando essas duas entidades migrarem pelo mesmo
caminho.

### Pessoa sai do kernel — a entidade mais referenciada do escritório

A segunda migração pelo mesmo caminho: `persons` não está mais em `entityRegistry.ts`, e quem
descreve a coleção é a extensão **Pessoas** (`com.microteia.pessoa`, `dataCollection: 'persons'`,
`eventPrefix: 'person'`, `tagCollection: 'personTags'`, sete listas de opções com as opções de
partida). Foram apagados as páginas (`Persons`, `ViewPerson`), o `PersonStore`, três repositórios e
três interfaces, os use cases, o tipo `Person` e suas uniões, o plugin `core.persons`, o
`PersonCommandProvider`, o `ClientMentionModal` e os deep links `view-person:`/`new-person`.

Pessoa expôs o que Processo não expunha, porque é **apontada** por quase todo mundo e tem um
formulário rico. O que o kernel precisou aprender:

| Capacidade | Declaração | Sem ela |
|---|---|---|
| Objeto aninhado criado pela tela | chave pontilhada (`address.city`) — `upsertFieldAtPath` CRIA o ramo | a chave virava um campo literal `"address.city"` na raiz do documento; só o kernel conseguia ter objeto aninhado |
| Valor de partida do campo | `FieldDefinition.defaultValue` | "Pessoa Física" e "Ativo" eram embutidos no formulário em código; a tela declarada começaria sempre vazia |

> **Ida-e-volta do schema:** `defaultValue` e `autoValue` viajam também no `NativeFieldSpec` — a
> forma canônica que `fieldDefinitionToNativeSpec`/`nativeSpecToFieldDefinition` convertem. Uma tela
> LIGADA a outra coleção (`dataCollection`) resolve os campos por esse caminho, então uma propriedade
> que não faça a volta some em silêncio: era o que acontecia com o `defaultValue` de Pessoa, que
> nunca chegava ao formulário.
| Subtítulo do cartão | `subtitleFieldKey` passa a alimentar também o card (`RecordListSurface`) | o subtítulo só existia por slot de CÓDIGO — um cadastro simples precisaria de uma view em código só para isso |
| Leitura por caminho | `readValueByPath`, no card, nos filtros e no ida-e-volta do formulário | o campo dentro do objeto não aparecia no cartão, não filtrava e não voltava ao formulário — tudo em silêncio |
| Linha do cartão pelo ícone | `listIcon` sozinho já produz a meta-linha | `listIcon` sem `showInList` era um silêncio, contrariando o que a própria declaração promete |

Detalhes que valem registrar:

- **O campo do subtítulo não se repete como meta-linha.** Mesma regra que já valia entre as
  meta-linhas e o bloco de campos adicionais: a mesma informação não aparece duas vezes no cartão.
- **A menção `@pessoa` virou registro da extensão** (`host.mentions.register`, no `startup`), como
  `@processo`. O kernel perdeu a entrada fixa no `MENTION_COMMANDS` e o modal correspondente.
- **`usePersons` saiu da ponte das extensões.** Quem precisa das pessoas usa `useCollection('persons')`
  — nenhuma entidade de negócio tem hook próprio no kernel.
- **Diferenças assumidas:** o cabeçalho do detalhe mostra o ícone da tela no lugar da inicial do
  nome; o botão de Ativar/Inativar deu lugar ao campo `status` no formulário (select com valor de
  partida "Ativo"); e os eventos `person_note.*`/`person_document.*` saíram do catálogo, como
  aconteceu com `case_note.*`.

### O que é de PAÍS não fica no kernel

CPF, CNPJ, telefone, CEP e a busca de endereço pelo CEP eram do núcleo. São regras do **Brasil** — e
um sistema que será internacionalizado não pode carregá-las em toda instalação, nem crescer
empilhando o próximo país ao lado do anterior no mesmo código. Elas viraram a extensão
`com.microteia.brasil` (`plugins/marketplace/brasil.ts`), que as publica pelos pontos que já
existiam:

| Declaração | Ponto de extensão | Antes |
|---|---|---|
| `cpf`, `cnpj`, `cpfCnpj`, `phone`, `cep` | `data.field.preset` | `CORE_FIELD_RULE_PRESETS` |
| `viacep` | `data.external.lookup` | `CORE_LOOKUP_PROVIDERS` |

O que **fica** no núcleo é o que vale em qualquer lugar: `digits`, `trim`, `upper`, `lower` — e o
motor que executa tudo (template de máscara, pipeline de formatação, avaliador de expressão) mais as
garantias da busca externa (`https` obrigatório, timeout com teto, resposta com tamanho máximo,
nenhuma credencial). `CORE_LOOKUP_PROVIDERS` ficou **vazio**: o ponto continua ali para o dia em que
existir uma busca que valha no mundo todo.

As CHAVES não mudaram (`preset: 'cpf'` segue sendo `'cpf'`), então nenhum campo já gravado precisa de
migração — muda quem responde pelo significado da chave. Sem a extensão instalada, o campo continua
existindo e guardando o que tem; perde a máscara, a conferência e o preenchimento por CEP.

**Os TEMPLATES também saíram.** `CPF_TEMPLATE`, `CNPJ_TEMPLATE`, `PHONE_TEMPLATES` e `CEP_TEMPLATE`
vivem na extensão; no kernel restou `applyMaskTemplate`, que preenche um template qualquer e não sabe
o que é um documento. Junto foram os formatadores `formatCpf`/`formatCnpj`/`formatPhoneBr`/
`formatCepBr` e os atalhos `formatCPF`/`formatCNPJ`/`formatPhone`/`formatCEP` de `utils/formatters`.

A API curada das extensões acompanhou: `@microteia/format` perdeu os quatro e ganhou
`applyMask(value, templates)` — quem precisa de máscara declara o template que quiser, e o kernel
segue sem conhecer país nenhum.

**Resíduos assumidos:** `isCPF`/`isCNPJ` (avaliador de expressões, front) e `formatCPF`/`formatCNPJ`
(catálogo de expressões do backend) continuam no kernel, ao lado de `length` e `upper`. São FUNÇÕES
de um catálogo, e expandi-lo por extensão é uma frente própria — quando existir, elas saem por ela.
O `formatPhone` local de `pages/Profile` é o outro: o telefone do próprio usuário ainda é um campo
em código, fora do caminho declarativo.

### Uma ação pode ser um INTERRUPTOR

`ActionDefinition.activeWhen` é uma expressão que diz quando a ação está **ligada**. Declarada, o
botão passa a mostrar o estado do registro — verde ligado, vermelho desligado — em vez de só
disparar; ausente (o normal), o botão é o de sempre. Como `hiddenWhen` e `disabledWhen`, vale só na
UI, sobre os valores do formulário e o registro gravado.

Existe porque um cadastro costuma ter um estado que se alterna (ativo/inativo, arquivado,
destacado), e isso só existia em código, no cabeçalho de uma tela fixa. O Ativar/Inativar de Pessoa é
o primeiro consumidor: `hiddenWhen: 'isNew'` (registro novo nasce Ativo e ainda não existe para
alternar), `activeWhen: 'status != "Inativo"'`, e um workflow de três passos — Montar Objeto com o
status invertido → Gravar Registro → devolver `actions: ['refresh']` para a tela recarregar.

**Uma dependência pode trazer uma COLEÇÃO, e precisa dizer isso.** Processos aponta para `persons`
(responsável, polo ativo, polo passivo). Enquanto Pessoa era do kernel, `isCoreCollection` resolvia;
fora dele, a referência passou a ser uma tela que o pacote não leva. A convenção antiga só cobria
chave namespaced (`<slug>__x`), que não serve aqui: uma entidade que sai do kernel **mantém o nome
global da coleção** — se ganhasse prefixo, os registros mudariam de lugar. Por isso a dependência
aceita a forma longa:

```ts
dependencies: {
  'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
}
```

`dependencyRange`/`dependencyCollections` (em `plugin/pluginManifest.ts`) leem as duas formas, e
`validatePackage` passa a considerar a referência coberta. A dependência é **dura**: sem Pessoas
instalada, o `PluginHost` recusa carregar Processos (`dependency.missing`) em vez de carregá-la com
os campos de pessoa apontando para o vazio.

### Contrato sai do kernel — e a relação que não é posse

A terceira migração pelo mesmo caminho: `contracts` não está mais em `entityRegistry.ts`, e quem
descreve a coleção é a extensão **Contratos** (`com.microteia.contrato`, `dataCollection:
'contracts'`, `eventPrefix: 'contract'`, `tagCollection: 'contractTags'`, `writeRoles: ['admin',
'lawyer']`, dez listas de opções com as opções de partida). Foram apagados as páginas (`Contracts`,
`ViewContract`), o `ContractStore`, três repositórios e três interfaces, os use cases de contrato,
nota e documento, o tipo `Contract` e suas uniões, o plugin `core.contracts`, o
`ContractCommandProvider`, o `ContractMentionModal` e os deep links
`view-contract:`/`new-contract`. As regras nomeadas de `contracts`, `contractTags` e de nove das dez
listas saíram do `firestore.rules` — tudo passa pelo curinga.

Contrato fica no MEIO da cadeia — aponta para Pessoa e é apontado por Processo —, e é o que cobrou
do kernel as capacidades abaixo.

| Capacidade | Declaração | Sem ela |
|---|---|---|
| Código gerado no registro novo | `FieldDefinition.autoValue: { pattern }` | o número do contrato era sorteado em código, no ViewModel da tela fixa |
| Uma tela dentro de outra, sem virar filha | `ScreenDefinition.parentRelation: 'related'` | declarar a aba rebaixaria Processos a tela filha: sem menu, sem ⌘K e sem o campo "Contrato" no formulário |
| Linha de cartão que a declaração não alcança | slot `renderMetaRows` do `RecordListSurface` | a vigência ("início – fim") é composição de dois campos; separadas, as duas datas ficam sem sentido no cartão |
| Data no formato do escritório, nas extensões | `formatDate` em `@microteia/format` | cada view de extensão reescreveria o próprio formatador |

**`autoValue` — o código que ninguém quer digitar.** O padrão descreve a forma caractere a caractere
(`A` letra, `0` dígito, `*` alfanumérico; o resto é literal), e o valor sorteado não se repete entre
os registros já carregados da coleção. `AA0000` reproduz exatamente o número que a tela fixa
sorteava. Diferente de `defaultValue`, que semeia um valor FIXO, aqui o valor muda a cada registro —
e continua editável, porque é sugestão, não carimbo. Sortear é IMPURO: o gerador (`services/
autoValue.ts`) só é chamado do EFEITO que semeia o formulário de um registro novo, nunca no corpo do
componente nem dentro de um `useMemo` — a mesma disciplina que a tela fixa seguia.

**`parentRelation` — posse e visão eram a mesma coisa, e não são.** `parentEntity` significava duas
coisas ao mesmo tempo: "os registros aparecem numa aba do pai" e "esta tela não existe sozinha". Para
o Contrato mostrar os processos ligados a ele, só a primeira serve. A distinção agora é explícita:

| `parentRelation` | Aba no pai | Menu e ⌘K | Campo de vínculo no formulário | Salvar volta ao pai |
|---|---|---|---|---|
| `owned` (padrão) | sim | não | escondido (já vem preenchido) | sim |
| `related` | sim | sim | visível — é por ele que se liga e desliga | não |

`isOwnedByParentScreen` (em `services/screenDataCollection.ts`) é o ponto único que as quatro
decisões consultam; separadas, elas divergiriam. Processos declara `parentEntity: 'contracts'`,
`parentFieldKey: 'contractId'`, `parentRelation: 'related'` — o que também torna a dependência
Processo → Contrato explícita, na mesma forma longa que já ligava Processo a Pessoa.

**O que mudou para o usuário:** a aba "Processos" do contrato deixou de ter o seletor "Vincular um
processo". Ligar um processo a um contrato é preencher o campo **Contrato** no próprio processo — e
criar um processo pela aba do contrato já o traz vinculado. É uma porta a menos para a mesma ação,
não uma ação a menos.

**Uma lista compartilhada:** `contractCostCenters` é declarada pela extensão de **Contratos**, e o
campo "Centro de custo" do **Financeiro** aponta para ela. Duas telas compartilhando uma lista de
opções é o arranjo normal (`lookupCollection` igual), e é por isso que o Financeiro não a redeclara —
quem instala as duas extensões tem uma lista só.

### Financeiro sai do kernel — e o que a declaração ainda não alcançava

A quarta migração pelo mesmo caminho: `financials` não está mais no `entityRegistry.ts`, e quem
descreve a coleção é a extensão **Financeiro** (`com.microteia.financeiro`, `dataCollection:
'financials'`, `eventPrefix: 'financial'`, `tagCollection: 'financialTags'`, `writeRoles: ['admin',
'lawyer']`, quatro listas de opções com as opções de partida). Foram apagados as páginas
(`Financials`, `ViewFinancial`), o `FinancialStore`, dois repositórios e duas interfaces, os use
cases de lançamento e documento, os tipos `Financial`/`FinancialTag`/`FinancialDocument`, o plugin
`core.financials`, o `FinancialCommandProvider` e as abas `financials`/`view-financial:`/
`new-financial`. As regras nomeadas de `financials`, `financialTags`, das duas listas e de
`contractCostCenters` saíram do `firestore.rules` — tudo passa pelo curinga.

Financeiro é a ponta da cadeia: aponta para Pessoa, Processo e Contrato, e depende das três.

| Capacidade | Declaração | Sem ela |
|---|---|---|
| Filtrar data por PERÍODO | campo `date` com `filterable` vira duas pontas, "(de)" e "(até)" | o Financeiro montava `dueDateFrom`/`dueDateTo` em código, e nenhuma outra tela alcançava o mesmo |
| Somar o que está filtrado | slots `summary` e `headerActions` do `RecordListSurface` | uma soma sobre os registros filtrados não se declara campo a campo |
| Abrir já filtrado | `useEntityList({ defaultFilterTokens })` | a primeira tela do Financeiro seria o histórico inteiro do escritório |
| Abrir a LISTAGEM de uma coleção de fora | `useOpenScreenList` | o painel do escritório apontava para a aba fixa `financials`, que deixou de existir |

**Os gestos do fluxo viraram Actions.** Registrar pagamento, estornar e registrar cancelamento eram
`if`s na view (`f.status === 'Aberto' ? [...] : []`). Cada um é agora uma **Action** sobre um
workflow de três passos — Montar Objeto com os campos a gravar (`today()` carimba a data) → Gravar
Registro → resposta com a mensagem e `actions: ['refresh']` — e quem decide se aparece é uma
expressão sobre o registro (`hiddenWhen: 'isNew or status != "Aberto"'`). É a mesma máquina que o
escritório usa no Form Design, e o mesmo caminho do interruptor de status da Pessoa.

**O que ficou no kernel, e por quê.** O **Painel Financeiro** (`core.financial-dashboard`) continua
sendo tela de código: é um relatório de gráficos (`recharts`), e a API curada das extensões ainda não
expõe biblioteca de gráfico. Ele já não conhece entidade nenhuma declarada em código — lê a coleção
pelo caminho genérico (`useFinancialRecords`, mesmo contrato de leitura de `useCaseRecords` e irmãos)
e navega por `useOpenScreenList`. Sai do kernel no dia em que uma extensão puder desenhar os mesmos
gráficos.

### Prazos sai do kernel — a última entidade de escritório

A quinta migração pelo mesmo caminho, e a que fecha a série: `deadlines` não está mais no
`entityRegistry.ts`, e quem descreve a coleção é a extensão **Prazos** (`com.microteia.prazo`,
`dataCollection: 'deadlines'`, `eventPrefix: 'deadline'`, 8 campos em 3 seções e três listas de
opções com as opções de partida). Foram apagados as páginas (`Deadlines`, `ViewDeadline`), o
`DeadlineStore`, dois repositórios (front e backend) e duas interfaces, os use cases, os tipos
`Deadline`/`DeadlineStatus`/`DeadlinePriority`, o plugin `core.deadlines` e as abas
`deadlines`/`view-deadline:`/`new-deadline`. As regras nomeadas de `deadlines` e `deadlineTypes`
saíram do `firestore.rules` — tudo passa pelo curinga — e o índice composto `caseId`+`dueDate`
saiu do `firestore.indexes.json`, porque a leitura passou a ser a genérica da coleção.

Prazo cobrou três capacidades que a declaração ainda não alcançava — todas genéricas, nenhuma sobre
prazo:

| Capacidade | Declaração | Sem ela |
|---|---|---|
| Faixa de destaque no cartão | `accentColor(record)` no `RecordListSurface` | a prioridade do prazo só se leria depois de ler o texto do cartão |
| Ordem da listagem | `useEntityList({ sortRecords })` | a agenda abriria na ordem de CADASTRO, e o prazo mais recente não é o mais urgente |
| Abrir a listagem já filtrada | `useOpenScreenList(collection, filterTokens)` + a intenção consumida pelo `useRecordListViewModel` | o painel e o cartão de um push endereçavam a intenção pela CHAVE da tela, que passou a variar por escritório |

A terceira fechou um buraco que a migração do Financeiro tinha deixado em aberto: o painel do
escritório ainda deixava o recado para `'financials'` e `'cases'`, chaves de tela que não existem
mais — o filtro era montado e ninguém o lia. Agora quem endereça é a resolução por coleção, e a
listagem consome a intenção na primeira montagem (aba abrindo) e por assinatura (aba já aberta).

**Concluir virou Action.** Marcar um prazo como concluído era um `if` na view seguido de uma chamada
de store; é agora uma **Action** sobre um workflow de três passos — Montar Objeto (`today()` carimba
a conclusão) → Gravar Registro → resposta com `actions: ['refresh']` —, e quem decide se o gesto
aparece é `hiddenWhen: 'isNew or status == "Concluído" or status == "Cancelado"'`.

**O Step "Criar Prazo" virou WORKFLOW.** `CreateDeadlineStep` era o último passo de workflow que
conhecia uma entidade de escritório pelo nome: recebia `IDeadlineRepository` e gravava em
`deadlines`. A funcionalidade não se perdeu — mudou de camada. A extensão instala o workflow
chamável **"Criar Prazo"** (`wf-prazo-criar`, `eventName: 'workflow.called'`), montado só com os
passos genéricos do motor:

| Passo | O que faz |
|---|---|
| Buscar Registros (`query`) | acha o processo por `caseNumber` |
| Condição | `outputs.buscarProcesso.count < 1` → Montar Objeto `{ ok: false, error }` + Encerrar Workflow |
| Condição | advogado informado? → busca por `name` e repete o mesmo par de erro; os dois ramos publicam `responsibleLawyerId`, um com o id achado e o outro com `null` |
| Montar Objeto → Gravar Registro (`upsert`) | monta o prazo e grava em `deadlines` |

E ele é MELHOR que o Step que substituiu: o Step exigia o **id** do processo e o do advogado, e quem
chama um workflow raramente os tem em mãos — quem analisa uma intimação tem o NÚMERO do processo e o
NOME do advogado. O workflow resolve os dois e **para** quando não acha, em vez de pendurar um prazo
num processo inexistente. Encerrar Workflow não produz saída própria, então o retorno é a saída do
passo anterior: daí o par "Montar Objeto com o erro + Encerrar".

O `scripts/prazoCriarWorkflow.test.ts` roda essa declaração no **motor de verdade** — é o único
lugar que enxerga as duas pontas (o pacote em `src/`, o motor em `functions/`), e é o que garante que
um erro de digitação em `output.buscarProcesso.first.id` não chegue ao escritório do cliente.

#### Declarar uma automação que a AUTORIA consegue reabrir

Uma automação que viaja numa extensão é instalada no escritório, e lá vira um registro comum: o
admin abre, lê e ajusta pelo construtor de sempre. **Executar não basta** — o motor resolve as cinco
variantes de `InputMapping`, os construtores da autoria não, e uma declaração que eles não sabem ler
mente na tela e se perde no primeiro toque. Duas regras, com as armadilhas que as originaram:

| Onde | O que declarar | O que NÃO declarar, e por quê |
|---|---|---|
| Valor de um filtro do "Buscar Registros" | `Literal` ou `Expression` (`event.caseNumber`) | `Event`/`Output`/`Variable` **rodam**, mas o construtor só tem controle para os dois primeiros: a linha abre como "Valor fixo" VAZIO, e mexer nela apaga o filtro |
| Condição sobre a saída de um step | nó de **Expressão** (`output.buscarProcesso.count < 1`) | `FieldComparison` com `outputs.…` **roda**, mas o seletor de campo dela só oferece os campos do EVENTO — o caminho aparece marcado como inválido |

A comparação continua valendo para o que ela sabe oferecer: um campo do evento
(`event.payload.responsibleLawyerName`) é mais legível como comparação do que como expressão. E note
o par de nomes que engana: a comparação lê o **contexto cru** (`outputs`, plural), a expressão lê o
**escopo publicado** para ela (`output`, singular) — é o singular que o autocomplete oferece, e
escrever o plural numa expressão devolve indefinido em silêncio.

**Por que não estender os construtores em vez de restringir a declaração.** Dar às duas pontas de uma
comparação um seletor de quatro origens (fixo / do evento / de step anterior / expressão) multiplica o
widget e cria dois jeitos de dizer a mesma coisa. O nó de **Expressão** já cobre o conjunto inteiro,
com autocomplete sobre `event`, `input`, `output` e as variáveis — é a saída que o próprio construtor
oferece, e é a que o pacote usa. O que valeria a pena um dia é menor e cirúrgico: fazer o seletor de
campo da comparação oferecer também as saídas dos steps, como o editor de expressão já faz.

`src/plugins/marketplace/authoringRoundTrip.test.ts` guarda as duas regras para **todo** o
`MARKETPLACE_CATALOG`, lendo as origens aceitas do próprio construtor
(`QUERY_VALUE_MAPPING_KINDS`) e os campos oferecidos de `buildConditionEventFields` — não de uma
cópia da lista. Nenhum teste de execução pega esse defeito: as duas declarações erradas passam.

Workflows existentes que usem o Step `create-deadline` param de resolver o passo e precisam ser
refeitos — chamando este workflow, ou com Gravar Registro direto.

**O que ficou no kernel, e por quê.** A **Agenda** (`calendar`), o **Painel** e os **Pushes** do
tribunal continuam sendo telas de código, e continuam lendo e escrevendo prazos — pelo caminho
GENÉRICO: `useDeadlineRecords()` (mesmo contrato de leitura de `useCaseRecords` e irmãos) para ler,
`useRecords().updateRecord/createRecord` para gravar, `useOpenRecord`/`useOpenScreenList` para
navegar. Nenhuma delas conhece uma entidade declarada em código; sem a extensão instalada, a lista
vem vazia e a tela mostra o estado vazio, em vez de dado errado.

**O que a migração custou, e é aceitável.** (1) A busca da listagem casa os textos do registro
(tipo, descrição, status), não mais o número do processo — quem procura por processo tem o filtro
"Processo", com o número no rótulo. (2) Os caminhos denormalizados (`event.case.caseNumber`) saem do
catálogo de eventos, como já saíram nas quatro migrações anteriores: o evento oferece o `caseId`, e o
registro apontado é resolvido na hora em que a expressão o pede. (3) Excluir um prazo passa a ser do
admin (a regra curinga), onde antes o advogado também podia — o mesmo que já vale para Pessoa,
Processo, Contrato e Financeiro. (4) No cartão, os botões de hover saem na ordem "copiar link,
excluir, concluir": as ações nativas vêm antes das declaradas.

### As ações do registro viram contribuições

Copiar link, Duplicar, Etiquetas e Excluir eram as ÚNICAS ações que o kernel sabia desenhar: quatro
`if` em código, ligadas por caixa de seleção (`listActions`), sem ícone configurável, sem ordem, sem
expressão. Não eram Actions — Action, no sistema, executa um workflow, e essas quatro são operações
de TELA, sem nada para rodar no servidor.

O ponto **`ui.record.action`** resolve a diferença. Uma ação de registro é uma contribuição como
qualquer outra: metadata declarada (chave, rótulo, ícone, ordem, `hiddenWhen`) mais uma implementação
de código que recebe um **host** estreito — o registro, onde ele vive e as operações que a tela sabe
executar. `core.records` contribui as cinco (as quatro de sempre mais **Desvincular**), e o kernel
deixa de conhecer qualquer uma pelo nome: some o mapa fixo de ícones, some o `Record<ScreenListAction,
…>` de handlers, some o `if` que decidia quem aparece.

```ts
recordAction({ key: 'copyLink', title: 'Copiar link', icon: 'link', order: 0 }, 'CopyLinkRecordAction')
```

**O host diz ONDE, o comando diz O QUÊ.** `recordTabKey`/`cloneTabKey` vêm do host, não do comando:
a listagem genérica usa `view-dyn:`, uma extensão com editor próprio usa o prefixo dela, o cabeçalho
do detalhe usa o `deepLinkKey` que a tela declarou. Antes, a ponte das extensões reescrevia o
`onClick` de "duplicar" e "copiar link" procurando pela CHAVE da ação — ela precisava conhecer o nome
de cada ação do kernel. Agora só endereça o registro.

**Uma Action do escritório pode executar um comando.** `ActionDefinition.command` é a alternativa a
`workflowId`: presente, a ação roda a operação de tela em vez de chamar uma automação. É o que põe
as embutidas e as do escritório na MESMA lista, e o que faltava para "toda ação é uma Action". A tela
de Ação escolhe entre as duas; uma superfície que não saiba executar comandos (`runRecordCommand`
ausente) simplesmente não mostra a ação, em vez de mostrar um botão que falha.

### Onde a ação aparece muda o que ela significa

O escopo das expressões ganhou duas variáveis ortogonais — `surface` diz ONDE, `relation` diz O QUÊ:

| Variável | Valores | Significa |
|---|---|---|
| `surface` | `detail`, `list`, `parentTab` | cabeçalho do registro, cartão da listagem própria, cartão dentro da aba de outro registro |
| `relation` | `none`, `owned`, `related` | o registro não está na aba de ninguém, é FILHO do pai, ou é entidade de topo que apenas aponta para ele |

Existem porque a mesma ação é lida de formas diferentes conforme o lugar. O caso que as motivou: na
aba "Processos" de um contrato, o cartão oferecia **Excluir** — e ali o gesto que o usuário faz é
"tirar daqui", não "apagar o processo inteiro do escritório".

**O slot destrutivo é decidido por DECLARAÇÃO, não pelo kernel.** Excluir e Desvincular dividem o
mesmo `slot` (`delete`), e o `hiddenWhen` de cada uma escolhe:

| Ação | `hiddenWhen` | Aparece |
|---|---|---|
| Excluir | `relation == "related"` | fora de aba, e na aba de um filho de verdade — o registro é parte do pai |
| Desvincular | `relation != "related"` | só na aba de um relacionado; limpa o campo de vínculo, e por ser gravação comum não exige admin |

`slot` é o que permite duas ações disputarem o mesmo lugar: a tela habilita `delete` uma vez, e a
relação decide qual das duas o usuário vê. Desvincular também devolve, pelo caminho declarativo, o
que a migração de Contrato tinha perdido: o par vincular/desvincular da aba "Processos". Vincular é
criar pela aba (já nasce ligado) ou preencher o campo na tela do próprio registro.

**Como uma ação embutida CHEGA à tela.** Não pela tela de Ações: são dois caminhos distintos, e o
das embutidas já existia.

| Configuração | O que lista | Onde se configura |
|---|---|---|
| `listActions` | os SLOTS de ação de registro que a tela oferece | aba "Listagem" do Form Design (caixas) |
| `cardActionIds` / `viewActionIds` | `ActionDefinition` do escritório | aba "Ações" do Form Design |

`getCardActions` percorre as ações contribuídas e fica com aquelas cujo `slot` está em
`listActions`. Nenhum documento é criado, nada é vinculado à mão: a caixa que sempre existiu virou o
vínculo. Uma tela nova nasce com as quatro marcadas porque `resolveListActions` cai no padrão.

Para que isso valesse também para uma ação NOVA, duas coisas tiveram de abrir:

- **`ScreenListAction` virou `string`**, pelo mesmo motivo de `EntityKey`: o conjunto é DADO, não
  união fechada. Fechado, o nome da ação de uma extensão nunca poderia ser gravado em `listActions`.
- **As caixas da aba "Listagem" saem das contribuições** (`listActionOptionsFrom`), não de uma lista
  literal. Duas ações no mesmo slot são UMA caixa, e a caixa carrega a dependência de etiquetas que a
  ação declarou (`requiresTags`) — o Form Design não conhece mais a palavra `manageTags`.

**O que ainda não é declaração:** o cabeçalho do detalhe continua com os botões fixos de
gravar/copiar/duplicar/excluir, e `listActions` e "Ações" continuam sendo duas listas. Unificá-las
exige criar documentos de `ActionDefinition` por escritório — migração de dados, não refatoração —, e
é o passo seguinte.

### Quem abre um registro de fora não guarda a chave da aba

Abrir um registro a partir de OUTRO lugar — a Auditoria, uma menção no editor, o card de outra tela —
é resolver uma COLEÇÃO na tela que a apresenta **hoje**. Guardar a chave de aba envelhece: o log de
auditoria gravava `view-person:{id}`, e no dia em que Pessoa saiu do kernel o botão "Ir para o
registro" passou a abrir uma tela vazia. A Cloud Function que grava o log não tem como saber a chave
certa — ela depende das telas instaladas naquele escritório.

Duas peças resolvem:

- **O log guarda a coleção, não a aba.** `AuditLog.linkCollection` + `linkRecordId` (para um filho —
  nota, documento — é o PAI, que é quem tem tela). `entityLink` fica como está, para os registros
  gravados antes disto: a UI só o usa quando a coleção falta.
- **A tela declara como endereça um registro.** `ScreenDefinition.recordTabPrefix` — a chave é
  `prefixo + id`. Ausente, vale a aba genérica (`view-dyn:<chave>:`). Existe porque uma extensão pode
  trazer o próprio editor: sem a declaração, o mesmo processo abria numa tela pela menção
  (`processo-edit:`) e noutra pela auditoria.

`useOpenRecord` é o ponto único que junta as duas: acha a tela que descreve a coleção, respeita o
`recordTabPrefix` dela e, na falta de tela, cai na aba FIXA — se houver. Ele é exportado em
`@microteia/data`: uma extensão que MOSTRA registros de uma coleção que não é dela (o Kanban mostra
`cases`) abre pela coleção, sem conhecer quem a apresenta.

#### A extensão que abre mão do editor próprio

Processos e Contratos nasceram com duas views de código, lista e detalhe. O detalhe foi **removido**:
`RecordDetailSurface` + `useEntityDetailVM` montam exatamente o formulário que `ViewDynamicRecord`
monta a partir do mesmo schema — eram duas telas idênticas para manter, e a auditoria e as menções
precisavam de uma declaração a mais (`recordTabPrefix`) só para escolher entre elas. Hoje as duas
extensões declaram apenas a LISTAGEM, que é onde o cartão foge do que a declaração alcança (os polos
do processo, o chip de dias em trâmite, a vigência do contrato).

O caminho continua aberto: `recordTabPrefix` e `RecordDetailSurface` seguem no kernel para a extensão
que precise de um detalhe que o schema não descreva. A régua é essa — **desenhe em código só o que a
declaração não alcança.**

> A trava de `max-width: 800px` do formulário dinâmico saiu junto: era a única diferença visível
> entre o detalhe genérico e o de extensão, e fazia a mesma tela parecer duas.

> **`view-dyn:` também começa com `view-`.** A checagem anterior (`builtin.startsWith('view-')`)
> aceitava a aba dinâmica como se fosse fixa, e uma coleção sem tela nenhuma — extensão desinstalada —
> abria aba morta. `builtinViewTabKey` devolve `null` quando não há aba fixa: "não existe" e "a
> dinâmica" são respostas diferentes.

### Uma referência aponta para a COLEÇÃO

O seletor "Tela vinculada" do Form Design oferecia as telas dinâmicas pela CHAVE (`contratos`)
enquanto o campo guarda a COLEÇÃO (`refEntity: 'contracts'`) — que é o que `useReferenceOptions`
resolve em runtime. Resultado: o campo já gravado não achava a própria opção e o seletor acusava
"Registro não encontrado (contracts)", com tudo funcionando por baixo.

A opção passa a valer `screenDataCollection(def)`. Numa tela comum é a mesma coisa (a chave É a
coleção); numa tela ligada a outra coleção, é o nome global — o mesmo que sobrevive à entidade mudar
de dono. Duas telas que descrevam a mesma coleção (a de extensão e o documento de baseline que só
carrega a permissão) entram como uma opção só.

### Uma lista colorida não ganha item sem cor

`optionsColored` dizia como as opções são LIDAS, e nada sobre como uma opção NASCE. O resultado
aparecia no dropdown com "adicionar novo": a opção recém-criada saía sem cor nenhuma, apagada ao lado
das que vieram declaradas pela extensão. `nextLookupOptionColor` (em `shared/styles/colorUtils.ts`)
fecha o ciclo — a opção criada pelo usuário nasce colorida quando o campo declara `optionsColored`
**ou** quando a lista já tem opções com cor (a lista mostra o que é, mesmo sem a declaração). A cor
sai da paleta do tema a partir do azul, parando na primeira ainda não usada naquela lista, para que
duas opções seguidas não saiam iguais.

### Telas fixas por Schema — piloto (Pessoas)

Primeiro passo de unificação: o formulário "Dados" de `ViewPerson` é renderizado pelo `CustomFieldsSection` a partir de um layout de código `presentation/pages/ViewPerson/personFormSchema.ts` (`PERSON_FORM_FIELDS: FieldDefinition[]`), em vez de campos escritos à mão. A visibilidade PF/PJ (antes `if type === ...` no JSX) agora é `logic.hiddenWhen` por campo.

- **Renderer lookup-aware (aditivo):** `CustomFieldsSection` ganhou props opcionais `lookupOptions` (`Record<collection, LookupOptionSet{staticOptions,dynamicOptions}>`), `onAddLookupOption`, `onDeleteLookupOption`, `canDeleteLookupOption`. Um `FieldDefinition` com `lookupCollection` renderiza um `DynamicSelect` alimentado por essas props. Telas customizadas que não passam as props seguem idênticas — sem risco.
- **Bridge:** `ViewPerson.viewmodel` expõe `nativeFields` (o layout), `nativeValues` (o próprio `formData`), `setNativeFieldValue` (→ `setFormData`), `personLookupOptions` (montado dos memos de `usePersonLookup`) e `handleAddPersonLookup`/`handleDeletePersonLookup` (mapeiam `collection → PersonLookupKind`). O `formData` chato por chave já é o escopo das expressões.
- **Fora do piloto (a integrar depois):** a busca automática de endereço por CEP (`handleCEPChange` permanece no viewmodel, disponível) e o erro inline de CPF/CNPJ (a validação de dígito continua no save via `FieldRules`). As demais telas fixas ainda são escritas à mão.

**Runtime de detalhe compartilhado (Fase A, slice 1) — Anotações/Documentos:** a lógica e a UI de Anotações e Documentos (antes duplicadas em cada tela fixa e no runtime dinâmico) vivem em `presentation/shared/entityScreen/` (`useEntityNotes`, `useEntityDocuments`, tipos `EntityNote`/`EntityDocument`/`NotesPort`/`DocumentsPort`) + `presentation/components/layout/EntityDetailPanels/` (`NotesPanel`, `DocumentsPanel`). Cada tela monta um **port** que embrulha seus use cases (tenant/usuário/screenKey presos no closure) e passa o `recordId`; `ViewPerson` e `ViewDynamicRecord` consomem os mesmos hooks/painéis. `PersonNote`/`CustomRecordNote` (e os documentos) satisfazem as interfaces comuns por structural typing.

**Casca genérica (Fase A, slice 2) — `EntityDetailView`:** o shell (header com avatar/título/subtítulo/etiquetas + ações copiar-link/clonar/etiquetas/salvar/excluir; abas Dados/Anotações/Documentos; conteúdo) vive em `presentation/components/layout/EntityDetailView` (view + styles próprios). `ViewPerson` e `ViewDynamicRecord` viraram wrappers finos que passam **slots** (`avatar`, `title`, `subtitle`, `dataContent`, `headerActionsExtra` p/ o toggle de status do Person, `modals`) + o estado do viewmodel. Cada `*.styles` de tela ficou só com o que é específico (form de Pessoa + `ToggleIcon`; estados de indisponibilidade + `FormWrapper` do dinâmico). A tela dinâmica passou a exibir o ícone dentro do avatar circular (uniformização).

**Chrome do viewmodel (Fase A, slice 3) — `useEntityDetailChrome`:** a lógica comum aos viewmodels de detalhe (estado de aba, copiar deeplink, clonar, gerenciador de etiquetas, confirmação de exclusão) foi extraída para `presentation/shared/entityScreen/useEntityDetailChrome.ts`, parametrizada por entidade (`deepLinkKey`, `cloneKey`, `remove`, `onRemoved`, mensagens). Cada viewmodel usa o hook e **re-expõe sob os mesmos nomes** — as views não mudaram. O que resta por-entidade no viewmodel é intrinsecamente específico: `save`/mapeamento de `values`, `tagAdapter`, ports de notes/docs e lookups.

**Lista genérica (Fase A, slice 4) — `EntityListView`:** a casca da listagem (header com título/ícone + botão "novo"; toolbar com `CompositeFilter`; conteúdo com loading/empty/grid) vive em `presentation/components/layout/EntityListView`. `Persons` e `DynamicRecordList` a consomem passando os defs de filtro, estados e os **cards como `children`** — ambas usam o `EntityListCard` (avatar/título/etiquetas + `CustomFieldMetaRows` no slot `extra`). `Persons.styles` foi removido; `DynamicRecordList.styles` ficou só com o estado de indisponibilidade.

**Abas extras no detalhe (Fase C, Contratos):** o `EntityDetailView` aceita `extraTabs?: { key; label; content }[]`, para abas próprias da tela além de Dados/Anotações/Documentos — o caso real é a aba **Processos** do Contrato (vincular/desvincular processos). Com isso `EntityDetailTab` passou de union fechado para `string`; as telas seguem usando `'data' | 'notes' | 'documents'`, e os viewmodels expõem `activeTab: EntityDetailTab`. **Trade-off consciente:** perde-se a checagem de digitação das chaves fixas; a alternativa (generics acumulando as chaves extras por tela) foi descartada por complicar a assinatura do shell em troca de pouco.

**Fase C — concluída.** Detalhe e lista de todas as telas fixas rodam no runtime compartilhado (Pessoas, Prazos, Financeiro, Processos, Contratos) — Notícias ficou fora por ser um feed com comentários, não um cadastro registro-a-registro. Números: Contratos 872→~390 (viewmodel) e ~640→~140 (view); Processos 717→~300; Financeiro 510→~250.

**Cards das listas fixas — schema + slots (Fase C, listas):** as quatro listas fixas (Processos, Contratos, Prazos, Financeiro) deixaram o markup manual e passaram a usar `EntityListView` + `EntityListCard`. As meta-linhas comuns vêm de **`ui.list` no registry** via `deriveListRows`, que também percorre as **relações (`fks`)** — nesse caso emite `type: 'reference'` + `refEntity`, e o `useListRowResolver` (`presentation/shared/listRows.ts`) traduz o ID para o rótulo pelo mesmo `useReferenceOptions` que alimenta os campos `reference` do formulário, além de formatar moeda/data pelo `type`. **Para incluir/reordenar uma linha de card, edite `ui.list` do campo no registry — não a view.**

O que NÃO deriva, e por quê (regra que emergiu das quatro listas):
- **Composição de 2+ campos** (vigência `início – fim` do Contrato; datas `vencimento · pagamento · cancelamento` do Financeiro): como linhas separadas ficariam ambíguas sem rótulo.
- **Linhas navegáveis** (Pessoa/Processo/Contrato no Financeiro, nº do processo no Prazo): derivar viraria texto e perderia o clique que abre o registro.
- **Exclusivo da tela** (polos do Processo, partes do Contrato, badges, chip de dias).

Para isso o `EntityListCard` ganhou slots opcionais — `belowHeader` (entre cabeçalho e meta-linhas), `footer` (após as etiquetas, ex.: o valor do lançamento) e `accentColor` (faixa lateral de severidade, ex.: prioridade do Prazo) — e o `EntityListView` ganhou `headerExtra` e `belowHeader` (ex.: botões Dashboard/ocultar totais e a barra de totais do Financeiro). Todos com default que preserva quem já usava. `EntityCardMetaRow.value` é `ReactNode`, então uma linha bespoke pode ser um link sem o card saber disso.

**Atenção:** `ui.list.icon` é string livre e um nome errado cai no ícone de fallback silenciosamente (aconteceu com `'money'`, que não existe — o correto é `'moneyDollar'`). Há teste em `deriveEntitySchema.test.ts` que varre os `ui.list` das cinco entidades e falha apontando campo e ícone.

**Ações no card da listagem:** o `EntityListCard` aceita `actions` (ícone + `onClick`, `copyLink`/`clone`/`manageTags`/`delete`). Nas telas dinâmicas isso é **configurável**: `ScreenDefinition.listActions: ScreenListAction[]` (tipo em `entitySchemas.ts`, sincronizado; persistido em `screenDefinitions/{key}` e lido em `mapScreenDefinition`, default `[]`). No `ScreenBuilder`, o modal de tela tem o grupo "Ações no card da listagem" (`LIST_ACTION_OPTIONS` + `toggleListAction`; `manageTags` desabilitado sem `hasTags`). `DynamicRecordList` monta as ações via `getCardActions` filtrando por `listActions` (+ `delete` só admin, `manageTags` só com `hasTags`) e provê os modais `TagManager`/`ConfirmModal` — mesmo padrão de `Persons` (`PERSON_LIST_CONFIG.actions`). **Atenção:** `toSaveInput`/`builtinSaveInput` listam campos à mão — qualquer campo novo de `ScreenDefinition` precisa ser adicionado neles, senão salvamentos parciais o apagam.

### Actions Customizadas

Um botão configurável nas telas de dados que dispara um **workflow síncrono** e aplica o retorno de volta na tela. Complementa `listActions` (o quarteto nativo fechado): as customizadas são um array próprio, renderizado depois.

**Entidade** — `ActionDefinition` (`src/domain/entities/Action.ts`, **arquivo compartilhado**, gerado em `functions/src` por `sync-schemas`), persistida em `tenants/{tid}/actions/{actionId}`: `key` (identificador que chega ao workflow), `title`, `icon` (chave de `screenIcons.tsx`), `workflowId`, `hiddenWhen`/`disabledWhen` (expressões), `confirmMessage`, `danger`, `enabled`, `order`. `ScreenDefinition` ganhou `viewActionIds`/`cardActionIds` (ids referenciados, ordem configurada) — uma mesma action serve várias telas.

**Contrato com o workflow** — o alvo tem `eventName: 'workflow.called'` e recebe `action` (o `key`), `source` (o `screenKey`), `context` (valores da tela), `recordId` e `isNew`. O frontend manda o `values` **cru**; quem poda e coage é o `formatAndValidateParameters` do executor, contra os `fields` declarados no parâmetro `context`. As saídas esperadas são `result` (objeto a aplicar), `status` (`{ code: 'SUCCESS'|'WARNING'|'ERROR', message, fieldErrors? }`) e `actions` (comandos locais).

> **O último Step precisa emitir as três chaves de uma vez.** O `WorkflowExecutor` devolve **apenas os outputs do último step da travessia** (`context.outputs[run.lastStepId]`), então um Step que emitisse uma chave por vez descartaria as anteriores. As formas corretas são **"Montar Objeto" sem nome** (o `MapStep` espalha os campos na raiz quando `config.name` é vazio) ou um **Step Script** retornando `{ result, status, actions }`. Como `normalizeActionOutcome` é tolerante, esse erro seria um no-op silencioso; por isso o `runAction` detecta a ausência das três chaves e devolve uma mensagem explicando a regra.

`normalizeActionOutcome` (mesmo arquivo, com testes) traduz os outputs crus e é **deliberadamente tolerante**: saída ausente ou malformada vira "nada a aplicar", nunca exceção na tela. Aceita comando como string (`"merge"`) ou objeto (`{ type: 'merge' }`) — a forma-objeto existe para comandos parametrizados no futuro sem quebrar workflows já escritos.

**Formas compactas do `status`.** O avaliador de expressões tem literal de **array** (`["a","b"]`) mas **não de objeto** — objeto só via a função `object(chave, valor, …)`. Para não obrigar a isso, `asStatus` aceita quatro formas: `{ code, message, fieldErrors? }` (única que carrega `fieldErrors`), `["SUCCESS", "Mensagem"]`, `["SUCCESS"]` e `"SUCCESS"`. Nas formas compactas, texto que **não** é um código conhecido vira a mensagem com código `SUCCESS` — `"Enviado"` e `["Enviado"]` são sucesso com mensagem. Na forma-objeto as posições são nomeadas, então um `code` desconhecido é **descartado** (cai para `SUCCESS` com mensagem vazia), não promovido a mensagem.

**Execução** — callable **síncrono** `runAction` (`functions/src/infrastructure/handlers/runAction.ts`), que reusa `getRunCalledWorkflowUseCase()` — o mesmo motor do Step "Chamar Workflow" com "Aguardar retorno". Sem event bus, sem polling: a resposta HTTP já traz `outcome` + `executionId`. Como o use case roda os steps direto, o handler chama `ensureWorkflowStepsRegistered()`. Erros de execução voltam no campo `error` (não lançam), padrão de `runScript`.

**Comandos locais** — aplicados por `dispatchActionOutcome` (`presentation/shared/entityScreen/useScreenActions.ts`) na **ordem canônica** `ACTION_COMMAND_ORDER`, não na ordem do array: `replace → merge → save → refresh → clone → delete → close` (senão `['save','merge']` gravaria antes de mesclar). Um `status.code === 'ERROR'` reporta e **para** — nada de gravar ou excluir sobre uma falha declarada. Comando sem callback correspondente é ignorado: a listagem não tem formulário para `merge` nem aba para `close` (mesmo racional do `listActionCapabilities.ts`). O `result` é **achatado em caminhos pontilhados** antes de aplicar, para que objetos aninhados cheguem aos campos via `setValueByPath` (arrays são folhas — campos de múltipla escolha).

> **Atenção:** `merge` seguido de `save` exigiu `handleSave(override?: Values)` em `useEntityDetail` — o `handleSave` fecha sobre o `values` do render corrente e não enxergaria o merge recém-aplicado. O dispatcher acumula os valores localmente e os passa adiante.

**Expressões** — `hiddenWhen`/`disabledWhen` são o mesmo par de `FieldLogic` e reusam `evaluateFieldBoolean`; `domain/schema/actionExpression.ts` só monta o escopo. Puramente de UI (o backend não as reavalia). O escopo expõe os campos da tela **na raiz** (como nas expressões de campo) mais os reservados `record`, `isNew`, `isDirty`, `role` — que **sobrescrevem** campos de mesmo nome (um campo `record` segue legível por `record.record`). Reavaliação é síncrona a cada render, então "ao abrir a tela" e "ao mudar um campo" saem de graça.

**Superfícies** — na View, `useEntityDetail` chama `useScreenActions` e devolve `screenActions`; o `EntityDetailView` renderiza os botões e o `ConfirmModal` de `confirmMessage`. As 6 telas de detalhe só repassam a prop. No card, `useRecordListViewModel` avalia as expressões **por registro** (funções puras, não hooks — não dá para chamar hook em loop) e usa o mesmo `dispatchActionOutcome`, com `save` mapeado para `updateRecord`. `RecordCardAction` ganhou `iconKey`/`disabled`; a view resolve por `getScreenIcon`. Administração em `Actions`/`ViewAction` (só admin), seleção por tela na aba "Ações" do `ScreenBuilder`.

**Viewmodel genérico (Fase A, fecho) — `useEntityDetail`:** o núcleo restante (parse do tabKey, resolução do registro com `findInStore` + fallback opcional `getById` + `recordNotFound`, o **estado único de `values`** com `setFieldValue`, a orquestração de salvar — validar → montar payload → create/update → `notify` → reabrir aba → título — e o efeito de título da aba) vive em `presentation/shared/entityScreen/useEntityDetail.ts`, compondo `useEntityDetailChrome`/`useEntityNotes`/`useEntityDocuments`. `ViewPerson` e `ViewDynamicRecord` viraram **adapters finos**: montam um `config` (stores tipados, `recordToValues`/`valuesToPayload`, `resolveTabTitle`, `create`/`update`/`validate`, ports, flags `hasNotes`/`hasDocuments`) e adicionam só seus overrides (Person: lookups tipados + toggle de status). O `values` é **um mapa só** (nativo aninhado + custom flat); `setFieldValue` grava por caminho via **`setValueByPath`** (`domain/services/customFieldValues.ts`, com teste) — chave com `.` aninha (`address.street`), sem `.` grava no topo. A **máscara** é 100% dirigida por `field.mask`: o `MaskedInput` formata no render (formatters idempotentes), então nenhuma tela pré-formata. Os ports de notes/docs são genéricos (`useNotesPort`/`useDocumentsPort` sobre a interface de repositório, com `extra` opcional p/ o `screenKey` do dinâmico); os 14 use cases `make*Note/Document*` foram removidos.

**Fase C — migrar as fixas restantes (em andamento):** Prazos foi a primeira (Notícias ficou fora do escopo: é um feed com comentários, não um cadastro registro-a-registro). Três recursos novos, todos **aditivos** (defaults preservam Pessoas/dinâmicas):
- **`deriveFormFields` deriva `fks`** como campos `reference` (ex.: `caseId` → `cases`, `responsibleLawyerId` → `persons`) — o `useReferenceOptions` já resolve as opções de `persons/members/cases/contracts/financials/deadlines` + telas dinâmicas. FKs de etiqueta ficam fora do formulário com `ui: { form: false }` (quem trata é o TagManager). `FkSpec` ganhou `required?`/`ui?`; `NativeFieldSpec` ganhou `optionsColored?`. Os campos derivados são reordenados por `order` no fim da derivação.
- **`useEntityDetail`**: `afterCreate: 'reopen' | 'close'` (Prazos **fecha** a aba ao criar; o padrão continua reabrindo em edição) e **`remove` opcional** (telas sem exclusão no detalhe).
- **`EntityDetailView`**: `showCopyLink`/`showClone` opcionais (default `true`).

Campos **derivados** que não são do formulário (ex.: `status` do Prazo, calculado de `completedAt`/`dueDate`) ficam com `ui: { form: false }` no registry e são montados no `valuesToPayload` do adapter. Opções com cor usam **token do tema** (`success`/`warning`/`danger`…), resolvido por `resolveColor` — nunca hex literal.

**Erro de validação por campo (modelo genérico):** o `config.validate` devolve `EntityValidationResult | null` (`{ message; fieldErrors: Record<fieldKey, string> }`). `useEntityDetail` guarda `fieldErrors`, exibe `message` no `notify` no save, **limpa o erro do campo ao editá-lo** (`setFieldValue`) e zera tudo quando a validação passa. As views passam `errors={vm.fieldErrors}` ao `CustomFieldsSection`, cujo `fieldError(field)` prioriza `errors[field.key]` e cai na validação ao vivo por expressão (`logic.validate`) quando não há erro de save. Os adapters montam o mapa com `collectRequiredErrors(fields, values)` (obrigatórios, por campo) + os `RuleIssue.path→error` de `validateRecordRules` (formato/`validate.check`/expressão). Vale só p/ Pessoas e telas dinâmicas; as demais fixas herdam ao migrar.

**Fonte única por campo (Form e List derivam do registry) — piloto Pessoas:** cada campo tem sua config num **único lugar** — o `NativeFieldSpec` no `ENTITY_REGISTRY`. O `NativeFieldSpec` guarda as **regras de negócio/domínio** (`label`, `type`, `rules`, `logic`, `lookupCollection`, `refEntity`, `multi`, `required`, `options`, `optionsAllowUserAdd`) e ganhou um bloco **`ui: FieldUiSpec`** só de **apresentação** (`control`, `mask`, `section`, `order`, `placeholder`, `form`, `list:{icon,order}`) — sincronizado p/ `functions` (backend ignora). Separar negócio de apresentação permite outras formas de exibição no futuro sem mexer nas regras. `CustomFieldType`/`CustomFieldMask`/`CustomFieldOption` foram movidos p/ `domain/schema/fieldRules.ts` (evita ciclo; `entitySchemas.ts` re-exporta).

- **Derivação:** `presentation/shared/deriveEntitySchema.ts` — `deriveFormFields(entityKey, {overrides?, extra?})` achata `object` p/ chaves-com-ponto (`address.city`), define o `control` a partir de `ui.control` ?? default do storage type, e copia o resto do `ui`/campo; `deriveListRows(entityKey)` extrai os campos com `ui.list`. `PERSON_FORM_FIELDS`/`PERSON_LIST_CONFIG.rows` agora **derivam** (`personFormSchema.ts`/`personListSchema.ts`); título/subtítulo/ações/etiquetas seguem config de card.
- **Chaves-com-ponto:** `CustomFieldsSection` lê valores via `readByPath` (navega quando a chave tem `.`; retrocompatível p/ slugs de campos customizados) e escreve via `setFieldValue`. No `ViewPerson`, o `values` unificado guarda o endereço **aninhado** (`address: { street, … }`); `personToValues`/`valuesToPersonPayload` (no viewmodel) fazem a projeção `Person tipado ↔ values` (dígitos de cpf/cnpj, `birthDate`, `address`), e `setValueByPath` mantém a escrita aninhada de `address.*`. (O autopreenchimento de CEP via ViaCEP não é mais fiado na UI — fica como reintrodução futura via mecanismo de efeito on-change de campo.)
- **Adicionar um campo comum agora é em 1 lugar:** editar `ENTITY_REGISTRY.persons.fields` (com `ui`) faz o campo aparecer no form (e no card, se `ui.list`) sem tocar em `personSchema`.
- **Modelo único de campo (`FieldDefinition`):** os três caminhos convergem no MESMO `FieldDefinition`, consumido pelo mesmo `CustomFieldsSection` (render) e `recordRules` (validação): campos fixos nativos (`deriveFormFields` → `FieldDefinition[]`), campos customizados de entidades fixas (`getCustomFieldsFor(entityKey)` → `FieldDefinition[]`) e campos de entidades dinâmicas (`ScreenDefinition.fields`). A única diferença é a origem da DEFINIÇÃO do campo fixo (`NativeFieldSpec` no registry, ainda necessário para backend/workflow/path-resolver), que deriva para `FieldDefinition`. Teste-guarda: `presentation/shared/deriveEntitySchema.test.ts`. O futuro (só tabelas/campos dinâmicos) colapsa `NativeFieldSpec` em `FieldDefinition`.
- **Pasta única `pages/Persons`:** lista (`Persons.*`) e detalhe (`ViewPerson.*`) moram na mesma pasta, com `personSchema.ts` (form derivado + config do card). A pasta `ViewPerson/` foi removida.

**Listagem (card) por config — piloto Pessoas:** `ui/EntityListCard` é o card reutilizável (avatar, título, subtítulo, ações no hover no canto superior direito, linhas de meta com ícone, etiquetas, `extra` para `CustomFieldMetaRows`). Config em código `presentation/pages/Persons/personListSchema.ts` (`PERSON_LIST_CONFIG`): `titleKey`, `subtitle{key,icon}`, `showTags`, `actions` (`copyLink|clone|manageTags|delete`, cada uma opcional) e `rows[{key,icon}]` (ordem + ícone por linha; ícones resolvidos por `getScreenIcon`). O `Persons.viewmodel` resolve cada `row.key`→valor (`getCardModel`), monta as ações (delete só admin) e o `TagStoreAdapter`; a View mapeia `iconKey→getScreenIcon` e `action.key→ícone`. Telas customizadas e demais fixas migram depois.

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
   exatamente do repositório de que precisa: `UpsertStep`/`RemoveStep`/`QueryStep` → os
   repositórios GENÉRICOS de registro (nenhuma entidade pelo nome);
   `NotifyStep`/`RegisterAuditStep` → `IAuditLogRepository` (já existente, reaproveitado);
   `SetVariableStep` → nenhuma dependência externa. Nenhum Step conhece mais uma entidade de
   escritório: `CreateDeadlineStep`, o último que conhecia, saiu com a entidade Prazo.
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

Um input de Step com `type: 'EntityReference'` declara também `entityType?: string` — a mesma chave usada por
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

**Tabela tipada e validada nos dois lados** — `resolveQueryTable` resolve o nome para a **própria
coleção**: entidade do registro ou tela do tenant (`isEntityCollection`), ou lista/lookup
(`isLookupCollection`). Não há mais coleção física distinta da tabela lógica nem filtro implícito. `validateQuerySpec` confirma a tabela e cada caminho de
`where`/`orderBy`/`projections` via `resolvePath`. Roda no front (`QueryBuilderControl`, antes de
salvar) e no back (antes de executar) — mesma função.

**Projeção por caminho** (ex: `client.name`, `client.apelido`, `prioridade`)
reaproveita o pipeline de hidratação de FKs: `buildHydrationPlan` + `materializeHops` +
`IWorkflowRecordFetcher`, materializando cada linha do resultado. Os `projections` também limitam
quais FKs são carregadas (evita over-fetch).

**Isolamento e segurança** — o `tenantId` (`context.execution.tenantId`) é SEMPRE injetado no path
(`tenants/{tenantId}/...`), então uma consulta nunca cruza escritórios. Nesta versão não há checagem
de role por usuário: o workflow é tratado como automação de nível administrativo do tenant.

**Estratégia índice-free (evita a exigência de índice composto do Firestore)** — o Firestore exige
índice composto ao misturar `==` com range/`orderBy` em outro campo, ou `array-contains`/`in` com
outro filtro. Como o usuário escolhe campos arbitrários, pré-criar esses
índices é inviável — e coleções criadas em runtime não podem sequer ser declaradas em
`firestore.indexes.json`. Por isso:
- **Servidor:** apenas predicados `eq`, servidos por índices single-field automáticos → **nunca**
  exige índice composto. Consultado com
  `limit(MAX_SCAN = 300)`.
- **Memória:** `neq`, ranges (`lt/lte/gt/gte`), `in`, `contains`, `exists`, a **ordenação** e o
  **`limit` final** (cap `MAX_QUERY_LIMIT = 100`) são aplicados sobre a janela varrida — depois da
  materialização, para permitir filtro em caminhos de FK (ex: `client.apelido`).
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

#### Compatibilidade com o sandbox QuickJS — OBRIGATÓRIO

Toda função de expressão é exposta **também** dentro do Step "Script" como `fn.<nome>`, atravessando a
ponte host↔VM do QuickJS (`runScriptSandbox.ts`). Isso impõe restrições **inegociáveis** ao corpo de `call()`:

- **Só valores serializáveis atravessam a ponte:** `string`, `number`, `boolean`, `null`, `Date`, objetos
  e arrays puros desses tipos. Argumentos e retorno passam por `JSON.stringify`/`parse` (com sentinela
  `__date__` para `Date`). **Nunca** retorne `function`, `symbol`, `undefined` aninhado, `Map`/`Set`,
  `RegExp`, `BigInt` ou instâncias de classe — o outro lado receberá `undefined` ou dado corrompido.
- **`call()` é puro e síncrono:** sem I/O, sem `Promise`, sem acesso a estado externo além do `context`
  recebido. Consulta ao banco é responsabilidade do `query(...)` do sandbox, não de uma `fn.*`.
- **Trate a entrada como texto literal, não como código.** O bug histórico do `replace` (usava
  `new RegExp(search)`, fazendo `fn.replace(cpf, ".", "")` apagar a string inteira) veio de interpretar
  um argumento do usuário como regex. Se precisar de regex, exponha-o como parâmetro explícito e separado.
- **Falha via `throw new Error(...)` em PT-BR.** No sandbox, o erro é convertido em rejeição da VM e
  **aborta o Script inteiro** (nenhum output é retornado) — então valide tipos antes de operar.

**Testes de prova são obrigatórios.** Nenhuma função nova de expressão entra sem um teste que a exercite
**dentro do sandbox QuickJS real** (não só chamando `call()` direto). Adicione o caso em
`functions/src/infrastructure/workflow/sandbox/runScriptSandbox.test.ts`, cobrindo: caminho feliz,
travessia de tipos não-triviais (ex: `Date`, objeto, array) e o comportamento de erro. O teste roda com
`npx vitest run functions/src/infrastructure/workflow/sandbox/runScriptSandbox.test.ts` e faz parte do
gate antes do commit.

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
uma: **hidrata o payload** (resolução lazy de FKs, ver abaixo) → avalia a `Condition` → roda os `steps` em ordem (`order`
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
   os `denormalizedFields` do registry); um campo `reference` **substitui** o ID pelo registro
   alvo na própria chave (`event.tarefa.nome`), sem envelope nenhum. FKs múltiplas materializam
   arrays (cap de 50 itens,
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
| Push | `pushes` | `push` |
| Item de Lista (qualquer lookup) | `personTypes`, `caseAreas`, `contractTypes`, `deadlineTypes`, `financialCategories`, etc. (lista fechada em `LOOKUP_COLLECTIONS`) | `lookup` |

Toda entidade tem exatamente dois eventos: `<prefixo>.saved` (criação **ou** atualização — o
motor não distingue as duas) e `<prefixo>.deleted`. O `payload` publicado é `{ id, ...dados_do_documento }`
— os dados de depois da escrita (`saved`) ou de antes (`deleted`), **sem denormalização de FKs**
(a resolução é lazy, na execução — seção "Resolução lazy de FKs").

Toda tela do tenant emite pelo **próprio nome da coleção** (`medico.saved`, `medico.deleted`) — as
fixas mantêm o prefixo declarado no registro para não quebrar automações existentes. As coleções
reservadas do sistema (tags, `members`, `aiConnections`, `workflow_*`, subcoleções `notes`/`documents`)
são ignoradas por denylist (`RESERVED_COLLECTIONS`), sem consultar o cache de telas: o gatilho roda em
toda escrita do tenant e uma leitura extra por escrita sairia cara.

**Catálogo de eventos:** derivado do `ENTITY_REGISTRY` no arquivo compartilhado
`domain/schema/eventCatalog.ts` (fonte em `src/`, cópia gerada em `functions/`) — eventos de
entidade (campos nativos, FKs e caminhos denormalizados derivados de `FkSpec`) ∪ eventos de
sistema declarados (`SYSTEM_EVENTS`: notas/documentos com pai denormalizado do registry, lookup).
`src/domain/services/workflowEventCatalog.ts` é um adapter fino que re-exporta o catálogo — usado
para (1) o seletor de evento na aba Geral, com rótulos em PT-BR (`"Ao salvar: Processo"`) e (2) a
lista de campos do mapping "Do evento". O mesmo catálogo fornece `eventNameToRoot`, a raiz de
navegação usada pelo autocomplete do `ExpressionEditor` e pela hidratação lazy.

**Catálogo por tenant.** `buildWorkflowEventCatalog(ctx)` acrescenta ao catálogo estático um par
`.saved`/`.deleted` por tela do tenant, e é o que popula o seletor de gatilho. Não existe mais um
passo de "escolher a entidade depois de escolher o evento": o gatilho já É a entidade
(`WorkflowDefinition.screenKey` foi removido). `getWorkflowEventFields(eventName, ctx)` devolve os
campos do payload a partir da entidade resolvida — os declarados pelo tenant vêm na raiz, sem
prefixo `values.`/`customValues.` e sem lista dinâmica à parte.

### v1 — implementado vs preparado

**Implementado:** `ActionStep` com Steps reais (`NotifyStep`, `RegisterAuditStep`,
`SetVariableStep`, e depois `MapStep`, `UpsertStep`, `RemoveStep`, `QueryStep`, `ScriptStep`…), execução sequencial fail-fast, publicação automática de
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
motor): `DelayStep`, retry/compensação/rollback, execução síncrona. (`ScriptStep` e
`SubWorkflowStep` já são reais; a ramificação de fluxo — `StepCondition` — é nativa do motor,
ver abaixo.)

### StepCondition — ramificação de fluxo (nó de controle nativo)

Além da condição de gatilho (avaliada uma vez, antes de qualquer Step), um Workflow pode ramificar
o fluxo no meio da sequência com um **StepCondition**: um Step de `type: 'Condition'` que **não é
um plugin do `StepRegistry`** (não tem `StepDefinitionSummary`, `stepDefinitionId` fica vazio) e sim
um nó de controle tratado nativamente pelo `WorkflowExecutor`. Ele carrega uma `Condition` (reusa o
mesmo tipo e o mesmo `ConditionEvaluator` da condição de gatilho) e dois ramos:
`branches.whenTrue` e `branches.whenFalse`, cada um uma **sequência recursiva de Steps** (que pode
conter outros StepCondition — aninhamento livre).

**Modelo de dados** (`WorkflowStep` em `src/domain/entities/Workflow.ts` e a cópia manual em
`functions/src/domain/entities/Workflow.ts` — este arquivo **não** está no `sync-schemas.cjs`):
campos opcionais `condition?: Condition` e `branches?: { whenTrue: WorkflowStep[]; whenFalse:
WorkflowStep[] }`, usados só quando `type === 'Condition'`. Persiste na mesma coleção via
`updateWorkflowSteps` (árvore inteira; `branches` são arrays de objetos — permitido no Firestore,
não há array-de-array). Nenhuma coleção nova nem regra de segurança alterada.

**Execução** (`functions/src/domain/engine/WorkflowExecutor.ts`): o antigo laço plano virou
`executeSteps(steps, lastStepId)` recursiva. Por nível: `filter(enabled).sort(order)`. Ao encontrar
um nó `Condition`, monta `context.input` (mesmo flatten das saídas acumuladas dos demais Steps),
avalia `evaluateCondition(step.condition, context)` (erro → log `ERROR` e falha), registra um log
`INFO` (com o `stepId` do nó, o booleano e o ramo tomado — aparece na aba Execuções) e **recorre no
ramo escolhido**; ao retornar, o fluxo **converge** para os Steps seguintes do nível. Só Steps
efetivamente executados escrevem em `context.outputs`; os outputs finais do workflow são os do
**último Step executado na travessia** (rastreado por `lastStepId`).

**Escopo de outputs por caminho:** o intellisense de "Saída de outro step" (`priorSteps` em
`EditWorkflowStep`) passou a ser calculado por `collectPriorSteps(rootSteps, targetId)` em
`src/presentation/shared/workflowHelpers.ts`: do nó-alvo até a raiz, coleta os irmãos anteriores em
cada nível (e os anteriores a cada Condição ancestral), **excluindo o outro ramo** e os próprios nós
de Condição (que não produzem output). Para um Step ainda não inserido, `collectPriorStepsForInsert`
faz o equivalente a partir do alvo de inserção. O `ConditionBuilder` ganhou props opcionais
(`stepOutputFields`/`workflowVariables`/`inputRoot`) para que expressões de um StepCondition
enxerguem as saídas dos Steps anteriores (ex.: decidir com base no resultado de um Script:
`output.aprovado == true`).

**UI** (`ViewWorkflow`): grafo e lista renderizam a árvore recursivamente (`FlowLevel`/`ListLevel`
em `ViewWorkflow.view.tsx`); o nó Condição abre duas raias "Verdadeiro"/"Falso" (tokens
`theme.colors.success`/`warning`) com botões de adicionar Step/Condição por ramo. O drag & drop
reordena **dentro do mesmo ramo** (identificado por `parentKey`). Toda a manipulação da árvore
(flatten/find/update/remove/insert/move/reorder) vive em funções puras em `workflowHelpers.ts`.
Excluir um nó Condição remove seus ramos em cascata. `EditWorkflowStep` edita `step.condition` com o
`ConditionBuilder` quando o Step é do tipo Condição. A coleta e o remapeamento de Scripts/SubWorkflows
(usados no empacotamento/instalação de extensões) percorrem a árvore via `flattenSteps`/`mapStepTree`
(`functions/src/domain/services/stepTree.ts`).

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

### Step "Encerrar Workflow" (`exit`) — saída antecipada

Step sem inputs e sem outputs (`configurable: false`) que **interrompe a execução no ponto em que
está**. O retorno do workflow passa a ser o que ele já seria naquele instante: as saídas do **Step
executado imediatamente antes**. Não existe "Step que declara a saída" — quem define o retorno é
sempre o último Step da travessia (`context.outputs[run.lastStepId]`); o `exit` apenas antecipa esse
fim. Para montar o objeto de retorno, use "Montar Objeto" (`map`) antes dele.

**Mecânica.** `WorkflowResult` ganhou `halt?: boolean`. Quando um executor devolve `halt`, o
`executeSteps` retorna `{ ok: true, halted: true }` **sem mover o `lastStepId`** (o Step de
encerramento não produz saída própria), e o flag sobe pela recursão: um ramo de `StepCondition`
propaga imediatamente sem executar os Steps após a condição, e um corpo de `Loop` interrompe as
iterações restantes **sem agregar** o vetor de `outputName` e **sem limpar** `context.outputs` do
corpo — justamente porque o retorno vem de um Step de dentro do corpo. `halt` é um contrato genérico
do executor, não um caso especial do Step `exit`: qualquer Step futuro pode encerrar o fluxo.

**Design-time (IntelliSense do "Chamar Workflow").** Para saber o que um workflow-alvo devolve, o
editor não procura mais um Step de saída nomeado. `returningStepsOf`
(`presentation/shared/workflowHelpers.ts`, com testes) reproduz a regra do motor: os candidatos são
os Steps anteriores a cada `exit` (um por ramo) ou, se não houver nenhum `exit`, o último Step do
nível raiz — expandindo nós de `Condition` nos terminais de cada ramo, já que eles não têm saída
própria. Dois detalhes que **precisam** espelhar o executor, e por isso têm teste-irmão em
`WorkflowExecutor.test.ts`: um `exit` na primeira posição de um ramo ou do corpo de um Loop tem como
"Step anterior" o último Step do nível de cima (o `incomingLastStepId` do executor), e um `exit` sem
nenhum Step anterior devolve **vazio** — não cai no fallback do último Step do fluxo, porque em
runtime esse Step nunca chega a executar.

As saídas dos candidatos são resolvidas por `localStepOutputs`, uma versão de `resolveStepOutputs`
**sem** `from-target-workflow-outputs`: a separação é o que impede recursão infinita quando um
workflow chama outro que também chama workflow.

> **Descontinuado:** o Step `output` ("Saída do Workflow"), que emitia um par nome-valor, foi
> removido — o `MapStep` sem nome faz o mesmo com N campos de uma vez e com builder visual.
> Workflows salvos que ainda o referenciem falham com "StepDefinition desconhecida" e precisam ser
> editados.

### Step "Script" — código do usuário em sandbox QuickJS

O Step `script` executa **código JavaScript do usuário** dentro de um sandbox **QuickJS-Emscripten** (WebAssembly). Todo código é tratado como **hostil por padrão**: sem acesso ao Firebase Admin SDK, rede, filesystem ou credenciais do host.

**Entidade `Script` (reutilizável e desacoplada do Workflow).** Vive em `tenants/{tenantId}/scripts/{id}` — feature administrativa, como `WorkflowDefinition`. Não entra no `ENTITY_REGISTRY` (não é event-triggerable/referenciável). Campos: `inputParams: WorkflowParameter[]` e `outputParams: ScriptOutputParam[]` (só para ergonomia/IntelliSense do editor de Steps), `sourceTs` (editado) e `compiledJs` (executado). A transpilação TS→JS acontece **no frontend, ao salvar** (via `sucrase`), rejeitando `import`/`export`/`require`; a Cloud Function nunca transpila — só executa `compiledJs`.

**O Step espelha o padrão "Chamar Workflow".** Input estático `scriptId` (Literal) + `dynamicInputs: { kind: 'from-target-script-parameters' }` (que expõe os `inputParams` do Script como inputs `param.<chave>`) e `dynamicOutputs: { kind: 'from-target-script-outputs' }` (que expõe os `outputParams` como saídas para o IntelliSense dos Steps seguintes). Essas duas variantes de metadata são espelhadas manualmente em `functions/src/domain/engine/StepDefinition.ts` **e** `src/domain/entities/WorkflowStepCatalog.ts`.

**Sandbox — `functions/src/infrastructure/workflow/sandbox/runScriptSandbox.ts`** (fronteira única de segurança; o `compiledJs` é não-confiável mesmo transpilado no cliente):
- **Least privilege:** no sandbox só existem `input` (params mapeados via `resolveMapping`), `fn.*` (todas as funções de expressão síncronas), `log(...)` e as funções de dados assíncronas `query(...)`, `upsert(...)` e `remove(...)`. Sem `import`/`require`/`fetch`/`process`/`fs` (inexistentes no QuickJS; ainda assim rejeitados na validação de save).
- **Limites por execução:** `setMemoryLimit` (~32MB), `setMaxStackSize`, `setInterruptHandler(shouldInterruptAfterDeadline(~3s))` renovado a cada rajada síncrona (interrompe loops infinitos) e um **deadline total de parede (~10s)** que cobre também as esperas assíncronas do `query` — ambos bem abaixo do timeout da function.
- **Escopo de tenant:** sempre `context.execution.tenantId` (não forjável pelo script).
- **Memória:** todo handle do QuickJS tem `.dispose()` garantido em `finally`; o módulo WASM é cacheado entre invocações.
- **Marshalling Host↔VM:** JSON com sentinela `{ __date__: ms }` preserva `Date` nos dois sentidos, para que as funções de data em `fn.*` funcionem corretamente.

**Ponte de consulta `query(spec)` (assíncrona).** O global `query` aceita um `QuerySpec` (`{ table, where:[{path,op,value}], orderBy?, limit, projections }`, mesmo formato do Step "Buscar Registros") e devolve `{ count, results, first }`. Reúsa **integralmente** o pipeline do QueryStep, extraído para `functions/src/infrastructure/workflow/query/runWorkflowQuery.ts` (validação, `queryByEquality` enraizado em `tenants/{tenantId}/…`, hidratação de projeções, predicados em memória, ordenação e `limit`); a ponte apenas envolve cada `where[].value` como `InputMapping` `Literal`. Segurança: escopo por `context.execution.tenantId` (nunca vindo do script), teto de `MAX_QUERIES` consultas por execução, e o deadline total acima. Implementação com `vm.newPromise()` + um loop de bombeamento que intercala `executePendingJobs()` com o `await` das consultas em voo.

O script do usuário retorna um objeto (ex.: `main()` no final) que vira os `outputs` do Step. Deps novas: `quickjs-emscripten` (functions) e `sucrase` (frontend). Registro do Step em `registerSteps.ts` + `container.ts` (recebe `IScriptRepository` e os repositórios de query já existentes).

---

### Passos de dados de escrita "Gravar Registro" (Upsert) e "Excluir Registro" (Remove)

Contraparte de escrita do Step "Buscar Registros" e da ponte `query`. Permitem que uma automação
**inclua/atualize** (`upsert`) e **exclua** (`remove`) registros de **qualquer entidade** — fixa
(`persons`, `cases`…), de tela do Form Design/extensão (`medico`) — e de **listas** (lookups). Núcleo compartilhado em
`functions/src/infrastructure/workflow/mutation/runWorkflowMutation.ts`
(`runWorkflowUpsert`/`runWorkflowRemove`), sobre `IWorkflowMutationRepository`
(`FirestoreWorkflowMutationRepository`).

- **Escopo de escrita (DENYLIST)** — `src/domain/schema/mutationSpec.ts` (`resolveWritableTable`):
  **bloqueados** `members` (papéis/permissões), `pushes` e `news` (infra). Todo o resto é gravável,
  inclusive uma tela criada agora — a inversão de allowlist para denylist é o que torna o modelo
  extensível sem tocar no kernel.
- **Segurança de tenant** — o `tenantId` vem **sempre** de `context.execution.tenantId`; o `spec`
  nunca o contém. Não há mais guarda de "registro de outra tela": a coleção isola por construção.
- **Validação** — `validateUpsertSpec` achata o `data` em caminhos e valida cada um com
  `resolvePath` (rejeita campos desconhecidos, campos gerenciados pelo sistema — `id`, timestamps,
  autoria — e escrita "através" de referência). **Todas** as tabelas gravam os campos na raiz;
  listas gravam `key`/`label`/`color`. `upsert` sem `id` inclui (com `createdBy: 'workflow-engine'`
  + timestamps); com `id` existente faz merge.
- **Eventos** — como a escrita é um `set`/`delete` em `tenants/{tenantId}/{coleção}/{doc}`, os
  eventos `*.saved`/`*.deleted` são emitidos **automaticamente** pelo trigger
  `publishWorkflowEventOnEntityChange`; nenhuma emissão manual. **Sem cascata** (ver "Cascata de
  Exclusão").
- **Config no editor** — novos `InputType` `'Upsert'`/`'Remove'` (espelhados em
  `StepDefinition.ts` e `WorkflowStepCatalog.ts`), com editores dedicados `UpsertBuilderControl`/
  `RemoveBuilderControl` (padrão `QueryBuilderControl`). O executor de cada Step resolve os
  `InputMapping` da config em valores literais antes de chamar o núcleo.

**Ponte no Script — `upsert(spec)` / `remove(spec)`.** Mesmo padrão assíncrono de `query` em
`runScriptSandbox.ts` (deferred + bombeamento), com teto `MAX_MUTATIONS` por execução. `upsert`
recebe `{ table, id?, data }` → `{ id, created, record }`; `remove` recebe `{ table, id }` →
`{ id, removed }`. Documentadas para o usuário na tela **"Funções de Dados"**
(`presentation/pages/DataFunctionReference`, chave `data-function-reference`, aberta pelo botão no
editor de Script) e no IntelliSense do editor (`scriptTypeDefs.ts`).

---

> **Compartilhamento de workflows.** Não existe compartilhamento direto de workflow entre escritórios:
> todo workflow é **privado ao tenant**, no mesmo modelo de Scripts e Actions. Para distribuir um
> workflow a outro escritório, crie uma **Extensão** selecionando apenas esse workflow — o
> empacotamento/instalação de extensões é o único canal de compartilhamento. Ver "Plataforma de
> Plugins".

---

## Plataforma de Plugins

Camada que transforma a Microteia de um sistema configurável em uma **plataforma extensível**, no
modelo do AppExchange/Odoo: toda funcionalidade — inclusive as que hoje moram no núcleo — chega por
**contribuição declarada em um Manifest**, e o Kernel nunca conhece um plugin pelo nome.

> **Status:** Etapas 0 a 3 concluídas. A interface **e** o motor de automações já chegam por
> contribuição de plugin. Ver "Etapas" ao final desta seção.
>
> ⚠️ A Etapa 3 mexe em `functions/` — exige `npm run deploy:workflow` para valer em produção.

### Os dez princípios

1. O Kernel nunca conhece plugins. 2. Plugins nunca alteram o Kernel. 3. Toda funcionalidade é
registrada por Contribution. 4. Tudo é baseado em interfaces. 5. O ciclo de vida cobre instalar,
atualizar, desativar e remover. 6. Todo plugin é isolado. 7. Toda API é tipada. 8. Todo registro
ocorre por Manifest. 9. Metadata antes de código. 10. Nenhuma decisão pode impedir um Marketplace
com milhares de plugins.

### O gabarito obrigatório

Toda funcionalidade nova — do núcleo ou de terceiro — responde antes de ser escrita: como é
registrada no Kernel; quais Extension Points usa; quais Capabilities fornece; quais consome; como é
instalada; como é removida; como é versionada; como evita acoplamento; como funciona no Marketplace.

### Metadata separada de implementação

O padrão já provado pelo Workflow Engine (`StepDefinitionSummary` serializável no cliente vs
`StepDefinition.createExecutor` só em `functions/`) vira a regra geral. Uma `Contribution` carrega
`metadata` 100% serializável e, opcionalmente, uma `ImplRef` que aponta para a implementação:

| `impl.kind` | O que é | Quem pode usar |
|---|---|---|
| `code` | Função/componente compilado no bundle, resolvido por chave no `ImplementationRegistry` | **Só plugins first-party** |
| `script` | Script do usuário no sandbox QuickJS já existente | Qualquer plugin |
| `widget` | Árvore declarativa renderizada pelo Kernel (Widget DSL) | Qualquer plugin |
| `workflow` | Workflow do tenant | Qualquer plugin |

`code` é o único que executa JavaScript arbitrário e por isso é **privilégio de plugin interno** —
é essa linha que permite centenas de plugins de terceiros sem revisar JS, sem CSP exótica e sem
sandbox de browser. `isTrustedOnlyImplKind` e a flag `trusted` de `validatePluginManifest`
implementam a regra.

### Contratos — `domain/schema/plugin/` (sincronizado para `functions/`)

Arquivos **compartilhados**: fonte única em `src/domain/schema/plugin/`, cópias geradas por
`npm run sync-schemas`. Nunca edite as cópias.

| Arquivo | Contrato |
|---|---|
| `semver.ts` | Parse/comparação/faixas semver sem dependência externa. Suporta `*`, `=`, `^`, `~`, `>`, `>=`, `<`, `<=` e conjunção separada por espaço |
| `diagnostics.ts` | `PluginDiagnostic` — canal único de erro/aviso. Validador **nunca lança** |
| `permission.ts` | `dominio:recurso:acao` (ou `dominio:acao`), com curinga. Domínios: `data`, `workflow`, `script`, `capability`, `ui`, `net` |
| `capability.ts` | `CapabilityProvision`/`CapabilityRequirement` e `selectProvider` — múltiplos provedores para a mesma capability |
| `extensionPoint.ts` | `ExtensionPointDefinition` + compatibilidade de `apiVersion` |
| `contribution.ts` | `Contribution`, `ImplRef` e a **ordenação determinística** |
| `pluginManifest.ts` | `PluginManifest` + `validatePluginManifest` |
| `kernelVersion.ts` | `KERNEL_VERSION` — versão do contrato Kernel↔plugins |

### Versionamento em três eixos — não confundir

| Eixo | Onde | Sobe quando |
|---|---|---|
| Versão do produto | `package.json` / `VERSIONS.md` | Toda release, pela regra de commit |
| `KERNEL_VERSION` | `kernelVersion.ts` | Major: um Extension Point muda de forma incompatível. Minor: algo é adicionado |
| `apiVersion` do ponto | cada `ExtensionPointDefinition` | Contrato daquele ponto específico |

Um manifest declara `kernel: '^1.0.0'`; cada contribuição declara a `apiVersion` do contrato contra
o qual foi escrita. `isApiVersionCompatible(contribuição, ponto)` aceita um ponto que evoluiu
aditivamente (contribuição `1.0.0` roda em ponto `1.4.2`) e recusa major diferente **ou**
contribuição que exija contrato mais novo que o instalado.

### Falha isolada, nunca fatal

Nenhum validador lança. Manifest malformado, ponto desconhecido, versão incompatível ou
implementação proibida viram `PluginDiagnostic` com `code` e `path` — a contribuição é descartada e
**as demais do mesmo plugin continuam válidas**. Com centenas de plugins instalados, um plugin
quebrado não pode derrubar o boot.

### Ordenação determinística — não é detalhe

`compareContributions` ordena por prioridade (maior primeiro), depois `pluginId`, depois `id`, todos
alfabéticos. **Nunca** a ordem de carregamento: com centenas de plugins, depender de quem registrou
primeiro tornaria a ordem do menu e o vencedor de qualquer conflito não-determinístico entre um boot
e outro. `selectProvider` segue a mesma regra, com a vinculação explícita do escritório vencendo
sempre a prioridade.

### Isolamento de dados

Plugin declara telas como qualquer outra origem — cada uma vira sua coleção, marcando os
artefatos com `ownerPluginId` e `managed: true` (bloqueia edição pelo usuário no Form Design). A
consequência é que plugin novo **nunca exige deploy de `firestore.rules`**, e o dado do plugin herda
⌘K, auditoria, workflow, filtros e agregados sem nenhum código adicional.

### Runtime — `kernel/` (sincronizado para `functions/`)

O Kernel é **puro**: sem React, sem Firebase, sem styled-components, sem conhecer nenhuma camada
do app. Por isso os mesmos arquivos servem os dois runtimes — a fonte vive em `src/kernel/` e
`npm run sync-schemas` gera a cópia em `functions/src/kernel/`, como já acontece com o schema.

| Arquivo | Responsabilidade |
|---|---|
| `ExtensionPointRegistry.ts` | Pontos declarados. Só o dono redeclara o próprio ponto; outro plugin tentando sequestrá-lo é recusado |
| `ContributionRegistry.ts` | Índice por ponto, com consulta **memoizada** e ordenação determinística |
| `ImplementationRegistry.ts` | Tabela `impl: code` dos plugins internos, isolada por plugin |
| `CapabilityRegistry.ts` | Provedores por capability, resolvidos por `selectProvider` |
| `PluginHost.ts` | Composition root: valida, resolve dependências, registra tudo |

Todos são **factories** (`createXxxRegistry()`), não classes nem singletons — cada host tem o seu
mundo, o que torna teste e multi-tenant triviais.

### `PluginHost.load` — carga como reconstrução total

`load(records)` **substitui o mundo inteiro**: zera os quatro registries e reconstrói. Não existe
`unload` — desinstalar é `load` sem aquele registro. Uma entrada só, um caminho de código só, e a
garantia de que não sobra rastro de um plugin removido (contribuição, ponto, implementação ou
provimento de capability).

A carga tem cinco fases, nesta ordem:

1. **Deduplicação** — o mesmo `id` duas vezes: a segunda é ignorada (`manifest.duplicate`).
2. **Validação do manifest** — sem validar contribuições ainda (os pontos não existem). Erro aqui
   descarta o plugin inteiro.
3. **Dependências** — laço de ponto fixo que remove quem tem dependência ausente
   (`dependency.missing`), incompatível (`dependency.unsatisfied`) ou que não carregou
   (`dependency.disabled`) — **propagando em cascata** até estabilizar.
4. **Ordem topológica (Kahn)** — dependência antes de dependente. O que sobra fora da ordem está em
   um ciclo, ou depende de alguém que está: sai com `dependency.cycle`. A fila é reordenada
   alfabeticamente a cada passo, então a ordem final não depende da ordem de entrada.
5. **Registro** — pontos primeiro (para que um plugin possa contribuir a um ponto declarado por
   outro), depois implementações, depois contribuições, depois capabilities.

### Granularidade da falha — manifest vs. contribuição

`PluginDiagnostic.contributionIndex` é o que separa os dois níveis: diagnóstico **com** índice
descarta apenas aquela contribuição; **sem** índice descarta o plugin. É por isso que um plugin com
uma contribuição para um ponto inexistente continua carregando, com as outras funcionando. O
`contributionId` não serviria para isso — ele pode ser justamente o campo inválido.

### Conflitos são avisos, nunca exceções

Ponto com `multiple: false` recebendo mais de uma contribuição gera `contribution.conflict`
(**warning**), e vence a primeira da ordenação determinística. Capability exigida e não fornecida
gera `capability.unsatisfied` (**warning**) — o plugin carrega mesmo assim, porque a integração pode
ser instalada depois. Só erro impede carga.

### Binding React — `stores/KernelContext.tsx` + `stores/useKernel.ts`

Segue a separação obrigatória do projeto: o `.tsx` exporta **apenas** o `KernelProvider`; o `.ts`
exporta o Context, os tipos e os hooks `useKernel`, `useContributions`, `useContribution`,
`useCapability`, `useImplementation` e `usePluginDiagnostics`. `useContributions` devolve
**referência estável** entre renders (a memoização do `ContributionRegistry`), então usar o
resultado em dependência de `useMemo`/`useEffect` não causa loop.

### A UI como contribuição — `plugins/` (Etapa 2)

Não existe mais `pageRegistry.tsx` nem `CommandPaletteRegistry.ts`. Telas, itens de menu e
provedores do ⌘K são **contribuições** de 12 plugins internos.

| Ponto | Metadata | `impl` |
|---|---|---|
| `ui.page` | `key`, `keyPrefix`, `title`, `icon`, `fullBleed`, `requiredRole` | `code` (lazy) ou `widget` |
| `ui.nav` | `key`, `label`, `icon`, `order`, `requiresTenantAdmin` | nenhuma |
| `ui.command` | `group` | `code` |

Contratos em `presentation/shared/uiExtensionPoints.ts` — **terreno neutro de propósito**: plugin
não importa outro plugin, e tanto os plugins quanto o shell dependem só dessa definição.

**`icon` é uma chave de `screenIcons`, nunca um componente.** Foi o que manteve a metadata
serializável (requisito para viajar até o Marketplace) e consolidou os ícones das telas fixas no
mesmo conjunto curado que as telas dinâmicas já usavam.

**Composition root:** `plugins/index.ts` é o único arquivo do app que conhece a lista de plugins.
Remover uma linha dali remove a tela, o item de menu e os comandos daquele módulo.

**Ordem do menu é `metadata.order`, não a ordem das contribuições.** As telas dinâmicas do
escritório entram com `DYNAMIC_SCREEN_NAV_ORDER = 100`, entre os cadastros (10..90) e a
administração (110+) — substituindo o `splice` que antes procurava o índice de `tenant-settings`.

**Resolução de aba** (`presentation/shared/resolveUiContributions.ts`, função pura e testada):
chave exata primeiro, depois **o prefixo mais longo**. O critério de comprimento é o que faz
`new-person:clone:abc` cair em `new-person:clone:` e não em `new-person:` — sem ele, o vencedor
dependeria da ordem de registro.

**Id de contribuição de tela paramétrica leva o sufixo `-prefix`.** O slug de `tenant-settings:`
seria idêntico ao de `tenant-settings`, e a segunda contribuição era descartada como duplicada —
com a tela sumindo em silêncio. Quem pegou foi o teste de paridade.

### Carregamento sob demanda

Toda `impl` de tela é um `React.lazy` (`lazyView` em `plugins/contributionBuilders.ts`), e o
`WorkspacePanelNode` envolve a tela num `Suspense`. Isso não é só otimização: um manifest precisa
poder ser **lido sem arrastar o código da tela junto**, senão o Marketplace com centenas de plugins
carregaria tudo no boot. Efeito medido no bundle principal: **3,39 MB → 1,15 MB** (327 KB gzip),
com os chunks passando de 96 para 180.

### O motor de automações como contribuição — `functions/src/plugins/` (Etapa 3)

`registerSteps.ts` não existe mais, e o `ExpressionEngine` não importa mais 53 funções uma a uma.

| Ponto | Metadata | `impl` |
|---|---|---|
| `workflow.step` | `stepDefinitionId`, `name`, `category` | `code` → `StepFactory` |
| `expression.function` | `name`, `category`, `minArgs`, `maxArgs` | `code` → `ExpressionFunction` |

Três plugins: `core.workflow` (declara os pontos), `core.steps` (12 passos) e `core.expressions`
(53 funções). Composition root em `functions/src/plugins/index.ts`.

**Step é fábrica, não objeto pronto.** `StepFactory = (deps: RegisterStepsDeps) => StepDefinition`:
quem contribui declara a fábrica, e `registerStepsFromPlugins` injeta os repositórios na carga. As
deps vivem em `infrastructure/workflow/stepDeps.ts`, arquivo próprio — se estivessem no loader, o
manifest não poderia tipá-las sem fechar um ciclo.

**A metadata da função é derivada do próprio objeto.** `description`, `signature` e `example` já
vivem no `ExpressionFunction` e alimentam a tela de referência; repeti-los no manifest criaria duas
verdades. O manifest declara só o que o Kernel precisa para raciocinar sem carregar código.

O `WorkflowExecutor`, o `StepRegistry` e os handlers de catálogo **não mudaram**: o `stepRegistry`
continua sendo o índice que o executor consulta; o que virou orientado a dados foi quem o popula.

### Carga de plugins ciente do tenant — o que ativa um plugin instalado

O host do Kernel do topo do `App` (`KernelProvider records={CORE_PLUGINS}`) é o **host base**: serve
o `resolveService` do DI e as rotas públicas, acima do tenant. Sozinho, ele nunca vê o que um
escritório instalou.

`stores/TenantKernelProvider.tsx` resolve isso com **override de contexto React**: dentro do tenant,
envolvendo `<WorkspaceShell />`, ele renderiza um **segundo** `KernelProvider` com
`records = [...CORE_PLUGINS, ...instalados]`. Como os dois usam o mesmo `KernelContext`, a instância
interna vence para a subárvore do workspace — barra lateral, páginas e ⌘K leem as contribuições
**dela**. O DI, acima, continua no host base. Nenhuma mudança no Kernel; só aninhamento.

`installedPluginRecords(catalog, installations)` (`domain/usecases/plugins/`, puro e testado)
computa os `PluginRecord` a partir de `(instalação habilitada ∩ catálogo)`, sempre `trusted: false`.
Consequências:

- **Contribuição de UI de plugin instalado não é persistida.** É derivada; ativar/desativar liga e
  desliga o menu e as páginas ao vivo, sem gravar nada. (Workflow continua materializado — é estado;
  UI é função do que está instalado.)
- **Terceiro nunca roda `code`.** `trusted: false` faz o `PluginHost` recusar `impl: code`; só
  `widget`/`workflow`/`nav` passam. Uma página de plugin instalado é sempre Widget DSL.
- **Instalação órfã** (manifest sumiu do catálogo por despublicação) é ignorada.

O plugin de exemplo `com.microteia.guia` prova o caminho: seu manifest contribui `ui.nav` + uma
`ui.page` de widget; instalar faz "Guia" aparecer no menu e a página renderizar pelo `WidgetRenderer`
— sem uma linha de código do plugin no browser. (O `com.microteia.boas-vindas` cobre o outro
mecanismo, materialização de workflow.)

**Limitação registrada:** o `resolveService` do DI usa o host base, então um `data.service` de plugin
instalado não é resolvido — sem consumidor hoje; a evolução é o DI ler o host de tenant.

### Widget DSL — tela declarativa sem JS de plugin (Etapa 6)

Um plugin de terceiro só contribui `script`/`widget`/`workflow` (nunca `code`). O **Widget DSL** é
o que permite `widget`: uma descrição **serializável** de uma tela que o Kernel renderiza usando os
próprios componentes do Microteia — zero `dangerouslySetInnerHTML`, zero `eval`, cor só via tema.

**`WidgetSpec`** (`presentation/shared/widget/widgetSpec.ts`) é uma união discriminada por `type`.
v1 (estática, sem ligação a dados): `stack`, `grid`, `heading`, `text`, `markdown`, `metric`,
`keyValue`, `banner`, `divider`. Adicionar um nó é aditivo.

**`WidgetRenderer`** (`components/ui/WidgetRenderer/`) percorre a árvore recursivamente. **Nó
desconhecido é ignorado, não derruba a tela** — um plugin escrito para uma versão mais nova do DSL
degrada em vez de quebrar (há teste). Cada nó vira um componente já existente (`InfoBanner`,
`MarkdownContent`, styled-components com tokens).

**Ligado no caminho de página.** `useResolvePage` já trata `impl: { kind: 'widget', spec }`:
devolve um componente que renderiza `<WidgetRenderer spec={...} />`. Então, assim que um plugin
instalado puder contribuir para o host (carga por tenant, pendente), uma tela `ui.page` de widget
aparece como qualquer outra — o caminho está pronto.

**Provado no app** pela tela **Extensões**: cada plugin com `overview` (um `WidgetSpec`) ganha um
"Ver detalhes" que abre um modal renderizado pelo `WidgetRenderer`. Consumidor real, clicável, sem
depender da carga por tenant.

**Falta para o Widget DSL completo:** ligação a dados (`source: query:/script:/field:`) e `when` por
expressão — o que torna um widget dinâmico, não só descritivo.

### Integridade do Marketplace — publicar válido e ver por que falhou

Duas guardas que fecham buracos da carga por tenant:

**Validação na publicação** (`domain/usecases/plugins/PublishPluginUseCase.ts`). Publicar agora roda
`validatePluginManifest` **antes** de gravar no registro, contra os pontos e a versão do kernel em
execução, com `trusted: false` — exatamente como o plugin vai rodar nos escritórios. Manifest com id
inválido, kernel incompatível, contribuição para ponto inexistente ou tentativa de `impl: code` (JS
compilado de terceiro) é **recusado, sem gravar**. Sem isso, um admin publicaria um plugin que
falharia em todos os tenants. O `PluginStore` valida usando `host.points.snapshot()` do host base.

**Visibilidade de falha de carga.** Um plugin instalado que não carrega (ex.: incompatível) antes
sumia em silêncio. Agora o `Marketplace.viewmodel` cruza `host.isLoaded(pluginId)` com
`result.diagnostics` do host de tenant: se o plugin está instalado e habilitado mas **não** carregou,
o card mostra "Esta extensão não pôde ser carregada: <motivo>". `usePluginDiagnostics()` já existia;
aqui ele ganha consumidor.

### Registro global do Marketplace (Etapa 7 — spine)

O catálogo deixou de ser só código: uma coleção-raiz `plugin_registry` guarda os plugins
publicados (qualquer autenticado LÊ; só a equipe global publica).

| | Leitura | Escrita |
|---|---|---|
| `plugin_registry/{pluginId}` | qualquer autenticado | só `isSystemAdmin()` (equipe global) |

**Marketplace curado, v1.** Publicar é escrita de cliente gated a SYSTEM — a equipe Microteia
curadora, não o admin do tenant. Precisa apenas de `deploy:rules`, sem Cloud Function nem service
account. A evolução para marketplace aberto (revisão + publish via Admin SDK) é trocar a regra e a
porta de escrita, sem mexer no resto.

**Catálogo mostrado = publicados ∪ embutidos**, deduplicados por id, o publicado vencendo
(`domain/usecases/plugins/mergeCatalog.ts`, puro e testado). Os plugins **embutidos**
(`plugins/marketplace/catalog.ts`) vêm no bundle e são o ponto de partida; o **registro** é o que
permite adicionar um plugin **sem deploy do frontend**. Publicar um embutido prova o ciclo:
o card passa de "Interna" para "Publicada" e a partir dali vem do Firestore. O `PluginStore` assina
`plugin_registry` (global, independente de tenant) e expõe `publish`/`unpublish` para SYSTEM.

O que falta para a Etapa 7 completa: versões por plugin (`versions/{semver}`) e um fluxo de publish
de verdade (formulário/validação de manifest).

### Extensões que carregam módulos de domínio (Fase 1)

Uma extensão traz um MÓDULO completo — entidades com campos, máscara, validação, expressões,
relacionamentos, cálculos, master-detail — reusando **inteiramente** o sistema de Telas Dinâmicas.
`ScreenDefinition`/`FieldDefinition` já expressam tudo (`logic.compute`, `logic.onChange`,
`aggregation`, `refEntity`, `parentEntity`); os gaps eram só empacotamento e marcação.

- `MarketplacePlugin.screens: ScreenModuleTemplate[]` — telas autorais com `key` de template.
- `ownerPluginId`/`managed` em `ScreenDefinition`; `ownerPluginId` em `FieldDefinition`.
- **Materialização** (`domain/usecases/plugins/screenModule.ts`, puro): a tela instala **na chave que
  o pacote declara** (`produtos`), não numa chave namespaced por plugin. A chave É o nome da coleção
  (`tenants/{tenantId}/produtos`), então ela é a *interface* da entidade: aparece no código da
  extensão, nos stores e nas consultas. Materializar reescreve as referências entre telas do pacote
  (`refEntity`/`parentEntity`/`aggregation.from`) pelo `screenKeyMap`; ref a coleção fixa (`persons`)
  fica intacta. Instalar faz `upsert` das telas gerenciadas; desinstalar apaga as telas com aquele
  `ownerPluginId` e **preserva os registros** (dados órfãos) — a chave é estável, então reinstalar cai
  na mesma coleção e os registros voltam a aparecer.
- **Resolução da chave — `installedScreenKey(templateKey, taken)`.** Ordem: (1) já existe tela de
  mesmo `sourceId`? usa a chave DELA (dedup, e instalação antiga em chave longa fica onde está);
  (2) senão reivindica a chave declarada; (3) se o nome estiver ocupado — outra tela, **lista de
  opções** ou **conjunto de etiquetas**, que disputam o mesmo espaço de nomes — ou for
  `RESERVED_COLLECTIONS`, ganha sufixo via `ensureUniqueKey`: `produtos` → `produtos_2`. É a mesma
  convenção do Form Design, e o resultado é sempre um nome válido por `COLLECTION_NAME_PATTERN` (o
  esquema antigo, com hífens, não era). `buildScreenKeyMap` acumula as chaves reivindicadas para que
  duas telas do mesmo pacote não disputem uma só.
- **Tela ADOTADA — a desinstalação DEVOLVE, não apaga** (`isAdoptedScreen`/`handBackScreen`): quando
  a deduplicação por `sourceId` encontra no tenant uma tela que **não** nasceu de extensão (Form
  Design ou kernel), a instalação reusa a chave dela **e preserva o `origin`** (`design`/`builtin`) e
  o `managed` — a tela continua sendo do tenant, só ganha a extensão no conjunto de donos. Ao sair o
  último dono, a tela **não** é excluída: a extensão sai dos donos, `managed` volta a `false` e os
  campos que ela trouxe passam a `origin: 'design'`. Apagá-la perderia a **chave da coleção** e, com
  ela, o vínculo dos registros — foi o bug do ciclo "criar no Form Design → exportar → importar →
  desinstalar → reinstalar". Enquanto houver dono, a exclusão pelo Form Design é bloqueada por
  **ownership** (não por `origin`) no `DeleteScreenDefinitionUseCase`.
- **Complemento de tela (`screenPatches`) — estender o que já existe.** Um pacote nem sempre traz uma
  entidade nova: ele pode acrescentar campos a uma tela que já existe no destino (um campo `crm` em
  `persons`, ou um campo numa tela de outra extensão). Uma `ScreenModuleTemplate` não serve para isso
  — ela é a tela INTEIRA, e instalá-la sobrescreveria rótulos, ícone e ações da tela de destino e a
  reivindicaria como da extensão. O `ScreenPatchTemplate` declara só `{ target, targetKind, fields }`:
  - **Alvo universal.** `targetKind: 'collection'` para tela do kernel (`persons` — o nome é igual em
    todo escritório); `'sourceId'` para tela de outra extensão, cuja chave instalada varia. Nome de
    tela do tenant de destino não é alvo válido (não é conhecido no pacote) e o `validatePackage`
    recusa, assim como recusa alvo que seja tela do PRÓPRIO pacote (aí os campos vão na tela).
  - **A posse fica no CAMPO, não na tela.** Os campos entram com `origin: 'plugin'` e `ownerPluginId`;
    a extensão **não** entra em `ownerPluginIds` da tela. Por isso `releaseScreenPatches` (uninstall)
    varre as telas de terceiros e tira só os campos dela — a tela e os registros continuam de pé, e os
    valores já gravados no campo removido ficam nos documentos (inofensivos, como toda chave sem
    definição). Telas do próprio plugin não passam por aí: quem cuida delas é o `releaseScreen`.
  - **Tela do kernel ainda sem documento** ganha `builtinScreenBaseline(collection)` (em
    `schema/screenEntity.ts`) — a MESMA baseline que o Form Design grava no primeiro ajuste de uma
    tela fixa, com `sidebarOrder` (sem ele o documento ficaria fora do `getAll`, que ordena por esse
    campo). Alvo que não existe no escritório é ignorado: não há o que estender.
  - **Autoria:** `screenToPatch` (em `packageBuilder.ts`) empacota de uma tela de terceiros somente os
    campos `origin: 'design'` — os do kernel e os de outra extensão não são do autor para distribuir.
    A tela de autoria lista essas telas no grupo "Campos em telas existentes", separado de "Telas", e
    EXCLUI dele as telas que o próprio pacote carrega (senão o complemento competiria com o template
    da tela). O instalador e o `validatePackage` recusam esse mesmo caso, para os pacotes já gerados.
- **Reexportar uma extensão em edição reancora os templates na tela VIVA** (`refreshedFromInstalled` +
  `toTemplateRefs`, com `installedScreens`/`installedActions` na entrada do `buildPackage`). Quem edita
  uma extensão edita a tela INSTALADA, no Form Design; sem esse reancoramento o export reemitiria o
  template carregado, e o que o autor mexeu se perderia — foi o que fez um campo novo só conseguir
  viajar como complemento e, na atualização, apagar todos os demais campos da tela. `key` e `sourceId`
  continuam sendo os do template (a identidade do pacote não muda porque a instalação local
  desambiguou a chave); campos de outra extensão não viajam; e as referências voltam ao vocabulário do
  pacote — chave instalada de outra tela vira `key` de template, id real de action vira `templateId`.
  Pelo mesmo motivo, `collectLookups`/`collectTagLists` varrem o pacote FINAL (telas + complementos), e
  não a seleção de origem: era assim que as listas e etiquetas de uma extensão importada sumiam ao
  reexportá-la.
- As telas instaladas fluem pelo pipeline de telas dinâmicas **automaticamente** (sidebar, ⌘K, Form
  Design, renderer, agregação no backend) por serem `ScreenDefinition` no tenant.
- **Form Design espelha as telas fixas:** tela/campo de extensão é EDITÁVEL (ajustes não-críticos,
  como nas telas fixas) mas NÃO EXCLUÍVEL — só a desinstalação remove. A exclusão é bloqueada nos
  handlers do `ScreenBuilder` e, como backstop de integridade, no `DeleteScreenDefinitionUseCase`.
  Editar preserva o `ownerPluginId` (o spread do campo e o `toSaveInput` o carregam em todo save);
  adicionar campos próprios continua liberado. Etiqueta "Extensão" no card e na meta do campo.

Plugin de exemplo `com.microteia.vendas` (produto, venda, item): validação por regex, currency,
select, relação com pessoa[core], preço do item vindo do produto (`onChange`), total do item
calculado (`compute`), total da venda agregado, e master-detail venda→itens.

**Pacote completo (actions, scripts, workflows).** `MarketplacePlugin` carrega `screens`, `workflows`,
`actions` e `scripts` — um plugin é qualquer subconjunto. Telas usam a `screenKey` declarada (resolvida
por `installedScreenKey`); actions/scripts/workflows têm **id de template** e recebem id gerado na
instalação, então a materialização faz **remapeamento em duas passadas** (`packageMaterialize.ts`): cria
scripts → mapa; cria workflows (reescreve `step.configuration.scriptId`, remapeia a tela-gatilho) → mapa;
reescreve `targetWorkflowId` (workflow que chama workflow); cria actions (reescreve `workflowId`) →
mapa; grava telas (reescreve `viewActionIds`/`cardActionIds` e as refs entre telas). Ordem obrigatória:
scripts → workflows → actions → telas. `ownerPluginId` em Action e Script (Workflow já tinha);
desinstalar cascateia os quatro tipos e preserva os registros.

**Um modelo de referências, um validador** (`pluginReferences.ts`, puro): as referências de saída de
cada artefato (tela→actions/telas, action→workflow, workflow→scripts/workflows/tela-gatilho). O
`validatePackage(pkg)` exige que toda referência esteja **incluída no pacote**, seja **coleção fixa do
core**, ou esteja **coberta por dependência declarada** (chave `<slug>__x` de uma `dependencies` — a
convenção antiga, mantida por compatibilidade; hoje só `core.ui` é declarada como dependência). É a MESMA checagem que o export (dry-run) e o import usam — simétrico e agnóstico.

**O gatilho de um workflow é uma referência a uma tela — mas o nome do evento não é a chave dela.**
`screenEventPrefix(tela)` é o ponto único que traduz tela em nome de evento no empacotamento:
`eventPrefix` declarado, senão a coleção que ela descreve, senão a chave. As duas pontas param de
supor que prefixo e chave são a mesma palavra:

| Ponta | O que faz | Sem isso |
|---|---|---|
| `workflowOutRefs(workflow, telas)` | acha a tela pelo que ela EMITE e referencia a **chave** dela | um pacote com automação em `case.saved` acusaria uma tela "case" inexistente e não exportaria |
| `buildScreenEventMap(telas, screenKeyMap)` | mapeia só a tela cujo evento leva a chave dela — a única que muda de nome na instalação | um prefixo declarado seria namespaceado e a automação nasceria escutando um evento que ninguém publica |
| `eventPrefixIssues(telas)` | recusa prefixo reservado pelo motor, prefixo de entidade fixa em OUTRA coleção e duas coleções publicando o mesmo evento | uma tela `medico` declarando `person` faria toda gravação de médico disparar as automações de Pessoa |

O prefixo de eventos é um nome **global**, como a coleção: quem escuta não sabe qual extensão
publica. Declarar o prefixo da própria coleção fixa (`cases` → `case`) é o oposto de uma colisão —
é a continuidade que deixa a entidade sair do kernel sem renomear evento nenhum, e por isso a
checagem compara a coleção, não só o nome.

`splitEntityEventName` reconhece o evento de FILHO (`person_note.saved`) por composição — prefixo de
entidade do registro mais `_note`/`_document` —, e não por "tem underscore": chave com underscore é
o normal de uma tela trazida por dependência (`com-microteia-vendas__produto`), e barrá-la fazia o
gatilho dela passar despercebido no empacotamento.

**Escopo desta fase:** materialização/instalação. A autoria ("Criar Plugin": marcar artefatos +
manifest → validar como dry-run de import → gerar `.json`/publicar) e o upgrade são as fases seguintes.

### Fatia vertical do Marketplace — instalar de verdade

### Fatia vertical do Marketplace — instalar de verdade (Etapa 5 + prova de ponta a ponta)

A primeira extensão instalável real, provando a plataforma inteira **reusando o motor de
automações** — sem uma linha de backend novo.

**O plugin de exemplo** (`plugins/marketplace/catalog.ts`, `com.microteia.boas-vindas`) carrega um
único workflow: ao criar uma Pessoa (`person.saved`, `changeType == created`), registra um evento
na Auditoria. O catálogo é código embutido nesta fatia; na Etapa 7 completa vem do registro global.

**Instalar = materializar.** `InstallMarketplacePluginUseCase` valida a instalação (regras puras da
Etapa 5), cria os workflows do plugin no tenant **marcados com `ownerPluginId`** e habilitados, e só
então grava o `PluginInstallation`. A ordem importa: validar antes de criar evita workflow órfão;
gravar o registro por último evita marcar como instalado algo cuja materialização falhou.

**Duas convenções de caminho — não confundir** (o autor do plugin de exemplo tropeçou nisto): o
`fieldPath` de um `FieldComparison` (condição) é resolvido contra o **contexto inteiro**, então usa
caminho absoluto — `event.payload.changeType`. Já o `path` de um `EventInputMapping` (config de
step) é resolvido contra `context.event.payload`, então é **relativo ao payload** — `id`, não
`event.id`. Em **expressões** (`ExpressionInputMapping`), `event` já aponta para o payload, então
`event.name` é o campo `name` do registro. Três resolvedores, três raízes.

**O motor já executa.** O workflow materializado é uma `WorkflowDefinition` normal na coleção
`workflow_definitions` — a Cloud Function `onWorkflowEventCreated` (já no ar) o dispara como
qualquer outro. **Nenhum backend novo, nenhuma rule nova.** Por isso o `ownerPluginId` é um marcador
**só do frontend**: o motor é agnóstico a dono (roda todo workflow habilitado), então
`functions/src/.../Workflow.ts` não precisa do campo.

**Desinstalar = cascata.** `UninstallMarketplacePluginUseCase` remove **todos** os workflows do
tenant com aquele `ownerPluginId` e depois apaga o registro — a cascata de artefatos que a Etapa 5
reservou, agora real para workflows. Workflows do próprio usuário (sem `ownerPluginId`) não são
tocados; há teste.

**Superfície:** o `PluginStore` assina as instalações do tenant e expõe instalar/ativar/desativar/
remover; a página **Extensões** (`core.marketplace`, contribuindo `ui.page` + `ui.nav`) lista o
catálogo com o estado por card. Só admin gerencia (InfoBanner para os demais).

### Ciclo de vida de instalação (Etapa 5 — spine)

Quando um plugin do Marketplace for instalado num escritório, o registro fica em
`tenants/{tid}/plugin_installations/{pluginId}`: `version`, `enabled`, `config`,
`grantedPermissions`, `installedAt/By`. Regra: membro lê (o app precisa saber o que está ativo),
só admin instala/atualiza/remove.

**A lógica de negócio é pura e isolada** em `domain/services/pluginLifecycle.ts`: `planInstall`,
`planEnable`, `planDisable`, `planUpgrade`, `planUninstall` recebem o estado atual e devolvem o
próximo estado **ou** um erro tipado (`already-installed`, `not-installed`, `not-newer-version`,
`invalid-version`) — nunca lançam, nunca tocam I/O. Regras cobertas: idempotência (ativar o que já
está ativo é no-op, não erro), upgrade só para frente (recusa versão igual/anterior, comparada por
semver), install só do que não existe.

Os use cases (`usecases/plugins/PluginLifecycleUseCases.ts`, padrão factory) orquestram o
repositório em volta dessas funções: leem o estado, aplicam a regra, persistem só se aprovada.

**Esta é a Etapa 5 em sua forma spine.** O que depende de existir plugin instalável — a tela de
Plugins (admin), o enforçamento de permissão por plugin no sandbox QuickJS e a marcação
`ownerPluginId`/`managed` dos artefatos com varredura na desinstalação — fica para a Etapa 7, quando
o Marketplace fornece o conteúdo. O `UninstallPluginUseCase` já reserva o lugar da cascata de
artefatos, hoje um no-op documentado.

### Entidades e lookups como contribuições (Etapa 4b)

`EntityKey` deixou de ser união fechada e virou `string` — o conjunto de entidades é **dado**, não
tipo. A validação de que uma chave existe é de runtime, contra o registro (`getEntityByCollection`,
`ctx.registry`). A união `BuiltinEntityKey` sobrevive só para documentar o conjunto nativo.

| Ponto | Metadata | `impl` |
|---|---|---|
| `data.entity` | o `EntityMetadata` inteiro | nenhuma (metadata pura) |
| `data.lookup` | o `LookupMetadata` inteiro | nenhuma |
| `data.field.preset` | o `FieldRulePreset` inteiro | nenhuma |
| `data.external.lookup` | o `LookupProviderSpec` inteiro | nenhuma |

**Entidade é dado da camada de domínio, abaixo do Kernel — então o schema continua sendo o dono.**
`ENTITY_REGISTRY` permanece a fonte ergonômica que `pathResolver`, `eventCatalog`, `mutationSpec`
etc. consomem direto (não podem importar o Kernel, que está acima). As contribuições em
`domain/schema/dataExtensionPoints.ts` **derivam** desses mesmos objetos e os EXPÕEM ao Kernel: é o
que torna o catálogo de entidades consultável e, no futuro, publicável. Fonte única, dupla exposição
— não é fachada, é respeitar a hierarquia de camadas.

Consequência honesta: remover `core.data` da lista de plugins **não** remove as entidades do schema
(o schema depende delas diretamente, por baixo). Diferente de uma tela ou um Step, que somem ao
descarregar o plugin. É o preço de entidade ser domínio, não apresentação.

### Serviços de plugin no DI do frontend (Etapa 4c)

O `DIContainer` do frontend **permanece tipado e cabeado à mão** — 58 campos, seguros em
compilação, consumidores (`useDI().personRepository`) intocados. Transformá-lo em contribuições
seria uma fachada: mais código que hoje, troca da garantia do compilador por `!` de runtime, e o
risco de rearrastar o Firebase para os testes (o que a Etapa 2 evitou). Repositório nativo não é
ponto de extensão de terceiro — plugins usam a coleção da própria tela via o repositório genérico, não `FirebaseXRepository`.

O que é extensível, de forma **aditiva**, é o ponto `data.service`: um plugin registra um serviço
próprio (uma integração externa, por exemplo) e o resolve por chave:

```ts
const geocoder = useDI().resolveService<Geocoder>('acme.geocoder');
```

`resolvePluginService` (`infrastructure/di/pluginServices.ts`, puro e testado) faz a busca; o
`DIProvider` lê o host do Kernel via `KernelContext` **opcional** — sem `KernelProvider` em volta,
`resolveService` devolve `undefined` em vez de quebrar. O núcleo não perde nada; o plugin ganha um
lugar de verdade para injetar comportamento no frontend.

### Capabilities — múltiplos provedores para a mesma capacidade (Etapa 4a)

O container de injeção não nomeia mais os cinco serviços de IA. Eles são contribuições do ponto
`capability.provider`, no plugin `core.ai`.

| Ponto | Metadata | `impl` |
|---|---|---|
| `capability.provider` | `capability`, `version`, `providerKey`, `label` | `code` → a implementação |

**`provides` no manifest e a contribuição fazem coisas diferentes, de propósito.** O `provides`
DECLARA a capacidade — é o que o Marketplace lista e o que satisfaz o `consumes` de outro plugin,
sem carregar código nenhum. A contribuição CARREGA a implementação. Um plugin pode declarar que
fornece IA e ter sua implementação recusada por incompatibilidade sem que a declaração suma.

**Aqui a resolução coleta todos, não escolhe um.** `capabilityProvidersOf('ai.completion')` devolve
a lista inteira, e o `canHandle` de cada serviço decide quem atende a conexão configurada pelo
escritório — o mecanismo de seleção que já existia. `selectProvider`/`resolve` (escolher **um** por
prioridade ou vínculo do tenant) continua disponível para capacidades onde só um provedor faz
sentido por vez.

Adicionar um provedor novo de IA é uma linha de manifest: `container.ts` não muda. Há teste
provando isso com um plugin de terceiro fictício.

### Carga preguiçosa das funções de expressão — não mexa

O índice dos plugins importa os Steps, que importam o `ExpressionEngine`. Registrar as funções no
topo do módulo do motor lê `BACKEND_PLUGINS` **antes de o módulo terminar de inicializar**, e a
lista chega `undefined`. Por isso o registro é preguiçoso e idempotente.

A garantia está concentrada em **um** acessador: `loadedExpressionFunctions()`, exportado pelo
`ExpressionEngine`. Os três leitores do catálogo (o próprio motor, o `runScriptSandbox` e o handler
`getExpressionFunctions`) passam por ele. **Nunca leia `expressionFunctions` direto** — pula a
garantia, e o sintoma é o catálogo vazio só em alguns caminhos.

### Guarda de acoplamento no ESLint

`eslint.config.js` tem duas zonas `no-restricted-imports` que reprovam o build:

- `src/kernel/**` e `functions/src/kernel/**` não importam `plugins/`, `presentation/`, `data/`,
  `stores/` nem `firebase` — o Kernel depende só dos contratos.
- `src/plugins/*/**` não importa outro plugin diretamente — a comunicação é por Capability ou por
  Extension Point.

A configuração do ESLint pode ser afrouxada sem ninguém perceber, então `kernel/kernelPurity.test.ts`
é a segunda tranca: lê o próprio código-fonte do Kernel via `import.meta.glob(..., '?raw')` e falha
no `npm test` se qualquer arquivo importar algo além de `domain/schema/plugin/` ou de outro arquivo
do Kernel. O último caso do teste prova que o detector realmente reconhece uma violação — guarda que
não dispara é pior que guarda nenhuma.

### Etapas

| Etapa | Entrega |
|---|---|
| 0 ✅ | Contratos em `domain/schema/plugin/`, guarda no ESLint, sincronização |
| 1 ✅ | Runtime: os quatro registries, `PluginHost` e o binding React |
| 2 ✅ | Dogfood da UI: telas (lazy), navegação e ⌘K como contribuições de 12 core plugins |
| 3 ✅ | Dogfood da automação: 12 Steps e 53 funções de expressão como contribuições |
| 4a ✅ | Capabilities: os 5 provedores de IA saem do container e viram contribuições |
| 4b ✅ | `EntityKey` aberto; entidades e lookups como contribuições `data.entity`/`data.lookup` |
| 4c ✅ | Ponto `data.service`: plugin injeta serviço no DI do frontend, container tipado intacto |
| 4d ✅ | Ponto `data.field.preset`: máscara, formatação e validação prontas saem do kernel e viram declaração |
| 4e ✅ | Ponto `data.external.lookup`: busca de dados externos vira declaração; ViaCEP deixa de ser código |
| 4f ✅ | Confiança de código de extensão: procedência do catálogo ou revisão explícita, vinculada por hash |
| 5 ✅ | Ciclo de vida + carga por tenant: instalar ativa menu/página/workflow do plugin |
| — ✅ | Fatia vertical: plugin de exemplo instalável ponta a ponta (workflow + página Extensões) |
| 7 ◑ | Marketplace: registro global + publish (SYSTEM); falta versões por plugin e publish com validação |
| 6 ✅ | Widget DSL (estático) — plugin instalado entrega tela por widget; falta só ligação a dados |
| 7 | Marketplace: `plugin_registry`, publicação e instalação |

---

## Busca de dados externos declarativa

O slot `FieldLogic.onChangeLookup` ("Ao alterar, buscar dados externos") resolve um provedor **por
nome**. Antes, o registro era um array literal do `DIContainer` com uma classe dentro
(`ViaCepLookupService`) — acrescentar um provedor exigia commit no kernel.

### O contrato — `domain/schema/lookupProviderSpec.ts` (sincronizado)

A requisição inteira é **dado**: `input` (pipeline `FormatOp`, o mesmo das regras de campo), `when`
(expressão booleana), `request.url` com `{value}`, `map` (chave de saída → caminho no JSON) e
`failWhen` (resposta 200 que significa "não encontrado"). `outputKeys` é **derivado** de
`Object.keys(map)` — não se declara duas vezes.

### O executor — `data/services/DeclarativeLookupService.ts`

`makeDeclarativeLookupService(spec)` implementa `IExternalLookupService` e é **o único ponto do app
que faz requisição em nome de uma extensão**. Por ser único, é onde as garantias cabem:

| Garantia | Por quê |
|---|---|
| só `https:` | `http` vazaria o valor digitado em claro; `data:`/`javascript:` transformariam a declaração num vetor de execução |
| `credentials: 'omit'`, `cache: 'no-store'` | nenhum cookie ou credencial do app viaja para o terceiro |
| `{value}` com `encodeURIComponent` | o valor digitado não pode escapar para a estrutura da URL |
| timeout com teto (`MAX_LOOKUP_TIMEOUT_MS`) | uma declaração não segura o formulário do usuário |
| teto de corpo antes do `JSON.parse` | resposta gigante não trava a aba |
| devolve **só** as chaves de `map` | a resposta bruta nunca chega a quem declarou |

`when` ausente dispara; `when` presente que estoure **não** dispara — não se bombardeia um serviço de
terceiro por causa de expressão quebrada. Erro nunca lança: vira `ok: false`, conforme o contrato.

**Limite consciente:** a URL é pública dentro do pacote, então este canal **não comporta chave de
API**. Provedor autenticado dependeria de um proxy no backend, ainda não implementado.

### Resolução — hook, não DI

`useExternalLookupProviders()` lê as contribuições do `TenantKernelProvider`. Não vem do
`DIContainer` de propósito: o `DIProvider` lê o host **base** (`CORE_PLUGINS`), então declaração de
extensão de tenant nunca chegaria lá. `externalLookupServices` saiu do container.

O ViaCEP virou declaração em `CORE_LOOKUP_PROVIDERS` e a classe foi **deletada**; a chave segue
`viacep`, então `address.zipCode` de Pessoa continua valendo sem migração. Os 7 casos do teste antigo
viraram testes do executor rodando a declaração — é o que autorizou a exclusão.

Na autoria, o provedor escolhido mostra o **host de destino** e as chaves devolvidas: a URL é dado, e
é isso que torna a escolha revisável.

## Fronteira de confiança do código de extensão

**O que uma extensão executa hoje:** `evaluateExtensionView` compila com `sucrase` e avalia em
`new Function('require','module','exports', code)`. `HOST_MODULES` é allowlist de **imports** — não
de escopo. Corpo de `new Function` roda em escopo global, então `fetch`, `sendBeacon`, `WebSocket`,
`localStorage` e `document.cookie` estão ao alcance. **Não há sandbox de browser, e não se finge que
há.** Sombrear globais foi descartado deliberadamente: `({}).constructor.constructor('return fetch')()`
recupera tudo em uma linha — seria vender segurança inexistente. Contenção real exigiria Web Worker ou
iframe sandbox.

A defesa, portanto, é **procedência + gesto deliberado** — o mesmo caminho de WordPress (revisão no
diretório + `DISALLOW_FILE_MODS`), Odoo (no SaaS hospedado não se instala módulo arbitrário) e do
Workspace Trust do VS Code.

### A regra

`extensionRecordFrom(pkg, mayRunCode)` só transforma `views` em `implementations` quando `mayRunCode`.
O padrão do argumento é `false` — **falha fechada**. Antes, ter `views` bastava para receber
`trusted: true`, e um `.json` importado à mão executava código para todos os membros do tenant.

`isExtensionCodeTrusted` (em `domain/usecases/plugins/extensionCodeTrust.ts`):

1. pacote sem `views`/`startup` → não se aplica (telas, campos e workflows entram normalmente);
2. procedência confiável (`hasTrustedProvenance`) → roda: `source: 'public'` (a aprovação por SYSTEM
   **é** a revisão) ou `source: 'builtin'` (o pacote veio do CATÁLOGO EMBUTIDO — é o próprio código
   da aplicação, e pedir revisão dele a um admin não acrescentaria garantia);
3. caso contrário → só com `codeTrust` cujo `hash` bate com o código atual.

**O vínculo é por hash, não por versão.** Um pacote montado à mão pode manter `1.0.0` e trocar o
código; confiança presa à versão passaria a valer para código nunca revisado. O hash é SHA-256 sobre
as `views` (ordenadas por chave) mais o `startup`, separados por `\u0000`.

`useExtensionCodeTrust` calcula o conjunto de confiáveis de forma assíncrona; enquanto calcula, o
conjunto é **vazio** — de novo, falha fechada.

### O gesto

No Marketplace, cópia instalada com código não confiado ganha o selo "Código não revisado" e a ação
**Revisar e confiar**, que abre a fonte e exige confirmação. `codeTrust` grava quem confiou, quando e
o hash. Reinstalar preserva o registro — quem decide é o hash, então código igual mantém a revisão e
código alterado volta a exigir o gesto.

### Catálogo embutido e pacotes distribuíveis

`MARKETPLACE_CATALOG` (`src/plugins/marketplace/catalog.ts`) são as extensões de PRIMEIRA PARTE que
viajam no bundle. Aparecem em Extensões com o selo "Do sistema", instalam com um clique
(`source: 'builtin'`) e executam código pela procedência — é o caminho curto de desenvolvimento:
editar o `.ts`, recarregar, "Atualizar" na linha da extensão. O botão "Atualizar" aparece quando o
pacote embutido **difere** do instalado, não só quando a versão sobe: durante o desenvolvimento a
versão fica parada enquanto o código muda.

#### "Atualizar" converge — não desinstala e instala de novo

`applyPackageArtifacts` é uma operação de CONVERGÊNCIA, e é assim de propósito. Ela reescreve o que o
pacote traz, **remove** o que sumiu dele (`releaseVanishedGeneratedArtifacts`) e **preserva** o que é
do escritório: os campos que o escritório acrescentou à tela da extensão (`preservedUserFields`), as
ações que configurou no Form Design (`viewActionIds`/`cardActionIds` em união), a tela adotada que já
existia antes (`isAdoptedScreen`, devolvida na desinstalação em vez de apagada) e a automação que o
escritório DESLIGOU (`enabled`). Os ids dos artefatos também não mudam — um workflow do escritório que
chama o da extensão por `targetWorkflowId` continua chamando o mesmo, e o histórico de execuções não
fica órfão.

Desinstalar e instalar de novo perderia essas cinco coisas e renumeraria os artefatos. É por isso que
"Atualizar" não é o par das duas operações, ainda que o resultado pareça o mesmo de fora.

**O que quebrava, e por quê.** O conteúdo de script, workflow e action só era reescrito quando a
revisão de origem que chegava era maior (`revOf(template) > revOf(existing)`). O catálogo embutido é
escrito à mão e não carimba revisão nesses três — os dois lados ficavam em `0`, e `0 > 0` congelava o
artefato na PRIMEIRA instalação, para sempre. O botão aparecia (ele compara conteúdo), a mensagem
dizia "Extensão atualizada" e nada mudava; só desinstalar e instalar resolvia. As telas nunca tiveram
essa trava. Hoje a regra é `shouldRewriteContent`: reescreve quando não há revisão materializada com
que comparar, ou quando a que chega é maior; um pacote SEM revisão não sobrescreve uma cópia
versionada, que é o caso para o qual a revisão existe — duas extensões carregando o mesmo `sourceId`,
e a mais velha não pode regredir a mais nova.

O MESMO pacote também é distribuível como `.json` em `extension-templates/`, para escritórios que não
rodam este bundle. O arquivo é **gerado**, nunca editado à mão:

```bash
npm run build:extensions        # regrava extension-templates/*.json a partir dos .ts
npm run verify-extensions       # falha se algum estiver desatualizado (roda no `npm run verify`)
```

`scripts/export-extensions.mjs` carrega os módulos pelo próprio Vite (`ssrLoadModule`) e serializa
com `serializePackage` — o mesmo formato do botão "Baixar .json". `scripts/extensionTemplates.test.ts`
é a rede: alterar a extensão e esquecer de regerar o arquivo quebra o teste, em vez de deixar um
`.json` velho instalando uma tela que não existe mais no repositório.

**O que continua em aberto, e é honesto registrar:** não há CSP (`connect-src`), `manifest.permissions`
segue declarado e não consultado (inclusive o domínio `net`), e `installedPluginRecords` continua sem
chamador — a decisão de confiança vive agora em `extensionCodeTrust`.

## Camada de Regras de Campo (validação e formatação)

Camada declarativa, **compartilhada entre front e backend**, que formata e valida um valor **antes
da gravação**. Resolve a ausência de um "before save" no Firestore sem rotear as escritas por uma
Cloud Function (que rodaria com privilégio máximo).

### Núcleo — `domain/schema/fieldRules.ts` (sincronizado)

```ts
interface FieldRules {
  validate?: { pattern?: string; flags?: string; message?: string; check?: ValidateCheck };
  format?:   { preset?: FormatPreset; pattern?: string; replacement?: string; flags?: string };
}
```

`preset` e `check` são **chaves resolvidas num catálogo declarado** (ver a seção seguinte), não
uniões fechadas: `FormatPreset` e `ValidateCheck` são `string`. O `format` aplica o pipeline do
preset e depois a substituição por regex (`pattern` → `replacement`, com `$1`, `$2`…). Um regex
inválido é ignorado, nunca lança.

### Máscaras, formatações e validações prontas — `domain/schema/fieldRulePresets.ts` (sincronizado)

**O kernel conhece VERBOS; o vocabulário de negócio é declaração de plugin.** Antes, CPF/CNPJ/
telefone/CEP viviam em quatro uniões e mapas de função dentro do kernel, e acrescentar "RG" ou
"placa" exigia um commit no núcleo — o oposto da pedra fundamental. Hoje o kernel só executa
primitivos, e o significado de cada chave vem de uma contribuição.

```ts
type FormatOp =
  | { op: 'digits' | 'letters' | 'alphanumeric' | 'trim' | 'upper' | 'lower' }
  | { op: 'mask'; templates: string[] }
  | { op: 'regex'; pattern: string; replacement?: string; flags?: string }
  | { op: 'expression'; expression: string };

interface FieldRulePreset {
  key: string;                 // sem `/` é reservado ao núcleo; extensão usa 'com.acme.docs/rg-sp'
  label: string;
  appliesTo?: CustomFieldType[];
  mask?: { templates: string[]; placeholder?: string; inputMode?: 'numeric' | 'text' };
  format?: FormatOp[];
  validate?: { expression?: string; pattern?: string; flags?: string; message?: string };
}
```

**Motor genérico de máscara — `applyMaskTemplate(value, templates)`.** `#` = dígito, `A` = letra,
`*` = alfanumérico; o resto é literal. A aplicação é **progressiva** (o separador só aparece quando
há conteúdo depois dele — é o que permite digitar e apagar sem a máscara empurrar o cursor), e entre
vários templates vence o primeiro que comporta o conteúdo. Essa lista é o que substituiu os `if` de
tamanho: telefone é `['(##) ####-####', '(##) #####-####']`, CPF-ou-CNPJ é
`['###.###.###-##', '##.###.###/####-##']`. `fieldRulePresets.test.ts` compara o motor com os
formatadores removidos **caractere a caractere, para todo prefixo** — é esse teste que autoriza a
remoção deles do kernel.

**Sem código, de propósito.** O escape final é `{ op: 'expression' }` / `validate.expression`,
avaliado pelo `fieldExpression.ts` — que já é compartilhado front/back e já expõe `isCPF`, `isCNPJ`,
`onlyNumber`, `replace`, `length`. Um tier de código só rodaria no browser e só para extensão
trusted, quebrando a paridade que faz a regra valer igual na tela e na automação. `isValidCpf` e
`isValidCnpj` continuam existindo, mas como **funções do catálogo de expressões**, não como ramos de
`switch`: qualquer declaração de qualquer plugin pode chamá-las.

**Resolução em runtime.** O catálogo entra no `SchemaContext` (`ctx.fieldRulePresets`), pelo mesmo
caminho de telas, listas e etiquetas — `buildFieldRulePresetCatalog` funde `CORE_FIELD_RULE_PRESETS`
com o que as extensões declaram:

| Lado | Como chega |
|---|---|
| Front (autoria e formulário) | `useFieldRulePresets()` lê as contribuições do `TenantKernelProvider` |
| Front (gate de gravação) | `FieldRulePresetBridge` empurra para `setRecordRulesFieldRulePresets` |
| Back | `ScreenDefinitionCache` lê `tenants/{id}/installed_extensions` (só as `active`) junto das telas, no mesmo cache de 5 min |

**Chave já ocupada não é sobrescrita** — uma extensão não redefine o que `cpf` significa para as
telas que já dependem dele (espelha `extensionPoint.duplicate`).

**Compatibilidade: zero migração.** O campo continua gravando só a chave (`ui.mask: 'cpf'`,
`format.preset: 'cpf'`, `validate.check: 'cpf'`) — mudou apenas quem responde pelo significado dela.

**Tolerância a falha é deliberada:** preset desconhecido ou expressão quebrada = no-op na formatação
e **aprovação** na validação. Uma extensão desinstalada não pode transformar registros válidos em
registros que ninguém consegue salvar. Por isso `evaluateFieldBoolean` ganhou o parâmetro
`fallback`: os slots de tela (`hiddenWhen`/`disabledWhen`) querem `false`, a validação de preset
quer `true`.

**Invariante que garante compatibilidade:** `validate` **nunca roda em valor vazio** (`null`,
`undefined`, `''`, `[]`) — obrigatoriedade continua sendo assunto exclusivo de `required`. Sem essa
regra, ligar uma validação quebraria todo registro e workflow que deixa o campo em branco.

`src/utils/formatters.ts` e `src/utils/validators.ts` **re-exportam** deste núcleo (são a fachada de
presentation); a implementação vive só aqui, porque `src/utils` não é sincronizado para `functions/`.

### Onde `rules?` é declarado (sempre opcional)

| Tipo | Arquivo | Cobre |
|---|---|---|
| `NativeFieldSpec` | `domain/schema/entityRegistry.ts` | campos nativos (inclusive `objectFields`) |
| `FieldDefinition` | `domain/entities/entitySchemas.ts` | campos dinâmicos (editados no ScreenBuilder) |
| `WorkflowParameter` | `domain/entities/Workflow.ts` (+ espelho manual em `functions/`) | parâmetros de Workflow **e** de Script |
| `InputDefinition` | `functions/src/domain/engine/StepDefinition.ts` (+ espelho `WorkflowStepCatalog.ts`) | inputs de Step |

`pattern`/`patternMessage` do `InputDefinition` antecedem esta camada e continuam válidos:
`toEffectiveRules()` os lê como um `validate` equivalente (`rules.validate` explícito tem prioridade).

> ⚠️ **O formato canônico gravado no Firestore para CPF, CNPJ, telefone e CEP é o de DÍGITOS PUROS**
> — a máscara existe só na tela. Por isso as regras nativas em `ENTITY_REGISTRY` usam
> `format: { preset: 'digits' }`, nunca um preset com máscara: trocar isso mudaria o shape do dado
> gravado e quebraria comparações com os registros existentes.

### Resolvedores

- **`domain/schema/recordRules.ts`** — `formatAndValidateRecord(ctx, table, data)`: percorre as folhas
  **presentes** em `data`, resolve o campo de cada uma pelo `SchemaContext` (`resolveFieldSpec` —
  campo nativo, campo de objeto aninhado, ou campo declarado pelo tenant, todos na raiz), **converte
  o valor para o `type` declarado** (`coerceWriteValue`) e só então aplica `format`/`validate`,
  devolvendo `{ data, issues }`.
- **`domain/schema/parameterRules.ts`** — `formatAndValidateParameters(parameters, data)`: idem, contra
  um `WorkflowParameter[]` (desce recursivamente em `Object.fields`; quando `list: true`, mapeia as
  regras sobre cada elemento do array).

> **Parâmetro como lista (`list: true`).** Flag ortogonal em `WorkflowParameter`/`ScriptOutputParam`: o
> resto do parâmetro descreve **um item** e `list` diz "vários deles" (lista de escalar, de `select`, de
> `EntityReference` ou de `Object`). Substitui o antigo `multi` do `EntityReference` (removido — um conceito
> só). No editor visual é o seletor **Quantidade** (Único/Vários), disponível para todos os tipos; no DSL
> JSON é a propriedade `"list": true`. Um parâmetro-lista não tem `default`. No IntelliSense de paths a
> lista é tratada como **folha opaca** (sem indexação de elemento no autocomplete); dentro de Scripts o
> `input.<chave>` é tipado como `T[]` e é indexável normalmente por ser apenas JS.

### As portas de gravação

| Porta | Onde | Comportamento |
|---|---|---|
| **Front — garantia** | `applyRecordRules()` no `create`/`update` de cada `FirebaseXxxRepository` | formata; lança `RecordRulesError` se inválido. Nenhuma escrita escapa, venha de store, viewmodel ou importador |
| **Front — UX** | `validateRecordRules()` no `handleSave` de cada ViewModel de formulário | mesma checagem, para exibir o erro por campo antes de tentar salvar |
| **Backend — gravação** | `runWorkflowUpsert()` (`workflow/mutation/runWorkflowMutation.ts`) | cobre de uma vez o Step "Gravar Registro" **e** o `upsert()` do Script. Falha o step se inválido |
| **Backend — inputs de Step** | `resolveInputsSafe()` (`engine/InputMapping.ts`) | formata o valor resolvido e falha o step se a regra não passar |
| **Backend — parâmetros de Workflow** | `runWorkflow()` (`engine/WorkflowExecutor.ts`), antes do 1º step | execução vira `FAILED` com o campo e o motivo no log |
| **Backend — parâmetros de Script** | `ScriptStep.ts`, após `applyParameterDefaults` | falha o step antes de entrar no sandbox |
| **Backend — execução manual/IA** | callable `handlers/runWorkflow.ts` | `HttpsError('invalid-argument')` com as mensagens |

> **Tipo declarado = tipo gravado.** A conversão vive no portão, não em cada chamador. O controle de
> data do formulário fala `aaaa-mm-dd` e o motor de workflows entrega `Date`; os dois chegam ao
> Firestore como Timestamp, porque `formatAndValidateRecord` coage pelo `type` do campo. Sem isso
> uma tela do Form Design gravaria a data como texto — indistinguível no console, mas quebrando
> `addDays(event.campo, n)` no workflow que a própria tela dispara, enquanto a mesma expressão
> funcionaria numa tela fixa (cujos mappers escritos à mão já convertiam). A data pura (`aaaa-mm-dd`)
> é montada no **fuso local**: ela nomeia um dia, e `new Date('2026-07-15')` daria meia-noite UTC —
> o dia anterior no horário do escritório. Na volta, `toDateFieldInput` (`customFieldValues.ts`)
> devolve `Date`/Timestamp ao formato do controle, e `FirebaseRecordRepository` converte Timestamps
> em `Date` de forma genérica, já que uma coleção de tela não tem mapper escrito à mão.

O `SchemaContext` do front precisa das `ScreenDefinition`s do tenant, e um repositório não alcança um
Store React — por isso `data/utils/recordRulesGate.ts` mantém um contexto de módulo que o
`ScreenDefinitionStore` **empurra** (`setRecordRulesScreens`) a cada mudança das telas.

### Step "Validar Objeto" (`validate-object`)

Valida/formata um objeto vindo do `input` ou do `event` e devolve o objeto já tratado como saída
nomeada. Config em `domain/schema/validateSpec.ts` (`ValidateStepConfig`); a lógica é
`validateObject(ctx, config, raw)`. Três modos:

| `entityType` | `parameters` | Resultado |
|---|---|---|
| ✔ | — | Valida pelo schema da entidade; a saída é o objeto inteiro |
| ✔ | ✔ | A saída continua sendo a entidade, mas as regras dos parâmetros **sobrepõem** as do schema (via `skipPaths`) |
| — | ✔ | A saída é um objeto anônimo formado **apenas** pelas chaves declaradas |

É o único lugar onde `required` de um `WorkflowParameter` é exigido em runtime — de propósito, já que
`formatAndValidateParameters` é compartilhado e precisa continuar não-quebrante.

---

## Firestore Security Rules

**As regras de segurança do Firestore ficam no arquivo `firestore.rules` (raiz do projeto).**

O `firebase.json` aponta para esse arquivo. Sempre que uma nova coleção for criada ou permissão alterada:
1. Edite `firestore.rules`
2. Deploy: `firebase deploy --only firestore:rules`

Não documente as regras neste arquivo — a fonte de verdade é `firestore.rules`.

### Curinga das telas — a única regra que precisa de explicação aqui

Como uma tela É uma coleção e o nome dela só existe em runtime, os registros são autorizados por um
`match /{screenCollection}/{recordId}` dentro de `match /tenants/{tenantId}`. Duas coisas o tornam
seguro, e nenhuma pode ser removida:

1. **Denylist obrigatória.** O Firestore avalia TODAS as regras que casam e concede se QUALQUER uma
   conceder. Sem `isReservedCollection`, o curinga anularia as regras nomeadas mais estritas —
   `workflow_executions` (`write: if false`), `members` (sem create/delete), `cases` (create/update
   só para advogado ou admin). A lista espelha `RESERVED_COLLECTIONS`
   (`domain/schema/screenEntity.ts`); `scripts/reservedCollections.test.ts` falha se divergirem.
2. **`exists(screenDefinitions/{collection})` na ESCRITA.** Impede que uma coleção inventada receba
   dados. A leitura dispensa a checagem de propósito: coleção sem tela está vazia, e cobrar uma
   leitura de documento por consulta não pagaria o que protege.

O `storage.rules` tem o curinga equivalente para os arquivos dos documentos, com
`isReservedStoragePath` cobrindo `logs` (que tem regra própria, mais estrita).

---

## Firebase Storage Rules

**As regras de segurança do Storage ficam no arquivo `storage.rules` (raiz do projeto).**

O `firebase.json` aponta para esse arquivo. Deploy: `firebase deploy --only storage`

Não documente as regras neste arquivo — a fonte de verdade é `storage.rules`.

---

## Performance — Queries Firestore

### Regras de query

- **Sempre usar `where` + `orderBy` no servidor** — nunca filtre grandes coleções no cliente
- **`limit()`** obrigatório em coleções que crescem indefinidamente
- **Índices compostos** devem ser documentados no arquivo `firestore.indexes.json` (raiz do projeto)
- Coleções de crescimento ilimitado exigem **paginação por cursor** (`startAfter`)

### Índices compostos necessários

**Os índices compostos ficam em `firestore.indexes.json` (raiz do projeto).**

Deploy: `npm run deploy:indexes`

Toda query nova que combine `where` com `orderBy` em campos diferentes exige uma entrada nesse arquivo — **nunca** crie o índice pelo link de erro do console sem registrá-lo lá, porque o próximo `deploy --only firestore:indexes` o apagaria. O caminho inverso vale igual: ao remover a última query que usa um índice, remova a entrada e faça o deploy, para não pagar escrita por índice morto.

Um índice composto `(campo ASC, ordenação ASC)` também atende à mesma query com ordenação DESC — o Firestore percorre o índice ao contrário. Só é preciso um índice por *conjunto* de campos, não por direção.

A tabela abaixo é **derivada** do `firestore.indexes.json` e existe só para registrar o "porquê" de cada índice. Em caso de divergência, o arquivo é a fonte de verdade.

| Coleção | Campos | Query que o exige |
|---|---|---|
| `auditLogs` | `tenantId` ASC, `createdAt` DESC | `getPage` — auditoria por escritório, mais recente primeiro |
| `auditLogs` | `tenantId` ASC, `severity` ASC, `createdAt` ASC | `countUnreadCritical` — badge de falhas CRITICAL não lidas |
| `tenants/{id}/financials` | `caseId` ASC, `dueDate` DESC | `getFinancialsByCase` |
| `tenants/{id}/financials` | `personId` ASC, `dueDate` DESC | `getFinancialsByPerson` (cascata de exclusão de `Person`) |
| `tenants/{id}/financials` | `type` ASC, `dueDate` ASC | `getFinancialsByType` (serve a ordenação DESC pelo percurso inverso) |
| `news` | `tenantId` ASC, `createdAt` DESC | `getNews` / `subscribeToNews` — notícias por escopo (sistema ou tenant) |
| `tenants/{id}/pushes` | `emailId` ASC, `processNumber` ASC | `getByEmailIdAndProcessNumber` — deduplicação de intimações |
| `tenants/{id}/workflow_definitions` | `eventName` ASC, `enabled` ASC | `findEnabledByEvent` — o gatilho do motor localiza workflows por evento |
| `tenants/{id}/workflow_executions` | `workflowDefinitionId` ASC, `startedAt` DESC | Aba "Execuções" de um workflow, mais recente primeiro |

Além dos compostos, o arquivo declara dois `fieldOverrides`:

| Coleção | Campo | Motivo |
|---|---|---|
| `auditLogs` | `expiresAt` | TTL — o Firestore expurga o log automaticamente na data |
| `members` (collectionGroup) | `userId` ASC | `getTenantsForUser` consulta `collectionGroup('members')` para descobrir os escritórios do usuário |

---

## Sistema de Deeplinks

Deeplinks permitem compartilhar links diretos para tabs específicas.

### Formato

```
https://microteia.app/view-news:{newsId}
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

## Testes — o que cada camada cobre

`npx vitest run`. O grosso da suíte é de **função pura** (domínio e schema), que é onde a lógica de
verdade mora. Mas duas classes de defeito já escaparam dela e ganharam rede própria:

- **Mapeamento destrutivo na leitura** — `screenDefinitionMapper.test.ts`. O mapper converte o
  documento do Firestore campo a campo; esquecer um campo novo grava no banco e descarta na leitura,
  e a tela parece "não ter salvo". O teste é **dirigido por tipo**: o objeto de amostra é um
  `Omit<ScreenDefinition, …>`, então acrescentar uma propriedade à entidade quebra a compilação do
  teste até ela ser declarada, e o teste falha até o mapper tratá-la.
- **Listas manuais de deploy** — `scripts/deployLists.test.ts`. Os grupos `deploy:*` do
  `package.json` e o `ALL_FUNCTIONS` de `deploy-functions-individually.cjs` enumeram functions à mão;
  uma function nova fora deles não sobe, sem erro nenhum. Já aconteceu com `runAction` e
  `recomputeAggregatesOnEntityChange`.

**Testes de hook/fluxo** (`@testing-library/react` + `jsdom`) são a exceção, não a regra: o ambiente
global do Vitest continua `node`, e cada arquivo que precisa de DOM declara
`// @vitest-environment jsdom` no topo. Usar só quando o defeito estiver na **ordem do fluxo** ou na
ligação com os stores — coisas que função pura não expressa. Exemplos: `useEntityFormFields.test.tsx`
(store → formulário) e `ScreenBuilder.nativeField.test.tsx` (ordem das validações no save do campo
fixo). Os stores entram por `vi.mock` do módulo, sem árvore de providers.

> Ao escrever um teste de regressão, **reintroduza o defeito e confirme que o teste falha**. Dois
> dos testes acima passaram na primeira tentativa contra o código quebrado — um por escolher um
> campo que não disparava a validação, outro por mutação que não foi aplicada.

## Regra de Commit — Gate de Qualidade

**Nenhum commit sem passar pelas DUAS verificações:**

```bash
npx tsc -b --force && npx eslint . --max-warnings 0
```

| Ferramenta | Pega | Não pega |
|---|---|---|
| `tsc -b --force` | Erros de **tipo** (percorre os *project references*, ao contrário de `tsc --noEmit`) | Regras dos Hooks, refs, pureza |
| `eslint . --max-warnings 0` | Regras do React Compiler | Erros de tipo |
