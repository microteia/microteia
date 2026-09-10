import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { LIBRARY_NAMESPACE } from './libraryMessages';

/** **Portuguese (Brazil) for the Library example** — the translation travels inside the package. */
const LIBRARY_PT_BR: Record<string, string> = {
  'package.name': 'Uma extensão-biblioteca, pelo exemplo',
  'package.category': 'Cooperação',
  'package.description':
    'Uma extensão sem interface nenhuma: publica um ponto de extensão, exporta um script e um fluxo para outras apontarem, e oferece uma capacidade.',
  'package.summary':
    'A metade da cooperação que PUBLICA. Não instala tela nem página — tudo o que ela traz existe para outra extensão usar: um ponto de extensão próprio que outras preenchem, um script de sandbox e um fluxo chamável nomeados em `exports`, uma permissão a que outras podem somar, e uma capacidade que ela provê. Leia ao lado do exemplo consumidor, que é a outra metade.',

  'point.formatter.title': 'Formatador de código',
  'point.formatter.description':
    'Registre um jeito de formatar um código. Quem preencher este ponto é oferecido onde a biblioteca formata um.',

  'script.normalize': 'Normalizar um código',
  'script.normalize.description':
    'Apara, põe em maiúsculas e junta com hifens. Exportado, para que outra extensão possa apontar um passo para ele.',
  'script.normalize.in.code': 'Código a normalizar',
  'script.normalize.out.code': 'O código normalizado',
  'script.normalize.out.changed': 'Se ele diferia do que foi dado',

  'workflow.announce': 'Anunciar um código',
  'workflow.announce.description':
    'Um fluxo chamável: recebe um código e um motivo, e os grava na auditoria. Exportado, para que outra extensão possa chamá-lo.',
  'workflow.announce.audit.title': 'Código anunciado',
  'parameter.code': 'Código',
  'parameter.reason': 'Motivo',

  'resource.library': 'Biblioteca de códigos',
  'permission.use': 'Usar a biblioteca de códigos',
  'permission.use.description':
    'Chamar o que esta biblioteca exporta. Outra extensão pode alargar esta permissão com as exigências dela.',
};

export const libraryPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: LIBRARY_NAMESPACE,
    messages: LIBRARY_PT_BR,
  });
