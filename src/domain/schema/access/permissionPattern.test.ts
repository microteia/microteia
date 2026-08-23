import { describe, it, expect } from 'vitest';
import { matchesPermission } from './permissionPattern';

const granted = ['pet1.read', 'pet1.delete', 'pet2.read', 'finance.write', 'push.recheck'];

describe('matchesPermission', () => {
  it('casa o identificador exato', () => {
    expect(matchesPermission(granted, 'pet1.delete')).toBe(true);
    expect(matchesPermission(granted, 'pet1.create')).toBe(false);
  });

  it('é sensível a maiúsculas — Pet1 e pet1 são coleções diferentes', () => {
    expect(matchesPermission(granted, 'Pet1.delete')).toBe(false);
  });

  it('<entity> vira a entidade do contexto', () => {
    expect(matchesPermission(granted, '<entity>.delete', 'pet1')).toBe(true);
    expect(matchesPermission(granted, '<entity>.delete', 'pet2')).toBe(false);
  });

  it('<entity> sem entidade no contexto responde NÃO, e não casa com tudo', () => {
    expect(matchesPermission(granted, '<entity>.delete')).toBe(false);
    expect(matchesPermission(granted, '<entity>.delete', '   ')).toBe(false);
  });

  it('* casa um segmento inteiro, dos dois lados do ponto', () => {
    expect(matchesPermission(granted, '*.delete')).toBe(true);
    expect(matchesPermission(granted, 'pet1.*')).toBe(true);
    expect(matchesPermission(granted, '*.update')).toBe(false);
  });

  it('% casa um pedaço DENTRO do segmento', () => {
    expect(matchesPermission(granted, 'pet%.read')).toBe(true);
    expect(matchesPermission(granted, 'fin%.write')).toBe(true);
    expect(matchesPermission(granted, 'dog%.read')).toBe(false);
  });

  it('curinga nunca atravessa o ponto', () => {
    expect(matchesPermission(['a.b.c'], '*')).toBe(false);
    expect(matchesPermission(['a.b'], '%')).toBe(false);
  });

  it('o ponto do padrão é literal, não o "qualquer caractere" da regex', () => {
    expect(matchesPermission(['axb'], 'a.b')).toBe(false);
  });

  it('combina <entity> com curinga', () => {
    expect(matchesPermission(granted, '<entity>.*', 'pet1')).toBe(true);
    expect(matchesPermission(granted, '<entity>.*', 'gato')).toBe(false);
  });

  it('o curinga do DONO do escritório concede qualquer padrão', () => {
    expect(matchesPermission(['*'], 'qualquer.coisa')).toBe(true);
    expect(matchesPermission(['*'], '<entity>.delete', 'gato')).toBe(true);
  });

  it('mas o curinga do dono NÃO salva um padrão sem entidade resolvível', () => {
    expect(matchesPermission(['*'], '<entity>.delete')).toBe(false);
  });

  it('padrão vazio responde NÃO', () => {
    expect(matchesPermission(['*'], '')).toBe(false);
    expect(matchesPermission(granted, '   ')).toBe(false);
  });

  it('permissão de plugin, sem relação com coleção, casa igual', () => {
    expect(matchesPermission(granted, 'push.recheck')).toBe(true);
    expect(matchesPermission(granted, 'push.*')).toBe(true);
  });
});
