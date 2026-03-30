import { useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { createHybridUser } from '../lib/api';

export function AuthCallbackPage() {
  const setAuth = useUserStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // 임시로 더미 유저 상태를 만듭니다
      const mockUser = {
        id: 999,
        provider: 'oauth',
        username: 'SocialUser',
        email: '',
        name: '소셜 로그인 유저'
      };
      setAuth(token, createHybridUser(mockUser));
      window.location.replace('/');
    } else {
      alert('로그인에 실패했습니다.');
      window.location.replace('/');
    }
  }, [setAuth]);

  return <div>로그인 처리 중...</div>;
}
