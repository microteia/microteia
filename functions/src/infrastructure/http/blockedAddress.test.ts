import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from './blockedAddress';

describe('isBlockedAddress — os IPs que a function nunca conecta', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.10', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
  ])('bloqueia o IPv4 interno ou reservado %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '64:ff9b::a00:1', '2002:a00:1::',
  ])('bloqueia o IPv6 interno ou que esconde um IPv4 %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it('o IPv4 dentro de um IPv6 mapeado é conferido como IPv4, nas duas grafias', () => {
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:a00:1')).toBe(true);
    expect(isBlockedAddress('::ffff:7f00:1')).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '[2606:4700:4700::1111]'])(
    'libera o endereço público %s',
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );

  it('o que não é IP não conecta', () => {
    expect(isBlockedAddress('localhost')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
  });
});
