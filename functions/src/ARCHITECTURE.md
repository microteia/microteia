# Arquitetura das Cloud Functions - Curatino

## Estrutura SOLID Refatorada

Esta estrutura segue os princípios SOLID e a arquitetura em camadas do projeto Curatino.

### Hierarquia de Camadas

```
domain ← data ← infrastructure
```

Camadas só dependem das que estão à sua esquerda. **Nunca** ao contrário.

---

## Estrutura de Diretórios

```
functions/src/
  domain/              # Camada de domínio - regras de negócio
    entities/          # Entidades e tipos do domínio
    repositories/      # Interfaces de repositórios e serviços
    usecases/          # Casos de uso (lógica de negócio)
  
  data/                # Camada de dados - implementações concretas
    repositories/      # Implementações dos repositórios (Firebase)
    services/          # Serviços externos (IA, OAuth, etc)
  
  infrastructure/      # Camada de infraestrutura - configuração
    firebase/          # Inicialização do Firebase
    di/                # Container de Injeção de Dependências
    handlers/          # Handlers das Cloud Functions
  
  index.ts             # Ponto de entrada - apenas re-exporta handlers
```

---

## Princípios SOLID Aplicados

### 1. Single Responsibility Principle (SRP)
Cada classe/módulo tem uma única responsabilidade:
- **Entities**: Definem apenas estruturas de dados
- **Repositories**: Apenas acesso a dados
- **Services**: Apenas comunicação com APIs externas
- **Use Cases**: Apenas lógica de negócio
- **Handlers**: Apenas orquestração HTTP

### 2. Open/Closed Principle (OCP)
Aberto para extensão, fechado para modificação:
- Novos provedores de IA podem ser adicionados implementando `IAIProviderService`
- Novos repositórios podem ser criados sem alterar os existentes

### 3. Liskov Substitution Principle (LSP)
Implementações podem substituir interfaces:
- `FirebaseAIConnectionRepository` pode substituir `IAIConnectionRepository`
- Qualquer serviço de IA pode substituir `IAIProviderService`

### 4. Interface Segregation Principle (ISP)
Interfaces específicas e coesas:
- `IAIConnectionRepository` - apenas buscar credenciais
- `ITenantMemberRepository` - apenas verificar membros
- `IAIProviderService` - apenas chamar provedor de IA

### 5. Dependency Inversion Principle (DIP)
Dependências apontam para abstrações:
- Use Cases dependem de **interfaces**, não de implementações concretas
- O `DIContainer` injeta as implementações concretas

---

## Fluxo de Dados

### Exemplo: callAIProxy

```
1. Handler (callAIProxy.ts)
   ↓ valida autenticação e parâmetros
   
2. Use Case (GetDefaultAICredentialsUseCase)
   ↓ valida permissões + busca credenciais
   
3. Repository (FirebaseAIConnectionRepository)
   ↓ consulta Firestore
   
4. Use Case (CallAIAnalysisUseCase)
   ↓ escolhe provedor + executa análise
   
5. Service (OpenAIService / AnthropicService / etc)
   ↓ chama API externa
   
6. Handler
   ↓ retorna resultado ao cliente
```

---

## Como Adicionar Nova Funcionalidade

### 1. Criar Entidades (domain/entities/)
```typescript
export interface MinhaEntidade {
  id: string;
  nome: string;
}
```

### 2. Criar Interface do Repositório (domain/repositories/)
```typescript
export interface IMeuRepositorio {
  buscar(id: string): Promise<MinhaEntidade>;
}
```

### 3. Criar Use Case (domain/usecases/)
```typescript
export type MeuUseCase = {
  execute: (id: string) => Promise<MinhaEntidade>;
};

export const makeMeuUseCase = (repo: IMeuRepositorio): MeuUseCase => ({
  execute: (id: string) => repo.buscar(id),
});
```

### 4. Implementar Repositório (data/repositories/)
```typescript
export class FirebaseMeuRepositorio implements IMeuRepositorio {
  constructor(private readonly db: Firestore) {}
  
  async buscar(id: string): Promise<MinhaEntidade> {
    // implementação
  }
}
```

### 5. Registrar no DIContainer (infrastructure/di/container.ts)
```typescript
getMeuUseCase(): MeuUseCase {
  if (!this.meuUC) {
    const repo = new FirebaseMeuRepositorio(getDb());
    this.meuUC = makeMeuUseCase(repo);
  }
  return this.meuUC;
}
```

### 6. Criar Handler (infrastructure/handlers/)
```typescript
export const minhaFunction = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    const di = getDI();
    const useCase = di.getMeuUseCase();
    const result = await useCase.execute(request.data.id);
    return result;
  },
);
```

### 7. Exportar no index.ts
```typescript
export { minhaFunction } from './infrastructure/handlers/minhaFunction';
```

---

## Padrões de Nomenclatura

### Use Cases
- Interface: `[Ação][Entidade]UseCase` (ex: `GetUserInfoUseCase`)
- Factory: `make[Ação][Entidade]UseCase` (ex: `makeGetUserInfoUseCase`)

### Repositórios
- Interface: `I[Nome]Repository` (ex: `IUserRepository`)
- Implementação: `Firebase[Nome]Repository` (ex: `FirebaseUserRepository`)

### Services
- Interface: `I[Nome]Service` (ex: `IAIProviderService`)
- Implementação: `[Nome]Service` (ex: `OpenAIService`)

---

## Testes

Para testar um Use Case:
```typescript
const mockRepo: IAIConnectionRepository = {
  getDefaultCredentials: jest.fn().mockResolvedValue({ ... }),
};

const useCase = makeGetDefaultAICredentialsUseCase(mockRepo, mockTenantRepo);
const result = await useCase.execute('tenant-1', 'user-1');
```

---

## Benefícios da Refatoração

✅ **Testabilidade**: Cada camada pode ser testada isoladamente  
✅ **Manutenibilidade**: Mudanças são localizadas e controladas  
✅ **Extensibilidade**: Novos provedores/repositórios sem alterar código existente  
✅ **Clareza**: Responsabilidades bem definidas  
✅ **Reusabilidade**: Use Cases podem ser reutilizados  
✅ **Inversão de Controle**: Fácil trocar implementações (mock, produção, etc)
