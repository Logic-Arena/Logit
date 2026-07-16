import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loginLocal, createHybridUser } from '../lib/api';
import { useUserStore } from '../store/useUserStore';
import { useToast } from '../hooks/useToast';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

type RecoveryMode = 'find-account' | 'reset-password' | null;

export function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoginId, setRecoveryLoginId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryResult, setRecoveryResult] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const setAuth = useUserStore((s) => s.setAuth);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const navigate = useNavigate();
  const location = useLocation();
  const showToast = useToast();
  // QR/링크로 보호된 경로에 바로 접근했다가 로그인으로 밀려난 경우, 로그인 후 원래 목적지로 돌려보냄
  const redirectTo = (location.state as { from?: string } | null)?.from || '/';

  useEffect(() => {
    if (isLoggedIn) navigate(redirectTo, { replace: true });
  }, [isLoggedIn, navigate, redirectTo]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      showToast('아이디와 비밀번호를 입력해주세요', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await loginLocal({ username: loginId, password });
      setAuth(response.token, createHybridUser(response.user));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '로그인에 실패했습니다', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleFindAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoveryLoading(true);
    setRecoveryResult(null);
    try {
      const res = await fetch(`${API_URL}/auth/find-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecoveryResult(`아이디: ${data.loginId}`);
    } catch (err) {
      setRecoveryResult(err instanceof Error ? err.message : '계정을 찾을 수 없습니다.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryLoginId.trim() || !recoveryEmail.trim() || !newPassword.trim()) return;
    setRecoveryLoading(true);
    setRecoveryResult(null);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: recoveryLoginId.trim(), email: recoveryEmail.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecoveryResult('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
    } catch (err) {
      setRecoveryResult(err instanceof Error ? err.message : '비밀번호 재설정에 실패했습니다.');
    } finally {
      setRecoveryLoading(false);
    }
  }

  function closeRecovery() {
    setRecoveryMode(null);
    setRecoveryEmail('');
    setRecoveryLoginId('');
    setNewPassword('');
    setRecoveryResult(null);
  }

  return (
    <div className="auth-page">
      {recoveryMode && (
        <div className="auth-recovery-overlay" onClick={closeRecovery}>
          <div className="auth-recovery-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="auth-recovery-modal__title">
              {recoveryMode === 'find-account' ? '아이디 찾기' : '비밀번호 찾기'}
            </h2>

            {recoveryMode === 'find-account' ? (
              <form onSubmit={handleFindAccount} className="auth-recovery-modal__form">
                <div className="form-field">
                  <label className="form-label">가입 이메일</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="가입 시 입력한 이메일"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>
                <button className="btn btn--primary" type="submit" disabled={recoveryLoading}>
                  {recoveryLoading ? '조회 중...' : '아이디 찾기'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="auth-recovery-modal__form">
                <div className="form-field">
                  <label className="form-label">아이디</label>
                  <input
                    className="form-input"
                    placeholder="아이디 입력"
                    value={recoveryLoginId}
                    onChange={(e) => setRecoveryLoginId(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">가입 이메일</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="가입 시 입력한 이메일"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">새 비밀번호</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="새 비밀번호 (6자 이상)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <button className="btn btn--primary" type="submit" disabled={recoveryLoading}>
                  {recoveryLoading ? '처리 중...' : '비밀번호 변경'}
                </button>
              </form>
            )}

            {recoveryResult && (
              <p className="auth-recovery-modal__result">{recoveryResult}</p>
            )}
            <button className="btn btn--ghost auth-recovery-modal__close" onClick={closeRecovery}>
              닫기
            </button>
          </div>
        </div>
      )}

      <div className="auth-split">

        {/* ── Left: Brand ── */}
        <div className="auth-split__brand">
          <div className="auth-brand__logo">
            <img src="/logit-logo.png" alt="Logit" className="auth-brand__logo-img" />
          </div>
          <div className="auth-brand__tagline">
            <p className="auth-brand__tagline-eyebrow">논리로 성장하세요</p>
            <h2 className="auth-brand__tagline-title">
              날카로운 논증으로<br />
              아레나를<br />
              제패하세요
            </h2>
          </div>
        </div>

        {/* ── Right: Form ── */}
        <div className="auth-split__form">
          <div className="auth-split__form-header">
            <h1>로그인</h1>
            <p>Logit에 오신 걸 환영합니다</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label className="form-label" htmlFor="login-id">아이디</label>
              <input
                id="login-id"
                className="form-input"
                type="text"
                placeholder="아이디를 입력하세요"
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="login-password">비밀번호</label>
              <input
                id="login-password"
                className="form-input"
                type="password"
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              id="login-submit"
              className="btn btn--primary auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="auth-divider"><span>또는</span></div>

          <div className="auth-social auth-social--row">
            <button
              className="btn auth-social__icon-btn"
              type="button"
              title="Google로 계속하기"
              onClick={() => window.location.href = `${API_URL}/auth/google`}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>
            <button
              className="btn auth-social__icon-btn auth-social__icon-btn--kakao"
              type="button"
              title="Kakao로 계속하기"
              onClick={() => window.location.href = `${API_URL}/auth/kakao`}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="#3C1E1E">
                <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.717 1.618 5.1 4.078 6.566L5 21l4.48-2.4A11.4 11.4 0 0012 18.6c5.523 0 10-3.477 10-7.8S17.523 3 12 3z"/>
              </svg>
            </button>
          </div>

          <p className="auth-footer">
            계정이 없으신가요?{' '}
            <Link to="/signup" className="auth-footer__link">회원가입</Link>
          </p>
          <div className="auth-recovery-links">
            <button type="button" className="auth-recovery-link" onClick={() => setRecoveryMode('find-account')}>
              아이디 찾기
            </button>
            <span className="auth-recovery-divider">|</span>
            <button type="button" className="auth-recovery-link" onClick={() => setRecoveryMode('reset-password')}>
              비밀번호 찾기
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
