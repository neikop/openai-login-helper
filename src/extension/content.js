import { isLoginUrl } from './login-target.js';

(() => {
  if (window.top !== window || location.origin !== 'https://auth.openai.com') return;
  const visible = element => !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const editable = element => visible(element) && !element.disabled && !element.readOnly;
  const all = selector => [...document.querySelectorAll(selector)];
  const normalize = value => (value || '').replace(/\s+/g, ' ').trim();
  const label = element => normalize(element.innerText || element.value || element.getAttribute('aria-label'));
  const send = message => chrome.runtime.sendMessage(message);
  let busy = false;
  let runId;
  let lastAction = 0;
  let lastCompletion;
  let closeTimer;
  function scheduleClose(completedId, closeAt) {
    if (!completedId || completedId === lastCompletion) return;
    lastCompletion = completedId;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => collapsePanel(true), Math.max(0, (closeAt || 0) - Date.now()));
  }
  let panelAnimation;
  let panelCollapsed = true;
  let panelHost;
  let panelFrame;
  let launcher;
  function collapsePanel(collapsed) {
    if (!panelHost || panelCollapsed === collapsed) return;
    panelCollapsed = collapsed;
    panelAnimation?.cancel();
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    panelFrame.style.pointerEvents = collapsed ? 'none' : 'auto';
    launcher.style.display = 'none';
    if (!collapsed) {
      panelHost.style.width = 'min(390px, calc(100vw - 32px))';
      panelHost.style.height = 'min(590px, calc(100vh - 32px))';
      panelFrame.style.display = 'block';
    }
    const small = { transform: 'scale(.88)', opacity: 0 };
    const full = { transform: 'scale(1)', opacity: 1 };
    panelAnimation = panelFrame.animate(collapsed ? [full, small] : [small, full], { duration, easing: 'ease-out' });
    panelAnimation.onfinish = () => {
      if (!collapsed) {
        panelFrame.contentWindow?.postMessage({ type: 'LOGIN_HELPER_FOCUS_SEARCH' }, new URL(chrome.runtime.getURL('panel.html')).origin);
        return;
      }
      panelFrame.style.display = 'none';
      launcher.style.display = 'inline-flex';
      panelHost.style.width = 'auto';
      panelHost.style.height = 'auto';
    };
  }
  function mountPanel() {
    if (panelHost?.isConnected) return;
    const loginPage = isLoginUrl(location.href) || /^\/(log-in|login|mfa|mfa-challenge|u\/login)(\/|$)/.test(location.pathname);
    if (!loginPage) return;
    panelHost = document.createElement('div');
    panelHost.style.cssText = 'all:initial;position:fixed;right:16px;top:16px;z-index:2147483647;display:block;width:min(390px, calc(100vw - 32px));height:min(590px, calc(100vh - 32px));';
    const root = panelHost.attachShadow({ mode: 'closed' });
    const styles = document.createElement('style');
    styles.textContent = `
      .launcher {
        display: none; align-items: center; gap: 10px;
        border: 1px solid #1d4ed8; border-radius: 12px;
        background: #2563eb; color: #fff; padding: 11px 15px;
        font: 500 14px/20px system-ui; cursor: pointer;
        box-shadow: 0 4px 16px #2563eb26;
      }
      .launcher:hover { background: #1d4ed8; border-color: #1e40af;  }
      .launcher:active { background: #1e40af; }
      .launcher:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
      .launcher svg { flex-shrink: 0; }
    `;
    panelFrame = document.createElement('iframe');
    panelFrame.src = chrome.runtime.getURL('panel.html');
    panelFrame.title = 'OpenAI Login Helper — chọn tài khoản';
    panelFrame.style.cssText = 'transform-origin:top right;display:block;width:100%;height:100%;border:1px solid #e5e5e5;border-radius:16px;background:#fff;box-shadow:0 16px 64px #0000001f;';
    launcher = document.createElement('button');
    launcher.className = 'launcher';
    launcher.type = 'button';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '22');
    icon.setAttribute('height', '22');
    icon.setAttribute('viewBox', '0 0 32 32');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-width', '2.484');
    path.setAttribute('d', 'M22.356 19.797H17.17M9.662 12.29l1.979 3.576a.511.511 0 0 1-.005.504l-1.974 3.409M30.758 16c0 8.15-6.607 14.758-14.758 14.758-8.15 0-14.758-6.607-14.758-14.758C1.242 7.85 7.85 1.242 16 1.242c8.15 0 14.758 6.608 14.758 14.758Z');
    icon.append(path);
    launcher.append(icon, document.createTextNode('Tài khoản OpenAI'));
    launcher.addEventListener('click', () => collapsePanel(false));
    root.append(styles, panelFrame, launcher);
    document.documentElement.append(panelHost);
    panelCollapsed = true;
    collapsePanel(false);
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'COLLAPSE_PANEL') { clearTimeout(closeTimer); collapsePanel(true); }
    if (message.type === 'COMPLETE_PANEL') scheduleClose(message.completedId, message.closeAt);
    if (message.type === 'CHECK_LOGIN_PAGE') {
      const { email } = loginFields();
      const button = email && buttonFor(email);
      respond({ ready: isLoginUrl(location.href) && !!email && !!button && safeForm(email, button) });
    }
  });

  function fill(input, value) {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
  }
  function loginFields() {
    const inputs = all('input').filter(editable);
    const code = inputs.find(input => input.autocomplete === 'one-time-code'
      || /^(code|otp|totp|verification[_-]?code|auth[_-]?code)$/i.test(input.name)
      || /^one[- ]time code$/i.test(normalize(input.getAttribute('aria-label') || [...(input.labels || [])].map(item => item.textContent).join(' '))));
    return {
      email: inputs.find(input => input.type === 'email' || /^(email|username)$/i.test(input.name) || input.autocomplete === 'username'),
      password: inputs.find(input => input !== code && input.type === 'password' && input.autocomplete !== 'new-password'),
      code
    };
  }
  function buttonFor(input) {
    return [...(input.form || document).querySelectorAll('button, input[type="submit"]')]
      .find(button => visible(button) && /^(continue|tiếp tục)$/i.test(label(button)));
  }
  function safeForm(input, button) {
    const action = button?.getAttribute('formaction') || input.form?.getAttribute('action');
    return !action || new URL(action, location.href).origin === location.origin;
  }
  async function halt(reason) { await send({ type: 'HALT', runId, reason }); }
  async function submit(step, input) {
    let button = buttonFor(input);
    if (!button) return;
    if (!safeForm(input, button)) return halt('unsafeForm');
    const claim = await send({ type: 'CLAIM', runId, step });
    if (!claim?.active || claim.already || claim.wait || claim.error) return;
    fill(input, claim.value);
    // Allow controlled forms to re-render and enable their submit button.
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const state = await send({ type: 'STATE' });
      if (!state?.active || state.id !== runId) return;
      button = buttonFor(input);
      if (button && button.isConnected && !button.disabled && button.getAttribute('aria-disabled') !== 'true') {
        if (!safeForm(input, button)) return halt('unsafeForm');
        if (!input.isConnected || !input.checkValidity()) return halt('unsupported');
        if (step === 'totp') {
          const armed = await send({ type: 'CODE_SUBMIT', runId });
          if (!armed?.active || !input.isConnected || !button.isConnected) return;
        }
        button.click();
        lastAction = Date.now();
        if (step === 'totp') {
          await send({ type: 'COMPLETE', runId });
        }
        return;
      }
    }
    await halt('unsupported');
  }

  async function tick() {
    mountPanel();
    if (busy || Date.now() - lastAction < 1200) return;
    busy = true;
    try {
      const state = await send({ type: 'STATE' });
      if (!state?.active) {
        scheduleClose(state?.completedId, state?.closeAt);
        return;
      }
      clearTimeout(closeTimer);
      runId = state.id;
      const alerts = all('[role="alert"], [aria-live="assertive"], [data-error], .error, [class*="error-message"]').filter(visible);
      if (alerts.some(element => /incorrect|invalid|wrong|expired|too many|try again|unable|không đúng|không hợp lệ|hết hạn|thử lại/i.test(element.textContent))) return halt('error');
      const { email, password, code } = loginFields();
      if (!isLoginUrl(location.href) && /sign[-_]?up|register|create-account|reset[-_]?password|forgot[-_]?password|enroll|consent/i.test(location.pathname)) return;
      const step = ['email', 'password', 'totp'][state.steps.length];
      const input = { email, password, totp: code }[step];
      if (input) await submit(step, input);
    } catch {
      // Extension reloads invalidate old content-script contexts; never log secrets.
    } finally { busy = false; }
  }
  setInterval(tick, 650);
  tick();
})();
