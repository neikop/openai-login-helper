import { useState } from 'react';

interface Props { message: string; tone: string; noticeKey: string | number }

export function HeaderStatus({ message, tone, noticeKey }: Props) {
  const loading = /(?:…|\.{3})$/.test(message);
  const displayTone = loading ? 'running' : tone;
  // Keep the loading animation continuous when completion starts the close timer.
  const key = loading ? `${displayTone}:${message}` : `${tone}:${noticeKey}`;
  const [display, setDisplay] = useState<{ message: string; tone: string; key: string } | null>(null);
  // Retain only the outgoing text until its exit animation finishes.
  // A new notice replaces it immediately, including during an exit.
  if (message && (display?.key !== key || display.message !== message)) {
    setDisplay({ message, tone: displayTone, key });
  }
  return <div className="header-status-slot" role={tone === 'error' ? 'alert' : 'status'} aria-atomic="true">
    {display ? <p key={display.key}
      className={`header-status ${display.tone} ${message ? 'notice-enter' : 'notice-exit'}`}
      aria-hidden={!message} aria-label={display.message === '…' ? 'Đang xử lý' : display.message} title={message || undefined}
      onAnimationEnd={event => { if (event.target === event.currentTarget && !message) setDisplay(null); }}>
      <span className="status-text" aria-hidden="true">{display.message.replace(/(?:…|\.{3})$/, '')}</span>
      {/(?:…|\.{3})$/.test(display.message) ? <span className="loading-dots" aria-hidden="true" /> : null}
    </p> : null}
  </div>;
}
