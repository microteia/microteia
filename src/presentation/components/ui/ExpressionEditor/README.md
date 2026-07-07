# ExpressionEditor — Melhorias de Validação e IntelliSense

Este documento descreve as melhorias implementadas no componente `ExpressionEditor` para workflows.

## 📋 Visão Geral

O `ExpressionEditor` permite que usuários criem expressões dinâmicas em workflows, com validação em tempo real e autocomplete inteligente. Com a integração do `expr-eval` e as 40+ novas funções, o editor agora oferece:

1. **Validação melhorada** usando o parser do `expr-eval`
2. **IntelliSense expandido** com snippets, categorias e contextos
3. **Mensagens de erro específicas** com dicas de correção

---

## 🔍 Validação Melhorada

### Antes
- Validava strings não fechadas
- Verificava parênteses balanceados
- Validava existência de funções
- Validava campos do evento

### Agora
✅ **Tudo acima, mais:**
- **Validação sintática real** usando o parser do `expr-eval`
- **Validação de aridade**: detecta funções com número incorreto de argumentos
  - Exemplo: `addDays(today())` → erro: "requer 2 argumentos, mas recebeu 1"
- **Mensagens de erro descritivas** com sugestões
- **Detecção de funções não fechadas**
- **Validação de operadores** e expressões incompletas

### Arquivo: `expressionValidator.ts`

```typescript
// Valida sintaxe + aridade de funções
validateExpressionWithParser(expression, availableFunctions)
```

**Assinaturas conhecidas** (para validação de argumentos):
- `today()` — 0 args
- `addDays(data, dias)` — 2 args
- `if(condição, seVerdadeiro, seFalso)` — 3 args
- `concat(valor1, valor2, ...)` — 1+ args
- `formatDate(data, formato)` — 2 args
- E mais 40+ funções

---

## 💡 IntelliSense Expandido

### Antes
- Autocomplete de funções ao digitar nomes
- Autocomplete de campos ao digitar `event.campo`

### Agora
✅ **Tudo acima, mais:**

#### 1. **Snippets Prontos**
Sugestões de padrões comuns com placeholders:

- `if - condicional` → `if(${condição}, ${valorVerdadeiro}, ${valorFalso})`
- `formatDate - data brasileira` → `formatDate(${data}, "DD/MM/YYYY")`
- `coalesce - valor padrão` → `coalesce(${valor}, "${padrão}")`
- `concat - juntar textos` → `concat(${texto1}, " ", ${texto2})`
- `dateDiff - diferença em dias` → `dateDiff(${data1}, ${data2}, "days")`

#### 2. **Contextos Reconhecidos**
Autocomplete para:
- `event.` → campos do evento que disparou o workflow
- `input.` → dados de entrada configurados para o step
- `output.` → saídas de steps anteriores

#### 3. **Categorias Visuais**
Cada função/snippet mostra sua categoria:
- 📅 **Data**
- 📝 **Texto**
- 🔢 **Operador**
- 🔀 **Condicional**
- ✅ **Validação**
- 💡 **Snippet**
- 📦 **Contexto**

#### 4. **Assinaturas Detalhadas**
Mostra a assinatura da função ao passar o mouse:
- `formatDate(data, formato)`
- `dateDiff(data1, data2, unidade)`
- `if(condição, valorSeVerdadeiro, valorSeFalso)`

### Arquivo: `autocompleteHelpers.ts`

```typescript
// Constrói lista de autocomplete com base no contexto
buildAutocompleteItems(mode, query, functions, eventFields, includeSnippets)

// Insere snippet com placeholders
insertSnippet(text, snippet, cursorPos)
```

---

## 🎨 Melhorias Visuais

### FunctionMenu Redesenhado

**Antes:**
```
formatDate()
Formata uma data
```

**Agora:**
```
formatDate()                    [DATA]
formatDate(data, formato)
Formata uma data usando um padrão (YYYY-MM-DD HH:mm:ss)
```

- **Header** com nome da função + categoria
- **Detail** (assinatura em itálico)
- **Description** (em múltiplas linhas se necessário)
- **Altura máxima** aumentada de 200px para 300px
- **Largura** aumentada de 240px para 280-400px

---

## 🚀 Exemplos de Uso

### Exemplo 1: Formatação de Data
Digite: `format`

**Sugestões:**
1. ✨ `formatDate - data brasileira` → `formatDate(today(), "DD/MM/YYYY")`
2. 📅 `formatDate()` → `formatDate(data, formato)`
3. 📝 `formatCPF()` → `formatCPF(texto)`
4. 📝 `formatCNPJ()` → `formatCNPJ(texto)`

### Exemplo 2: Condicionais
Digite: `if`

**Sugestões:**
1. ✨ `if - condicional` → `if(condition, trueValue, falseValue)`
2. 🔀 `if()` → `if(condição, valorSeVerdadeiro, valorSeFalso)`

### Exemplo 3: Contextos
Digite: `e`

**Sugestões:**
1. 📦 `event` → dados do evento
2. 🔀 `isEmpty()` → verifica se valor está vazio
3. 🔀 `isEmail()` → valida e-mail
4. ...

### Exemplo 4: Validação em Tempo Real

**Expressão:** `addDays(today())`

**Validação:**
❌ "Função 'addDays' requer no mínimo 2 argumentos, mas recebeu 1"

**Corrigindo:** `addDays(today(), 5)`

**Validação:**
✅ "Expressão válida ✓"

---

## 📚 Funções Disponíveis (40+)

### 📅 Data (9)
- `today()`, `now()`, `addDays(data, dias)`
- `formatDate(data, formato)`, `dateDiff(data1, data2, unidade)`
- `dayOfWeek(data)`, `isWeekend(data)`
- `year(data)`, `month(data)`, `day(data)`

### 📝 Texto (11)
- `concat(...)`, `upper(texto)`, `lower(texto)`, `length(valor)`, `trim(texto)`
- `replace(texto, busca, subst)`, `substring(texto, início, fim)`
- `startsWith(texto, prefixo)`, `endsWith(texto, sufixo)`
- `split(texto, sep)`, `join(array, sep)`

### 🔢 Matemática (8)
- `round(num, decimais)`, `floor(num)`, `ceil(num)`, `abs(num)`
- `min(...)`, `max(...)`, `sum(array)`, `avg(array)`

### 📊 Array (4)
- `first(array)`, `last(array)`, `contains(array, valor)`, `indexOf(arrayOuTexto, valor)`

### 🔀 Condicional/Lógica (8)
- `if(cond, true, false)`, `and(...)`, `or(...)`, `not(valor)`
- `isEmpty(valor)`, `isNull(valor)`, `isNotNull(valor)`, `coalesce(...)`

### ✅ Validação Brasil (5)
- `isCPF(texto)`, `isCNPJ(texto)`, `isEmail(texto)`
- `formatCPF(texto)`, `formatCNPJ(texto)`

### 💾 Variável (1)
- `getVar(nome)`

---

## 🛠️ Arquivos Modificados

### Novos Arquivos
1. `expressionValidator.ts` — validação com `expr-eval` + aridade
2. `autocompleteHelpers.ts` — construção de autocomplete com snippets

### Arquivos Atualizados
1. `ExpressionEditor.viewmodel.tsx` — integra nova validação e autocomplete
2. `FunctionMenu.view.tsx` — mostra categoria e assinatura
3. `FunctionMenu.styles.tsx` — estilos para Header, Category, Detail

### Dependências Adicionadas
- `expr-eval` (frontend) — para validação sintática

---

## 🎯 Benefícios

1. **Menos erros:** Validação detecta problemas antes de salvar
2. **Mais produtividade:** Snippets aceleram criação de expressões comuns
3. **Melhor descoberta:** Categorias e contextos facilitam encontrar funções
4. **Autoexplicativo:** Assinaturas mostram o que cada função espera
5. **Experiência moderna:** IntelliSense comparável a IDEs profissionais

---

## 📖 Para Desenvolvedores

### Adicionar Nova Função

1. **Backend** (`functions/src/domain/engine/expression/builtins/`):
   ```typescript
   export const minhaFuncaoFn: ExpressionFunction = {
     name: 'minhaFuncao',
     call: ([arg1, arg2]) => { /* lógica */ },
     description: 'Descrição clara',
     signature: 'minhaFuncao(arg1, arg2)',
     example: 'minhaFuncao("teste", 123)',
     category: 'Texto', // ou Data, Operador, etc
   };
   ```

2. **Registrar** em `ExpressionEngine.ts`:
   ```typescript
   import { minhaFuncaoFn } from './builtins/minhaFuncaoFn';
   [/* ... */, minhaFuncaoFn].forEach((fn) => expressionFunctions.register(fn));
   ```

3. **Validação** (frontend, `expressionValidator.ts`):
   ```typescript
   const FUNCTION_SIGNATURES: Record<string, FunctionSignature> = {
     // ...
     minhaFuncao: { name: 'minhaFuncao', minArgs: 2, maxArgs: 2 },
   };
   ```

Pronto! A função aparece automaticamente no autocomplete com categoria, assinatura e validação.

### Adicionar Snippet

Em `autocompleteHelpers.ts`:

```typescript
const COMMON_SNIPPETS: AutocompleteItem[] = [
  // ...
  {
    value: 'meuSnippet(${1:param}, "${2:valor}")',
    label: 'meuSnippet - descrição curta',
    description: 'Descrição completa do snippet',
    category: 'Snippet',
    snippet: 'meuSnippet(${1:param}, "${2:valor}")',
  },
];
```

**Placeholders:**
- `${1:param}` — primeiro campo a preencher, padrão "param"
- `${2:valor}` — segundo campo, padrão "valor"
- O cursor posiciona automaticamente no primeiro placeholder após inserção

---

## 🧪 Testando

1. **Validação:**
   - Digite uma expressão incompleta: `addDays(today()` → erro de parênteses
   - Digite função com args errados: `if(true, "sim")` → erro de aridade

2. **Snippets:**
   - Digite `format` → selecione "formatDate - data brasileira"
   - Veja o cursor posicionado no primeiro placeholder

3. **Contextos:**
   - Digite `event.` → veja campos disponíveis
   - Digite `input.` ou `output.` → veja sugestões de contexto

4. **Categorias:**
   - Abra o autocomplete → veja badges de categoria ao lado de cada função
   - Observe assinaturas em itálico abaixo do nome

---

## 📝 Notas Finais

- A validação é **assíncrona** com debounce de 400ms para não travar a digitação
- O autocomplete **prioriza matches exatos** e que começam com a query
- Snippets **só aparecem no modo função**, não ao digitar `event.campo`
- Altura do menu adapta automaticamente para caber na tela
