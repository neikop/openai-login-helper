import { parseSecret } from './totp.js';

export async function readAccounts() {
  const { accountsV1 } = await chrome.storage.local.get('accountsV1');
  return Array.isArray(accountsV1) ? accountsV1 : [];
}
export function summary(account) {
  return { id: account.id, label: account.label, email: account.email, has2fa: !!account.secret };
}
export async function moveAccount(id, targetId, position) {
  if (!['before', 'after'].includes(position)) throw new Error('Vị trí không hợp lệ.');
  const accounts = await readAccounts();
  const account = accounts.find(item => item.id === id);
  if (!account || !accounts.some(item => item.id === targetId)) throw new Error('Tài khoản này đã bị xóa.');
  if (id === targetId) return;
  const reordered = accounts.filter(item => item.id !== id);
  const targetIndex = reordered.findIndex(item => item.id === targetId);
  reordered.splice(targetIndex + (position === 'after' ? 1 : 0), 0, account);
  await chrome.storage.local.set({ accountsV1: reordered });
}
export function validateAccount(value) {
  if (!value || typeof value !== 'object') throw new Error('Tài khoản không hợp lệ.');
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const password = typeof value.password === 'string' ? value.password : '';
  const secretValue = value.secret ?? value.totpSecret ?? value['2faKey'] ?? '';
  const secret = typeof secretValue === 'string' ? secretValue.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Email không hợp lệ.');
  if (!password || password.length > 4096) throw new Error('Mật khẩu phải có từ 1 đến 4096 ký tự.');
  if (label.length > 100 || typeof secretValue !== 'string' || secret.length > 2048) throw new Error('Tên hoặc khóa 2FA không hợp lệ.');
  if (!secret) throw new Error('Hãy nhập key MFA.');
  parseSecret(secret);
  return { label, email, password, secret };
}
export async function saveAccount(value) {
  const clean = validateAccount(value);
  const accounts = await readAccounts();
  const existing = value.id ? accounts.find(account => account.id === value.id) : undefined;
  if (value.id && !existing) throw new Error('Tài khoản này đã bị xóa.');
  if (accounts.some(account => account.id !== existing?.id && account.email.toLowerCase() === clean.email.toLowerCase())) throw new Error('Email này đã có trong danh sách.');
  if (!existing && accounts.length >= 500) throw new Error('Tối đa 500 tài khoản.');
  const account = { ...clean, id: existing?.id || crypto.randomUUID() };
  await chrome.storage.local.set({ accountsV1: existing ? accounts.map(item => item.id === account.id ? account : item) : [...accounts, account] });
  return account;
}
