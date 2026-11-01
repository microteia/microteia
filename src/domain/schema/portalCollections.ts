/**
 * Os nomes das coleções do portal — num módulo-FOLHA, sem import nenhum. `screenEntity.ts` os reserva
 * e é importado por quase todo o schema; `portal.ts` depende do motor de expressões, que chega de
 * volta a `screenEntity.ts`. Morando lá, a constante era lida antes de inicializada.
 */
export const PORTAL_USERS_COLLECTION = 'portalUsers';
export const PORTAL_RECORDS_COLLECTION = 'portalRecords';
export const PORTAL_DOCUMENTS_SUBCOLLECTION = 'documents';
/**
 * A reprojeção de uma coleção depois que uma declaração mudou — um documento por coleção, só do
 * servidor. O cursor gravado ali é o gatilho da rodada seguinte.
 */
export const PORTAL_REPROJECTIONS_COLLECTION = 'portal_reprojections';
/** Coleção de RAIZ, só do servidor: a marca do convite que precisa existir antes da conta. */
export const PORTAL_INVITES_COLLECTION = 'portalInvites';
/**
 * Coleção de RAIZ, só do servidor: um documento por escritório com a contagem da hora corrente dos
 * convites feitos por automação. Na raiz, e não sob o escritório, para não disputar nome com uma tela.
 */
export const PORTAL_INVITE_RATES_COLLECTION = 'portalInviteRates';
/**
 * O convite por IDENTIDADE: o que a pessoa precisa provar (a claim exigida) e a que sujeitos ela dá
 * acesso. Fica sob o escritório e só o servidor grava — a conta de quem o aceita ainda não existe
 * quando ele nasce, e por isso o convite não pode morar em `portalUsers/{uid}`.
 */
export const PORTAL_IDENTITY_INVITES_COLLECTION = 'portalIdentityInvites';
/**
 * Coleção de RAIZ, só do servidor: a prova da última entrada de cada conta aberta por um provedor
 * (`portalIdentityProofs/{uid}`) — provedor, `sub`, nível e as claims de convite que ela satisfez.
 * Sobrevive à revogação, que apaga o acesso, e é o que deixa o convite refeito religar a conta. Na
 * raiz porque o uid já é do escritório, e uma gravação sob `tenants/{t}` acordaria os gatilhos de
 * toda coleção a cada entrada.
 */
export const PORTAL_IDENTITY_PROOFS_COLLECTION = 'portalIdentityProofs';
/**
 * Coleção de RAIZ, só do servidor: o pedido de entrada por OIDC entre a ida ao provedor e a volta —
 * o verificador do PKCE, o `nonce` e o escritório. Na raiz porque a volta traz só o `state`.
 */
export const PORTAL_SIGN_IN_REQUESTS_COLLECTION = 'portalSignInRequests';
/**
 * Coleção de RAIZ, só do servidor: a marca da última abertura registrada de cada convidado em cada
 * registro (ou documento) de tela com `portal.trackViews`. Na raiz, e não sob o escritório, porque uma
 * gravação em `tenants/{t}/{coleção}` acorda os gatilhos de toda coleção — e uma abertura não é fato de
 * registro nenhum. Some sozinha pelo TTL de `expiresAt`.
 */
export const PORTAL_VIEW_MARKS_COLLECTION = 'portalViewMarks';
/**
 * O texto do portal EDITADO pelo escritório (`portal.content`): um documento por referência de mensagem,
 * com o texto de cada idioma. Vence o do pacote no mesmo idioma, e só no conteúdo dos nós `markdown` das
 * páginas e cartões declarados — o resto do catálogo não é tocado.
 */
export const PORTAL_TEXTS_COLLECTION = 'portalTexts';
