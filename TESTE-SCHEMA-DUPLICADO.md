# Guia de Teste - Schema Duplicado

## Implementação Concluída ✅

### Arquivos Criados/Modificados:

1. **Schemas Idênticos**:
   - ✅ `src/domain/entities/entitySchemas.ts`
   - ✅ `functions/src/domain/entities/entitySchemas.ts`

2. **Script de Verificação**:
   - ✅ `scripts/verify-schemas.cjs`

3. **Configuração**:
   - ✅ `package.json` - adicionados scripts `verify-schemas` e `verify`
   - ✅ `ARCHITECTURE.md` - nova seção "Schema Duplicado — Regra Absoluta"
   - ✅ `VERSIONS.md` - entrada para versão 0.44.22

---

## Testes Manuais

### 1. Verificar Sincronização (deve passar)

```bash
npm run verify-schemas
```

**Resultado esperado**:
```
✅ entitySchemas.ts sincronizado entre frontend e backend
```

---

### 2. Testar Divergência (deve falhar)

**a) Modificar apenas o arquivo do frontend:**

```bash
# Adicione uma linha qualquer no final do arquivo frontend
echo "// teste" >> src/domain/entities/entitySchemas.ts
```

**b) Execute a verificação:**

```bash
npm run verify-schemas
```

**Resultado esperado**:
```
❌ FALHA: entitySchemas.ts DIVERGENTE entre frontend e backend!
```

**c) Restaure o arquivo:**

```bash
git checkout src/domain/entities/entitySchemas.ts
```

**d) Verifique novamente (deve passar):**

```bash
npm run verify-schemas
```

---

### 3. Testar Comando Completo

```bash
npm run verify
```

**Resultado esperado**:
```
> typecheck
(sem erros)

> lint
(sem erros)

> verify-schemas
✅ entitySchemas.ts sincronizado entre frontend e backend
```

---

### 4. Verificar Estrutura dos Arquivos

**a) Conferir frontend:**

```bash
head -30 src/domain/entities/entitySchemas.ts
```

Deve mostrar:
- Cabeçalho com ⚠️ REGRA ABSOLUTA
- Tipos: CustomFieldType, FieldDefinition, ScreenDefinition
- ENTITY_FK_SCHEMA com cases, deadlines, etc.

**b) Conferir backend:**

```bash
head -30 functions/src/domain/entities/entitySchemas.ts
```

Deve ser **idêntico** ao frontend.

**c) Comparar diretamente:**

```bash
diff src/domain/entities/entitySchemas.ts functions/src/domain/entities/entitySchemas.ts
```

**Resultado esperado**: Nenhuma diferença (comando não imprime nada).

---

### 5. Testar Integração com Git

**a) Ver arquivos modificados:**

```bash
git status
```

Deve mostrar:
- `src/domain/entities/entitySchemas.ts` (novo)
- `functions/src/domain/entities/entitySchemas.ts` (novo)
- `scripts/verify-schemas.cjs` (novo)
- `package.json` (modificado)
- `ARCHITECTURE.md` (modificado)
- `VERSIONS.md` (modificado)

**b) Simular workflow de commit:**

```bash
# Antes de commitar, deve rodar verify
npm run verify
```

Se passar, está pronto para commit.

---

## Próximos Passos (Opcional)

### Implementar Auto-Enriquecimento de FKs

Com o schema agora centralizado, é possível implementar a denormalização automática de FKs em workflows:

1. **No backend** (`functions/src/infrastructure/workflow/`):
   - Criar `FkEnricher.ts` que usa `ENTITY_FK_SCHEMA`
   - Integrar em `publishWorkflowEventOnEntityChange.ts`

2. **Benefício**:
   - `event.customValues.tarefa` automaticamente terá `{ id, nome, ... }` em vez de só o ID
   - Expressões como `event.customValues.tarefa.nome` funcionarão naturalmente

**Quer que eu implemente isso agora ou prefere testar primeiro o schema duplicado?**

---

## Troubleshooting

### Script não encontrado

**Erro**: `Cannot find module 'scripts/verify-schemas.cjs'`

**Solução**: Verificar se o arquivo existe:
```bash
ls -la scripts/verify-schemas.cjs
```

### Permissão negada

**Erro**: `Permission denied`

**Solução**: Tornar executável:
```bash
chmod +x scripts/verify-schemas.cjs
```

### Divergência persistente

Se o script continua reportando divergência mesmo após copiar:

1. Verifique espaços em branco ocultos:
   ```bash
   cat -A src/domain/entities/entitySchemas.ts | tail
   cat -A functions/src/domain/entities/entitySchemas.ts | tail
   ```

2. Force normalização:
   ```bash
   # Copie o conteúdo exato
   cp src/domain/entities/entitySchemas.ts functions/src/domain/entities/entitySchemas.ts
   npm run verify-schemas
   ```

---

## Checklist Final

- [ ] `npm run verify-schemas` passa
- [ ] `npm run verify` passa (typecheck + lint + schemas)
- [ ] Arquivos frontend e backend são idênticos
- [ ] ARCHITECTURE.md documenta a regra
- [ ] Git status mostra os arquivos corretos

**Se todos os itens estão ✅, a implementação está completa!**
