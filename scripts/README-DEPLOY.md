# Deploy Individual de Firebase Functions

Script que resolve o problema de limite de CPU ao fazer deploy de todas as Firebase Functions simultaneamente.

## Problema

Ao executar `firebase deploy --only functions`, o Firebase pode falhar com erro de limite de CPU quando há muitas functions sendo deployadas ao mesmo tempo.

## Solução

O script `deploy-functions-individually.cjs` faz deploy de cada function isoladamente, com delay configurável entre deploys.

## Uso Básico

```bash
# Deploy de todas as functions (delay padrão de 1 segundo)
npm run deploy:functions:individual

# Ou diretamente
node scripts/deploy-functions-individually.cjs
```

## Opções

### Ajustar delay entre deploys

```bash
# Aguardar 30 segundos entre cada deploy
node scripts/deploy-functions-individually.cjs --delay 30

# Aguardar 60 segundos (recomendado para evitar limites)
node scripts/deploy-functions-individually.cjs --delay 60
```

### Deployar apenas functions específicas

```bash
# Deploy apenas de callAIProxy e getUserInfo
node scripts/deploy-functions-individually.cjs --only callAIProxy,getUserInfo
```

### Pular functions específicas

```bash
# Deployar todas exceto auditFlatEntityChange
node scripts/deploy-functions-individually.cjs --skip auditFlatEntityChange

# Pular múltiplas functions
node scripts/deploy-functions-individually.cjs --skip auditFlatEntityChange,auditNestedEntityChange
```

### Combinar opções

```bash
# Delay de 45s, apenas workflow e AI
node scripts/deploy-functions-individually.cjs --delay 45 --only callAIProxy,detectWorkflows,runWorkflow
```

## O que o script faz

1. **Compila as functions** uma única vez (`npm run build:functions`)
2. **Faz deploy individual** de cada function com `firebase deploy --only functions:nomeDaFunction`
3. **Aguarda** o delay configurado entre cada deploy
4. **Mostra progresso** detalhado de cada function
5. **Salva log** em `.deploy-log.json` com resumo de sucessos e falhas
6. **Retorna exit code** 0 se tudo passou, 1 se houve falhas

## Exemplo de saída

```
═══════════════════════════════════════════════════════════
  Deploy Individual de Firebase Functions — Microteia
═══════════════════════════════════════════════════════════
Total de functions: 30
Delay entre deploys: 30s
───────────────────────────────────────────────────────────

🔧 Compilando functions...

✅ Compilação concluída.

───────────────────────────────────────────────────────────
Iniciando deploys individuais...
───────────────────────────────────────────────────────────

[1/30] ━━━ callAIProxy
[1/30] Iniciando deploy...
[1/30] ✅ Deploy de callAIProxy concluído com sucesso

⏳ Aguardando 30s antes do próximo deploy...

[2/30] ━━━ copyPublicWorkflow
...
```

## Tempo estimado

Com delay de 30s entre deploys:
- **30 functions × 30s = ~15 minutos** (apenas delays)
- **+ tempo de deploy de cada function** (varia)
- **Total: ~20-30 minutos**

Com delay de 1s (padrão):
- **Total: ~5-10 minutos**

## Ajuda

```bash
node scripts/deploy-functions-individually.cjs --help
```

## Nota

Se encontrar limites de CPU mesmo com este script, aumente o `--delay` para 60 ou 90 segundos.
