import { describe, expect, it } from 'vitest';
import {
  accessFromPreflight,
  callableEndpoint,
  invokerGrantCommand,
} from './callableAccess.js';

/**
 * Esta é a única verificação do Console que reproduz a chamada do NAVEGADOR. Ela existe porque um
 * deploy bem-sucedido não prova alcance: a concessão de invocação pública pode ser recusada por
 * política da organização, e aí a aplicação abre e toda chamada ao servidor falha como se fosse CORS.
 */
describe('alcance das callables pelo navegador', () => {
  it('trata 403 como IAM negando, não como function ausente', () => {
    expect(accessFromPreflight(403, null)).toBe('blocked');
  });

  it('trata 404 como function que não subiu naquela região', () => {
    expect(accessFromPreflight(404, null)).toBe('missing');
  });

  it('só considera alcançável o preflight que devolve o cabeçalho de CORS', () => {
    expect(accessFromPreflight(204, 'https://acme.web.app')).toBe('reachable');
    expect(accessFromPreflight(204, null)).toBe('unknown');
  });

  it('não emite veredito sobre o que não entende', () => {
    expect(accessFromPreflight(500, null)).toBe('unknown');
    expect(accessFromPreflight(401, null)).toBe('unknown');
  });

  it('monta o endereço com a região, que é o que o navegador chama', () => {
    expect(callableEndpoint('southamerica-east1', 'acme', 'getUserInfo'))
      .toBe('https://southamerica-east1-acme.cloudfunctions.net/getUserInfo');
  });

  it('nomeia o serviço do Cloud Run em minúsculas, que é como a function aparece lá', () => {
    const command = invokerGrantCommand('southamerica-east1', 'acme', 'getUserInfo');
    expect(command).toContain('add-iam-policy-binding getuserinfo');
    expect(command).toContain('--region=southamerica-east1');
    expect(command).toContain('--member=allUsers');
    expect(command).toContain('--role=roles/run.invoker');
  });
});
