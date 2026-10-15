export function isLoginUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://auth.openai.com' && /^\/(log-in|log-in-or-create-account)\/?$/.test(url.pathname);
  } catch { return false; }
}

export async function findLoginTarget(sender, role) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !isLoginUrl(tab.url) || (role === 'panel' && sender.tab?.id !== tab.id)) return null;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_LOGIN_PAGE' }, { frameId: 0 });
    if (result?.ready !== true) return null;
    // Navigation or tab switching during the probe must not authorize a stale target.
    const [current] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return current?.id === tab.id && isLoginUrl(current.url) ? current : null;
  } catch { return null; }
}
