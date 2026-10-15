// RFC 6238. No network calls or third-party dependencies.
export function parseSecret(input) {
  let secret = String(input || '').trim();
  let algorithm = 'SHA-1';
  let digits = 6;
  let period = 30;
  if (secret.startsWith('otpauth://')) {
    const uri = new URL(secret);
    if (uri.hostname !== 'totp') throw new Error('Chỉ hỗ trợ khóa TOTP.');
    secret = uri.searchParams.get('secret') || '';
    const alg = (uri.searchParams.get('algorithm') || 'SHA1').toUpperCase();
    algorithm = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' }[alg];
    digits = Number(uri.searchParams.get('digits') || 6);
    period = Number(uri.searchParams.get('period') || 30);
  }
  secret = secret.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (!algorithm || ![6, 8].includes(digits) || !Number.isInteger(period) || period < 15 || period > 120) {
    throw new Error('Tham số TOTP không được hỗ trợ.');
  }
  if (!/^[A-Z2-7]+$/.test(secret) || secret.length < 16) {
    throw new Error('Khóa 2FA cần là secret Base32 hoặc URL otpauth://totp, không phải mã 6 số.');
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const char of secret) {
    buffer = (buffer << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits >= 5 || buffer !== 0) throw new Error('Khóa Base32 không hợp lệ.');
  return { key: new Uint8Array(bytes), algorithm, digits, period };
}

export async function generateTotp(secret, now = Date.now()) {
  const config = parseSecret(secret);
  const counter = Math.floor(now / 1000 / config.period);
  const message = new ArrayBuffer(8);
  new DataView(message).setBigUint64(0, BigInt(counter));
  const key = await crypto.subtle.importKey('raw', config.key, { name: 'HMAC', hash: config.algorithm }, false, ['sign']);
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = hash[hash.length - 1] & 15;
  const binary = ((hash[offset] & 127) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
  return { code: String(binary % 10 ** config.digits).padStart(config.digits, '0'), remaining: config.period - (Math.floor(now / 1000) % config.period) };
}
