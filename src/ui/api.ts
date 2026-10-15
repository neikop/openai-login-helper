export interface AccountSummary { id: string; label: string; email: string; has2fa: boolean }
export interface AccountDraft { id?: string; label: string; email: string; password: string; secret: string }
export interface RunStatus { active: boolean; message: string; accountId?: string; canStart?: boolean; completedId?: string; updatedAt?: number; closeAt?: number }

export async function request<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response || response.error) throw new Error(response?.error || 'Không kết nối được extension. Hãy Reload extension và tải lại trang.');
  return response as T;
}
