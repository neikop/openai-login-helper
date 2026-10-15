import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountForm } from './AccountForm';
import { AccountList } from './AccountList';
import { Logo } from './Logo';
import { HeaderStatus } from './HeaderStatus';
import { useNotice } from './useNotice';
import { request, type AccountDraft, type AccountSummary, type RunStatus } from './api';

const embedded = location.pathname.endsWith('/panel.html');
const manager = new URLSearchParams(location.search).has('manage');
const emptyAccount: AccountDraft = { label: '', email: '', password: '', secret: '' };

export function App() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { notice, showNotice } = useNotice();
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<RunStatus>({ active: false, message: '' });
  const [editor, setEditor] = useState<AccountDraft | null>(null);
  const [deleting, setDeleting] = useState<AccountSummary | null>(null);
  const revision = useRef(0);
  const lastStatus = useRef({ key: '', at: 0 });
  const applyStatus = useCallback((value: RunStatus) => {
    const at = value.updatedAt || 0;
    if (at < lastStatus.current.at) return;
    setStatus(value);
    const key = `${at}:${value.active}:${value.message}:${value.completedId || ''}`;
    if (key === lastStatus.current.key) return;
    lastStatus.current = { key, at };
    if (!at) return;
    const message = /^(Sẵn sàng|Đã dừng và xóa|Tab đã đóng\.)/.test(value.message) ? '' : value.message;
    showNotice(value.active ? '' : message, value.completedId ? 'success' : 'error', at);
  }, [showNotice]);
  const reportFormError = (message: string) => {
    setFormError(message);
    showNotice(message, 'error');
  };
  const searchRef = useRef<HTMLInputElement | null>(null);
  const attachSearch = useCallback((input: HTMLInputElement | null) => {
    searchRef.current = input;
    input?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!embedded) return;
    const focusSearch = (event: MessageEvent) => {
      if (event.source === window.parent && event.origin === 'https://auth.openai.com'
        && event.data?.type === 'LOGIN_HELPER_FOCUS_SEARCH') {
        searchRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('message', focusSearch);
    return () => window.removeEventListener('message', focusSearch);
  }, []);
  const reload = useCallback(async () => {
    const current = ++revision.current;
    const result = await request<{ accounts: AccountSummary[] }>('ACCOUNTS_LIST');
    if (current !== revision.current) return;
    setAccounts(result.accounts);
    setSelectedId(previous => result.accounts.some(account => account.id === previous) ? previous : result.accounts[0]?.id || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastError = '';
    const report = (reason: unknown) => {
      if (!alive) return;
      const message = reason instanceof Error ? reason.message : 'Không thể tải dữ liệu.';
      if (message !== lastError) showNotice(message, 'error');
      lastError = message;
      setLoading(false);
    };
    const refreshStatus = () => { void request<RunStatus>('STATUS').then(value => {
      if (alive) { lastError = ''; applyStatus(value); }
    }).catch(report); };
    void reload().catch(report);
    refreshStatus();
    const timer = setInterval(refreshStatus, 1000);
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.accountsV1) void reload().catch(report);
      if (area === 'session' && changes.status) {
        const next = changes.status.newValue as RunStatus | undefined;
        const previous = changes.status.oldValue as RunStatus | undefined;
        if (next) applyStatus(next);
        clearTimeout(closeTimer);
        if (!embedded && !manager && next?.completedId && next.completedId !== previous?.completedId && next.closeAt) {
          closeTimer = setTimeout(() => window.close(), Math.max(0, next.closeAt - Date.now()));
        }
      }
    };
    chrome.storage.onChanged.addListener(changed);
    return () => { alive = false; revision.current++; clearInterval(timer); clearTimeout(closeTimer); chrome.storage.onChanged.removeListener(changed); };
  }, [reload, applyStatus, showNotice]);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); showNotice('');
    try { await action(); } catch (reason) { showNotice(reason instanceof Error ? reason.message : 'Không thể thực hiện thao tác.', 'error'); }
    finally { setBusy(false); }
  }
  const query = search.trim().toLowerCase();
  const filtered = accounts.filter(account => `${account.label} ${account.email}`.toLowerCase().includes(query));
  const effectiveId = status.active && status.accountId ? status.accountId : selectedId;
  const selected = accounts.find(account => account.id === effectiveId);
  const start = () => perform(async () => { await request('START', { accountId: selectedId }); applyStatus(await request<RunStatus>('STATUS')); });
  const openManager = () => perform(async () => { await request('OPEN_MANAGER'); });
  const canReorder = !busy && !loading && !status.active && filtered.length > 1;
  const moveAccount = (id: string, targetId: string, position: 'before' | 'after') => {
    if (!canReorder || id === targetId) return;
    const account = accounts.find(item => item.id === id);
    if (!account || !accounts.some(item => item.id === targetId)) return;
    const previous = accounts;
    const reordered = accounts.filter(item => item.id !== id);
    const targetIndex = reordered.findIndex(item => item.id === targetId);
    reordered.splice(targetIndex + (position === 'after' ? 1 : 0), 0, account);
    // Commit the visual order immediately so the overlay lands in its new slot.
    revision.current++;
    setAccounts(reordered);
    void perform(async () => {
      try {
        await request('ACCOUNT_MOVE', { id, targetId, position });
      } catch (reason) {
        setAccounts(previous);
        await reload().catch(() => {});
        throw reason;
      }
      await reload();
      showNotice('Đã sắp xếp');
    });
  };

  const headerMessage = notice?.message || (status.active ? 'Thinking…' : busy || loading ? '…' : '');
  const headerTone = notice?.tone ?? (busy || loading || status.active ? 'running' : '');

  return <main className={`app ${embedded ? 'panel' : manager ? 'manager' : 'popup'}`}>
    <header className="app-header"><Logo /><div className="header-info"><h1>Login Helper</h1>
      <HeaderStatus message={headerMessage} tone={headerTone} noticeKey={notice?.expiresAt ?? headerMessage} />
    </div>
      {embedded ? <button className="icon-button" aria-label="Thu gọn bảng tài khoản" onClick={() => void perform(async () => { await request('COLLAPSE'); })}>−</button> : null}
    </header>
    <section className="app-content" key={editor ? `edit-${editor.id || 'new'}` : 'accounts'} aria-label={editor ? 'Thông tin tài khoản' : 'Danh sách tài khoản'}>
    {editor ? <AccountForm key={editor.id || 'new'} initial={editor} busy={busy} error={formError} onError={reportFormError} onSave={account => perform(async () => {
      const result = await request<{ account: AccountSummary }>('ACCOUNT_SAVE', { account });
      setEditor(null); setFormError(''); await reload(); setSelectedId(result.account.id); showNotice('Đã lưu');
    })} /> : <>
      <div className="account-controls">
        <div className="section-heading"><h2>Tài khoản <span>{accounts.length}</span></h2>
          <button className="small-button" onClick={() => { setEditor({ ...emptyAccount }); setFormError(''); setDeleting(null); showNotice(''); }} disabled={busy}>＋ Thêm</button>
        </div>
        {accounts.length ? <input ref={attachSearch} className="search" type="search" aria-label="Tìm tài khoản" placeholder="Tìm theo tên hoặc email…" value={search} onChange={event => setSearch(event.target.value)} /> : null}
      </div>
      {loading ? null : !accounts.length ? <div className="empty"><div className="empty-symbol" aria-hidden="true">＋</div><h3>Chưa có tài khoản</h3><p>Bấm Thêm để bắt đầu.</p></div> : !filtered.length ? <p className="empty">Không có tài khoản khớp tìm kiếm.</p> : <AccountList accounts={filtered} selectedId={effectiveId} busy={busy} running={status.active} embedded={embedded}
        onSelect={setSelectedId} onMove={moveAccount} onDelete={setDeleting}
        onEdit={account => void perform(async () => {
          const result = await request<{ account: AccountDraft }>('ACCOUNT_GET', { id: account.id });
          setEditor(result.account); setFormError(''); setDeleting(null);
        })} />}
      {deleting ? <div className="delete-confirm" role="alert"><p>Xóa <strong>{deleting.email}</strong> khỏi danh sách đã lưu?</p><div className="actions"><button className="danger-button" disabled={busy} onClick={() => void perform(async () => { await request('ACCOUNT_DELETE', { id: deleting.id }); setDeleting(null); await reload(); showNotice('Đã xóa'); })}>Xóa tài khoản</button><button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>Hủy</button></div></div> : null}
    </>}
    </section>
    <footer className="app-footer">
      {editor ? <div className="footer-actions"><button className="start" type="submit" form="account-form" disabled={busy}>Lưu tài khoản</button><button type="button" className="secondary" onClick={() => { setEditor(null); setFormError(''); }} disabled={busy}>Hủy</button></div>
        : <div className="footer-actions"><button className="start" disabled={!selected || busy || status.active || loading || !status.canStart} onClick={() => void start()}><span>Start</span><span aria-hidden="true">→</span></button><button className="secondary" disabled={!status.active || busy} onClick={() => void perform(async () => { await request('STOP'); applyStatus(await request<RunStatus>('STATUS')); })}>Dừng</button></div>}
      {!manager ? <button className="text-button manage-link" onClick={() => void openManager()} disabled={busy}>Quản lý tài khoản ↗</button> : null}
    </footer>
  </main>;
}
