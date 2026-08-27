import { describe, expect, it } from 'vitest';
import { isMessageRef } from './i18n/messageRef';
import { ENTITY_REGISTRY_LIST } from './entityRegistry';
import { LOOKUP_REGISTRY_LIST } from './lookupRegistry';
import { CORE_FIELD_RULE_PRESETS } from './fieldRulePresets';
import { CORE_STEP_CATALOG } from './workflowStepCatalog';
import { WORKFLOW_EVENT_CATALOG } from './eventCatalog';
import { KERNEL_PERMISSIONS } from './access/kernelPermissions';

/**
 * **Nenhum rótulo dos catálogos de DADO do kernel é texto — todos são referência.**
 *
 * Este teste existe porque a mesma falha voltou de cinco lugares diferentes, e sempre pela mesma
 * fresta: o ESLint só vê literal em português quando ele tem acento ou está solto no JSX. `'Membro'`,
 * `'Documentos'`, `'Tipo'`, `'Lista'`, `'Objeto'`, `'Campo'` — nenhum tem acento, nenhum é JSX, e
 * todos apareciam na tela. Alargar o gatilho por acento marcaria todo identificador do projeto; a
 * defesa que funciona é sobre a FORMA DO DADO, não sobre a sintaxe.
 *
 * A verificação é `isMessageRef`, e não "começa com @", porque a forma importa: `@core.data` sem a
 * barra não é referência nenhuma, e passaria pelo teste mais frouxo até alguém abrir a tela.
 *
 * **Um catálogo novo entra nesta lista.** É a única manutenção que ele pede, e é deliberado que seja
 * manual: só quem escreve o catálogo sabe quais campos dele um humano lê. Rótulo composto — que junta
 * dois textos com um separador — não tem lugar aqui nem em lugar nenhum: a composição é do catálogo de
 * mensagens (`'{screen}: {entity}'`), porque é no separador que o idioma se esconde.
 */
const rotulosDe = (): { catalogo: string; onde: string; valor: string }[] => {
  const rotulos: { catalogo: string; onde: string; valor: string }[] = [];
  const push = (catalogo: string, onde: string, valor: string | undefined) => {
    if (valor !== undefined && valor.trim() !== '') rotulos.push({ catalogo, onde, valor });
  };

  ENTITY_REGISTRY_LIST.forEach((entity) => {
    push('ENTITY_REGISTRY', `${entity.key}.labelSingular`, entity.labelSingular);
    push('ENTITY_REGISTRY', `${entity.key}.labelPlural`, entity.labelPlural);
    entity.fields.forEach((field) => {
      push('ENTITY_REGISTRY', `${entity.key}.${field.key}.label`, field.label);
      push('ENTITY_REGISTRY', `${entity.key}.${field.key}.placeholder`, field.ui?.placeholder);
    });
  });

  LOOKUP_REGISTRY_LIST.forEach((lookup) => {
    push('LOOKUP_REGISTRY', `${lookup.collection}.screenLabel`, lookup.screenLabel);
    push('LOOKUP_REGISTRY', `${lookup.collection}.entityLabel`, lookup.entityLabel);
  });

  CORE_FIELD_RULE_PRESETS.forEach((preset) => {
    push('CORE_FIELD_RULE_PRESETS', `${preset.key}.label`, preset.label);
    push('CORE_FIELD_RULE_PRESETS', `${preset.key}.mask.placeholder`, preset.mask?.placeholder);
    push('CORE_FIELD_RULE_PRESETS', `${preset.key}.validate.message`, preset.validate?.message);
  });

  CORE_STEP_CATALOG.forEach((step) => {
    push('CORE_STEP_CATALOG', `${step.id}.name`, step.name);
    push('CORE_STEP_CATALOG', `${step.id}.description`, step.description);
    step.inputs.forEach((input) => {
      push('CORE_STEP_CATALOG', `${step.id}.${input.id}.label`, input.label);
      push('CORE_STEP_CATALOG', `${step.id}.${input.id}.description`, input.description);
      if (input.options?.kind === 'Static') {
        input.options.options.forEach((option) => {
          push('CORE_STEP_CATALOG', `${step.id}.${input.id}.option.${option.value}`, option.label);
        });
      }
    });
    step.outputDefinitions.forEach((output) => {
      push('CORE_STEP_CATALOG', `${step.id}.out.${output.id}.label`, output.label);
    });
  });

  WORKFLOW_EVENT_CATALOG.forEach((entry) => {
    push('WORKFLOW_EVENT_CATALOG', `${entry.name}.label`, entry.label);
    Object.entries(entry.labelParams ?? {}).forEach(([chave, valor]) => {
      push('WORKFLOW_EVENT_CATALOG', `${entry.name}.labelParams.${chave}`, valor);
    });
    entry.fields.forEach((field) => {
      push('WORKFLOW_EVENT_CATALOG', `${entry.name}.field.${field.path}`, field.label);
    });
  });

  KERNEL_PERMISSIONS.forEach((permission) => {
    push('KERNEL_PERMISSIONS', `${permission.id}.name`, permission.name);
    push('KERNEL_PERMISSIONS', `${permission.id}.description`, permission.description);
  });

  return rotulos;
};

describe('catálogos de dado do kernel — todo rótulo é referência', () => {
  it('a varredura encontra rótulo para conferir em cada catálogo', () => {
    const porCatalogo = new Set(rotulosDe().map((rotulo) => rotulo.catalogo));

    // Sem esta asserção, um `forEach` sobre lista vazia passaria calado — e o teste que passa sem
    // olhar nada é pior que teste nenhum, porque parece cobertura.
    expect([...porCatalogo].sort()).toStrictEqual([
      'CORE_FIELD_RULE_PRESETS',
      'CORE_STEP_CATALOG',
      'ENTITY_REGISTRY',
      'KERNEL_PERMISSIONS',
      'LOOKUP_REGISTRY',
      'WORKFLOW_EVENT_CATALOG',
    ]);
  });

  it('nenhum rótulo é texto', () => {
    const texto = rotulosDe().filter((rotulo) => !isMessageRef(rotulo.valor));

    expect(
      texto.map((rotulo) => `${rotulo.catalogo} › ${rotulo.onde} = ${JSON.stringify(rotulo.valor)}`),
    ).toStrictEqual([]);
  });
});
