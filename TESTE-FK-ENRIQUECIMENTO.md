# Guia de Teste - Auto-Enriquecimento de FKs

## Implementação Concluída ✅

### O que foi implementado:

1. **FkEnricher Service** (`functions/src/infrastructure/workflow/FkEnricher.ts`)
   - Enriquece FKs fixas usando `ENTITY_FK_SCHEMA`
   - Enriquece FKs customizadas usando `ScreenDefinition`
   - Suporta FKs únicas e múltiplas
   - Denormaliza apenas campos especificados (performance)

2. **Integração com Workflows** (`publishWorkflowEventOnEntityChange.ts`)
   - Substituiu código hardcoded de denormalização
   - Carrega `ScreenDefinition` para entidades com campos customizados
   - Enriquece payload antes de publicar evento

3. **Migração de Schema** (`auditFkSchema.ts`)
   - Agora é re-export de `entitySchemas.ts`
   - Mantém compatibilidade com código existente
   - Marcado como deprecated

---

## Como Funciona

### Antes (Problema Original)

```typescript
// Workflow step com expressão
event.customValues.tarefa.nome

// Payload do evento:
{
  customValues: {
    tarefa: "abc123"  // ← Apenas ID, não objeto!
  }
}

// Resultado: ❌ Erro "tentativa de acessar propriedade nome em valor não-objeto"
```

### Depois (Auto-Enriquecimento)

```typescript
// Mesma expressão
event.customValues.tarefa.nome

// Payload do evento (ENRIQUECIDO automaticamente):
{
  customValues: {
    tarefa: {  // ← Objeto completo!
      id: "abc123",
      title: "Nome da Tarefa",
      screenKey: "tarefas",
      values: { nome: "Nome da Tarefa", ... }
    }
  }
}

// Resultado: ✅ "Nome da Tarefa"
```

---

## Teste Manual

### 1. Criar Campo de Referência (se não existir)

**a) Acesse Personalização (ícone de engrenagem)**

**b) Crie ou edite a tela "Processos"**

**c) Adicione um campo customizado:**
- Nome do campo: `Tarefa Principal`
- Nome na base (fieldName): `tarefa` 
- Tipo: `Vínculo com registro`
- Tela vinculada: Escolha uma tela customizada (ex: `Tarefas`)

**d) Salve**

---

### 2. Criar Workflow com Expressão que Acessa FK

**a) Acesse Workflows**

**b) Crie novo workflow:**
- Gatilho: `Ao salvar: Processo`
- Nome: `Teste FK Enriquecimento`

**c) Adicione Step "Criar Prazo":**
- Processo: Use expressão `event.id`
- Descrição: Use expressão `concat("Tarefa: ", event.customValues.tarefa.nome)`
- Data de vencimento: Data fixa qualquer
- Tipo: Qualquer

**d) Salve o workflow**

---

### 3. Testar Enriquecimento

**a) Crie ou edite um Processo**

**b) Preencha o campo "Tarefa Principal" com um registro existente**
- O campo deve mostrar uma lista de registros da tela customizada
- Selecione um registro que tenha um campo "nome" preenchido

**c) Salve o Processo**

**d) Verifique se o workflow executou:**
- Verifique a lista de Prazos
- Deve ter sido criado um prazo novo
- A descrição do prazo deve conter: `"Tarefa: [Nome da Tarefa]"`

**Resultado esperado:**
- ✅ Prazo criado com sucesso
- ✅ Descrição contém o nome da tarefa (não "undefined" ou erro)

---

### 4. Verificar Logs de Execução

**a) Acesse o console do Firebase Functions:**

```bash
firebase functions:log --project curatino
```

**b) Procure por logs de workflow**

**c) Verifique que o payload enriquecido contém:**
```
customValues: {
  tarefa: {
    id: "...",
    title: "...",
    values: { nome: "..." }
  }
}
```

---

## Casos de Teste

### Caso 1: FK para Entidade Fixa

**Setup:**
- Campo: `Contrato` (refEntity: `contracts`)
- Expressão: `event.customValues.contrato.number`

**Resultado esperado:**
- ✅ Retorna o número do contrato

---

### Caso 2: FK para Tela Customizada

**Setup:**
- Campo: `Tarefa` (refEntity: tela customizada)
- Expressão: `event.customValues.tarefa.nome`

**Resultado esperado:**
- ✅ Retorna o nome/título da tarefa

---

### Caso 3: FK Múltipla (Array)

**Setup:**
- Campo: `Tags` (multi: true)
- Expressão: `event.customValues.tags` (sem acessar propriedade)

**Resultado esperado:**
- ✅ Retorna array de objetos enriquecidos
- Cada objeto tem { id, title, ... }

---

### Caso 4: FK Null/Undefined

**Setup:**
- Campo de referência não preenchido
- Expressão: `event.customValues.tarefa.nome`

**Resultado esperado:**
- ✅ Não causa erro (campo ausente no customValues)
- OU retorna valor padrão/null

---

## Troubleshooting

### Expressão ainda falha com "valor não-objeto"

**Possível causa:** ScreenDefinition não foi carregada

**Verificação:**
```bash
# Verifique se existe screenDefinition para a entidade
firebase firestore:get /tenants/{tenantId}/screenDefinitions/cases
```

**Solução:** Crie a screenDefinition se não existir (via Personalização)

---

### FK não está sendo enriquecida

**Possível causa 1:** Campo não é do tipo `reference`

**Verificação:**
- Acesse Personalização
- Verifique se o campo é tipo "Vínculo com registro"

**Possível causa 2:** ENTITY_FK_SCHEMA desatualizado

**Verificação:**
```bash
# Verifique se schemas estão sincronizados
npm run verify-schemas
```

---

### Workflow não executa

**Possível causa:** Erro na Cloud Function

**Verificação:**
```bash
firebase functions:log --project curatino | grep ERROR
```

**Solução:** 
1. Verifique o log de erro
2. Corrija o problema
3. Redeploy: `npm run deploy:workflow`

---

## Arquivos Modificados/Criados

### Criados:
- ✅ `functions/src/infrastructure/workflow/FkEnricher.ts`
- ✅ `src/domain/entities/entitySchemas.ts`
- ✅ `functions/src/domain/entities/entitySchemas.ts`
- ✅ `scripts/verify-schemas.cjs`

### Modificados:
- ✅ `functions/src/infrastructure/handlers/publishWorkflowEventOnEntityChange.ts`
- ✅ `functions/src/domain/services/auditFkSchema.ts` (deprecado, re-export)
- ✅ `package.json` (v0.44.23)
- ✅ `VERSIONS.md`
- ✅ `ARCHITECTURE.md`

---

## Próximos Passos

1. **Deploy das Cloud Functions:**
   ```bash
   npm run deploy:workflow
   ```

2. **Testar em produção** com os casos de teste acima

3. **Monitorar logs** para garantir que não há erros

4. **Adicionar mais FKs** em `ENTITY_FK_SCHEMA` conforme necessário

---

## Performance

### Considerações:

- **Cache de ScreenDefinitions**: Atualmente carrega do Firestore a cada evento
  - **Melhoria futura**: Implementar cache em memória com TTL

- **FKs múltiplas**: Arrays grandes podem ser lentos
  - Atualmente não enriquece arrays (mantém apenas IDs)
  - **Melhoria futura**: Enriquecer apenas se array.length < 10

- **Denormalização seletiva**: Apenas campos especificados em `denormalizedFields`
  - ✅ Performance otimizada

---

## Exemplo Completo

```typescript
// ScreenDefinition (cases)
{
  fields: [
    {
      key: "tarefa",
      type: "reference",
      refEntity: "tarefas",  // tela customizada
      required: false
    }
  ]
}

// Processo salvo
{
  id: "processo-1",
  caseNumber: "001/2024",
  customValues: {
    tarefa: "tarefa-123"  // ID da tarefa
  }
}

// Evento publicado (ANTES do enriquecimento)
{
  id: "processo-1",
  caseNumber: "001/2024",
  customValues: {
    tarefa: "tarefa-123"
  }
}

// Evento publicado (DEPOIS do enriquecimento) ✨
{
  id: "processo-1",
  caseNumber: "001/2024",
  customValues: {
    tarefa: {
      id: "tarefa-123",
      title: "Elaborar petição inicial",
      screenKey: "tarefas",
      values: {
        nome: "Elaborar petição inicial",
        prazo: "2024-07-10",
        ...
      }
    }
  }
}

// Expressão no workflow
concat("Tarefa: ", event.customValues.tarefa.nome)

// Resultado
"Tarefa: Elaborar petição inicial" ✅
```

---

**🚀 PRONTO PARA TESTE!**

Execute os testes acima e verifique se o enriquecimento automático está funcionando.
