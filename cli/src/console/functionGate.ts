/**
 * O portão de instalação, conferido na FONTE.
 *
 * `forInstalledExtension` é a metade da retirada que age no instante certo: a Cloud Function é do
 * PROJETO e a instalação da extensão é do ESCRITÓRIO, então um `onDocumentWritten('tenants/{tenantId}/…')`
 * declarado por uma extensão dispara para TODOS os escritórios do projeto — os que nunca a instalaram, e
 * o que a desinstalou enquanto outro a mantém. Nesse último caso `--prune` não pode ajudar: a function
 * tem de continuar no ar, porque alguém ainda precisa dela.
 *
 * Só que nada cobrava o portão. O `create function` o escrevia no molde, e era só isso: nenhuma
 * verificação do empacotamento, do deploy ou do provisionamento olhava a fonte. Um gatilho sem portão
 * passava por tudo e ia para o ar — e o sintoma dele é o pior que existe, porque não é uma falha: é
 * código de uma extensão que ninguém tem mais rodando sobre os dados de quem nunca a pediu, sem erro em
 * lugar nenhum.
 *
 * É recusa, e não aviso, pelo mesmo motivo do nome de function repetido: o defeito é invisível depois de
 * instalado, e um aviso na saída de um deploy é lido uma vez. Mas ela é cobrada da function que VAI
 * SUBIR, e não de toda fonte que existe no disco — ver `gateProblemsFor`. Toda origem é lida, sempre, e
 * o que não vai subir é relatado pelo `provision`: quem tem a fonte parada ao lado do `microteia.yaml`
 * fica sabendo dela, sem ter o comando trancado por ela.
 *
 * A análise é por texto, no idioma dos outros leitores de fonte do Console (`callableFunctionNames`,
 * `declaredParametersIn`). Ela erra para o lado ALTO — o que ela não entende ela recusa —, e é por isso
 * que o portão declarado num identificador ao lado é reconhecido: recusar código correto é o que ensina
 * a desligar a verificação.
 */

/**
 * Os construtores de gatilho de Firestore.
 *
 * São os únicos eventos cujo caminho carrega `{tenantId}`, e portanto os únicos para os quais o portão
 * existe. Um `onSchedule` ou um `onMessagePublished` não tem escritório de onde perguntar — envolvê-los
 * no portão os deixaria permanentemente inertes, porque ele falha FECHADO. Eles ficam de fora desta
 * verificação de propósito: exigir deles um portão que não funciona seria trocar um defeito por outro.
 */
export const TENANT_TRIGGER_CONSTRUCTORS = [
  'onDocumentWritten',
  'onDocumentCreated',
  'onDocumentUpdated',
  'onDocumentDeleted',
  'onDocumentWrittenWithAuthContext',
  'onDocumentCreatedWithAuthContext',
  'onDocumentUpdatedWithAuthContext',
  'onDocumentDeletedWithAuthContext',
];

/**
 * Os construtores cujo evento NÃO carrega escritório no caminho.
 *
 * Para eles as duas saídas do autor eram erradas, e é isso que faz deles uma recusa e não um aviso: sem
 * portão a function age sobre o projeto inteiro; COM portão ela nunca roda — nem enquanto a extensão está
 * instalada —, porque `forInstalledExtension` falha FECHADO e nunca acha o `{tenantId}` que não existe.
 * Um autor que seguisse a orientação genérica "envolva o handler no portão" produzia uma function que
 * passava no deploy, não acusava nada e nunca fazia nada.
 *
 * A resposta é o laço por escritório (`forEachInstalledOffice`), e é por existir uma resposta que a
 * recusa é honesta.
 *
 * A lista é EXPLÍCITA, e não "tudo o que não é gatilho de documento": o que não se conhece não se recusa.
 * O RTDB fica de fora de propósito — o caminho dele TEM parâmetros, então um `{tenantId}` ali é possível
 * —, e a plataforma não usa RTDB em lugar nenhum.
 */
export const UNSCOPED_TRIGGER_CONSTRUCTORS = [
  'onSchedule',
  'onMessagePublished',
  'onRequest',
  'onObjectFinalized',
  'onObjectArchived',
  'onObjectDeleted',
  'onObjectMetadataUpdated',
  'onCustomEventPublished',
  'onTaskDispatched',
  'beforeUserCreated',
  'beforeUserSignedIn',
];

const GATE = 'forInstalledExtension';
const OFFICE_LOOP = 'forEachInstalledOffice';
const ANY_GATE = 'forAnyInstalledExtension';
const CALLABLE_GUARD = 'requireInstalledExtension';

/** Onde uma string termina, a partir da abertura dela. Aspas não fechada não engole o resto do arquivo. */
const stringEnd = (source: string, start: number, quote: string): number => {
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === quote) return index + 1;
    if (quote !== '`' && char === '\n') return index;
    index += 1;
  }
  return source.length;
};

/**
 * A fonte sem comentário nenhum, com as strings intactas.
 *
 * O JSDoc que o molde escreve CITA `forInstalledExtension` — é ali que ele explica o portão. Sem esta
 * limpeza, um gatilho que perdesse a chamada e mantivesse o comentário passaria na verificação, o que é
 * o caso exato que ela existe para pegar.
 */
export const withoutComments = (source: string): string => {
  let out = '';
  let index = 0;

  while (index < source.length) {
    const pair = source.slice(index, index + 2);

    if (pair === '//') {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
      out += ' ';
      continue;
    }
    if (pair === '/*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      out += ' ';
      continue;
    }

    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      const end = stringEnd(source, index, char);
      out += source.slice(index, end);
      index = end;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
};

/**
 * O texto entre os parênteses da chamada que abre em `open`. Conta os parênteses e pula as strings: um
 * `console.log('(')` no corpo do handler desequilibraria a contagem, e o efeito seria recusar uma
 * function correta.
 */
const callArguments = (source: string, open: number): string => {
  let depth = 0;
  let index = open;

  while (index < source.length) {
    const char = source[index];

    if (char === "'" || char === '"' || char === '`') {
      index = stringEnd(source, index, char);
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
    index += 1;
  }

  return source.slice(open + 1);
};

/**
 * O id que o portão daquele gatilho recebeu, ou `null` quando não há portão.
 *
 * Duas formas valem, e a segunda não é indulgência: `onDocumentWritten(opts, gated)` com
 * `const gated = forInstalledExtension('id', handler)` ao lado é código correto e comum quando o handler
 * cresce. Recusá-lo seria a verificação errando contra quem fez certo.
 */
const gatedFor = (args: string, source: string): string | null => {
  const direct = args.match(new RegExp(String.raw`\b${GATE}\s*\(\s*['"]([^'"]*)['"]`));
  if (direct !== null) return direct[1];

  for (const token of new Set(args.match(/[A-Za-z_$][\w$]*/g) ?? [])) {
    const indirect = source.match(new RegExp(
      String.raw`(?:const|let|var)\s+${token}\s*(?::[^=;\n]*)?=\s*${GATE}\s*\(\s*['"]([^'"]*)['"]`,
    ));
    if (indirect !== null) return indirect[1];
  }

  return null;
};

/**
 * Todos os ids que as guardas daquele gatilho recebem.
 *
 * A function COMUM usa `forAnyInstalledExtension(['a', 'b'], handler)`, cuja pergunta é outra — "alguma
 * das que eu sirvo está instalada?" —, então ela devolve mais de um id. A de extensão continua respondida
 * por `gatedFor`, que devolve um: ali um segundo id não significaria nada.
 */
const guardedIds = (args: string, source: string): string[] => {
  const found = new Set<string>();

  const any = args.match(new RegExp(String.raw`\b${ANY_GATE}\s*\(\s*\[([^\]]*)\]`));
  if (any !== null) {
    for (const id of any[1].matchAll(/['"]([^'"]+)['"]/g)) found.add(id[1]);
  }

  const single = gatedFor(args, source);
  if (single !== null) found.add(single);

  return [...found];
};

export interface TriggerDeclaration {
  /** O nome declarado — é por ele que se sabe se o `index.ts` o exporta. */
  name: string;
  /** O construtor usado. Aparece na mensagem: é ele que explica por que o portão é devido. */
  trigger: string;
  /** O id que `forInstalledExtension` recebeu, ou `null` quando o portão não está lá. */
  gatedFor: string | null;
  /** Todos os ids que as guardas daquele gatilho recebem — a comum guarda mais de um. */
  guards: string[];
}

/** Onde cada `export const x = <construtor>(` começa, para os construtores pedidos. */
const declarationsOf = (
  source: string,
  constructors: string[],
): { name: string; trigger: string; open: number }[] => {
  const pattern = new RegExp(
    String.raw`(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;\n]*)?=\s*(`
    + `${constructors.join('|')})\\s*(?:<[^>]*>)?\\s*\\(`,
    'g',
  );

  return [...source.matchAll(pattern)].map((match) => ({
    name: match[1],
    trigger: match[2],
    open: (match.index ?? 0) + match[0].length - 1,
  }));
};

/** Os gatilhos de Firestore declarados numa fonte, com o estado do portão de cada um. */
export const triggerDeclarations = (rawSource: string): TriggerDeclaration[] => {
  const source = withoutComments(rawSource);
  return declarationsOf(source, TENANT_TRIGGER_CONSTRUCTORS).map((declaration) => {
    const args = callArguments(source, declaration.open);
    return {
      name: declaration.name,
      trigger: declaration.trigger,
      gatedFor: gatedFor(args, source),
      guards: guardedIds(args, source),
    };
  });
};

/**
 * As functions sem escritório no evento, e o id que o laço por escritório recebeu no ARQUIVO.
 *
 * O alcance é o arquivo, e não os parênteses da chamada — a diferença é deliberada. O portão de um
 * gatilho de documento embrulha AQUELE handler, então ele tem de estar ali; o laço, ao contrário, roda
 * DENTRO do handler e pode estar algumas chamadas abaixo, num `syncOffice(tenantId)` que o próprio autor
 * escreveu. Exigi-lo nos parênteses recusaria código correto, e a verificação que erra assim é a que
 * ensina a próxima pessoa a desligá-la.
 *
 * O preço é conhecido: dois agendados no mesmo arquivo, um com laço e outro sem, passam os dois. É menos
 * grave que o inverso, e está dito.
 */
export const unscopedDeclarations = (rawSource: string): TriggerDeclaration[] => {
  const source = withoutComments(rawSource);
  const loop = source.match(new RegExp(String.raw`\b${OFFICE_LOOP}\s*\(\s*['"]([^'"]*)['"]`));

  return declarationsOf(source, UNSCOPED_TRIGGER_CONSTRUCTORS).map((declaration) => ({
    name: declaration.name,
    trigger: declaration.trigger,
    gatedFor: loop === null ? null : loop[1],
    guards: loop === null ? [] : [loop[1]],
  }));
};

/**
 * As callables declaradas, e o id que a guarda delas recebeu no ARQUIVO.
 *
 * O alcance é o arquivo pela mesma razão do laço por escritório: a guarda roda DENTRO do handler (ela
 * precisa do `request`), e o guia manda o autor manter o handler fino, com a decisão num arquivo ao
 * lado. Exigi-la nos parênteses recusaria justamente o código que o guia pede.
 */
export const callableDeclarations = (rawSource: string): TriggerDeclaration[] => {
  const source = withoutComments(rawSource);
  const guard = source.match(new RegExp(String.raw`\b${CALLABLE_GUARD}\s*\(\s*['"]([^'"]*)['"]`));

  return declarationsOf(source, ['onCall']).map((declaration) => ({
    name: declaration.name,
    trigger: declaration.trigger,
    gatedFor: guard === null ? null : guard[1],
    guards: guard === null ? [] : [guard[1]],
  }));
};

/**
 * O que uma origem de functions precisa ter para ser conferida. É a forma de `FunctionSource`, declarada
 * aqui em vez de importada: assim este módulo se testa sozinho, sem montar diretório nenhum.
 */
export interface GateSubject {
  label: string;
  /** `functions/` é comum a várias extensões, e não tem uma instalação de onde perguntar. */
  shared: boolean;
  exported: string[];
  triggers: TriggerDeclaration[];
  /** As functions cujo evento não carrega escritório: o agendado, a fila, o HTTP, o Storage. */
  unscoped: TriggerDeclaration[];
  /** Quem cada function comum declara servir. Vazio numa origem de extensão. */
  serves: Record<string, string[]>;
  /** As callables declaradas, com o estado da guarda de cada uma. */
  callableGuards: TriggerDeclaration[];
}

/** Os gatilhos que o `index.ts` de fato exporta — um declarado e não exportado não é deployado. */
const exportedOnly = (subject: GateSubject, declarations: TriggerDeclaration[]): TriggerDeclaration[] => {
  const exported = new Set(subject.exported);
  return declarations.filter((trigger) => exported.has(trigger.name));
};

const exportedTriggers = (subject: GateSubject): TriggerDeclaration[] =>
  exportedOnly(subject, subject.triggers);

const exportedUnscoped = (subject: GateSubject): TriggerDeclaration[] =>
  exportedOnly(subject, subject.unscoped);

const exportedCallables = (subject: GateSubject): TriggerDeclaration[] =>
  exportedOnly(subject, subject.callableGuards);

/**
 * Um problema de portão, e a function a que ele pertence.
 *
 * O nome está aqui porque é ele que decide o PESO do problema. A verificação lê toda fonte que existe no
 * disco — é assim que ela acha o que precisa achar —, mas o que existe no disco não é o que vai subir:
 * `extensions/<x>/functions/` de uma extensão que ninguém instalou é lida, copiada e nunca deployada.
 * Sem o nome, quem chama só tem a frase, e a única coisa que dá para fazer com uma frase é recusar tudo.
 * Foi o que acontecia: uma extensão desinstalada, com a fonte parada ao lado do `microteia.yaml`,
 * trancava o `deploy` inteiro — hosting, rules e índices junto — por causa de uma function que nenhum
 * comando teria subido.
 */
export interface GateProblem {
  /** A function a que o problema pertence. É por ela que se sabe se ela vai, de fato, subir. */
  name: string;
  message: string;
}

/**
 * Gatilho de extensão sem portão.
 *
 * `functions/` fica de fora porque ali a pergunta não tem resposta: a function é comum a várias
 * extensões, nenhuma a reivindica, e não há um id para o portão receber. É lacuna conhecida e tem
 * endereço próprio — enquanto ela não fechar, exigir aqui um portão impossível seria recusar a única
 * forma que a plataforma oferece para uma function compartilhada.
 */
export const ungatedTriggerProblems = (subjects: GateSubject[]): GateProblem[] => subjects
  .filter((subject) => !subject.shared)
  .flatMap((subject) => exportedTriggers(subject)
    .filter((trigger) => trigger.gatedFor === null)
    .map((trigger) => ({
      name: trigger.name,
      message: `${subject.label} exports "${trigger.name}", a ${trigger.trigger} trigger with no `
        + `installation gate — wrap its handler in ${GATE}('<this extension's id>', …) or it fires for `
        + 'every office in the project, including the ones that never installed the extension',
    })));

/**
 * Function de extensão cujo evento não tem escritório, e que não passa pelo laço.
 *
 * A recusa vem acompanhada do substituto porque sem ele ela seria só uma porta fechada: o laço por
 * escritório (`forEachInstalledOffice`) existe justamente para este caso, e é ele que a mensagem nomeia.
 *
 * `functions/` fica de fora pelo mesmo motivo de sempre: a comum não tem um id de extensão para dar ao
 * laço. Quem responde por ela é a declaração de quem ela serve.
 */
export const unscopedTriggerProblems = (subjects: GateSubject[]): GateProblem[] => subjects
  .filter((subject) => !subject.shared)
  .flatMap((subject) => exportedUnscoped(subject)
    .filter((trigger) => trigger.gatedFor === null)
    .map((trigger) => ({
      name: trigger.name,
      message: `${subject.label} exports "${trigger.name}", a ${trigger.trigger} function whose `
        + `event carries no {tenantId} — ${GATE} cannot gate it (it fails closed, so the function would `
        + `never run at all). Loop with ${OFFICE_LOOP}('<this extension's id>', …) inside the handler, or `
        + 'it acts on every office in the project, including the ones that never installed the extension',
    })));

/**
 * Gatilho de uma function COMUM que declara quem serve, e não guarda ninguém.
 *
 * A comum ficava fora desta cobrança porque não havia id para dar à guarda: nenhuma extensão pode
 * reivindicá-la. `microteia.serves` resolve exatamente isso — a partir dela existem ids, e a partir dos
 * ids a cobrança passa a ser possível. Um gatilho comum sem guarda dispara para todo escritório do
 * projeto, e é o mesmo defeito do gatilho de extensão sem portão, com um alcance maior.
 *
 * A comum SEM declaração continua de fora, e é deliberado: cobrar dela uma guarda sem ter ids a oferecer
 * seria fechar a porta sem abrir nenhuma. O que ela recebe é o relato do provisionamento.
 *
 * A segunda recusa é a guarda que nomeia extensão que a function não declara servir: as duas listas
 * respondem à mesma pergunta em dois lugares, e divergirem faz uma delas mentir — a `serves` decide a
 * retirada, a guarda decide a execução, e a function passaria a agir onde não pode ser retirada.
 */
export const unguardedSharedProblems = (subjects: GateSubject[]): GateProblem[] => subjects
  .filter((subject) => subject.shared)
  .flatMap((subject) => exportedTriggers(subject).flatMap((trigger): GateProblem[] => {
    const serves = subject.serves[trigger.name];
    if (serves === undefined || serves.length === 0) return [];

    if (trigger.guards.length === 0) {
      return [{
        name: trigger.name,
        message: `${subject.label} exports "${trigger.name}", a ${trigger.trigger} trigger declared as `
          + `serving ${serves.join(', ')} — guard it with ${ANY_GATE}([${serves.map((id) => `'${id}'`).join(', ')}], …) `
          + 'or it fires for every office in the project, including the ones that installed none of them',
      }];
    }

    const stranger = trigger.guards.filter((id) => !serves.includes(id));
    if (stranger.length === 0) return [];

    return [{
      name: trigger.name,
      message: `${subject.label} guards "${trigger.name}" for ${stranger.join(', ')}, which it does not `
        + `declare serving in microteia.serves (${serves.join(', ')}) — the two lists answer the same `
        + 'question, and one of them is wrong',
    }];
  }));

/**
 * Callable de extensão sem a guarda de instalação.
 *
 * "Uma callable órfã é inerte" era verdade de INTERFACE, e não de segurança — e era a frase que o guia
 * dizia. O deploy concede a `allUsers` o papel `roles/run.invoker` em cada callable; o que sobra depois é
 * a validação do token do Firebase. Então a tela ir embora com a extensão não fecha nada: o endpoint
 * segue no ar aceitando o token de QUALQUER usuário do projeto, de qualquer escritório, tendo ou não a
 * extensão.
 *
 * E o escritório chega no PAYLOAD, porque `useCallable` manda só o que a tela passou. Sem a guarda, um
 * usuário do escritório A chama a function apontando para o B — e o molde gerado conferia apenas se
 * havia `request.auth`.
 *
 * A comum fica de fora: `requireInstalledExtension` pede UM id, e a comum serve vários. É lacuna
 * conhecida e está registrada — a guarda "alguma das que eu sirvo" existe para gatilho, não para
 * callable.
 */
export const unguardedCallableProblems = (subjects: GateSubject[]): GateProblem[] => subjects
  .filter((subject) => !subject.shared)
  .flatMap((subject) => exportedCallables(subject)
    .filter((callable) => callable.gatedFor === null)
    .map((callable) => ({
      name: callable.name,
      message: `${subject.label} exports "${callable.name}", a callable with no installation `
        + `check — call ${CALLABLE_GUARD}('<this extension's id>', tenantId, request) before you read the `
        + 'payload. The deploy makes every callable publicly invocable, so it answers any signed-in user '
        + 'of this project, from any office, whether or not they installed the extension',
    })));

/** Todo problema de portão de um conjunto de origens, na ordem em que as mensagens os citam. */
export const gateProblems = (subjects: GateSubject[]): GateProblem[] => [
  ...ungatedTriggerProblems(subjects),
  ...unscopedTriggerProblems(subjects),
  ...unguardedSharedProblems(subjects),
  ...unguardedCallableProblems(subjects),
];

/**
 * Os problemas das functions que ESTÃO subindo — a lista que autoriza uma recusa.
 *
 * É a diferença entre "a fonte foi lida" e "a function vai para o ar", e ela não é sutil: a primeira
 * inclui toda extensão cujo diretório ficou no disco depois de desinstalada, e recusar por causa dela é
 * recusar um comando que não faria nada de errado. A segunda é o momento em que a recusa tem
 * consequência — e é o único em que ela é devida.
 */
export const gateProblemsFor = (subjects: GateSubject[], deploying: string[]): string[] => {
  const going = new Set(deploying);
  return gateProblems(subjects).filter((problem) => going.has(problem.name)).map((p) => p.message);
};

export interface MisgatedTrigger {
  /** A origem, como as mensagens a citam. */
  label: string;
  name: string;
  /** O id que a guarda recebeu. */
  gatedFor: string;
  /** O id da extensão que reivindica a function. */
  owner: string;
  /** Qual guarda recebeu o id errado — é ela que o autor tem de corrigir. */
  via: string;
}

/**
 * Portão aberto para o id ERRADO.
 *
 * É o defeito do copiar-e-colar entre extensões, e o sintoma dele é o oposto do gatilho sem portão: a
 * function sobe, o gatilho dispara, e o handler nunca roda em escritório nenhum. Nada falha — a extensão
 * apenas não faz o que promete, e a causa está numa string.
 *
 * Devolve os casos, e não as frases, porque quem chama precisa dos dois: a mensagem para relatar e o id
 * da extensão para pendurar. Deduzir o id de volta a partir do texto é o que faz um relatório recusar a
 * extensão errada quando o nome de uma aparece dentro da mensagem de outra.
 *
 * Só se pergunta quando o nome tem UM reivindicante: com dois, `functionClaimProblems` já recusou antes,
 * e apontar um deles como o dono certo seria inventar uma resposta.
 */
export const misgatedTriggers = (
  subjects: GateSubject[],
  claimants: Map<string, string>,
): MisgatedTrigger[] => {
  const wrong = (subject: GateSubject, declarations: TriggerDeclaration[], via: string) =>
    declarations.flatMap((trigger): MisgatedTrigger[] => {
      const owner = claimants.get(trigger.name);
      if (trigger.gatedFor === null || owner === undefined || owner === trigger.gatedFor) return [];
      return [{ label: subject.label, name: trigger.name, gatedFor: trigger.gatedFor, owner, via }];
    });

  return subjects
    .filter((subject) => !subject.shared)
    .flatMap((subject) => [
      ...wrong(subject, exportedTriggers(subject), GATE),
      ...wrong(subject, exportedUnscoped(subject), OFFICE_LOOP),
      ...wrong(subject, exportedCallables(subject), CALLABLE_GUARD),
    ]);
};

/** Como uma guarda de id errado aparece num relatório. */
export const describeMisgated = (entry: MisgatedTrigger): string =>
  `${entry.label} passes "${entry.gatedFor}" to ${entry.via} for "${entry.name}", but the extension that `
  + `claims it is "${entry.owner}" — the guard never opens, so nothing this function does ever happens`;

/**
 * Quem reivindica cada nome, quando é um só. Duas extensões pedindo o mesmo nome é problema de outra
 * verificação, e o nome sai daqui em vez de receber um dono escolhido a esmo.
 */
export const singleClaimants = (
  claims: { pluginId: string; backend: { functions?: string[] } }[],
): Map<string, string> => {
  const owners = new Map<string, string>();
  const disputed = new Set<string>();

  for (const claim of claims) {
    for (const name of claim.backend.functions ?? []) {
      const previous = owners.get(name);
      if (previous !== undefined && previous !== claim.pluginId) disputed.add(name);
      owners.set(name, claim.pluginId);
    }
  }

  for (const name of disputed) owners.delete(name);
  return owners;
};
