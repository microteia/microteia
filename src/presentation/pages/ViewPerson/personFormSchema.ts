import type { FieldDefinition } from '../../../domain/entities';

const UF = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const ONLY_FISICA = 'type != "Pessoa Física"';

const f = (
  overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label' | 'type'>,
): FieldDefinition => ({
  required: false,
  order: 0,
  ...overrides,
});

export const PERSON_FORM_FIELDS: FieldDefinition[] = [
  f({ key: 'type', label: 'Tipo', type: 'select', required: true, lookupCollection: 'personTypes', optionsAllowUserAdd: true }),
  f({ key: 'name', label: 'Nome', type: 'text', required: true }),
  f({ key: 'cpf', label: 'CPF', type: 'masked', mask: 'cpf', logic: { hiddenWhen: ONLY_FISICA } }),
  f({ key: 'cnpj', label: 'CNPJ', type: 'masked', mask: 'cnpj', logic: { hiddenWhen: 'type != "Pessoa Jurídica"' } }),
  f({ key: 'email', label: 'E-mail', type: 'text', placeholder: 'email@exemplo.com' }),
  f({ key: 'phone', label: 'Telefone', type: 'masked', mask: 'phone' }),
  f({ key: 'secondaryPhone', label: 'Telefone Secundário', type: 'masked', mask: 'phone' }),
  f({ key: 'relationship', label: 'Relacionamento', type: 'select', lookupCollection: 'personRelationships', optionsAllowUserAdd: true }),
  f({ key: 'occupation', label: 'Profissão', type: 'select', lookupCollection: 'personOccupations', optionsAllowUserAdd: true, logic: { hiddenWhen: ONLY_FISICA } }),
  f({ key: 'nationality', label: 'Nacionalidade', type: 'select', lookupCollection: 'personNationalities', optionsAllowUserAdd: true, logic: { hiddenWhen: ONLY_FISICA } }),
  f({ key: 'maritalStatus', label: 'Estado Civil', type: 'select', lookupCollection: 'personMaritalStatuses', optionsAllowUserAdd: true, logic: { hiddenWhen: ONLY_FISICA } }),
  f({ key: 'birthDate', label: 'Data de Nascimento', type: 'date', logic: { hiddenWhen: ONLY_FISICA } }),
  f({ key: 'gender', label: 'Sexo', type: 'select', lookupCollection: 'personGenders', optionsAllowUserAdd: true, logic: { hiddenWhen: ONLY_FISICA } }),

  f({ key: 'addressZipCode', label: 'CEP', type: 'masked', mask: 'cep', section: 'Endereço' }),
  f({ key: 'addressStreet', label: 'Rua / Avenida', type: 'text', section: 'Endereço' }),
  f({ key: 'addressNumber', label: 'Número', type: 'text', section: 'Endereço' }),
  f({ key: 'addressComplement', label: 'Complemento', type: 'text', section: 'Endereço', placeholder: 'Apto, Sala...' }),
  f({ key: 'addressNeighborhood', label: 'Bairro', type: 'text', section: 'Endereço' }),
  f({ key: 'addressCity', label: 'Cidade', type: 'select', section: 'Endereço', lookupCollection: 'personCities', optionsAllowUserAdd: true }),
  f({
    key: 'addressState',
    label: 'Estado',
    type: 'select',
    section: 'Endereço',
    options: UF.map((uf) => ({ key: uf, label: uf, isStatic: true })),
  }),

  f({ key: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Informações adicionais sobre a pessoa' }),
];
