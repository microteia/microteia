import type { DomainField, DomainModel } from './domainModel';

/**
 * O CORPUS DE FALSO-POSITIVO.
 *
 * Um par positivo/negativo por detector prova que ele não dispara no caso que QUEM O ESCREVEU
 * imaginou. Não prova o que importa: que um modelo bom inteiro passa. São coisas diferentes, e a
 * segunda é a que decide se o portão serve — um portão que reprova modelo bom é um portão que as
 * pessoas aprendem a contornar, e a partir daí ele não protege mais nada.
 *
 * Os três domínios abaixo foram escritos como um bom modelador escreveria, sem cuidado nenhum com o
 * validador, e cada um carrega de propósito os quatro casos que MAIS parecem defeito e não são:
 *
 * 1. campo escalar cujo nome começa com o nome de outra entidade e é atributo próprio — o código que
 *    o solicitante forneceu, o código que o convênio devolveu, o número de chamada do aluno;
 * 2. um nome de terceiro que ninguém modela (o professor da turma) — parecido com acoplamento, e não é;
 * 3. um snapshot legítimo, declarado;
 * 4. um agrupamento achatado com `section`, e uma lista de opções que poderia ser confundida com
 *    entidade.
 *
 * E, desde que o modelo passou a dizer o que ACONTECE, os três carregam comportamento pelo mesmo
 * critério: estados e transições como um bom modelador os escreveria. O quinto caso que mais parece
 * defeito e não é vive aí — um estado que NENHUMA transição da própria entidade atinge, porque quem
 * o atinge é o efeito do fluxo de outra ("ao encerrar a turma, toda matrícula dela fica concluída").
 * O detector de inalcançável só olhava as transições da entidade e acusava o caso mais comum de
 * todos.
 *
 * Toda transição de GESTO ganhou `description`, e este é o único ajuste que os fixtures sofreram desde
 * que foram escritos. Não é conforto de detector: um fluxo chamável sem descrição é invisível para o
 * passo `ai-detect-workflow`, que descarta candidato sem descrição — o vocabulário não existia quando
 * eles foram escritos, e hoje um bom modelador escreveria a frase. A de gravação (`assign-on-save`)
 * segue SEM descrição de propósito: o mecanismo não a exige ali, e é o que prova que o detector
 * pergunta só onde a ausência custa algo.
 *
 * Uma aba de documentos aparece no atendimento da clínica, com o motivo declarado. Ela é o negativo do
 * padrão: as três abas nascem DESLIGADAS, e ligar uma é decisão de negócio — o `because` é o que
 * distingue "ligado de propósito" de "ligado por hábito".
 *
 * Nomear negócio aqui é deliberado e é o mesmo que `fixtures.test-support.ts` já faz: modelagem só se
 * demonstra sobre um domínio concreto. Nada disto entra no kernel nem em artefato nenhum.
 */

const scalar = (key: string, type: DomainField['type'] = 'text'): DomainField =>
  ({ key, label: key, semanticType: 'scalar', type });

const reference = (key: string, target: string): DomainField =>
  ({ key, label: key, semanticType: 'reference', target });

const option = (key: string, lookup: string): DomainField =>
  ({ key, label: key, semanticType: 'scalar', type: 'select', lookup });

const ADDRESS: DomainModel['entities'][number] = {
  name: 'Address',
  kind: 'valueObject',
  fields: [scalar('street'), scalar('city'), scalar('state'), scalar('zip')],
};

// ─── 1. Suporte / chamados ────────────────────────────────────────────────────

export const supportModel = (): DomainModel => ({
  version: 1,
  intent: 'a support desk: tickets raised by requesters, routed to a queue, handled by agents, with '
    + 'the conversation kept on the ticket',
  target: 'extension',
  extensionId: 'com.example.support',
  entities: [
    ADDRESS,
    {
      name: 'Requester',
      kind: 'entity',
      collection: 'requesters',
      titleField: 'name',
      fields: [
        scalar('name'),
        scalar('email'),
        scalar('phone'),
        scalar('department'),
        { key: 'mailing', label: 'Mailing address', semanticType: 'embedded', embeddedOf: 'Address' },
      ],
    },
    {
      name: 'Agent',
      kind: 'entity',
      collection: 'agents',
      titleField: 'name',
      fields: [scalar('name'), scalar('email'), scalar('extension')],
    },
    {
      name: 'Queue',
      kind: 'entity',
      collection: 'queues',
      titleField: 'name',
      fields: [scalar('name'), scalar('slaHours', 'number'), scalar('active', 'checkbox')],
    },
    { name: 'TicketCategory', kind: 'lookup', collection: 'ticketCategories', fields: [] },
    { name: 'TicketPriority', kind: 'lookup', collection: 'ticketPriorities', fields: [] },
    { name: 'TicketStatus', kind: 'lookup', collection: 'ticketStatuses', fields: [] },
    {
      name: 'Ticket',
      kind: 'entity',
      collection: 'tickets',
      titleField: 'subject',
      fields: [
        scalar('subject'),
        scalar('body', 'textarea'),
        reference('requesterId', 'Requester'),
        reference('agentId', 'Agent'),
        reference('queueId', 'Queue'),
        option('category', 'ticketCategories'),
        option('priority', 'ticketPriorities'),
        option('status', 'ticketStatuses'),
        scalar('openedAt', 'date'),
        scalar('closedAt', 'date'),
        // O código do chamado no sistema DO SOLICITANTE. É dado do chamado, não do solicitante:
        // ninguém o encontra a partir do cadastro dele, e ele muda de chamado para chamado.
        scalar('requesterCode'),
        // Onde o chamado está NA fila. Atributo da relação visto deste lado, não da fila.
        scalar('queuePosition', 'number'),
        // Anotação que o atendente escreve NESTE chamado.
        scalar('agentNotes', 'textarea'),
        {
          key: 'requesterName',
          label: 'Requester name at opening',
          semanticType: 'snapshot',
          type: 'text',
          source: 'Requester.name',
          reason: 'the name as it was when the ticket was opened; renaming a requester must not rewrite the history of closed tickets',
        },
        {
          key: 'interactionCount',
          label: 'Interactions',
          semanticType: 'derived',
          derivedFrom: 'children',
          type: 'number',
          aggregation: { from: 'Interaction', via: 'ticketId', op: 'count' },
        },
      ],
    },
    {
      name: 'Interaction',
      kind: 'child',
      collection: 'ticketInteractions',
      titleField: 'summary',
      fields: [
        scalar('summary'),
        scalar('body', 'textarea'),
        reference('ticketId', 'Ticket'),
        reference('authorId', 'Agent'),
        scalar('at', 'date'),
        scalar('visibleToRequester', 'checkbox'),
      ],
    },
  ],
  relationships: [
    { sourceEntity: 'Ticket', targetEntity: 'Requester', sourceField: 'requesterId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true, displayFields: ['name', 'email'] },
    { sourceEntity: 'Ticket', targetEntity: 'Agent', sourceField: 'agentId', type: 'many-to-one', storage: 'reference', ownership: 'association' },
    { sourceEntity: 'Ticket', targetEntity: 'Queue', sourceField: 'queueId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true },
    { sourceEntity: 'Ticket', targetEntity: 'TicketCategory', sourceField: 'category', type: 'many-to-one', storage: 'lookup', ownership: 'association' },
    { sourceEntity: 'Interaction', targetEntity: 'Ticket', sourceField: 'ticketId', type: 'many-to-one', storage: 'child', ownership: 'composition', required: true },
    { sourceEntity: 'Interaction', targetEntity: 'Agent', sourceField: 'authorId', type: 'many-to-one', storage: 'reference', ownership: 'association' },
    { sourceEntity: 'Ticket', targetEntity: 'TicketStatus', sourceField: 'status', type: 'many-to-one', storage: 'lookup', ownership: 'association' },
  ],
  behavior: {
    states: [
      {
        entity: 'Ticket',
        field: 'status',
        lookup: 'ticketStatuses',
        initial: 'new',
        terminal: ['closed'],
        options: [
          { key: 'new', label: 'New' },
          { key: 'assigned', label: 'Assigned' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'closed', label: 'Closed' },
        ],
      },
    ],
    transitions: [
      // A única de gatilho de GRAVAÇÃO dos três domínios, e é o caso realista: quem preenche o
      // atendente é a pessoa, no formulário, e o chamado entra em atendimento por causa disso.
      {
        name: 'assign-on-save',
        entity: 'Ticket',
        from: 'new',
        to: 'assigned',
        trigger: { kind: 'entity-event', event: 'saved' },
        guard: { expression: 'agentId != null' },
        effects: [],
      },
      {
        name: 'resolve',
        description: 'resolves a ticket that has already been answered, and stamps when it was closed',
        entity: 'Ticket',
        from: 'assigned',
        to: 'resolved',
        trigger: { kind: 'user-action', action: 'resolve-ticket' },
        effects: [{ kind: 'set-field', field: 'closedAt', value: 'now' }],
      },
      {
        name: 'close',
        description: 'closes a resolved ticket and tells the requester it is done',
        entity: 'Ticket',
        from: 'resolved',
        to: 'closed',
        trigger: { kind: 'user-action', action: 'close-ticket' },
        effects: [{ kind: 'notify' }],
      },
    ],
    invariants: [
      {
        scope: 'field',
        entity: 'Interaction',
        field: 'body',
        expression: 'body != ""',
        message: 'An interaction with no text says nothing.',
      },
      // BLOQUEIA, e por isso está pendurada num gesto: a ação some antes de a pessoa apertar.
      {
        scope: 'transition',
        entity: 'Ticket',
        transition: 'resolve',
        enforcement: 'blocks',
        expression: 'interactionCount > 0',
        message: 'A ticket cannot be resolved before anyone has answered it.',
      },
      // REAGE, e está no lugar certo: quando `tickets.saved` chega, o documento já está gravado.
      {
        scope: 'transition',
        entity: 'Ticket',
        transition: 'assign-on-save',
        enforcement: 'reacts',
        expression: 'queueId != null',
        message: 'This ticket was assigned without a queue, and nobody will see it in a list.',
      },
    ],
  },
});

// ─── 2. Clínica ───────────────────────────────────────────────────────────────

export const clinicModel = (): DomainModel => ({
  version: 1,
  intent: 'a clinic: patients seen by professionals, appointments covered by an insurer, each '
    + 'appointment carrying the procedures performed',
  target: 'extension',
  extensionId: 'com.example.clinic',
  entities: [
    ADDRESS,
    {
      name: 'Patient',
      kind: 'entity',
      collection: 'patients',
      titleField: 'name',
      fields: [
        scalar('name'),
        scalar('birthDate', 'date'),
        scalar('document', 'masked'),
        scalar('phone'),
        scalar('email'),
        { key: 'home', label: 'Home address', semanticType: 'embedded', embeddedOf: 'Address' },
      ],
    },
    {
      name: 'Professional',
      kind: 'entity',
      collection: 'professionals',
      titleField: 'name',
      fields: [scalar('name'), scalar('licenseNumber'), option('specialty', 'specialties')],
    },
    { name: 'Specialty', kind: 'lookup', collection: 'specialties', fields: [] },
    {
      name: 'Insurance',
      kind: 'entity',
      collection: 'insurances',
      titleField: 'name',
      fields: [scalar('name'), scalar('registryNumber'), scalar('active', 'checkbox')],
    },
    {
      name: 'Procedure',
      kind: 'entity',
      collection: 'procedures',
      titleField: 'name',
      fields: [scalar('name'), scalar('tableCode'), scalar('basePrice', 'currency'), scalar('durationMinutes', 'number')],
    },
    { name: 'AppointmentStatus', kind: 'lookup', collection: 'appointmentStatuses', fields: [] },
    {
      name: 'Appointment',
      kind: 'entity',
      collection: 'appointments',
      titleField: 'reference',
      tabs: [{
        kind: 'documents',
        because: 'the insurer sends the authorisation as a file, and it has to sit on the appointment it authorises — '
          + 'a folder somewhere else is a folder nobody finds when the insurer questions the bill',
      }],
      fields: [
        scalar('reference'),
        reference('patientId', 'Patient'),
        reference('professionalId', 'Professional'),
        reference('insuranceId', 'Insurance'),
        scalar('scheduledAt', 'date'),
        option('status', 'appointmentStatuses'),
        // O código de autorização que o CONVÊNIO devolveu para este atendimento. É dado do
        // atendimento: outro atendimento do mesmo convênio tem outro.
        scalar('insuranceCode'),
        scalar('notes', 'textarea'),
        {
          key: 'totalCharged',
          label: 'Total charged',
          semanticType: 'derived',
          derivedFrom: 'children',
          type: 'currency',
          aggregation: { from: 'AppointmentProcedure', via: 'appointmentId', op: 'sum', field: 'lineTotal' },
        },
      ],
    },
    {
      name: 'AppointmentProcedure',
      kind: 'child',
      collection: 'appointmentProcedures',
      titleField: 'description',
      fields: [
        scalar('description'),
        reference('appointmentId', 'Appointment'),
        reference('procedureId', 'Procedure'),
        scalar('quantity', 'number'),
        {
          key: 'unitPrice',
          label: 'Unit price',
          semanticType: 'snapshot',
          type: 'currency',
          source: 'Procedure.basePrice',
          reason: 'the price agreed for this appointment; revising the price table must not rewrite what was billed',
        },
        {
          key: 'lineTotal',
          label: 'Line total',
          semanticType: 'derived',
          derivedFrom: 'self',
          type: 'currency',
          expression: 'quantity * unitPrice',
        },
      ],
    },
  ],
  relationships: [
    { sourceEntity: 'Appointment', targetEntity: 'Patient', sourceField: 'patientId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true, displayFields: ['name', 'document'] },
    { sourceEntity: 'Appointment', targetEntity: 'Professional', sourceField: 'professionalId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true },
    { sourceEntity: 'Appointment', targetEntity: 'Insurance', sourceField: 'insuranceId', type: 'many-to-one', storage: 'reference', ownership: 'association' },
    { sourceEntity: 'Appointment', targetEntity: 'AppointmentStatus', sourceField: 'status', type: 'many-to-one', storage: 'lookup', ownership: 'association' },
    { sourceEntity: 'AppointmentProcedure', targetEntity: 'Appointment', sourceField: 'appointmentId', type: 'many-to-one', storage: 'child', ownership: 'composition', required: true },
    { sourceEntity: 'AppointmentProcedure', targetEntity: 'Procedure', sourceField: 'procedureId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true },
    { sourceEntity: 'Professional', targetEntity: 'Specialty', sourceField: 'specialty', type: 'many-to-one', storage: 'lookup', ownership: 'association' },
  ],
  behavior: {
    states: [
      {
        entity: 'Appointment',
        field: 'status',
        lookup: 'appointmentStatuses',
        initial: 'scheduled',
        terminal: ['attended', 'cancelled'],
        options: [
          { key: 'scheduled', label: 'Scheduled' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'attended', label: 'Attended' },
          { key: 'cancelled', label: 'Cancelled' },
        ],
      },
    ],
    transitions: [
      {
        name: 'confirm',
        description: 'confirms a scheduled appointment once the insurer has authorised it',
        entity: 'Appointment',
        from: 'scheduled',
        to: 'confirmed',
        trigger: { kind: 'user-action', action: 'confirm-appointment' },
        effects: [],
      },
      {
        name: 'attend',
        description: 'records that a confirmed appointment was attended, and notifies whoever is waiting on it',
        entity: 'Appointment',
        from: 'confirmed',
        to: 'attended',
        trigger: { kind: 'user-action', action: 'attend-appointment' },
        effects: [{ kind: 'notify' }],
      },
      {
        name: 'cancel-scheduled',
        description: 'cancels an appointment that was only scheduled, before anyone confirmed it',
        entity: 'Appointment',
        from: 'scheduled',
        to: 'cancelled',
        trigger: { kind: 'user-action', action: 'cancel-appointment' },
        effects: [],
      },
      {
        name: 'cancel-confirmed',
        description: 'cancels an appointment that was already confirmed, which only the front desk may do',
        entity: 'Appointment',
        from: 'confirmed',
        to: 'cancelled',
        trigger: { kind: 'user-action', action: 'cancel-confirmed-appointment' },
        actor: 'the front desk',
        permission: 'appointments.update',
        effects: [{ kind: 'notify' }],
      },
    ],
    invariants: [
      {
        scope: 'field',
        entity: 'AppointmentProcedure',
        field: 'quantity',
        expression: 'quantity > 0',
        message: 'A procedure line must count at least one.',
      },
      {
        scope: 'transition',
        entity: 'Appointment',
        transition: 'confirm',
        enforcement: 'blocks',
        expression: 'insuranceCode != ""',
        message: 'An appointment cannot be confirmed before the insurer has authorised it.',
      },
    ],
  },
});

// ─── 3. Escola ────────────────────────────────────────────────────────────────

export const schoolModel = (): DomainModel => ({
  version: 1,
  intent: 'a school: students with guardians, enrolled in classes, assessed per subject',
  target: 'screenDefinitions',
  entities: [
    ADDRESS,
    {
      name: 'Guardian',
      kind: 'entity',
      collection: 'guardians',
      titleField: 'name',
      fields: [scalar('name'), scalar('document', 'masked'), scalar('phone'), scalar('email')],
    },
    {
      name: 'Student',
      kind: 'entity',
      collection: 'students',
      titleField: 'name',
      fields: [
        scalar('name'),
        scalar('birthDate', 'date'),
        reference('guardianId', 'Guardian'),
        { key: 'residence', label: 'Residence', semanticType: 'embedded', embeddedOf: 'Address' },
      ],
    },
    { name: 'ClassShift', kind: 'lookup', collection: 'classShifts', fields: [] },
    { name: 'ClassStatus', kind: 'lookup', collection: 'classStatuses', fields: [] },
    {
      name: 'SchoolClass',
      kind: 'entity',
      collection: 'schoolClasses',
      titleField: 'name',
      fields: [
        scalar('name'),
        scalar('year', 'number'),
        option('shift', 'classShifts'),
        option('status', 'classStatuses'),
        // O professor regente não é cadastro deste sistema — é um nome digitado. Parece acoplamento
        // e não é: não há entidade Teacher em lugar nenhum para apontar.
        scalar('teacherName'),
        scalar('room'),
      ],
    },
    {
      name: 'Subject',
      kind: 'entity',
      collection: 'subjects',
      titleField: 'name',
      fields: [scalar('name'), scalar('syllabusCode')],
    },
    { name: 'EnrollmentStatus', kind: 'lookup', collection: 'enrollmentStatuses', fields: [] },
    {
      name: 'Enrollment',
      kind: 'entity',
      collection: 'enrollments',
      titleField: 'reference',
      fields: [
        scalar('reference'),
        reference('studentId', 'Student'),
        reference('classId', 'SchoolClass'),
        scalar('enrolledAt', 'date'),
        option('status', 'enrollmentStatuses'),
        // O número de chamada. É da MATRÍCULA — o mesmo aluno tem outro número no ano seguinte.
        scalar('studentNumber', 'number'),
        {
          key: 'averageScore',
          label: 'Average score',
          semanticType: 'derived',
          derivedFrom: 'children',
          type: 'number',
          aggregation: { from: 'Assessment', via: 'enrollmentId', op: 'avg', field: 'score' },
        },
      ],
    },
    {
      name: 'Assessment',
      kind: 'child',
      collection: 'assessments',
      titleField: 'title',
      fields: [
        scalar('title'),
        reference('enrollmentId', 'Enrollment'),
        reference('subjectId', 'Subject'),
        scalar('score', 'number'),
        scalar('weight', 'number'),
        scalar('assessedAt', 'date'),
      ],
    },
  ],
  relationships: [
    { sourceEntity: 'Student', targetEntity: 'Guardian', sourceField: 'guardianId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true, displayFields: ['name', 'phone'] },
    { sourceEntity: 'Enrollment', targetEntity: 'Student', sourceField: 'studentId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true },
    { sourceEntity: 'Enrollment', targetEntity: 'SchoolClass', sourceField: 'classId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true },
    { sourceEntity: 'Enrollment', targetEntity: 'EnrollmentStatus', sourceField: 'status', type: 'many-to-one', storage: 'lookup', ownership: 'association' },
    { sourceEntity: 'Assessment', targetEntity: 'Enrollment', sourceField: 'enrollmentId', type: 'many-to-one', storage: 'child', ownership: 'composition', required: true },
    { sourceEntity: 'Assessment', targetEntity: 'Subject', sourceField: 'subjectId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true },
    { sourceEntity: 'SchoolClass', targetEntity: 'ClassStatus', sourceField: 'status', type: 'many-to-one', storage: 'lookup', ownership: 'association' },
  ],
  behavior: {
    states: [
      {
        entity: 'Enrollment',
        field: 'status',
        lookup: 'enrollmentStatuses',
        initial: 'requested',
        terminal: ['completed', 'withdrawn'],
        options: [
          { key: 'requested', label: 'Requested' },
          { key: 'active', label: 'Active' },
          // NENHUMA transição de Enrollment leva aqui. Quem leva é o efeito de `finish-classes`,
          // que é um fluxo de SchoolClass — e é o caso que o detector de inalcançável acusava.
          { key: 'completed', label: 'Completed' },
          { key: 'withdrawn', label: 'Withdrawn' },
        ],
      },
      {
        entity: 'SchoolClass',
        field: 'status',
        lookup: 'classStatuses',
        initial: 'planned',
        terminal: ['finished'],
        options: [
          { key: 'planned', label: 'Planned' },
          { key: 'running', label: 'Running' },
          { key: 'finished', label: 'Finished' },
        ],
      },
    ],
    transitions: [
      {
        name: 'activate',
        description: 'activates an enrollment that has a roll number, putting the student in the class',
        entity: 'Enrollment',
        from: 'requested',
        to: 'active',
        trigger: { kind: 'user-action', action: 'activate-enrollment' },
        effects: [],
      },
      {
        name: 'withdraw',
        description: 'withdraws an active enrollment and notifies the guardian',
        entity: 'Enrollment',
        from: 'active',
        to: 'withdrawn',
        trigger: { kind: 'user-action', action: 'withdraw-enrollment' },
        effects: [{ kind: 'notify' }],
      },
      {
        name: 'start-classes',
        description: 'starts a planned class, which is what puts its enrollments in motion',
        entity: 'SchoolClass',
        from: 'planned',
        to: 'running',
        trigger: { kind: 'user-action', action: 'start-classes' },
        effects: [],
      },
      {
        name: 'finish-classes',
        description: 'finishes a running class and completes every enrollment of it',
        entity: 'SchoolClass',
        from: 'running',
        to: 'finished',
        trigger: { kind: 'user-action', action: 'finish-classes' },
        effects: [{ kind: 'update-record', entity: 'Enrollment', field: 'status', value: '"completed"' }],
      },
    ],
    invariants: [
      {
        scope: 'field',
        entity: 'Assessment',
        field: 'score',
        expression: 'score >= 0',
        message: 'A score below zero is a typing mistake, not a grade.',
      },
      {
        scope: 'transition',
        entity: 'Enrollment',
        transition: 'activate',
        enforcement: 'blocks',
        expression: 'studentNumber > 0',
        message: 'An enrollment cannot be activated before it has a roll number.',
      },
    ],
  },
});

export const CORPUS: { name: string; model: () => DomainModel }[] = [
  { name: 'support desk', model: supportModel },
  { name: 'clinic', model: clinicModel },
  { name: 'school', model: schoolModel },
];
