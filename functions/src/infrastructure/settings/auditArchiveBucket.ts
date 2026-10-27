import { defineString } from 'firebase-functions/params';

/**
 * O bucket do ARQUIVO da Auditoria — de quem mantém a instalação, no `.env.<projectId>` dela. Vazio é
 * "não configurado": o arquivo não pode ser ligado por escritório nenhum, e nada mais muda. É por isso
 * que ele tem `default` — uma instalação que não usa o arquivo não tem nada a preencher.
 *
 * Um nome declarado, e não um derivado do projeto: um nome previsível poderia ser criado por OUTRA
 * pessoa, num projeto dela, e receber a auditoria de quem nunca o configurou.
 */
export const AUDIT_ARCHIVE_BUCKET: ReturnType<typeof defineString> = defineString('AUDIT_ARCHIVE_BUCKET', { default: '', description: 'Bucket with locked retention for the daily audit archive. Empty: the archive is unavailable.' });
