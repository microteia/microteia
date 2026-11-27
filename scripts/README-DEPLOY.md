# Deploy das Cloud Functions nos nossos projetos

O deploy das functions em `microteia-dev` e `curatino` é feito por `microteia deploy-functions`
(`cli/src/vendor/deployOwnFunctions.ts`) — o mesmo caminho do `microteia deploy` do Console. Ele
substituiu o `deploy-functions-individually.cjs`.

## Uso

```bash
# Um grupo (a lista de cada um está no package.json)
npm run deploy:workflow

# Todas, por nome
npm run deploy:functions

# Produção
TARGET=prod npm run deploy:portal

# Direto, com as opções
npm run build:cli
node cli/lib/index.js deploy-functions --only functions:runReport,functions:draftReport
node cli/lib/index.js deploy-functions --skip functions:agentMcp --batch 5
node cli/lib/index.js deploy-functions --all          # não pergunta ao projeto o que ele já roda
```

| Opção | O que faz |
|---|---|
| `--target dev\|prod` | o projeto; sem ela, o `TARGET` do ambiente, e `dev` por padrão |
| `--only a,b` / `--skip a,b` | filtra as functions (com ou sem o prefixo `functions:`) |
| `--batch <n>` | quantas functions por `firebase deploy`; o padrão é `DEFAULT_FUNCTION_BATCH` |
| `--delay <s>` | espera entre um lote e o próximo |
| `--all` | sobe todas, sem comparar o carimbo |
| `--force` | repassa `--force` ao `firebase` (confirma política de repetição e APAGA cópias em outra região) |

## O que ele faz

1. Apaga `functions/lib` e compila UMA vez (`npm run build:functions`).
2. Pergunta ao projeto o que ele roda e avisa de cópia em região abandonada.
3. Sobe em lotes, com uma cópia do `firebase.json` sem o `predeploy`. O que um lote não subiu é tentado
   sozinho, na mesma passada, para dizer o motivo; o que ainda falhar ganha uma segunda passada.
4. Antes, sonda o carimbo: se o código que sobe é o mesmo que o projeto já roda, o grupo não sobe.

Por que sempre por nome: o `microteia-dev` tem functions de outro módulo que este código não declara, e
`firebase deploy --only functions` inteiro aborta pedindo para apagá-las.

Se a máquina estiver lenta e a análise do código estourar 10 s, use `FUNCTIONS_DISCOVERY_TIMEOUT=120`.

Detalhes: "Deploy das functions — em lotes, e duas passadas" no `ARCHITECTURE.md`.
