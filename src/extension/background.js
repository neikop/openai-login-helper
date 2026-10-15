import { generateTotp, parseSecret } from './totp.js';
import { readAccounts, summary, saveAccount, moveAccount } from './accounts.js';
import { findLoginTarget } from './login-target.js';
import { NOTICE_DURATION } from '../shared/timing.ts';

const TTL = 5 * 60 * 1000;
const isAuth = url => { try { return new URL(url).origin === 'https://auth.openai.com'; } catch { return false; } };
const ready = Promise.all([
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
]);
function uiRole(sender) {
  if (sender.id !== chrome.runtime.id) return null;
  const page = sender.url?.split(/[?#]/)[0];
  if (page === chrome.runtime.getURL('index.html')) return 'manager';
  if (page === chrome.runtime.getURL('panel.html') && sender.frameId > 0 && isAuth(sender.tab?.url)) return 'panel';
  return null;
}
let queue = Promise.resolve();
function serialized(fn) {
  const task = queue.then(() => ready).then(fn);
  queue = task.catch(() => {});
  return task;
}
async function finish(message, details = {}) {
  await chrome.storage.session.remove('run');
  await chrome.storage.session.set({ status: { active: false, message, updatedAt: Date.now(), ...details } });
  await chrome.alarms.clear('expire');
}
async function completeRun(run) {
  const updatedAt = Date.now();
  const closeAt = updatedAt + NOTICE_DURATION;
  await finish('Thinking…', { completedId: run.id, tabId: run.tabId, updatedAt, closeAt });
  await chrome.tabs.sendMessage(run.tabId, { type: 'COMPLETE_PANEL', completedId: run.id, closeAt }, { frameId: 0 }).catch(() => {});
}
async function activeRun() {
  const { run } = await chrome.storage.session.get('run');
  if (run && run.expires <= Date.now()) {
    await finish('Hết thời gian đăng nhập');
    return null;
  }
  return run;
}
async function handle(message, sender) {
  const role = uiRole(sender);
  const popup = !!role;
  if (popup && message.type === 'ACCOUNTS_LIST') return { accounts: (await readAccounts()).map(summary) };
  if (popup && message.type === 'ACCOUNT_MOVE') {
    await moveAccount(message.id, message.targetId, message.position);
    return { ok: true };
  }
  if (popup && message.type === 'OPEN_MANAGER') {
    const url = chrome.runtime.getURL('index.html?manage=1');
    const tabs = await chrome.tabs.query({ url: chrome.runtime.getURL('index.html') + '*' });
    const existing = tabs.find(tab => tab.url === url);
    if (existing) { await chrome.tabs.update(existing.id, { active: true }); await chrome.windows.update(existing.windowId, { focused: true }); }
    else await chrome.tabs.create({ url });
    return { ok: true };
  }
  if (role === 'panel' && message.type === 'COLLAPSE') {
    await chrome.tabs.sendMessage(sender.tab.id, { type: 'COLLAPSE_PANEL' }, { frameId: 0 });
    return { ok: true };
  }
  if (role === 'manager' && message.type === 'ACCOUNT_GET') {
    const account = (await readAccounts()).find(item => item.id === message.id);
    if (!account) throw new Error('Không tìm thấy tài khoản.');
    return { account };
  }
  if (message.type === 'ACCOUNT_SAVE' && (role === 'manager' || (role === 'panel' && !message.account?.id))) {
    const account = await saveAccount(message.account);
    const run = await activeRun();
    if (run?.accountId === account.id) await finish('');
    return { account: summary(account) };
  }
  if (role === 'manager' && message.type === 'ACCOUNT_DELETE') {
    const accounts = await readAccounts();
    await chrome.storage.local.set({ accountsV1: accounts.filter(account => account.id !== message.id) });
    const run = await activeRun();
    if (run?.accountId === message.id) await finish('');
    return { ok: true };
  }
  if (popup && message.type === 'STATUS') {
    await activeRun();
    const status = (await chrome.storage.session.get('status')).status || { active: false, message: '' };
    if (status.message?.startsWith('Tab đã đóng.')) status.message = '';
    return { ...status, canStart: !status.active && !!(await findLoginTarget(sender, role)) };
  }
  if (popup && message.type === 'STOP') {
    await finish('');
    return { ok: true };
  }
  if (popup && message.type === 'START') {
    const account = (await readAccounts()).find(item => item.id === message.accountId);
    if (!account) throw new Error('Hãy chọn một tài khoản đã lưu.');
    const { email, password, secret } = account;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) throw new Error('Hãy nhập email và mật khẩu hợp lệ.');
    if (secret) parseSecret(secret);
    const tab = await findLoginTarget(sender, role);
    if (!tab) throw new Error('Hãy mở bước nhập email OpenAI.');
    await finish('');
    const run = { id: crypto.randomUUID(), accountId: account.id, tabId: tab.id, email, password, secret, expires: Date.now() + TTL, steps: [] };
    await chrome.storage.session.set({ run, status: { active: true, accountId: run.accountId, message: 'Thinking…', updatedAt: Date.now() } });
    await chrome.alarms.create('expire', { when: run.expires });
    return { ok: true };
  }
  if (!sender.tab || sender.frameId !== 0 || !isAuth(sender.url) || !isAuth(sender.tab.url)) return { active: false };
  const run = await activeRun();
  if (!run || run.tabId !== sender.tab.id) {
    const { status } = await chrome.storage.session.get('status');
    return { active: false, completedId: status?.tabId === sender.tab.id ? status.completedId : undefined, closeAt: status?.tabId === sender.tab.id ? status.closeAt : undefined };
  }
  if (message.type === 'STATE') return { active: true, id: run.id, steps: run.steps };
  if (message.runId !== run.id) return { active: false };
  if (message.type === 'CODE_SUBMIT' && run.steps.includes('totp')) {
    run.codeSubmitted = true;
    await chrome.storage.session.set({ run });
    return { active: true };
  }
  if (message.type === 'COMPLETE' && run.codeSubmitted) {
    await completeRun(run);
    return { active: false };
  }
  if (message.type === 'HALT') {
    // Only fixed messages are stored; never copy page text or credentials into status.
    const reasons = {
      error: 'Trang đăng nhập báo lỗi',
      unsafeForm: 'Form khác tên miền',
      unsupported: 'Không thể gửi form'
    };
    await finish(reasons[message.reason] || reasons.unsupported);
    return { active: false };
  }
  if (message.type !== 'CLAIM' || !['email', 'password', 'totp'].includes(message.step)) return { active: false };
  if (message.step !== ['email', 'password', 'totp'][run.steps.length]) return { active: true, already: true };
  let value;
  if (message.step === 'totp') {
    if (!run.secret) { await finish('Thiếu key MFA'); return { active: false }; }
    const result = await generateTotp(run.secret);
    // Wait for a fresh window rather than submitting a code about to expire.
    if (result.remaining <= 5) return { active: true, wait: true };
    value = result.code;
  } else if (message.step === 'email') value = run.email;
  else if (message.step === 'password') value = run.password;
  run.steps.push(message.step);
  await chrome.storage.session.set({ run, status: { active: true, accountId: run.accountId, message: 'Thinking…', updatedAt: Date.now() } });
  return { active: true, value };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  serialized(() => handle(message || {}, sender)).then(respond, error => {
    const popup = !!uiRole(sender);
    respond({ error: popup ? error.message : 'Không thể tiếp tục tự động đăng nhập.' });
  });
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'expire') serialized(activeRun);
});
chrome.tabs.onRemoved.addListener(tabId => serialized(async () => {
  const run = await activeRun();
  if (run?.tabId === tabId) await finish('');
}));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url) serialized(async () => {
    const run = await activeRun();
    if (run?.tabId !== tabId) return;
    // A full navigation can unload the content script before COMPLETE arrives.
    if (run.codeSubmitted) await completeRun(run);
    else if (!isAuth(change.url)) await finish('');
  });
});
