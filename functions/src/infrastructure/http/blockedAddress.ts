import { BlockList, isIP } from 'node:net';

/**
 * Os endereços que a function NUNCA conecta, venha o nome de onde vier.
 *
 * A lista de domínios do escritório decide o NOME; ela não decide o IP. `api.exemplo.com` pode
 * resolver para `169.254.169.254` (o servidor de metadados, que entrega credencial do projeto) ou
 * para a rede interna — por erro de quem cadastrou, ou de propósito por quem controla o DNS. Por isso
 * a conferência é sobre o IP que vai de fato ser conectado, e não sobre o texto da URL.
 */
const BLOCKED = new BlockList();

const IPV4_RANGES: [string, number][] = [
  ['0.0.0.0', 8], // "esta rede"
  ['10.0.0.0', 8], // privada
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local — metadados da nuvem
  ['172.16.0.0', 12], // privada
  ['192.0.0.0', 24], // atribuições do IETF
  ['192.0.2.0', 24], // documentação
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // privada
  ['198.18.0.0', 15], // benchmark
  ['198.51.100.0', 24], // documentação
  ['203.0.113.0', 24], // documentação
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reservada e broadcast
];

const IPV6_RANGES: [string, number][] = [
  ['::', 128], // não especificado
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 — esconderia um IPv4 interno
  ['64:ff9b:1::', 48],
  ['100::', 64], // descarte
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentação
  ['2002::', 16], // 6to4 — esconderia um IPv4 interno
  ['fc00::', 7], // ULA, a "privada" do IPv6
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (obsoleta, ainda roteada por alguns)
  ['ff00::', 8], // multicast
];

for (const [network, prefix] of IPV4_RANGES) BLOCKED.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of IPV6_RANGES) BLOCKED.addSubnet(network, prefix, 'ipv6');

const MAPPED_IPV4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const MAPPED_IPV4_HEX = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

/** `::ffff:10.0.0.1` é o IPv4 `10.0.0.1` — e é como ele é conferido. */
const embeddedIpv4 = (address: string): string | null => {
  const dotted = MAPPED_IPV4.exec(address);
  if (dotted) return dotted[1];
  const hex = MAPPED_IPV4_HEX.exec(address);
  if (!hex) return null;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
};

/** `true` para o que não é IP válido: na dúvida, não conecta. */
export const isBlockedAddress = (address: string): boolean => {
  const bare = address.replace(/^\[|\]$/g, '').split('%')[0];
  const family = isIP(bare);
  if (family === 4) return BLOCKED.check(bare, 'ipv4');
  if (family === 6) {
    const mapped = embeddedIpv4(bare);
    if (mapped) return isIP(mapped) !== 4 || BLOCKED.check(mapped, 'ipv4');
    return BLOCKED.check(bare, 'ipv6');
  }
  return true;
};
