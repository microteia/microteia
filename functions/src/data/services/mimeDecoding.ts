export function decodeQuotedPrintable(input: Buffer): Buffer {
  const text = input
    .toString('latin1')
    .replace(/=(?:\r\n|\r|\n)/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return Buffer.from(text, 'latin1');
}
