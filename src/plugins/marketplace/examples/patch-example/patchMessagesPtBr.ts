import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { PATCH_NAMESPACE } from './patchMessages';

/** **Portuguese (Brazil) for the Patch example** — the translation travels inside the package. */
const PATCH_PT_BR: Record<string, string> = {
  'package.name': 'Estender e migrar, pelo exemplo',
  'package.category': 'Cooperação',
  'package.description':
    'Acrescenta um campo a uma tela que é de outra extensão, e traz a migração que preenche os registros que já estavam lá.',
  'package.summary':
    'As duas coisas que uma extensão faz com dado que não é novo. Ela acrescenta um campo a uma tela que OUTRA extensão declarou, sem que nenhuma das duas seja reescrita, e traz uma migração que roda uma vez por escritório para preencher um campo que os registros antigos nunca tiveram. A migração roda no mesmo sandbox de um script, e nunca escreve o nome de uma coleção à mão.',

  'screen.note': 'Nota',
  'screen.note.plural': 'Notas',
  'field.title': 'Título',
  'field.title.placeholder': 'Sobre o que é esta nota',
  'field.code': 'Código',
  'field.body': 'Conteúdo',

  'patch.note': 'Nota relacionada',

  'migration.fill-code': 'Preencher o código das notas antigas',
};

export const patchPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: PATCH_NAMESPACE,
    messages: PATCH_PT_BR,
  });
