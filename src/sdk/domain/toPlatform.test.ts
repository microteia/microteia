import { describe, expect, it } from 'vitest';
import { modelScreenInputs } from './toPlatform';
import { parseDomainModel } from './domainModel';
import { salesBehaviorModel, salesModel } from './fixtures.test-support';

const fieldOf = (model: ReturnType<typeof salesModel>, collection: string, key: string) =>
  modelScreenInputs(model, () => undefined)
    .find((screen) => screen.key === collection)
    ?.fields.find((field) => field.key === key);

describe('denormalização declarada no modelo', () => {
  it('vira o nome de navegação do campo de referência — e nada além disso é gravado', () => {
    const model = salesBehaviorModel();
    const relationship = model.relationships.find((one) => one.denormalize)!;
    const collection = model.entities.find((entity) => entity.name === relationship.sourceEntity)!.collection!;

    const field = fieldOf(model, collection, relationship.sourceField);
    expect(field).toMatchObject({ type: 'reference', refDenormKey: relationship.denormalize!.denormKey });
    const declared = model.entities.find((entity) => entity.name === relationship.sourceEntity)!.fields.map((one) => one.key);
    expect(modelScreenInputs(model, () => undefined).find((screen) => screen.key === collection)?.fields.map((one) => one.key))
      .toEqual(declared);
  });

  it('sem a declaração, o campo não ganha nome de navegação', () => {
    const model = salesModel();
    const screens = modelScreenInputs(model, () => undefined);
    expect(screens.flatMap((screen) => screen.fields).some((field) => field.refDenormKey)).toBe(false);
  });
});

describe('onde o campo é desenhado (`visibleIn`, #12)', () => {
  it('atravessa do modelo para a tela, e a superfície desconhecida fica de fora', () => {
    const model = salesModel();
    const entity = model.entities[0];
    const raw = JSON.parse(JSON.stringify(model)) as { entities: { fields: Record<string, unknown>[] }[] };
    raw.entities[0].fields[0].visibleIn = ['card', 'grid'];
    const parsed = parseDomainModel(raw);
    if (!parsed.ok) throw new Error('o modelo de exemplo deixou de ser lido');
    expect(parsed.model.entities[0].fields[0].visibleIn).toEqual(['card']);

    const collection = entity.collection ?? entity.name;
    const screens = modelScreenInputs(parsed.model, () => undefined);
    const screen = screens.find((one) => one.key === collection) ?? screens[0];
    expect(screen.fields.find((one) => one.key === entity.fields[0].key)?.visibleIn).toEqual(['card']);
  });
});

