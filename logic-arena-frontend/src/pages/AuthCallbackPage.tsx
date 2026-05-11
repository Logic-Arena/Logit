import { useEffect } from 'react';
import { getMe } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';

export function AuthCallbackPage() {
  const { login } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      alert('로그인에 실패했습니다.');
      window.location.href = '/';
      return;
    }

    // 임시로 토큰을 저장해 getMe가 읽을 수 있게 함
    const tempState = JSON.stringify({ state: { token } });
    localStorage.setItem('logic-arena-auth', tempState);

    getMe()
      .then((user) => {
        login(token, user);
        window.location.href = '/';
      })
      .catch(() => {
        // 사용자 정보 로드 실패해도 토큰만으로 진행
        window.location.href = '/';
      });
  }, [login]);

  return <div>로그인 처리 중...</div>;
}
