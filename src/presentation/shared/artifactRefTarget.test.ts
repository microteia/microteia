import { describe, expect, it } from 'vitest';
import { artifactRefTarget } from './artifactRefTarget';
import type { NamedArtifact } from './artifactRefTarget';
import type { ArtifactRefOwner } from '../../domain/services/artifactLookup';

/**
 * O resolvedor devolve a REFERÊNCIA da frase, e é ela que o teste confere. Conferir a frase em si
 * seria conferir o catálogo — que tem gate próprio — e faria este teste falhar a cada redação nova.
 */
const resolve = (value: string | null | undefined, params?: Record<string, string>): string =>
  params ? `${value} ${JSON.stringify(params)}` : String(value);

const doPacote: NamedArtifact = {
  id: 'wf-9f1c',
  name: '@com.microteia.lawyer.automacao/workflow.cadastrar-partes',
  sourceId: 'wf-cadastrar-partes',
  ownerPluginIds: ['com.microteia.lawyer.automacao'],
};

const doEscritorio: NamedArtifact = { id: 'wf-local', name: 'Meu fluxo' };

const dona = (over: Partial<ArtifactRefOwner> = {}): ArtifactRefOwner => ({
  id: 'com.microteia.lawyer.automacao',
  active: true,
  exports: ['wf-cadastrar-partes'],
  ...over,
});

const REF = 'com.microteia.lawyer.automacao/wf-cadastrar-partes';

describe('artifactRefTarget', () => {
  /**
   * O defeito que originou tudo: o passo aponta o artefato de outra extensão, executa certo, e o
   * editor o desenhava como ausente porque procurava o valor gravado na coleção local por id.
   */
  it('resolve o nome do artefato a partir de uma referência qualificada', () => {
    const target = artifactRefTarget(resolve, [doPacote, doEscritorio], REF, [dona()]);

    expect(target.reason).toBeNull();
    expect(target.localId).toBe('wf-9f1c');
    expect(target.option?.label).toBe('@com.microteia.lawyer.automacao/workflow.cadastrar-partes');
  });

  /**
   * O valor da linha é o GRAVADO, não o id do documento: reescolher o mesmo alvo no seletor devolve
   * a referência qualificada, e é ela que precisa continuar gravada para sobreviver à extensão dona
   * ser reinstalada.
   */
  it('mantém a referência qualificada como valor da linha, nunca o id do documento', () => {
    const target = artifactRefTarget(resolve, [doPacote], REF, [dona()]);

    expect(target.option?.value).toBe(REF);
  });

  it('acha o artefato do próprio escritório pelo id local', () => {
    const target = artifactRefTarget(resolve, [doPacote, doEscritorio], 'wf-local', [dona()]);

    expect(target.option).toEqual({ value: 'wf-local', label: 'Meu fluxo' });
    expect(target.reason).toBeNull();
  });

  /**
   * Id local que não casa com nada é ausência da coleção do escritório mesmo — a única em que a frase
   * genérica de quem desenha está certa, e por isso a única sem motivo próprio.
   */
  it('não dá motivo para um id local ausente', () => {
    const target = artifactRefTarget(resolve, [doPacote], 'wf-apagado', [dona()]);

    expect(target.option).toBeNull();
    expect(target.reason).toBeNull();
  });

  it('diz que a extensão dona não está instalada', () => {
    const target = artifactRefTarget(resolve, [], REF, []);

    expect(target.option).toBeNull();
    expect(target.reason).toContain('@core.automation/step.target.ref.owner-absent');
    expect(target.reason).toContain('com.microteia.lawyer.automacao');
    expect(target.reason).toContain('wf-cadastrar-partes');
  });

  /**
   * Antes de `owner-inactive` de propósito: a dona está lá e não promete aquele id, então religá-la
   * não faria o artefato aparecer, e mandar religar primeiro custaria uma volta inútil.
   */
  it('diz que a extensão dona não exporta aquele id', () => {
    const target = artifactRefTarget(resolve, [], REF, [dona({ exports: ['outro'] })]);

    expect(target.reason).toContain('@core.automation/step.target.ref.not-exported');
    expect(target.reason).toContain('com.microteia.lawyer.automacao');
  });

  /** `exports` ausente é "não exporta nada", a mesma leitura do portão da instalação. */
  it('trata a dona sem exports declarados como quem não exporta o id', () => {
    const target = artifactRefTarget(resolve, [], REF, [dona({ exports: undefined })]);

    expect(target.reason).toContain('@core.automation/step.target.ref.not-exported');
  });

  it('diz que a extensão dona está desligada', () => {
    const target = artifactRefTarget(resolve, [], REF, [dona({ active: false })]);

    expect(target.reason).toContain('@core.automation/step.target.ref.owner-inactive');
  });

  /**
   * A dona está lá, ligada, e promete o id — e o documento não existe. É o resto honesto: nada do
   * que se sabe explica a ausência, e dizê-la assim é melhor que atribuí-la a uma causa errada.
   */
  it('diz que o registro do artefato não foi instalado quando nada mais explica a ausência', () => {
    const target = artifactRefTarget(resolve, [], REF, [dona()]);

    expect(target.reason).toContain('@core.automation/step.target.ref.artifact-absent');
  });

  /**
   * O dono precisa bater, e não só o `sourceId`: a instalação deduplica por `sourceId` sem olhar de
   * quem é, então sem o filtro a referência acharia a cópia de outra extensão.
   */
  it('não confunde o artefato de outra dona que divide o sourceId', () => {
    const deOutraDona: NamedArtifact = {
      id: 'wf-outro',
      name: 'Homônimo',
      sourceId: 'wf-cadastrar-partes',
      ownerPluginIds: ['com.terceiro.pack'],
    };
    const target = artifactRefTarget(resolve, [deOutraDona], REF, [dona()]);

    expect(target.option).toBeNull();
    expect(target.reason).toContain('@core.automation/step.target.ref.artifact-absent');
  });
});
