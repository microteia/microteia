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
