import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { OTHER_TENANT, TENANT, asUser, seed, testEnv } from './helpers';

/**
 * O PORTAL — quem é de fora do escritório, e o que ele alcança.
 *
 * A decisão que estes testes defendem é uma só: o convidado NÃO é membro. Por isso ele não lê nada
 * do que o escritório guarda — nem os registros originais, nem membros, perfis, telas ou
 * configurações —, e o que ele lê é a projeção que o servidor montou, só a que o carimba no
 * `audience`. A consulta sem esse filtro é recusada inteira, que é o que torna impossível listar o
 * dos outros.
 */
let env: RulesTestEnvironment;

beforeAll(async () => { env = await testEnv(); });
afterAll(async () => { await env.cleanup(); });

const portalUser = (uid: string, subjectKeys: string[]) => ({ userId: uid, email: `${uid}@x.com`, subjectKeys });
const projection = (audience: string[]) => ({
  collection: 'invoices',
  recordId: 'nf1',
  screenId: 'invoices',
  subjectKeys: ['companies/acme'],
  audience,
  title: 'NF-1',
  data: { number: 'NF-1' },
  labels: {},
  updatedAt: new Date(),
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, {
    users: { ana: {}, bia: {}, fiscal: {}, gestor: {} },
    owners: { [TENANT]: 'dono', [OTHER_TENANT]: 'outroDono' },
    members: { [TENANT]: { fiscal: ['invoices.read', 'invoices.update'], gestor: ['portal.manage'] } },
    screens: { [TENANT]: { invoices: { titleSingular: 'Invoice', fields: [] } } },
    records: {
      [TENANT]: {
        'invoices/nf1': { number: 'NF-1', companyId: 'acme', auditNote: 'interno' },
        'portalUsers/ana': portalUser('ana', ['companies/acme']),
        'portalUsers/bia': portalUser('bia', ['companies/globex']),
        'portalRecords/invoices__nf1': projection(['ana']),
        'portalRecords/invoices__nf2': { ...projection(['bia']), recordId: 'nf2' },
      },
    },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, `tenants/${TENANT}/portalRecords/invoices__nf1/documents/d1`), { name: 'nota.pdf' });
    await setDoc(doc(db, `tenants/${TENANT}/invoices/nf1/documents/d1`), { name: 'nota.pdf', url: 'u', portalShared: false });
  });
});

const projections = (uid: string) => collection(asUser(env, uid), `tenants/${TENANT}/portalRecords`);

describe('o convidado não é membro', () => {
  it('não lê o registro original, nem o que o escritório guarda', async () => {
    const db = asUser(env, 'ana');
    await assertFails(getDoc(doc(db, `tenants/${TENANT}/invoices/nf1`)));
    await assertFails(getDocs(collection(db, `tenants/${TENANT}/members`)));
    await assertFails(getDocs(collection(db, `tenants/${TENANT}/roles`)));
    await assertFails(getDocs(collection(db, `tenants/${TENANT}/screenDefinitions`)));
    await assertFails(getDoc(doc(db, `tenants/${TENANT}/settings/tenant`)));
    await assertFails(getDoc(doc(db, `tenants/${TENANT}`)));
  });
});

describe('a projeção', () => {
  it('lista só com o filtro pelo próprio uid, e recebe só o que é dele', async () => {
    await assertSucceeds(getDocs(query(projections('ana'), where('audience', 'array-contains', 'ana'))));
  });

  it('a lista sem o filtro é recusada inteira', async () => {
    await assertFails(getDocs(projections('ana')));
  });

  it('filtrar pelo uid de OUTRO é recusado', async () => {
    await assertFails(getDocs(query(projections('ana'), where('audience', 'array-contains', 'bia'))));
  });

  it('lê a sua por id, e não a de outro', async () => {
    const db = asUser(env, 'ana');
    await assertSucceeds(getDoc(doc(db, `tenants/${TENANT}/portalRecords/invoices__nf1`)));
    await assertFails(getDoc(doc(db, `tenants/${TENANT}/portalRecords/invoices__nf2`)));
  });

  it('revogado o convite, a projeção fecha na hora — antes de o audience ser refeito', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, `tenants/${TENANT}/portalUsers/ana`));
    });
    await assertFails(getDoc(doc(asUser(env, 'ana'), `tenants/${TENANT}/portalRecords/invoices__nf1`)));
  });

  it('ninguém grava do cliente — nem o dono do escritório', async () => {
    await assertFails(setDoc(doc(asUser(env, 'ana'), `tenants/${TENANT}/portalRecords/invoices__nf1`), projection(['ana', 'bia'])));
    await assertFails(setDoc(doc(asUser(env, 'dono'), `tenants/${TENANT}/portalRecords/x`), projection(['dono'])));
  });

  it('o documento projetado segue o audience do registro', async () => {
    await assertSucceeds(getDocs(collection(asUser(env, 'ana'), `tenants/${TENANT}/portalRecords/invoices__nf1/documents`)));
    await assertFails(getDocs(collection(asUser(env, 'bia'), `tenants/${TENANT}/portalRecords/invoices__nf1/documents`)));
  });
});

describe('o convite', () => {
  it('o convidado lê o seu; quem gerencia o portal lê todos; um membro qualquer, não', async () => {
    await assertSucceeds(getDoc(doc(asUser(env, 'ana'), `tenants/${TENANT}/portalUsers/ana`)));
    await assertFails(getDoc(doc(asUser(env, 'ana'), `tenants/${TENANT}/portalUsers/bia`)));
    await assertSucceeds(getDocs(collection(asUser(env, 'gestor'), `tenants/${TENANT}/portalUsers`)));
    await assertFails(getDocs(collection(asUser(env, 'fiscal'), `tenants/${TENANT}/portalUsers`)));
  });

  it('ninguém se convida — a escrita é só do servidor', async () => {
    await assertFails(setDoc(doc(asUser(env, 'bia'), `tenants/${TENANT}/portalUsers/bia`), portalUser('bia', ['companies/acme'])));
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/portalUsers/x`), portalUser('x', ['companies/acme'])));
  });

  it('o convidado altera do próprio convite só o perfil, e só as chaves conhecidas', async () => {
    const ana = asUser(env, 'ana');
    await assertSucceeds(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { profile: { name: 'Ana Souza' } }));
    await assertSucceeds(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { profile: {} }));
    await assertFails(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { profile: { name: 'x'.repeat(121) } }));
    await assertFails(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { profile: { name: 'Ana', cpf: '1' } }));
    await assertFails(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { profile: { name: 7 } }));
    await assertFails(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { profile: { name: 'Ana' }, subjectKeys: ['companies/globex'] }));
    await assertFails(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/bia`), { profile: { name: 'Bia' } }));
    await assertFails(updateDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/portalUsers/ana`), { profile: { name: 'Outra' } }));
  });

  it('a consulta de grupo acha só os próprios convites', async () => {
    await assertSucceeds(getDocs(query(collectionGroup(asUser(env, 'ana'), 'portalUsers'), where('userId', '==', 'ana'))));
    await assertFails(getDocs(query(collectionGroup(asUser(env, 'ana'), 'portalUsers'), where('userId', '==', 'bia'))));
  });
});

describe('compartilhar um documento', () => {
  const sharedDoc = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/invoices/nf1/documents/d1`);

  it('quem edita o registro marca, e só a marca muda', async () => {
    await assertSucceeds(updateDoc(sharedDoc('fiscal'), { portalShared: true, portalSharedBy: 'fiscal', portalSharedAt: new Date() }));
    await assertFails(updateDoc(sharedDoc('fiscal'), { portalShared: true, portalSharedBy: 'fiscal', name: 'outro.pdf' }));
  });

  it('a marca leva o autor verdadeiro', async () => {
    await assertFails(updateDoc(sharedDoc('fiscal'), { portalShared: true, portalSharedBy: 'outro', portalSharedAt: new Date() }));
  });

  it('o convidado não compartilha nada', async () => {
    await assertFails(updateDoc(sharedDoc('ana'), { portalShared: true, portalSharedBy: 'ana', portalSharedAt: new Date() }));
  });

  it('o documento não nasce compartilhado pelo cliente', async () => {
    await assertFails(setDoc(doc(asUser(env, 'fiscal'), `tenants/${TENANT}/invoices/nf1/documents/d2`), { name: 'x', portalShared: true }));
    await assertSucceeds(setDoc(doc(asUser(env, 'fiscal'), `tenants/${TENANT}/invoices/nf1/documents/d3`), { name: 'x' }));
  });
});

describe('declarar o portal de uma tela', () => {
  beforeEach(async () => {
    await seed(env, {
      members: {
        [TENANT]: {
          desenhista: ['screens.manage'],
          gestorPortal: ['screens.manage', 'portal.manage'],
        },
      },
      screens: {
        [TENANT]: {
          exposta: { titleSingular: 'Empresa', titleFieldKey: 'name', fields: [], portal: { subject: 'self', fields: ['name'] } },
        },
      },
    });
  });

  const screen = (uid: string, key = 'invoices') => doc(asUser(env, uid), `tenants/${TENANT}/screenDefinitions/${key}`);
  const portal = { subject: 'self', fields: ['number'] };

  it('quem só desenha telas edita a tela, mas não o que ela expõe', async () => {
    await assertSucceeds(updateDoc(screen('desenhista'), { titleSingular: 'Nota' }));
    await assertFails(updateDoc(screen('desenhista'), { portal }));
    await assertFails(setDoc(screen('desenhista', 'novaTela'), { titleSingular: 'X', fields: [], portal }));
  });

  it('numa tela do portal, trocar coleção, pai ou título também é decidir o que sai', async () => {
    await assertSucceeds(updateDoc(screen('desenhista', 'exposta'), { titleSingular: 'Companhia' }));
    await assertFails(updateDoc(screen('desenhista', 'exposta'), { dataCollection: 'interna' }));
    await assertFails(updateDoc(screen('desenhista', 'exposta'), { titleFieldKey: 'cpf' }));
    await assertFails(updateDoc(screen('desenhista', 'exposta'), { parentEntity: 'outra', parentFieldKey: 'x' }));
    await assertSucceeds(updateDoc(screen('gestorPortal', 'exposta'), { dataCollection: 'empresas' }));
    // Fora do portal, a coleção continua sendo só Form Design.
    await assertSucceeds(updateDoc(screen('desenhista'), { dataCollection: 'notas' }));
  });

  it('quem gerencia o portal declara e retira', async () => {
    await assertSucceeds(updateDoc(screen('gestorPortal'), { portal }));
    await assertSucceeds(updateDoc(screen('gestorPortal'), { portal: null }));
  });
});

describe('a home do portal (settings/portal)', () => {
  beforeEach(async () => {
    await seed(env, {
      members: { [TENANT]: { gestorPortal: ['portal.manage'], configurador: ['settings.manage'] } },
    });
  });

  const home = (uid: string) => doc(asUser(env, uid), `tenants/${TENANT}/settings/portal`);
  const value = { welcome: 'Olá', menu: { order: [], hidden: [] }, widgets: { order: [], hidden: [] } };

  it('quem gerencia o portal configura a home', async () => {
    await assertSucceeds(setDoc(home('gestorPortal'), value));
  });

  it('configurar o escritório não basta, e o convidado não alcança', async () => {
    await assertFails(setDoc(home('configurador'), value));
    await assertFails(setDoc(home('ana'), value));
    await assertFails(getDoc(home('ana')));
  });
});

describe('a entrada com identidade verificada', () => {
  it('o convite SUSPENSO (o escritório desligou o link de e-mail) não abre nada — nem a projeção, nem o documento', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await updateDoc(doc(db, `tenants/${TENANT}/portalUsers/ana`), { suspended: true });
    });
    const ana = asUser(env, 'ana');
    await assertFails(getDoc(doc(ana, `tenants/${TENANT}/portalRecords/invoices__nf1`)));
    await assertFails(getDocs(query(collection(ana, `tenants/${TENANT}/portalRecords`), where('audience', 'array-contains', 'ana'))));
    await assertFails(getDocs(collection(ana, `tenants/${TENANT}/portalRecords/invoices__nf1/documents`)));
    // O convite continua dela: a casca precisa dizer POR QUE não abre.
    await assertSucceeds(getDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`)));
  });

  it('o convidado não tira a própria suspensão, nem escreve a identidade', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await updateDoc(doc(db, `tenants/${TENANT}/portalUsers/ana`), { suspended: true });
    });
    const ana = asUser(env, 'ana');
    await assertFails(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { suspended: false }));
    await assertFails(updateDoc(doc(ana, `tenants/${TENANT}/portalUsers/ana`), { identity: { provider: 'x', level: 'gold' } }));
  });

  it('o convite por identidade: quem gerencia o portal lê; ninguém grava do cliente; o convidado não alcança', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, `tenants/${TENANT}/portalIdentityInvites/i1`), {
        email: 'bia@acme.com', claim: { name: 'nationalId', value: '12345678900' }, claimKey: 'nationalId=12345678900', subjectKeys: ['companies/acme'],
      });
    });
    await assertSucceeds(getDocs(collection(asUser(env, 'gestor'), `tenants/${TENANT}/portalIdentityInvites`)));
    await assertFails(getDocs(collection(asUser(env, 'fiscal'), `tenants/${TENANT}/portalIdentityInvites`)));
    await assertFails(getDoc(doc(asUser(env, 'ana'), `tenants/${TENANT}/portalIdentityInvites/i1`)));
    await assertFails(setDoc(doc(asUser(env, 'gestor'), `tenants/${TENANT}/portalIdentityInvites/i2`), { subjectKeys: ['companies/acme'] }));
    await assertFails(setDoc(doc(asUser(env, 'dono'), `tenants/${TENANT}/portalIdentityInvites/i1`), { boundUserIds: ['dono'] }));
  });

  it('o pedido de entrada e a configuração de provedores são só do servidor — nem o dono lê', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, 'portalSignInRequests/h1'), { tenantId: TENANT, codeVerifier: 'v', nonce: 'n' });
      await setDoc(doc(db, `tenants/${TENANT}/secrets/portal-identity`), { providers: [], secrets: { citizen: 's' } });
    });
    for (const uid of ['dono', 'gestor', 'ana']) {
      await assertFails(getDoc(doc(asUser(env, uid), 'portalSignInRequests/h1')));
      await assertFails(setDoc(doc(asUser(env, uid), 'portalSignInRequests/h2'), { tenantId: TENANT }));
      await assertFails(getDoc(doc(asUser(env, uid), `tenants/${TENANT}/secrets/portal-identity`)));
      await assertFails(setDoc(doc(asUser(env, uid), `tenants/${TENANT}/secrets/portal-identity`), { providers: [] }));
    }
  });

  it('a marca de abertura registrada é só do servidor — o convidado não a apaga para repetir, nem a escreve para calar', async () => {
    const markId = `${TENANT}__ana__invoices__nf1__`;
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, `portalViewMarks/${markId}`), { tenantId: TENANT, at: new Date() });
    });
    for (const uid of ['dono', 'gestor', 'ana']) {
      await assertFails(getDoc(doc(asUser(env, uid), `portalViewMarks/${markId}`)));
      await assertFails(deleteDoc(doc(asUser(env, uid), `portalViewMarks/${markId}`)));
      await assertFails(setDoc(doc(asUser(env, uid), `portalViewMarks/${TENANT}__ana__invoices__nf2__`), { tenantId: TENANT }));
    }
  });

  it('nenhum cliente forja `portalVerified` — a prova de quem gravou pelo portal é do servidor', async () => {
    const fiscal = asUser(env, 'fiscal');
    const forged = { provider: 'citizen', claim: { name: 'nationalId', value: '1' }, level: 'gold' };
    await assertFails(updateDoc(doc(fiscal, `tenants/${TENANT}/invoices/nf1`), { portalVerified: forged, updatedVia: 'ui' }));
    await assertSucceeds(updateDoc(doc(fiscal, `tenants/${TENANT}/invoices/nf1`), { number: 'NF-1b', updatedVia: 'ui' }));
  });
});
