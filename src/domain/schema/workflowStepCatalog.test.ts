import { describe, expect, it } from 'vitest';
import { coreStepMetadata, inputsForTemplateSource } from './workflowStepCatalog';

const renderDocument = () => coreStepMetadata('render-document');

const ids = (inputs: { id: string }[]) => inputs.map((input) => input.id);

describe('inputsForTemplateSource — o passo "Gerar documento"', () => {
  it('com um modelo de dados, o registro some e os dados aparecem', () => {
    const inputs = inputsForTemplateSource(renderDocument().inputs, 'payload');
    expect(ids(inputs)).not.toContain('recordId');
    expect(ids(inputs)).toContain('payload');
  });

  it('com um modelo de registro, os dados somem e o registro passa a ser obrigatório', () => {
    const inputs = inputsForTemplateSource(renderDocument().inputs, 'record');
    expect(ids(inputs)).not.toContain('payload');
    expect(inputs.find((input) => input.id === 'recordId')?.required).toBe(true);
  });

  it('sem modelo escolhido, tudo aparece e nada é cobrado — o catálogo não exige o registro', () => {
    const inputs = inputsForTemplateSource(renderDocument().inputs, null);
    expect(ids(inputs)).toEqual(expect.arrayContaining(['recordId', 'payload']));
    expect(inputs.find((input) => input.id === 'recordId')?.required).toBe(false);
  });
});
