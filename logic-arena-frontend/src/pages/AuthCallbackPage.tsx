import { useEffect } from 'react';

export function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('token', token);
      window.location.href = '/';
    } else {
      alert('로그인에 실패했습니다.');
      window.location.href = '/';
    }
  }, []);

  return <div>로그인 처리 중...</div>;
}
