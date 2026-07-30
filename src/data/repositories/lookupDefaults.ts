import type { LookupOption } from '../../domain/entities';

/**
 * Opções que já vêm prontas em cada lista do kernel. Antes viviam espalhadas como `DEFAULT_*` /
 * `STATIC_DEFAULTS` dentro dos ~30 repositórios de lookup; com o repositório único, o lugar delas é
 * aqui, indexadas pelo nome da coleção — a mesma chave que o campo usa em `lookupCollection`.
 *
 * São mescladas com as opções do tenant por `mergeLookupDefaults`, que descarta a duplicata: uma
 * opção do tenant com a mesma chave ou o mesmo rótulo de uma fixa não aparece duas vezes.
 */
const DECLARED: Record<string, Omit<LookupOption, 'isStatic'>[]> = {
  caseAreas: [
    { key: 'Cível', label: 'Cível' },
    { key: 'Criminal', label: 'Criminal' },
    { key: 'Trabalhista', label: 'Trabalhista' },
    { key: 'Tributário', label: 'Tributário' },
    { key: 'Família', label: 'Família' },
    { key: 'Consumidor', label: 'Consumidor' },
    { key: 'Administrativo', label: 'Administrativo' },
    { key: 'Constitucional', label: 'Constitucional' },
    { key: 'Ambiental', label: 'Ambiental' },
    { key: 'Imobiliário', label: 'Imobiliário' },
    { key: 'Empresarial', label: 'Empresarial' },
    { key: 'Digital', label: 'Digital' },
    { key: 'Outros', label: 'Outros' },
  ],
  caseInstances: [
    { key: '1º Grau', label: '1º Grau' },
    { key: '2º Grau', label: '2º Grau' },
    { key: 'Turma Recursal', label: 'Turma Recursal' },
    { key: 'STJ', label: 'STJ' },
    { key: 'STF', label: 'STF' },
    { key: 'TST', label: 'TST' },
    { key: 'TSE', label: 'TSE' },
  ],
  casePhases: [
    { key: 'Fase Inicial', label: 'Fase Inicial', color: 'casePhaseInitial' },
    { key: 'Instrução', label: 'Instrução', color: 'casePhaseInstruction' },
    { key: 'Sentença', label: 'Sentença', color: 'casePhaseSentence' },
    { key: 'Recurso', label: 'Recurso', color: 'casePhaseAppeal' },
    { key: 'Execução', label: 'Execução', color: 'casePhaseExecution' },
    { key: 'RPV', label: 'RPV', color: 'casePhaseExecution' },
    { key: 'Precatório', label: 'Precatório', color: 'casePhaseExecution' },
    { key: 'Arquivado', label: 'Arquivado', color: 'casePhaseArchived' },
  ],
  caseStatuses: [
    { key: 'Em Andamento', label: 'Em Andamento', color: 'caseStatusInProgress' },
    { key: 'Procedente', label: 'Procedente', color: 'caseStatusWon' },
    { key: 'Procedente em Parte', label: 'Procedente em Parte', color: 'caseStatusWon' },
    { key: 'Improcedente', label: 'Improcedente', color: 'caseStatusLost' },
    { key: 'Acordo', label: 'Acordo', color: 'caseStatusSettlement' },
    { key: 'Arquivado', label: 'Arquivado', color: 'caseStatusArchived' },
    { key: 'Suspenso', label: 'Suspenso', color: 'caseStatusSuspended' },
    { key: 'Extinto', label: 'Extinto', color: 'caseStatusLost' },
    { key: 'Rejeitado', label: 'Rejeitado', color: 'caseStatusArchived' },
  ],
  contractAdjustmentIndexes: [
    { key: 'INPC', label: 'INPC' },
    { key: 'IPCA', label: 'IPCA' },
  ],
  contractAdjustmentPeriodicities: [
    { key: 'Anual', label: 'Anual' },
  ],
  contractCategories: [
    { key: 'Cível', label: 'Cível' },
    { key: 'Empresarial', label: 'Empresarial' },
    { key: 'Trabalhista', label: 'Trabalhista' },
    { key: 'Imobiliário', label: 'Imobiliário' },
    { key: 'Societário', label: 'Societário' },
    { key: 'Propriedade Intelectual', label: 'Propriedade Intelectual' },
    { key: 'Tecnologia (TI)', label: 'Tecnologia (TI)' },
    { key: 'Financeiro', label: 'Financeiro' },
    { key: 'Consumidor', label: 'Consumidor' },
    { key: 'Administrativo', label: 'Administrativo' },
    { key: 'Tributário', label: 'Tributário' },
    { key: 'Público', label: 'Público' },
    { key: 'Agronegócio', label: 'Agronegócio' },
    { key: 'Família e Sucessões', label: 'Família e Sucessões' },
    { key: 'Outros', label: 'Outros' },
  ],
  contractCurrencies: [
    { key: 'Real', label: 'Real' },
  ],
  contractPaymentMethods: [
    { key: 'À vista', label: 'À vista' },
    { key: 'À prazo', label: 'À prazo' },
    { key: 'Boleto', label: 'Boleto' },
    { key: 'Cartão de Crédito', label: 'Cartão de Crédito' },
  ],
  contractStatuses: [
    { key: 'Em elaboração', label: 'Em elaboração', color: 'contractStatusDraft' },
    { key: 'Em revisão', label: 'Em revisão', color: 'contractStatusReview' },
    { key: 'Aguardando assinatura', label: 'Aguardando assinatura', color: 'contractStatusAwaitingSignature' },
    { key: 'Vigente', label: 'Vigente', color: 'contractStatusActive' },
    { key: 'Suspenso', label: 'Suspenso', color: 'contractStatusSuspended' },
    { key: 'Encerrado', label: 'Encerrado', color: 'contractStatusClosed' },
    { key: 'Cancelado', label: 'Cancelado', color: 'contractStatusCancelled' },
    { key: 'Rescindido', label: 'Rescindido', color: 'contractStatusTerminated' },
  ],
  contractTypes: [
    { key: 'Prestação de serviços', label: 'Prestação de serviços' },
    { key: 'Compra e venda', label: 'Compra e venda' },
    { key: 'Locação', label: 'Locação' },
    { key: 'Confissão de dívida', label: 'Confissão de dívida' },
    { key: 'Parceria', label: 'Parceria' },
    { key: 'Fornecimento', label: 'Fornecimento' },
    { key: 'Licenciamento', label: 'Licenciamento' },
    { key: 'NDA', label: 'NDA' },
    { key: 'Trabalho', label: 'Trabalho' },
    { key: 'Honorários advocatícios', label: 'Honorários advocatícios' },
    { key: 'Procuração', label: 'Procuração' },
    { key: 'Distrato', label: 'Distrato' },
    { key: 'Acordo', label: 'Acordo' },
  ],
  deadlineTypes: [
    { key: 'Audiência', label: 'Audiência' },
    { key: 'Recurso', label: 'Recurso' },
    { key: 'Contestação', label: 'Contestação' },
    { key: 'Petição', label: 'Petição' },
    { key: 'Pagamento', label: 'Pagamento' },
    { key: 'Outro', label: 'Outro' },
  ],
  documentTypes: [
    { key: 'Contrato', label: 'Contrato' },
    { key: 'Procuração', label: 'Procuração' },
    { key: 'Petição', label: 'Petição' },
    { key: 'Sentença', label: 'Sentença' },
    { key: 'Certidão', label: 'Certidão' },
    { key: 'RG', label: 'RG' },
    { key: 'CPF', label: 'CPF' },
    { key: 'Comprovante', label: 'Comprovante' },
    { key: 'Recibo', label: 'Recibo' },
    { key: 'Outros', label: 'Outros' },
  ],
  financialCategories: [
    { key: 'Honorários', label: 'Honorários' },
    { key: 'Êxito', label: 'Êxito' },
    { key: 'Mensalidade', label: 'Mensalidade' },
    { key: 'Custas Judiciais', label: 'Custas Judiciais' },
    { key: 'Perícia', label: 'Perícia' },
    { key: 'Deslocamento', label: 'Deslocamento' },
    { key: 'Escritório', label: 'Escritório' },
    { key: 'Impostos', label: 'Impostos' },
    { key: 'Outros', label: 'Outros' },
  ],
  financialStatuses: [
    { key: 'Aberto', label: 'Aberto', color: 'warning' },
    { key: 'Pago', label: 'Pago', color: 'success' },
    { key: 'Cancelado', label: 'Cancelado', color: 'textSecondary' },
  ],
  newsCategories: [
    { key: 'GENERAL', label: 'Geral' },
    { key: 'JURISPRUDENCE', label: 'Jurisprudência' },
    { key: 'LEGISLATION', label: 'Legislação' },
    { key: 'ANNOUNCEMENT', label: 'Comunicado' },
    { key: 'CIRCULAR', label: 'Circular' },
    { key: 'UPDATE', label: 'Atualização' },
  ],
  personGenders: [
    { key: 'Masculino', label: 'Masculino' },
    { key: 'Feminino', label: 'Feminino' },
    { key: 'Não Informado', label: 'Não Informado' },
  ],
  personMaritalStatuses: [
    { key: 'Solteiro(a)', label: 'Solteiro(a)' },
    { key: 'Casado(a)', label: 'Casado(a)' },
    { key: 'Divorciado(a)', label: 'Divorciado(a)' },
    { key: 'Viúvo(a)', label: 'Viúvo(a)' },
    { key: 'União estável', label: 'União estável' },
  ],
  personNationalities: [
    { key: 'Brasileira', label: 'Brasileira' },
  ],
  personRelationships: [
    { key: 'Cliente', label: 'Cliente', color: 'relationshipCliente' },
    { key: 'Parte', label: 'Parte', color: 'relationshipParte' },
    { key: 'Contato', label: 'Contato', color: 'relationshipContato' },
    { key: 'Fornecedor', label: 'Fornecedor', color: 'relationshipFornecedor' },
    { key: 'Sócio', label: 'Sócio', color: 'relationshipSocio' },
  ],
  personTypes: [
    { key: 'Pessoa Física', label: 'Pessoa Física' },
    { key: 'Pessoa Jurídica', label: 'Pessoa Jurídica' },
  ],
};

/**
 * `isStatic` é carimbado aqui, e não na declaração acima: opção que vem em código É fixa, por
 * definição. Deixar a marca a cargo de cada entrada faria dela algo que se esquece — e esquecê-la
 * põe a opção do kernel entre as do escritório, com botão de excluir e sem a cor do tema.
 */
export const LOOKUP_DEFAULTS: Record<string, LookupOption[]> = Object.fromEntries(
  Object.entries(DECLARED).map(([collection, options]) => [
    collection,
    options.map((option) => ({ ...option, isStatic: true })),
  ]),
);

export const lookupDefaultsFor = (collection: string): LookupOption[] => LOOKUP_DEFAULTS[collection] ?? [];
