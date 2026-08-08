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

    getMe(token)
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
