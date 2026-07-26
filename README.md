# Microteia

SaaS multi-tenant de gestão de escritórios. Cada escritório (tenant) opera de forma isolada: clientes, processos, prazos e financeiro ficam em subcoleções dedicadas no Firestore (`tenants/{tenantId}/{coleção}/{docId}`). Um usuário pode pertencer a múltiplos escritórios e alternar entre eles após o login.

## Tecnologias

- **Frontend:** React 19 + TypeScript + Vite
- **Estilização:** Styled Components (temas dark/light/claude/teams/bruma/kindle)
- **Backend:** Firebase (Auth + Firestore + Storage + Functions)
- **Roteamento:** React Router v7
- **Arquitetura:** Clean Architecture + MVVM

## Pré-requisitos

- Node.js 18+
- npm
- Conta Firebase com projeto configurado

## Instalação

1. Clone o repositório:
```bash
git clone <repository-url>
cd microteia
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Adicione suas credenciais do Firebase no `.env`:
```env
VITE_API_KEY=your_api_key
VITE_AUTH_DOMAIN=your_auth_domain
VITE_PROJECT_ID=your_project_id
VITE_STORAGE_BUCKET=your_storage_bucket
VITE_MESSAGING_SENDER_ID=your_sender_id
VITE_APP_ID=your_app_id
VITE_MEASUREMENT_ID=your_measurement_id
```

## Executando o projeto

```bash
# Desenvolvimento
npm run dev          # http://localhost:5173

# Verificação de qualidade (obrigatório antes de commit)
npm run verify       # tsc --noEmit + eslint --max-warnings 0

# Build de produção
npm run build

# Preview do build
npm run preview
```

## Deploy (Firebase Hosting)

```bash
# Build + deploy
npm run build
firebase deploy --only hosting

# Preview temporário (sem afetar produção)
firebase hosting:channel:deploy preview
```

## Estrutura do Projeto

```
src/
├── domain/          # Entidades, interfaces de repositório e use cases
├── data/            # Implementações Firebase dos repositórios
├── infrastructure/  # Config do Firebase, DIContainer, eventos, deeplink
├── stores/          # Contextos React globais (Auth, Tenant, Clients, Cases…)
├── presentation/    # Páginas e componentes (padrão MVVM por pasta)
├── routes/          # Proteção de rotas
└── shared/          # Tipos e estilos globais
```

Para detalhes de arquitetura, padrões de código e regras Firestore, consulte [ARCHITECTURE.md](./ARCHITECTURE.md).

## Módulos

| Módulo | Descrição |
|---|---|
| **Clientes** | Cadastro e gestão de clientes do escritório |
| **Processos** | Acompanhamento de processos jurídicos por cliente |
| **Prazos** | Controle de prazos processuais com calendário |
| **Financeiro** | Receitas, despesas e honorários por escritório |
| **Notícias** | Feed de notícias jurídicas (sistema e por escritório) |
| **Configurações** | Perfil, tema, membros do escritório e integrações |

## Multi-tenant

- Ao fazer login pela primeira vez, um escritório padrão é criado automaticamente.
- O tenant ativo fica em `useTenant().currentTenant`; todos os stores de dados só carregam quando ele não é `null`.
- Roles por escritório: `admin`, `lawyer`, `secretary`, `user`. Role global: `ADMIN` | `USER`.
- O último escritório escolhido é salvo em `localStorage` com chave `microteia:lastTenantId`.

## Autenticação

Firebase Authentication com Google Sign-In.
