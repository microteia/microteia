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
| `Push` | `tenants/{tenantId}/pushes/{id}` | Sim |
| `PushInteraction` | `pushInteractions/{uid}_{pushId}` | Não |
| `News` | `news/{id}` | Parcial: `tenantId=null` = Sistema (global); `tenantId=string` = Escritório |
| `NewsTag` | `newsTags/{id}` | Não |
| `NewsInteraction` | `newsInteractions/{uid}_{newsId}` | Não |
| `NewsComment` | `newsComments/{id}` | Não |
| `SavedFilter` | `savedFilters/{uid}_{screenKey}` | Não |

### Tipos-chave

```typescript
// Papel global do usuário no sistema
type UserRole = 'SYSTEM' | 'USER';

// Papel do usuário dentro de um escritório específico
type TenantRole = 'admin' | 'lawyer' | 'secretary' | 'user';

// Temas visuais disponíveis
type ThemeMode = 'dark' | 'light' | 'claude' | 'teams' | 'bruma' | 'kindle';
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
  name: string;           // "Escritório Silva & Associados"
  oab?: string;           // Número da OAB
  cnpj?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: Date;
  createdBy: string;      // userId do criador
  memberCount: number;
}
```

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
  responsibleLawyerId?: string;
  responsibleLawyerName?: string;
  contractId?: string | null;      // Contrato vinculado — Contract (único; um Processo pertence a no máximo 1 Contrato)
  contractNumber?: string | null;  // denormalizado, mesmo padrão de responsibleLawyerName
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

**Cores de status:** tokens `contractStatus*` em `shared/styles/theme.ts` (replicados nos 7 temas, mesmo padrão de `caseStatus*`).

Coleções Firestore: `tenants/{tenantId}/contracts/{id}`, `tenants/{tenantId}/contractTags/{id}`, `tenants/{tenantId}/contractTypes`, `contractCategories`, `contractStatuses`, `contractObjects`, `contractAdjustmentIndexes`, `contractAdjustmentPeriodicities`, `contractCurrencies`, `contractPaymentMethods`, `contractBanks`, `contractCostCenters`.

**Relação Processo ↔ Contrato:** um `Contract` pode ter vários `Case` vinculados, mas cada `Case` pertence a no máximo 1 `Contract`. A chave estrangeira vive no lado "muitos" (`Case.contractId` + `Case.contractNumber` denormalizado, mesmo padrão de `responsibleLawyerId`/`responsibleLawyerName`) — não existe array `caseIds` em `Contract`. A aba "Processos" de `ViewContract` deriva a lista de processos vinculados filtrando `useCaseStore().cases` por `contractId` em memória (via `useMemo`), sem query Firestore adicional nem índice composto, já que `CaseStore` carrega a lista de `cases` do tenant inteira. Vincular/desvincular é um `updateCase(caseId, { contractId, contractNumber })` comum. Ao excluir um `Contract`, `DeleteContractUseCase` desvincula (não exclui) os `cases` filhos antes de apagar o contrato (ver "Cascata de Exclusão").

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

### Entidade Deadline (Prazo)

```typescript
interface Deadline {
  id: string;
  tenantId: string;
  title: string;
  type: DeadlineType;       // 'judicial' | 'extrajudicial' | 'internal' | 'hearing' | 'meeting'
  caseId?: string;
  caseTitle?: string;
  caseNumber?: string;
  personName?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  responsibleLawyerId?: string;
  responsibleLawyerName?: string;
  description?: string;
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Entidade Financial (Financeiro)

```typescript
interface Financial {
  id: string;
  tenantId: string;
  type: 'income' | 'expense';
  category: FinancialCategory;
  description: string;
  amount: number;           // Sempre positivo; type determina se é entrada ou saída
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  caseId?: string;
  personId?: string;
  personName?: string;
  dueDate?: Date;
  paidAt?: Date;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

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
| `SYSTEM` | Acesso total ao sistema. Gerencia usuários na tela de Gestão de Acessos. Apenas outro `SYSTEM` pode atribuir esta role. |
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
│   │   ├── IPushRepository.ts
│   │   ├── IPushInteractionRepository.ts
│   │   ├── INewsRepository.ts
│   │   ├── INewsTagRepository.ts
│   │   ├── INewsInteractionRepository.ts
│   │   ├── INewsCommentRepository.ts
│   │   └── ISavedFilterRepository.ts
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
│       ├── pushes/
│       ├── pushinteractions/
│       ├── news/
│       ├── newstags/
│       ├── newsinteractions/
│       └── newscomments/
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
│       ├── theme.ts               # Tokens dark/light/claude/teams/bruma/kindle
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
| `PushStore` | Pushes do tribunal do tenant atual, CRUD + `updateStatus` |
| `PushInteractionStore` | Rastreamento de leitura de pushes por usuário |
| `NewsStore` | Notícias do sistema + do tenant atual, CRUD + curtidas |
| `NewsTagStore` | Etiquetas de boletins |
| `NewsInteractionStore` | Leitura, salvos, curtidas por usuário |
| `WorkspaceStore` | Tabs abertas no shell, tab ativa |
| `ThemeStore` | Tema visual com persistência em localStorage (`'curatino-theme'`) |

### Stores que dependem do tenant

`PersonStore`, `CaseStore`, `ContractStore`, `DeadlineStore`, `FinancialStore`, `PushStore` escutam `currentTenant` via `useTenant()`. Se `currentTenant` for `null`, limpam o estado e não fazem queries.

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
| `PUSH_UPDATED` | `PushStore` | `PushInteractionStore` (re-sincroniza contadores) |
| `NEWS_UPDATED` | `NewsStore` | `NewsTagStore`, `NewsInteractionStore` |

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
| `Person` | Todos os processos (`cases`) onde `personId === id`; todos os prazos e financeiros vinculados |
| `Case` | Todos os `deadlines` onde `caseId === id`; todos os `financials` onde `caseId === id` |
| `Contract` | Desvincula (não exclui) todos os `cases` onde `contractId === id`, limpando `contractId`/`contractNumber` |
| `Deadline` | — (folha) |
| `Financial` | — (folha) |
| `Push` | Todos os `pushInteractions` onde `pushId === id` |
| `PushInteraction` | — (folha) |

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

    // Retorna os dados do membro do tenant
    function memberData(tenantId) {
      return get(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid)).data;
    }

    // Verifica se o usuário é membro do tenant
    function isMember(tenantId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/tenants/$(tenantId)/members/$(request.auth.uid));
    }

    // Verifica se o usuário tem role de admin no tenant
    function isTenantAdmin(tenantId) {
      return isMember(tenantId) && memberData(tenantId).role == 'admin';
    }

    // Verifica se o usuário tem role de advogado ou admin no tenant
    function isTenantLawyerOrAdmin(tenantId) {
      return isMember(tenantId) &&
        memberData(tenantId).role in ['admin', 'lawyer'];
    }

    // Verifica se o usuário pode escrever dados no tenant (admin, lawyer, secretary)
    function canWriteInTenant(tenantId) {
      return isMember(tenantId) &&
        memberData(tenantId).role in ['admin', 'lawyer', 'secretary'];
    }

    // ─── Usuários ─────────────────────────────────────────────────────────────

    match /users/{userId} {
      allow get: if request.auth != null && request.auth.uid == userId;
      // list necessário para busca por email ao convidar membros para um tenant
      allow list: if request.auth != null;
      allow create: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.role == 'USER';
      allow update: if isSystemAdmin()
        || (request.auth != null && request.auth.uid == userId
            && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']))
        // Qualquer usuário autenticado pode atualizar SOMENTE o campo tenantIds de outro usuário.
        // Necessário para que addMember funcione entre tenants distintos (regras bloqueiam cross-user).
        // Seguro porque o acesso real aos dados do tenant exige registro em tenants/{id}/members.
        || (request.auth != null
            && request.resource.data.diff(resource.data).affectedKeys().hasAll(['tenantIds'])
            && request.resource.data.diff(resource.data).affectedKeys().size() == 1);
    }

    // ─── Perfis de usuário ────────────────────────────────────────────────────

    match /userProfiles/{userId} {
      allow read: if request.auth != null;
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

    // ─── Tenants (escritórios) ────────────────────────────────────────────────

    match /tenants/{tenantId} {
      // Qualquer membro pode ler o tenant
      allow get: if isMember(tenantId);
      // Somente admin do tenant pode atualizar dados do escritório
      allow update: if isTenantAdmin(tenantId);
      // Qualquer usuário autenticado pode criar um tenant (cria o próprio escritório)
      allow create: if request.auth != null;
      // Somente admin global pode deletar
      allow delete: if isSystemAdmin();

      // Conexões de IA do escritório — somente admin lê e escreve
      match /aiConnections/{connectionId} {
        allow read, write: if isTenantAdmin(tenantId);
      }

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

    match /tenants/{tenantId} {
      // Qualquer membro pode ler o tenant
      allow get: if isMember(tenantId);
      // Somente admin do tenant pode atualizar dados do escritório
      allow update: if isTenantAdmin(tenantId);
      // Qualquer usuário autenticado pode criar um tenant (cria o próprio escritório)
      allow create: if request.auth != null;
      // Somente admin global pode deletar
      allow delete: if isSystemAdmin();

      // Conexões de IA do escritório — somente admin lê e escreve
      match /aiConnections/{connectionId} {
        allow read, write: if isTenantAdmin(tenantId);
      }

      // Membros do tenant
      match /members/{memberId} {
        // Membros leem a lista de membros do próprio tenant
        allow read: if isMember(tenantId);
        // Admin do tenant adiciona/altera/remove membros.
        // Exceção de bootstrap: o dono do tenant pode se adicionar como primeiro membro
        // (necessário pois isTenantAdmin exige que o usuário já seja membro — deadlock sem esta regra).
        allow create: if isTenantAdmin(tenantId)
          || (request.auth != null
              && request.auth.uid == memberId
              && get(/databases/$(database)/documents/tenants/$(tenantId)).data.ownerId == request.auth.uid);
        allow update, delete: if isTenantAdmin(tenantId);
      }

      // Lookups de pessoa — qualquer membro lê; qualquer membro com escrita cria e deleta
      match /personTypes/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /personOccupations/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /personNationalities/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /personMaritalStatuses/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /personCities/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /personRelationships/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }

      // Pessoas
      match /persons/{personId} {
        allow read: if isMember(tenantId);
        allow create, update: if canWriteInTenant(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Anotações da pessoa — criação por qualquer membro com escrita; exclusão só admin
        match /notes/{noteId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow delete: if isTenantAdmin(tenantId);
        }

        // Documentos da pessoa — upload por qualquer membro com escrita; exclusão só admin
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
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

      // Lookups de processo — qualquer membro lê; advogado/admin cria e deleta
      match /caseAreas/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }
      match /casePhases/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }
      match /caseStatuses/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }
      match /caseInstances/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }
      match /caseActionTypes/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }
      match /caseCourts/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }
      match /caseDistricts/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }
      match /caseJudges/{id} {
        allow read: if isMember(tenantId);
        allow create: if canWriteInTenant(tenantId);
        allow delete: if isTenantLawyerOrAdmin(tenantId);
      }

      // Tipos de documento — compartilhado entre pessoas, processos e contratos
      match /documentTypes/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }

      // Processos
      match /cases/{caseId} {
        allow read: if isMember(tenantId);
        allow create, update: if isTenantLawyerOrAdmin(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Anotações do processo — criação por qualquer membro com escrita; exclusão só admin
        match /notes/{noteId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow delete: if isTenantAdmin(tenantId);
        }

        // Documentos do processo — upload por qualquer membro com escrita; exclusão só admin
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow delete: if isTenantAdmin(tenantId);
        }
      }

      // Lookups de contrato — qualquer membro lê; qualquer membro com escrita cria e deleta
      match /contractTypes/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractCategories/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractStatuses/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractObjects/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractAdjustmentIndexes/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractAdjustmentPeriodicities/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractCurrencies/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractPaymentMethods/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractBanks/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }
      match /contractCostCenters/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
      }

      // Contratos
      match /contracts/{contractId} {
        allow read: if isMember(tenantId);
        allow create, update: if isTenantLawyerOrAdmin(tenantId);
        allow delete: if isTenantAdmin(tenantId);

        // Anotações do contrato — criação por qualquer membro com escrita; exclusão só admin
        match /notes/{noteId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow delete: if isTenantAdmin(tenantId);
        }

        // Documentos do contrato — upload por qualquer membro com escrita; exclusão só admin
        match /documents/{documentId} {
          allow read: if isMember(tenantId);
          allow create: if canWriteInTenant(tenantId);
          allow delete: if isTenantAdmin(tenantId);
        }
      }

      // Tipos de prazo (lookup dinâmico por tenant)
      match /deadlineTypes/{id} {
        allow read: if isMember(tenantId);
        allow create, delete: if canWriteInTenant(tenantId);
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
      }

      // Pushes do Tribunal (notificações de email processadas)
      match /pushes/{pushId} {
        allow read: if isMember(tenantId);
        // Cloud Functions criam pushes (via Admin SDK, ignora estas regras)
        // Membros podem atualizar status
        allow update: if isMember(tenantId)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']);
        // Somente admin pode deletar
        allow delete: if isTenantAdmin(tenantId);
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
                    || memberData(resource.data.tenantId).role == 'admin'))
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
      allow create, update, delete: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
    }

    match /newsTagLinks/{linkId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // ─── Interações com boletins ──────────────────────────────────────────────

    match /newsInteractions/{interactionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
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

    // ─── Filtros salvos ───────────────────────────────────────────────────────

    match /savedFilters/{filterId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
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

    // ─── Documentos de processos ──────────────────────────────────────────────
    // Path: tenants/{tenantId}/cases/{caseId}/{filename}
    // (reservado para uso futuro — uploads de documentos de processos)
    match /tenants/{tenantId}/cases/{caseId}/{allPaths=**} {
      allow read: if request.auth != null
        && firestore.exists(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid));
      allow write: if request.auth != null
        && firestore.exists(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid))
        && request.resource.size < 20 * 1024 * 1024;     // máximo 20 MB
    }

    // ─── Documentos de pessoas ───────────────────────────────────────────────
    // Path: tenants/{tenantId}/persons/{personId}/{filename}
    match /tenants/{tenantId}/persons/{personId}/{allPaths=**} {
      allow read: if request.auth != null
        && firestore.exists(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid));
      allow create: if request.auth != null
        && firestore.exists(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid))
        && request.resource.size < 20 * 1024 * 1024;     // máximo 20 MB
      allow delete: if request.auth != null
        && firestore.get(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid)).data.role == 'admin';
    }

    // ─── Documentos de contratos ──────────────────────────────────────────────
    // Path: tenants/{tenantId}/contracts/{contractId}/{filename}
    match /tenants/{tenantId}/contracts/{contractId}/{allPaths=**} {
      allow read: if request.auth != null
        && firestore.exists(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid));
      allow create: if request.auth != null
        && firestore.exists(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid))
        && request.resource.size < 20 * 1024 * 1024;     // máximo 20 MB
      allow delete: if request.auth != null
        && firestore.get(/databases/(default)/documents/tenants/$(tenantId)/members/$(request.auth.uid)).data.role == 'admin';
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
| `tenants/{id}/cases` | `status` ASC, `createdAt` DESC | Para listar processos ativos |
| `tenants/{id}/pushes` | `tenantId` ASC, `receivedAt` DESC | Para ordenar pushes por data de recebimento |
| `tenants/{id}/pushes` | `status` ASC, `receivedAt` DESC | Para filtrar pushes por status |
| `news` | `tenantId` ASC, `createdAt` DESC | Para listar notícias por escopo (sistema ou tenant) |
| `members` (collectionGroup) | `userId` ASC | Para descobrir tenants de um usuário |
| `gmailConnections` | `email` ASC, `tenantId` ASC | Para buscar conexões Gmail por email na Cloud Function |

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
