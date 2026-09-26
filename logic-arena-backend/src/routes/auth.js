import express from 'express';
import axios from 'axios';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  FRONTEND_URL,
  KAKAO_REST_API_KEY,
  KAKAO_CLIENT_SECRET,
  KAKAO_CALLBACK_URL,
  TEACHER_CODE,
} from '../config.js';
import {
  findOrCreateGoogleUser,
  findOrCreateKakaoUser,
  signupLocalUser,
  loginLocalUser,
  serializeAuthUser,
  createAccessToken,
  getUserWithStats,
} from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { createHash } from 'node:crypto';
import { createSession, revokeSession } from '../store/sessionStore.js';
import { beginOAuth, verifyOAuthState, finishOAuth, exchangeOAuth } from '../services/oauthFlow.js';

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const loginIpLimit = rateLimit(300, 15 * 60_000, req => req.ip);
const loginAccountLimit = rateLimit(10, 15 * 60_000, req => createHash('sha256').update(typeof req.body?.username === 'string' ? req.body.username : '').digest('hex'));
const recoveryLimit = rateLimit(10, 15 * 60_000, req => req.ip);
const oauthLimit = rateLimit(30, 15 * 60_000, req => req.ip);
const validCredentials = (username, password) => typeof username === 'string' && username.length > 0 && username.length <= 100 && typeof password === 'string' && password.length > 0 && Buffer.byteLength(password) <= 72;

const isGoogleAuthConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const isKakaoAuthConfigured = Boolean(KAKAO_REST_API_KEY);

if (isGoogleAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateGoogleUser(profile);
          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
}

router.get(
  '/google',
  oauthLimit,
  (_req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res.status(503).json({ message: 'Google 로그인 설정이 필요합니다.' });
    }
    next();
  },
  (req, res, next) => {
    try {
      passport.authenticate('google', { scope: ['profile', 'email'], state: beginOAuth(req, res, 'google'), session: false })(req, res, next);
    } catch { res.status(503).json({ error: '잠시 후 다시 로그인해주세요.' }); }
  }
);

router.get(
  '/google/callback',
  (_req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res.status(503).json({ message: 'Google 로그인 설정이 필요합니다.' });
    }
    next();
  },
  verifyOAuthState('google'),
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/auth/callback?error=login_failed` }),
  (req, res) => {
    finishOAuth(req, res, req.user);
  }
);

router.get('/fail', (_req, res) => {
  res.status(401).json({ message: '로그인에 실패했습니다.' });
});

router.get('/signup', (_req, res) => {
  res.redirect(`${FRONTEND_URL}/auth/signup`);
});

router.get('/login', (_req, res) => {
  res.redirect(`${FRONTEND_URL}/auth/login`);
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await getUserWithStats(req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    res.json(serializeAuthUser(user));
  } catch (error) {
    res.status(500).json({ error: '사용자 정보를 불러오지 못했습니다.' });
  }
});

router.post('/signup', rateLimit(20, 60 * 60_000, req => req.ip), async (req, res) => {
  try {
    const { username, password, name, email, teacherCode } = req.body;

    if (!validCredentials(username, password)) {
      return res.status(400).json({
        error: '아이디와 비밀번호는 필수입니다.',
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        error: '비밀번호는 12자리 이상이어야 합니다.',
      });
    }

    // 선생님 코드는 선택 입력값이다. 입력한 경우에만 검증하고, 통과했을 때만 교사 권한을 준다.
    const submittedTeacherCode = typeof teacherCode === 'string' ? teacherCode.trim() : '';
    let isTeacher = false;
    if (submittedTeacherCode) {
      if (!TEACHER_CODE || submittedTeacherCode !== TEACHER_CODE) {
        return res.status(400).json({ error: '선생님 코드가 올바르지 않습니다.' });
      }
      isTeacher = true;
    }
    const user = await signupLocalUser({ username, password, name, email, isTeacher });
    const nonce = createSession(user.user_id);
    const token = createAccessToken(user, nonce);

    return res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : '회원가입에 실패했습니다.',
    });
  }
});

router.post('/login', loginIpLimit, loginAccountLimit, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!validCredentials(username, password)) {
      return res.status(400).json({
        error: '아이디와 비밀번호는 필수입니다.',
      });
    }

    const user = await loginLocalUser({ username, password });
    const nonce = createSession(user.user_id);
    const token = createAccessToken(user, nonce);

    return res.json({
      message: '로그인에 성공했습니다.',
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    return res.status(400).json({
      error: '아이디 또는 비밀번호가 올바르지 않습니다.',
    });
  }
});

router.patch('/profile', requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    const { name, profileImage } = req.body;
    const { prisma } = await import('../db/prisma.js');
    const data = {};
    if (name && typeof name === 'string' && name.trim()) data.name = name.trim();
    if (profileImage !== undefined) data.profile_image = profileImage || null;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: '변경할 항목이 없습니다.' });
    const updated = await prisma.user.update({ where: { user_id: userId }, data, include: { stats: true } });
    const { serializeAuthUser, withDebateGameCount } = await import('../services/authService.js');
    return res.json(serializeAuthUser(await withDebateGameCount(updated)));
  } catch (error) {
    return res.status(500).json({ error: '프로필 수정에 실패했습니다.' });
  }
});

// Recovery stays closed until a verified out-of-band recovery channel exists.
// Never issue a reset credential based on publicly knowable profile fields.
router.post(['/find-account', '/reset-password/verify', '/reset-password/confirm'], recoveryLimit, (_req, res) => {
  res.status(403).json({ error: '자동 계정 찾기는 현재 지원하지 않습니다. 서비스 운영자에게 계정 복구를 문의해주세요.' });
});

router.post('/logout', requireAuth, (req, res) => {
  revokeSession(req.user.id);
  res.json({ ok: true });
});

router.post('/oauth/exchange', oauthLimit, exchangeOAuth);

router.get('/kakao', oauthLimit, (req, res) => {
  if (!isKakaoAuthConfigured) {
    return res.status(503).json({ message: 'Kakao 로그인 설정이 필요합니다.' });
  }

  let state;
  try { state = beginOAuth(req, res, 'kakao'); }
  catch { return res.status(503).json({ error: '잠시 후 다시 로그인해주세요.' }); }
  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_CALLBACK_URL)}` +
    `&response_type=code&state=${encodeURIComponent(state)}`;

  res.redirect(kakaoAuthUrl);
});

router.get('/kakao/callback', verifyOAuthState('kakao'), async (req, res) => {
  if (!isKakaoAuthConfigured) {
    return res.status(503).json({ message: 'Kakao 로그인 설정이 필요합니다.' });
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code) return res.redirect(`${FRONTEND_URL}/auth/callback?error=kakao_login_failed`);

  try {
    const tokenResponse = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_REST_API_KEY,
        redirect_uri: KAKAO_CALLBACK_URL,
        code,
        ...(KAKAO_CLIENT_SECRET ? { client_secret: KAKAO_CLIENT_SECRET } : {}),
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      }
    );

    const kakaoAccessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${kakaoAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    const user = await findOrCreateKakaoUser(userResponse.data);
    finishOAuth(req, res, user);
  } catch (error) {
    console.error('Kakao login failed:', axios.isAxiosError(error) ? error.response?.status ?? 'network' : 'internal');
    res.redirect(`${FRONTEND_URL}/auth/callback?error=kakao_login_failed`);
  }
});

export default router;
