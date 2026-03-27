import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginLocal, signupLocal } from '../lib/api';

type AuthMode = 'login' | 'signup';

function getMode(pathname: string): AuthMode {
  return pathname.includes('/signup') ? 'signup' : 'login';
}

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = getMode(location.pathname);
  const isSignup = mode === 'signup';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = isSignup
        ? await signupLocal({
            username,
            password,
            name: name.trim() || undefined,
            email: email.trim() || undefined,
          })
        : await loginLocal({ username, password });

      localStorage.setItem('token', response.token);
      navigate('/', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '요청 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-shell">
        <section className="auth-hero">
          <p className="auth-hero__eyebrow">Logic Arena</p>
          <h1 className="auth-hero__title">
            {isSignup ? '계정을 만들고 바로 토론에 참여해보세요.' : '로그인하고 바로 토론방에 들어가세요.'}
          </h1>
          <p className="auth-hero__desc">
            회원가입과 로그인 화면은 프론트에서 보여주고, 실제 인증만 백엔드 API로 요청합니다.
          </p>
        </section>

        <section className="auth-card">
          <div className="auth-card__header">
            <h2>{isSignup ? '회원가입' : '로그인'}</h2>
            <p>{isSignup ? '아이디와 비밀번호로 새 계정을 만듭니다.' : '기존 계정으로 접속합니다.'}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span className="form-label">아이디</span>
              <input
                className="form-input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="아이디를 입력하세요"
                autoComplete="username"
                required
              />
            </label>

            {isSignup ? (
              <label className="form-field">
                <span className="form-label">이름</span>
                <input
                  className="form-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="표시할 이름을 입력하세요"
                  autoComplete="name"
                />
              </label>
            ) : null}

            {isSignup ? (
              <label className="form-field">
                <span className="form-label">이메일</span>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                  autoComplete="email"
                />
              </label>
            ) : null}

            <label className="form-field">
              <span className="form-label">비밀번호</span>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
              />
            </label>

            {error ? <p className="auth-form__error">{error}</p> : null}

            <button className="btn btn--primary auth-form__submit" type="submit" disabled={loading}>
              {loading ? '처리 중...' : isSignup ? '회원가입' : '로그인'}
            </button>
          </form>

          <div className="auth-card__footer">
            <Link className="btn btn--ghost" to={isSignup ? '/auth/login' : '/auth/signup'}>
              {isSignup ? '로그인으로 이동' : '회원가입으로 이동'}
            </Link>
            <Link className="auth-card__home" to="/">
              로비로 돌아가기
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
