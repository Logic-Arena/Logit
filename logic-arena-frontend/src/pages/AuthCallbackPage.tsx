import { useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { getMe } from '../lib/api';

export function AuthCallbackPage() {
  const setAuth = useUserStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      alert('로그인에 실패했습니다.');
      window.location.replace('/');
      return;
    }

    // 임시로 토큰을 저장해 getMe가 읽을 수 있게 함
    const tempState = JSON.stringify({ state: { token } });
    localStorage.setItem('logic-arena-auth', tempState);

    getMe()
      .then((user) => {
        setAuth(token, user);
        window.location.replace('/');
      })
      .catch(() => {
        window.location.replace('/');
      });
  }, [setAuth]);

  return <div>로그인 처리 중...</div>;
}
