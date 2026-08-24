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
 */
export const CORE_LICENSE_MESSAGES: Record<string, string> = {
  'page.title': 'Terms of Use and Privacy Policy',
  'updated-at': 'Last updated: {date}',

  'banner.beta':
    'Microteia is in beta. The system may contain errors, instabilities or temporary outages. Use is at the risk of the organization and its registered users.',

  'acceptance.title': '1. Acceptance of the terms',
  'acceptance.text':
    'Microteia is a management system for law firms, offered as SaaS (software as a service), multi-tenant. By creating an account or using the system, the user and the organization they belong to declare that they have read, understood and fully accepted these Terms of Use and this Privacy Policy. If you do not agree with any clause, you must not use the system.',

  'service.title': '2. Description of the service',
  'service.text':
    'Microteia allows registering and managing clients, cases, deadlines, contracts, financial entries and the organization’s communications, including support features based on artificial intelligence for reading and classifying e-mails, court notices and case updates. Each organization’s (tenant’s) data is stored in isolation from the other organizations using the system.',

  'beta.title': '3. Beta stage and limitation of warranties',
  'beta.text': 'Microteia is under development and testing (beta). This means that:',
  'beta.item.failures':
    'the system may present failures, outages, temporary data loss or unexpected behavior;',
  'beta.item.changes': 'features may be changed, suspended or discontinued without prior notice;',
  'beta.item.uptime':
    'there is no guarantee of continuous availability (uptime) nor of the total absence of errors;',
  'beta.item.parallel':
    'keeping parallel controls and manually checking deadlines and critical information is strongly recommended while the system is in beta.',

  'account.title': '4. Registration and account responsibility',
  'account.text':
    'The user is responsible for the accuracy of the registered data, for safeguarding their access credentials and for every activity carried out in their account. The organization (tenant) is responsible for correctly defining the roles (admin, lawyer, assistant, user) of each member and for the permissions granted.',

  'privacy.title': '5. Privacy and data protection',
  'privacy.text':
    'We collect and process personal data in accordance with the Brazilian General Data Protection Law (Law No. 13,709/2018 — LGPD), including:',
  'privacy.item.account': 'user registration data (name, e-mail, profile picture);',
  'privacy.item.records':
    'data entered by the organization about clients, cases, contracts and finances;',
  'privacy.item.email':
    'the content of e-mails and documents processed by the e-mail monitor, for the purpose of identifying deadlines and case updates;',
  'privacy.item.audit': 'system usage and audit data, for security and traceability purposes.',
  'privacy.isolation':
    'Each organization’s data is stored in isolation from the other tenants and is not shared with other organizations. Data may be processed by cloud infrastructure providers and by artificial intelligence services strictly necessary for the system to work, always under a contractual duty of confidentiality. We do not sell or share personal data with third parties for advertising purposes.',
  'privacy.rights':
    'The data subject may, at any time, request access to, correction of, portability of or deletion of their personal data — subject to the legal obligations to retain procedural and tax information — by contacting the e-mail address given at the end of these terms.',

  'security.title': '6. Information security',
  'security.text':
    'We adopt reasonable technical and organizational measures to protect the stored data, including role-based access control, isolation between organizations and audit logging. No system is entirely free of risk, and the user acknowledges that no security measure guarantees absolute protection against incidents.',

  'liability.title': '7. Limitation of liability',
  'liability.text':
    'To the fullest extent permitted by applicable law, Microteia and the person responsible for it are not liable for indirect damages, lost profits, loss of clients, missed procedural deadlines or any harm arising from the use of, or the inability to use, the system, including technical failures, unavailability, errors of the artificial intelligence or of third-party services. Using the system does not replace the professional judgment, diligence and manual review required in the practice of law.',

  'ip.title': '8. Intellectual property',
  'ip.text':
    'All source code, design, trademark and other elements of Microteia are protected by copyright and belong to its author. Copying, reverse engineering, redistribution or unauthorized commercial exploitation of the system is prohibited.',

  'changes.title': '9. Changes to these terms',
  'changes.text':
    'These terms may be updated at any time, especially during the beta stage of the system. The date of the last update is always shown at the top of this page. Continued use of the system after changes implies agreement with the new terms.',

  'law.title': '10. Governing law',
  'law.text':
    'These terms are governed by the laws of the Federative Republic of Brazil, and the courts of the domicile of the person responsible for the system are elected to settle any disputes, save for any legal provision to the contrary.',

  'extensions.title': 'Terms of the installed extensions',
  'extensions.text':
    'Each extension installed and active in this organization may carry its own licence terms, written by whoever authored it. They are reproduced below and add to — never replace — the terms above. An extension that is uninstalled or deactivated stops appearing here, because its terms stop applying.',

  'contact.title': 'Copyright and contact',
  'contact.text':
    'All copyright over Microteia belongs to the lawyer responsible for its development.',
  'contact.email-label': 'E-mail:',
};
