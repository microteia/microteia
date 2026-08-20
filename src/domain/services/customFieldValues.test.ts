import { describe, expect, it } from 'vitest';
import {
  buildInitialFormValues,
  fileNameFromUrl,
  formValuesToStoredValues,
  readRecordText,
  resolveRecordImageUrl,
  resolveRecordTabTitle,
  resolveRecordTitle,
  setValueByPath,
  toDateFieldInput,
  validateRequiredFields,
} from './customFieldValues';
import type { CustomFieldValue, FieldDefinition } from '../entities/entitySchemas';

type Values = Record<string, CustomFieldValue>;
const asValues = (obj: unknown): Values => obj as Values;

const dateField: FieldDefinition = {
  key: 'filedAt',
  label: 'Data de distribuição',
  type: 'date',
  required: false,
  order: 0,
  origin: 'design',
};

describe('buildInitialFormValues — campo de data', () => {
  it('traz a Date gravada de volta para o controle do formulário', () => {
    const form = buildInitialFormValues([dateField], { filedAt: new Date(2026, 6, 15) });
    expect(form.filedAt).toBe('2026-07-15');
  });

  it('aceita o Timestamp cru do Firestore', () => {
    const stored = { filedAt: { toDate: () => new Date(2026, 6, 15) } };
    expect(buildInitialFormValues([dateField], stored).filedAt).toBe('2026-07-15');
  });

  it('registro sem a data abre com o campo vazio', () => {
    expect(buildInitialFormValues([dateField], {}).filedAt).toBe('');
    expect(buildInitialFormValues([dateField], { filedAt: null }).filedAt).toBe('');
  });
});

describe('setValueByPath', () => {
  it('grava chave simples no topo (imutável)', () => {
    const before: Values = { name: 'Ana' };
    const after = setValueByPath(before, 'name', 'Bia');
    expect(after).toEqual({ name: 'Bia' });
    expect(before).toEqual({ name: 'Ana' });
  });

  it('cria o ramo aninhado quando ausente', () => {
    const after = setValueByPath({}, 'address.street', 'Rua A');
    expect(after).toEqual({ address: { street: 'Rua A' } });
  });

  it('mescla no ramo aninhado existente sem perder irmãos', () => {
    const before = asValues({ address: { street: 'Rua A', city: 'SP' } });
    const after = setValueByPath(before, 'address.city', 'RJ');
    expect(after).toEqual({ address: { street: 'Rua A', city: 'RJ' } });
    expect(before).toEqual({ address: { street: 'Rua A', city: 'SP' } });
  });

  it('preserva outras chaves de topo', () => {
    const before = asValues({ name: 'Ana', address: { street: 'Rua A' } });
    const after = setValueByPath(before, 'address.number', '10');
    expect(after).toEqual({ name: 'Ana', address: { street: 'Rua A', number: '10' } });
  });

  it('substitui um valor não-objeto por um ramo ao aprofundar', () => {
    const before = asValues({ address: 'x' });
    const after = setValueByPath(before, 'address.street', 'Rua A');
    expect(after).toEqual({ address: { street: 'Rua A' } });
  });
});

/**
 * `readRecordText` existe para distinguir "não tem" de "sem título": quem monta o cabeçalho e o
 * rótulo da aba precisa cair no próximo candidato quando o campo está vazio ou nem foi declarado.
 */
describe('readRecordText', () => {
  const record = { caseNumber: ' 123-4567 ', title: '', causeValue: 1500 };

  it('devolve o texto do campo, sem espaços nas pontas', () => {
    expect(readRecordText(record, 'caseNumber')).toBe('123-4567');
  });

  it('campo vazio, não declarado ou não textual devolve vazio — nunca "Sem título"', () => {
    expect(readRecordText(record, 'title')).toBe('');
    expect(readRecordText(record, '')).toBe('');
    expect(readRecordText(record, 'inexistente')).toBe('');
    expect(readRecordText(record, 'causeValue')).toBe('');
    expect(resolveRecordTitle(record, 'title')).toBe('@core.records/record.untitled');
  });
});

/**
 * A aba leva o TÍTULO do registro, não o subtítulo. A aba discordar da listagem, da busca e da
 * menção — que sempre mostraram o título — fazia o mesmo registro parecer dois.
 */
describe('resolveRecordTabTitle', () => {
  it('a aba leva o título do registro', () => {
    const processo = { title: 'Ação de Cobrança', caseNumber: '123-4567' };
    expect(resolveRecordTabTitle(processo, 'title', 'caseNumber')).toBe('Ação de Cobrança');
  });

  it('sem título preenchido, o subtítulo evita uma aba "Sem título"', () => {
    const processo = { title: '   ', caseNumber: '123-4567' };
    expect(resolveRecordTabTitle(processo, 'title', 'caseNumber')).toBe('123-4567');
  });

  it('sem os dois, sobra o rótulo genérico', () => {
    expect(resolveRecordTabTitle({}, 'title', 'caseNumber')).toBe('@core.records/record.untitled');
  });

  it('tela sem subtítulo declarado funciona igual', () => {
    expect(resolveRecordTabTitle({ name: 'Maria' }, 'name', '')).toBe('Maria');
  });
});

/**
 * A data guardada nem sempre é um `Date`: uma importação, um script ou uma automação gravam TEXTO.
 * Enquanto o corte era cru, `dd/mm/aaaa` virava "15/08/2026" — o formulário exibia vazio e o filtro
 * de intervalo comparava alfabeticamente contra `aaaa-mm-dd`, deixando de excluir o que devia.
 */
describe('toDateFieldInput', () => {
  it('lê Date e Timestamp pelo dia local', () => {
    expect(toDateFieldInput(new Date(2026, 7, 15))).toBe('2026-08-15');
    expect(toDateFieldInput({ toDate: () => new Date(2026, 7, 15) })).toBe('2026-08-15');
  });

  it('lê texto ISO, com ou sem hora', () => {
    expect(toDateFieldInput('2026-08-15')).toBe('2026-08-15');
    expect(toDateFieldInput('2026-08-15T03:00:00.000Z')).toBe('2026-08-15');
  });

  it('lê a data no formato do escritório', () => {
    expect(toDateFieldInput('15/08/2026')).toBe('2026-08-15');
    expect(toDateFieldInput('15-08-2026')).toBe('2026-08-15');
  });

  it('o que não é data devolve vazio, em vez de um texto que finge ser', () => {
    expect(toDateFieldInput('em breve')).toBe('');
    expect(toDateFieldInput(1755216000000)).toBe('');
    expect(toDateFieldInput(null)).toBe('');
    expect(toDateFieldInput(new Date('x'))).toBe('');
  });
});

const fileField: FieldDefinition = {
  key: 'photo',
  label: 'Foto',
  type: 'file',
  required: false,
  order: 0,
  origin: 'design',
};

const DOWNLOAD_URL = 'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/'
  + 'tenants%2Ft1%2Fpersons%2Fr9%2Ffields%2Fphoto%2F1723000000000_minha_foto.png'
  + '?alt=media&token=abc-123';

/**
 * O campo `file` grava uma URL, logo atravessa os três `default:` da conversão de valor. Estes testes
 * PRENDEM esse comportamento: um refactor de `default:` quebraria o tipo em silêncio.
 */
describe('campo de arquivo na conversão de valor', () => {
  it('a URL gravada volta para o formulário, e a ausência vira vazio', () => {
    expect(buildInitialFormValues([fileField], { photo: DOWNLOAD_URL }).photo).toBe(DOWNLOAD_URL);
    expect(buildInitialFormValues([fileField], {}).photo).toBe('');
  });

  it('vazio grava nulo; a URL grava como está', () => {
    expect(formValuesToStoredValues([fileField], { photo: '' }).photo).toBeNull();
    expect(formValuesToStoredValues([fileField], { photo: DOWNLOAD_URL }).photo).toBe(DOWNLOAD_URL);
  });

  it('obrigatório só passa com arquivo', () => {
    const required = { ...fileField, required: true };
    const t = ((key: string) => key) as unknown as Parameters<typeof validateRequiredFields>[0];
    expect(validateRequiredFields(t, [required], { photo: '' })).not.toBeNull();
    expect(validateRequiredFields(t, [required], { photo: DOWNLOAD_URL })).toBeNull();
  });
});

describe('fileNameFromUrl', () => {
  it('lê o nome original de uma URL de download, sem o carimbo de tempo', () => {
    expect(fileNameFromUrl(DOWNLOAD_URL)).toBe('minha_foto.png');
  });

  it('serve a um caminho cru e degrada para a entrada quando não há nome', () => {
    expect(fileNameFromUrl('tenants/t1/persons/r9/fields/photo/1723000000000_a.pdf')).toBe('a.pdf');
    expect(fileNameFromUrl('qualquer-coisa')).toBe('qualquer-coisa');
    expect(fileNameFromUrl('')).toBe('');
  });
});

describe('resolveRecordImageUrl', () => {
  it('devolve a URL quando a tela declara o campo e ele é de arquivo', () => {
    expect(resolveRecordImageUrl({ photo: DOWNLOAD_URL }, [fileField], 'photo')).toBe(DOWNLOAD_URL);
  });

  it('campo retipado NÃO alimenta a imagem — o cartão volta ao ícone da tela', () => {
    const retyped: FieldDefinition = { ...fileField, type: 'text' };
    expect(resolveRecordImageUrl({ photo: 'um texto qualquer' }, [retyped], 'photo')).toBeNull();
  });

  it('sem declaração, sem valor ou sem registro, não há imagem', () => {
    expect(resolveRecordImageUrl({ photo: DOWNLOAD_URL }, [fileField], null)).toBeNull();
    expect(resolveRecordImageUrl({ photo: '  ' }, [fileField], 'photo')).toBeNull();
    expect(resolveRecordImageUrl(null, [fileField], 'photo')).toBeNull();
  });
});
