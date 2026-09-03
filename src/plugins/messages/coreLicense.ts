/**
 * O texto dos Termos de Uso e da Política de Privacidade, em namespace PRÓPRIO.
 *
 * Ele não vive junto do resto por uma razão de tamanho: um documento jurídico completo é maior que
 * toda a interface somada, e enfiá-lo no pacote de um idioma obrigaria quem só quer traduzir botões
 * e menus a carregar — e revisar — páginas de texto legal. Separado, traduzir o sistema e traduzir o
 * contrato viram dois pacotes independentes, e o segundo é opcional.
 *
 * ⚠️ O conteúdo aqui é a versão-fonte. Alterá-lo altera o documento que o escritório aceita ao criar
 * conta: mudança de texto nesta lista é decisão jurídica, não de código.
 *
 * A premissa que sustenta o documento é a de DISTRIBUIÇÃO: o software é instalado no projeto de nuvem
 * do próprio escritório, e é por isso que o controle, a segurança e a lei aplicável são dele. Nenhuma
 * cláusula aqui pode passar a falar como se nós hospedássemos os dados — não os hospedamos, e o
 * documento que dissesse o contrário prometeria uma responsabilidade que ninguém tem como cumprir.
 */
export const CORE_LICENSE_MESSAGES: Record<string, string> = {
  'page.title': 'Terms of Use and Privacy Policy',
  'updated-at': 'Last updated: {date}',

  'banner.beta':
    'Microteia is in beta. The software may contain errors, instabilities or temporary outages. Use is at the risk of the organization and its registered users.',

  'acceptance.title': '1. Acceptance of the terms',
  'acceptance.text':
    'Microteia is an AI-first platform for business applications: each organization declares the application it needs — screens, collections, forms, automations and access profiles — and extends it with installable extensions. The software is licensed to be installed and operated by the organization itself. By creating an account or using an installation of Microteia, the user and the organization they belong to declare that they have read, understood and fully accepted these Terms of Use and this Privacy Policy. If you do not agree with any clause, you must not use the software.',

  'service.title': '2. Description of the service',
  'service.text':
    'Microteia does not impose a business domain: it provides the platform on which each organization builds its own application, declaring the screens, collections, forms, reports, automations and access profiles it needs, and installing extensions authored by itself or by third parties. Artificial intelligence features assist both in authoring those declarations and in reading, classifying and processing the content submitted to them. What each extension does, and which data it handles, is described in the extension itself and in the terms it carries. A single installation may host more than one organization (tenant), and each tenant’s data is stored in isolation from the others within that installation.',

  'install.title': '3. Where the software runs, and who holds the data',
  'install.text':
    'Microteia is installed in a cloud project that belongs to the organization — its own Firebase project — and not in an environment operated by the author of the software. This is the most important fact of this agreement, and everything below follows from it:',
  'install.item.project':
    'the cloud project, its billing account and its administrative credentials belong to the organization, which also decides in which region the data is hosted;',
  'install.item.data':
    'all data — records, files, access profiles, audit trail and backups — is written to and stays inside that project, under the exclusive control of the organization;',
  'install.item.access':
    'the author of the software has no standing access to the installation, to its data or to its credentials, and depends on access the organization itself grants, temporarily and explicitly, when it asks for support;',
  'install.item.operation':
    'availability, backup, retention, restoration and the cost of the cloud services are the responsibility of the organization that operates the installation, under the terms of its own cloud provider.',

  'beta.title': '4. Beta stage and limitation of warranties',
  'beta.text': 'Microteia is under development and testing (beta). This means that:',
  'beta.item.failures':
    'the software may present failures, outages, temporary data loss or unexpected behavior;',
  'beta.item.changes': 'features may be changed, suspended or discontinued without prior notice;',
  'beta.item.uptime':
    'there is no guarantee of continuous availability (uptime) nor of the total absence of errors;',
  'beta.item.parallel':
    'keeping parallel controls and manually checking critical information is strongly recommended while the software is in beta.',

  'account.title': '5. Accounts, profiles and the responsibilities of the organization',
  'account.text':
    'The user is responsible for the accuracy of the data they register, for safeguarding their access credentials and for every activity carried out in their account. The organization is responsible for the access profiles it creates, for the permissions granted to each of its members, for what the extensions it installs and the automations it declares do on its behalf, and for the content it and its users put into the installation — including having the right to process that content.',

  'privacy.title': '6. Data protection',
  'privacy.text':
    'Microteia is built so that the data of an installation stays in that installation. That is a matter of architecture, not of promise:',
  'privacy.item.no-collection':
    'the software sends the author no records, documents, usage statistics or personal data of the organization, and keeps no copy outside the installation;',
  'privacy.item.processing':
    'data is processed by the cloud provider whose project hosts the installation, and by the artificial intelligence, e-mail or integration services the organization itself configures with its own credentials — never by services the organization has not enabled;',
  'privacy.item.extensions':
    'an extension that needs an external service declares it in its own terms, and installing the extension is what authorizes it: an extension that is uninstalled or deactivated stops processing anything;',
  'privacy.item.audit':
    'usage and audit records exist for security and traceability, and they too stay inside the installation.',
  'privacy.controller':
    'The organization that operates the installation is the controller of the data in it. It is the organization that determines what is collected, for which purpose, for how long it is kept and who may see it, and it answers for the lawful basis of that processing before its own users, clients and authorities.',
  'privacy.laws':
    'What data protection law requires differs from country to country, and these terms elect none of them: the organization identifies which laws apply to it — by where it is established, and by where its users and the people whose data it processes are — and complies with them, including any duty to appoint a data protection officer, to keep records of processing activities or to notify incidents.',
  'privacy.rights':
    'A request for access to, correction of, portability of or deletion of personal data must be addressed to the organization that operates the installation: it is the only party with access to the data, and the only one able to answer. The author of the software neither holds that data nor is able to act on it.',

  'security.title': '7. Information security',
  'security.text':
    'The software provides the mechanisms; operating them belongs to the organization. Microteia ships with permission-based access control, isolation between tenants, server-side security rules for data and files, and an audit trail. Beside these, and no less decisive, are the measures only the organization can take:',
  'security.item.credentials':
    'protecting the administrative credentials of the cloud project, and the accounts that hold them;',
  'security.item.permissions':
    'reviewing the access profiles it creates, and removing the access of whoever leaves the organization;',
  'security.item.extensions':
    'assessing an extension before installing it — an active extension runs inside the installation, with the access the organization granted it;',
  'security.item.backup':
    'keeping backups whose restoration it has actually tested, and applying the versions of the software that fix known faults.',
  'security.note':
    'No system is entirely free of risk, and the organization acknowledges that no security measure guarantees absolute protection against incidents. Investigating and notifying an incident that happens in an installation is up to the organization that operates it.',

  'liability.title': '8. Limitation of liability',
  'liability.text':
    'To the fullest extent permitted by applicable law, the author of Microteia is not liable for indirect damages, lost profits, loss of business, missed deadlines, loss or leakage of data, or any harm arising from the use of, or the inability to use, the software — including technical failures, unavailability, errors of the artificial intelligence, the behavior of the extensions and automations the organization chose to install or declare, and the acts or omissions of the cloud and third-party services the organization contracted. The installation runs in the organization’s own project and is operated by the organization; the author does not administer it. Using the software does not replace the professional judgment, the diligence and the manual review required by the activity the organization carries out in it.',

  'ip.title': '9. Intellectual property',
  'ip.text':
    'All source code, design, trademark and other elements of Microteia are protected by copyright and belong to its author. The organization receives a non-exclusive, non-transferable licence to install and use the software in its own project, for its own operation; it does not receive the right to redistribute it, to sublicense it or to offer it as a service to third parties. Copying, reverse engineering and unauthorized commercial exploitation are prohibited. An extension authored by a third party belongs to its own author, and its use is governed by the terms that extension carries.',

  'changes.title': '10. Changes to these terms',
  'changes.text':
    'These terms may be updated, especially during the beta stage. Each installation carries the version of these terms that came with the version of the software it runs, and the date of the last update is always shown at the top of this page. Continued use after updating the software implies agreement with the terms that came with it.',

  'law.title': '11. Applicable law',
  'law.text':
    'These terms elect the law of no single country. Each party complies with the legislation that applies to it, and the organization that operates the installation answers for the requirements of its own jurisdiction and of those where its users and clients are. Where a mandatory provision of applicable law conflicts with a clause of these terms, that clause is limited to the minimum extent necessary for the remainder to stay valid. Any dispute is settled, by preference, at the domicile of the defending party, save for any legal provision to the contrary.',

  'extensions.title': 'Terms of the installed extensions',
  'extensions.text':
    'Each extension installed and active in this organization may carry its own licence terms, written by whoever authored it. They are reproduced below and add to — never replace — the terms above. An extension that is uninstalled or deactivated stops appearing here, because its terms stop applying.',

  'contact.title': 'Copyright and contact',
  'contact.text':
    'All copyright over Microteia belongs to the author responsible for its development.',
  'contact.email-label': 'E-mail:',
};
