# Guia de Deploy de Cloud Functions

As Cloud Functions estão organizadas em **6 grupos** para facilitar deploys seletivos e rápidos.

## Grupos de Functions

### 🔐 AUTH - Autenticação e Usuários
Funções relacionadas a autenticação, criação de usuários e validação de apelidos.

**Functions:**
- `getUserInfo`
- `checkNicknameAvailability`
- `claimNickname`
- `onUserCreated`

**Deploy:**
```bash
npm run deploy:auth
```

---

### 👥 TENANT - Gestão de Membros
Funções para adicionar/remover membros de tenants (escritórios).

**Functions:**
- `addTenantMember`
- `removeTenantMember`

**Deploy:**
```bash
npm run deploy:tenant
```

---

### 📋 AUDIT - Sistema de Auditoria
Funções que registram histórico de alterações em todas as entidades.

**Functions:**
- `auditFlatEntityChange`
- `autirNestedEntityChange`
- `auditTenantDeleted`
- `auditNewsChange`
- `auditNewsCommentChange`
- `auditNewsTagChange`
- `backupDeletedLog`

**Deploy:**
```bash
npm run deploy:audit
```

---

### ⚙️ WORKFLOW - Motor de Automações
**Grupo que altera com mais frequência!** Funções do sistema de workflows (automações).

**Functions:**
- `onWorkflowEventCreated` - Executa workflows quando eventos são criados
- `publishWorkflowEventOnEntityChange` - Publica eventos de entidades (cases, contracts, etc)
- `onNoteChange` - Publica eventos de notas (case_note, person_note, etc)
- `onDocumentChange` - Publica eventos de documentos
- `getExpressionFunctions` - Retorna catálogo de funções disponíveis para expressões
- `getWorkflowStepCatalog` - Retorna catálogo de steps disponíveis para workflows

**Deploy:**
```bash
npm run deploy:workflow
```

---

### 📧 GMAIL - Integração Gmail
Funções para integração com Gmail (push notifications, renovação de watches).

**Functions:**
- `gmailPush`
- `renewGmailWatches`
- `exchangeGmailCode`

**Deploy:**
```bash
npm run deploy:gmail
```

---

### 🛠️ UTIL - Utilitários Gerais
Funções auxiliares e de infraestrutura.

**Functions:**
- `callAIProxy` - Proxy para chamadas à API da OpenAI
- `logClientError` - Log de erros do cliente
- `cascadeDeletePushInteractions` - Cascata de exclusão de interações de push

**Deploy:**
```bash
npm run deploy:util
```

---

## Deploy Completo

Para fazer deploy de **todas** as functions de uma vez:

```bash
npm run deploy:functions
```

Ou deploy completo (functions + hosting):

```bash
npm run deploy
```

---

## Exemplos de Uso

### Cenário 1: Alterei apenas o motor de workflows
```bash
# Build + deploy só das functions de workflow (mais rápido!)
npm run deploy:workflow
```

### Cenário 2: Alterei sistema de auditoria
```bash
npm run deploy:audit
```

### Cenário 3: Primeira vez ou mudanças em vários grupos
```bash
npm run deploy:functions
```

---

## Verificar Functions Deployadas

Para ver quais functions estão ativas no Firebase:

```bash
firebase functions:list --project curatino
```

---

## Dicas

1. **Deploy incremental é mais rápido:** Se você só alterou workflow, use `npm run deploy:workflow` ao invés de `npm run deploy:functions`. O deploy leva ~1-2min ao invés de ~5-8min.

2. **Workflow altera com frequência:** Como o sistema de automações está em constante evolução, o grupo `workflow` é o que você mais vai usar.

3. **Teste local antes:** Use o emulador do Firebase para testar localmente antes de fazer deploy:
   ```bash
   firebase emulators:start --only functions
   ```

4. **Logs em tempo real:** Para ver logs durante/após o deploy:
   ```bash
   firebase functions:log --project curatino
   ```
