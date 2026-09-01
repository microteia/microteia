import { describe, it, expect } from 'vitest';
import { buildMessageCatalog, translate } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import { buildPermissionCatalog } from '../../domain/schema/access';
import { collectionPermissionResources } from '../../domain/services/collectionPermissionResources';
import { screenTagCollections } from '../../domain/services/screenDataCollection';
import { LOOKUP_REGISTRY_LIST } from '../../domain/schema/lookupRegistry';
import { CORE_DATA_MESSAGES, CORE_RECORDS_MESSAGES, coreMessage } from '../coreMessages';

const catalogoDeMensagens = buildMessageCatalog(
  [coreMessage('core.data', CORE_DATA_MESSAGES), coreMessage('core.records', CORE_RECORDS_MESSAGES)],
  'en',
);

const telaComEtiquetas = {
  titleSingular: 'Consultation',
  titlePlural: 'Consultations',
  tagCollection: 'consultas_tags',
  fields: [],
};

describe('as coleções do escritório como recursos de permissão', () => {
  it('leva os PARÂMETROS do rótulo, não só a referência', () => {
    const [recurso] = collectionPermissionResources(screenTagCollections([telaComEtiquetas]));
    expect(recurso).toEqual({
      id: 'consultas_tags',
      name: '@core.records/tag-list.of',
      nameParams: { name: 'Consultations' },
      deriveCrud: true,
    });
  });

  /**
   * O defeito que este teste guarda: o rótulo chegava à tela de Perfis de acesso sem nada para
   * interpolar, e o que a pessoa lia era o próprio template — em maiúsculas, por causa do estilo do
   * cabeçalho de grupo, e em qualquer idioma.
   */
  it('o rótulo do recurso resolve inteiro, sem sobrar token para interpolar', () => {
    const catalogo = buildPermissionCatalog([], collectionPermissionResources(screenTagCollections([telaComEtiquetas])));
    const rotulo = catalogo.resourceLabels.get('consultas_tags');
    expect(resolveLabel(catalogoDeMensagens, rotulo?.name, rotulo?.nameParams)).toBe('Tags: Consultations');
  });

  /**
   * Coleção RESERVADA tem regra própria no `firestore.rules`, com permissão própria — o curinga que
   * monta `<coleção>.create` exige `!isReservedCollection(name)`. Derivar as quatro para ela dava um
   * grupo inteiro de permissões que nenhuma regra lê, ao lado do grupo verdadeiro.
   */
  it('coleção reservada não deriva CRUD nenhum', () => {
    const embutidas = LOOKUP_REGISTRY_LIST.map((lookup) => ({
      collection: lookup.collection,
      label: '@core.data/lookup.qualified',
      labelParams: { screen: lookup.screenLabel, entity: lookup.entityLabel },
    }));
    expect(embutidas.length).toBeGreaterThan(0);
    expect(collectionPermissionResources(embutidas)).toEqual([]);
  });

  it('a lista que o escritório digitou passa intacta, sem parâmetro nenhum', () => {
    expect(collectionPermissionResources([{ collection: 'especialidades', label: 'Especialidades' }])).toEqual([
      { id: 'especialidades', name: 'Especialidades', deriveCrud: true },
    ]);
  });

  it('o catálogo de mensagens tem as chaves que os rótulos derivados referenciam', () => {
    expect(translate(catalogoDeMensagens, 'core.records/tag-list.of', { name: 'X' })).toBe('Tags: X');
    expect(translate(catalogoDeMensagens, 'core.data/lookup.qualified', { screen: 'A', entity: 'B' })).toBe('A: B');
  });
});
