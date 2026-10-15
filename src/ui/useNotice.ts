import { useCallback, useEffect, useReducer } from 'react';

import { NOTICE_DURATION } from '../shared/timing';
type Tone = 'success' | 'error' | '';
interface Notice { message: string; tone: Tone; expiresAt: number }
interface State { latestAt: number; current: Notice | null }
type Action = { type: 'show'; message: string; tone: Tone; at: number; now: number }
  | { type: 'expire'; notice: Notice };

export function noticeReducer(state: State, action: Action): State {
  if (action.type === 'expire') {
    return state.current === action.notice ? { ...state, current: null } : state;
  }
  // Polling must never restore an older notice after a newer UI action.
  if (action.at < state.latestAt) return state;
  const expiresAt = action.at + NOTICE_DURATION;
  return {
    latestAt: action.at,
    current: action.message && expiresAt > action.now
      ? { message: action.message, tone: action.tone, expiresAt } : null
  };
}

export function useNotice() {
  const [state, dispatch] = useReducer(noticeReducer, { latestAt: 0, current: null });
  const showNotice = useCallback((message: string, tone: Tone = 'success', at = Date.now()) => {
    dispatch({ type: 'show', message, tone, at, now: Date.now() });
  }, []);
  const notice = state.current;
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => dispatch({ type: 'expire', notice }), Math.max(0, notice.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [notice]);
  return { notice, showNotice };
}
