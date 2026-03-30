import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signupLocal, createHybridUser } from '../lib/api';
import { useUserStore } from '../store/useUserStore';
import { useToast } from '../hooks/useToast';

export function SignupPage() {
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const setAuth = useUserStore((s) => s.setAuth);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const navigate = useNavigate();
  const showToast = useToast();

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/', { replace: true });
    }
  }, [isLoggedIn, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !loginId.trim() || !password.trim()) {
      showToast('이름, 아이디, 비밀번호는 필수입니다', 'error');
      return;
    }
    if (password !== passwordConfirm) {
      showToast('비밀번호가 일치하지 않습니다', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('비밀번호는 6자 이상이어야 합니다', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await signupLocal({
        username: loginId,
        password,
        name,
        email: email || undefined,
      });
      const hybridUser = createHybridUser(response.user);
      setAuth(response.token, hybridUser);
      navigate('/', { replace: true });
    } catch (err) {
      showToast(err instanceof Error ? err.message : '회원가입에 실패했습니다', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo__text">Logit</span>
          <p className="auth-logo__sub">논리로 승부하는 토론 아레나</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label className="form-label" htmlFor="signup-name">이름 <span className="auth-required">*</span></label>
            <input
              id="signup-name"
              className="form-input"
              type="text"
              placeholder="닉네임을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="signup-id">아이디 <span className="auth-required">*</span></label>
            <input
              id="signup-id"
              className="form-input"
              type="text"
              placeholder="로그인에 사용할 아이디"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="signup-email">이메일 <span className="auth-optional">(선택)</span></label>
            <input
              id="signup-email"
              className="form-input"
              type="email"
              placeholder="email@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="signup-password">비밀번호 <span className="auth-required">*</span></label>
            <input
              id="signup-password"
              className="form-input"
              type="password"
              placeholder="6자 이상"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="signup-password-confirm">비밀번호 확인 <span className="auth-required">*</span></label>
            <input
              id="signup-password-confirm"
              className="form-input"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            id="signup-submit"
            className="btn btn--primary auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="auth-footer">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="auth-footer__link">로그인</Link>
        </p>
      </div>
    </div>
  );
}
