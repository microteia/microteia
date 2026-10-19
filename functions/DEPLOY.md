# Guia de Deploy de Cloud Functions

> **Este arquivo é derivado do `package.json`.** Os grupos `deploy:*` são a fonte de verdade, e
> `scripts/deployLists.test.ts` é o que garante que nenhuma function exportada fique fora deles. Se as
> duas pontas divergirem, o `package.json` está certo e este arquivo está velho.

As 28 Cloud Functions estão organizadas em **6 grupos**, para deploys seletivos nos
NOSSOS ambientes (`microteia-dev` e `curatino`), onde todas sobem.

**Grupo não é dono.** 5 destas functions pertencem a uma extensão, declaradas no
`manifest.backend` dela, e **não** entram na baseline do pacote distribuível: no projeto Firebase de um
escritório elas só são deployadas se ele tiver instalado a extensão, pelo `microteia provision`. Estão
marcadas abaixo. Ver "Artefatos de backend por extensão" no `ARCHITECTURE.md`.

## Grupos de Functions

### 🔐 AUTH — Autenticação e Usuários
Autenticação, criação de usuário e validação de apelidos.

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

### 👥 TENANT — Gestão de Membros
Adicionar e remover membros de um escritório, de forma atômica.

**Functions:**
- `addTenantMember`
- `removeTenantMember`

**Deploy:**
```bash
npm run deploy:tenant
```

---

### 🚪 PORTAL — Acesso de convidados externos
Quem é de FORA do escritório vê só os registros vinculados a ele, por uma projeção que o servidor
mantém.

**Functions:**
- `invitePortalUser` (onCall) — convida e vincula a um registro-sujeito; cria a conta, se preciso, depois de gravar a marca em `portalInvites` (é o que faz o `onUserCreated` não abrir escritório)
- `revokePortalUser` (onCall) — revoga um vínculo ou o convite inteiro
- `getPortalContext` (onCall) — o nome do escritório e as telas expostas, já traduzidas
- `getPortalDocumentUrl` (onCall) — a URL de um documento compartilhado, depois de conferir o acesso
- `submitPortalRecord` (onCall) — o convidado cria um registro; o vínculo é carimbado pelo servidor e a gravação passa pelo motor de registros (`via: 'portal'`)
- `projectPortalRecord` (Firestore `tenants/{t}/{coleção}/{id}`) — grava/apaga a projeção em `portalRecords`
- `projectPortalDocument` (Firestore `tenants/{t}/{coleção}/{id}/documents/{doc}`) — o documento compartilhado
- `refreshPortalAudience` (Firestore `tenants/{t}/portalUsers/{uid}`) — refaz o `audience` quando o convite muda
- `reprojectPortalOnScreenChange` (Firestore `tenants/{t}/screenDefinitions/{id}`) — refaz as coleções do portal quando a declaração muda

**Deploy:**
```bash
npm run deploy:portal
```

---

### 📋 AUDIT — Sistema de Auditoria
Registro do histórico de alterações e o backup frio do que expira.

**Functions:**
- `auditFlatEntityChange`
- `auditNestedEntityChange`
- `auditTenantDeleted`
- `backupDeletedAuditLog`

**Deploy:**
```bash
npm run deploy:audit
```

---

### ⚙️ WORKFLOW — Motor de Automações
O motor de automações, os catálogos que o cliente lê e as execuções sob demanda.

**Functions:**
- `onWorkflowEventCreated`
- `publishWorkflowEventOnEntityChange`
- `recomputeAggregatesOnEntityChange`
- `onNoteChange`
- `onDocumentChange`
- `getExpressionFunctions`
- `getWorkflowStepCatalog`
- `detectWorkflows`
- `runWorkflow`
- `runScript`
- `runAction`

**Deploy:**
```bash
npm run deploy:workflow
```

---

### 📄 DOCUMENTS — Geração de Documentos e Downloads
A geração a partir de um modelo e a limpeza dos arquivos de Downloads vencidos.

**Functions:**
- `renderDocument` — o gesto "Gerar documento" (aba Documentos ou Downloads)
- `attachDownloadToRecord` — "Anexar a um registro" na tela Downloads: move o arquivo para a aba Documentos
- `previewDocument` — a pré-visualização da tela de modelos (rascunho mesclado, sem gerar arquivo)
- `onDownloadDeleted` — apaga do bucket o arquivo do item de Downloads que o TTL (ou a pessoa) removeu

**Deploy:**
```bash
npm run deploy:documents
```

---

### 🛠️ UTIL — Utilitários Gerais
Proxy de IA e registro de falhas do frontend.

**Functions:**
- `callAIProxy`
- `logClientError`

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
