import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import type { AccountDraft } from './api';

interface Props { initial: AccountDraft; busy: boolean; error: string; onError: (message: string) => void; onSave: (account: AccountDraft) => Promise<void> }
const credentialFields = ['email', 'password', 'secret'] as const;
type CredentialField = typeof credentialFields[number];

export function AccountForm({ initial, busy, error, onError, onSave }: Props) {
  const [draft, setDraft] = useState(initial);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const secretRef = useRef<HTMLInputElement>(null);
  const inputs = [emailRef, passwordRef, secretRef];
  const field = (key: keyof AccountDraft, value: string) => {
    onError('');
    setDraft(current => ({ ...current, [key]: value }));
  };
  function paste(event: ClipboardEvent<HTMLInputElement>, start: CredentialField) {
    const parts = event.clipboardData.getData('text').trim().split(/\s+/);
    if (parts.length < 2) return;
    event.preventDefault();
    const offset = credentialFields.indexOf(start);
    if (parts.length > credentialFields.length - offset) {
      onError('Dán 3 mục vào ô Email');
      return;
    }
    onError('');
    setDraft(current => {
      const next = { ...current };
      credentialFields.slice(offset).forEach((key, index) => { next[key] = parts[index] || ''; });
      return next;
    });
    inputs[Math.min(offset + parts.length, 2)].current?.focus();
  }
  function nextField(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.nativeEvent.isComposing || !event.currentTarget.value || ![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    inputs[index + 1].current?.focus();
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (error) onError(error);
    else void onSave(draft);
  }
  return <form id="account-form" onSubmit={submit} className="editor" autoComplete="off">
    <h2>{initial.id ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h2>
    <div className="form-field">
      <label htmlFor="email">Email <span className="required-mark" aria-hidden="true">*</span></label>
      <input autoFocus ref={emailRef} id="email" type="email" required value={draft.email} onChange={event => field('email', event.target.value)} onPaste={event => paste(event, 'email')} onKeyDown={event => nextField(event, 0)} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={254} disabled={busy} />
    </div>
    <div className="form-field">
      <label htmlFor="password">Mật khẩu <span className="required-mark" aria-hidden="true">*</span></label>
      <input ref={passwordRef} id="password" type="password" required value={draft.password} onChange={event => field('password', event.target.value)} onPaste={event => paste(event, 'password')} onKeyDown={event => nextField(event, 1)} autoComplete="new-password" maxLength={4096} disabled={busy} />
    </div>
    <div className="form-field">
      <label htmlFor="secret">Key MFA <span className="required-mark" aria-hidden="true">*</span></label>
      <input ref={secretRef} id="secret" type="password" required value={draft.secret} onChange={event => field('secret', event.target.value)} placeholder="Key MFA" autoComplete="new-password" maxLength={2048} spellCheck={false} disabled={busy} />
    </div>
    <div className="form-field">
      <label htmlFor="label">Tên gợi nhớ <span>(optional)</span></label>
      <input id="label" value={draft.label} onChange={event => field('label', event.target.value)} placeholder="Cá nhân, công việc…" maxLength={100} disabled={busy} />
    </div>
  </form>;
}
