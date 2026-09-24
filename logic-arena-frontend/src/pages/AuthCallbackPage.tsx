import { useEffect, useRef } from 'react';
import { useUserStore } from '../store/useUserStore';
import { createHybridUser } from '../lib/api';

export function AuthCallbackPage() {
  const setAuth = useUserStore((s) => s.setAuth);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState(null, '', '/auth/callback');
    fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/auth/oauth/exchange`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('로그인 요청이 만료되었습니다.');
        const { token, user } = await res.json();
        setAuth(token, createHybridUser(user));
        window.location.replace('/');
      })
      .catch(() => {
        window.location.replace('/login?error=oauth_failed');
      });
  }, [setAuth]);

  return <div>로그인 처리 중...</div>;
}
