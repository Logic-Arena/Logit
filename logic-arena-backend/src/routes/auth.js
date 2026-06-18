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
import { createSession } from '../store/sessionStore.js';

const router = express.Router();
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

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

router.get(
  '/google',
  (_req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res.status(503).json({ message: 'Google 로그인 설정이 필요합니다.' });
    }
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  (_req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res.status(503).json({ message: 'Google 로그인 설정이 필요합니다.' });
    }
    next();
  },
  passport.authenticate('google', { session: false, failureRedirect: '/auth/fail' }),
  (req, res) => {
    const nonce = createSession(req.user.user_id);
    const token = createAccessToken(req.user, nonce);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
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

router.post('/signup', async (req, res) => {
  try {
    const { username, password, name, email, teacherCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: '아이디와 비밀번호는 필수입니다.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: '비밀번호는 6자리 이상이어야 합니다.',
      });
    }

    const isTeacher = Boolean(teacherCode) && teacherCode === TEACHER_CODE;
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

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
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
      error: error instanceof Error ? error.message : '로그인에 실패했습니다.',
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
    const { serializeAuthUser } = await import('../services/authService.js');
    return res.json(serializeAuthUser(updated));
  } catch (error) {
    return res.status(500).json({ error: '프로필 수정에 실패했습니다.' });
  }
});

router.post('/find-account', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }
    const { prisma } = await import('../db/prisma.js');
    const user = await prisma.user.findFirst({
      where: { email: email.trim(), provider: 'local' },
      select: { login_id: true },
    });
    if (!user || !user.login_id) {
      return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
    }
    const masked = user.login_id.length > 2
      ? user.login_id.slice(0, 2) + '*'.repeat(user.login_id.length - 2)
      : user.login_id;
    return res.json({ loginId: masked });
  } catch (error) {
    return res.status(500).json({ error: '계정 찾기에 실패했습니다.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { loginId, email, newPassword } = req.body;
    if (!loginId || !email || !newPassword) {
      return res.status(400).json({ error: '아이디, 이메일, 새 비밀번호를 모두 입력해주세요.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자리 이상이어야 합니다.' });
    }
    const { prisma } = await import('../db/prisma.js');
    const bcrypt = (await import('bcrypt')).default;
    const user = await prisma.user.findFirst({
      where: { login_id: loginId.trim(), email: email.trim(), provider: 'local' },
    });
    if (!user) {
      return res.status(404).json({ error: '아이디와 이메일이 일치하는 계정을 찾을 수 없습니다.' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { user_id: user.user_id }, data: { password: hashed } });
    return res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    return res.status(500).json({ error: '비밀번호 재설정에 실패했습니다.' });
  }
});

router.get('/kakao', (_req, res) => {
  if (!isKakaoAuthConfigured) {
    return res.status(503).json({ message: 'Kakao 로그인 설정이 필요합니다.' });
  }

  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_CALLBACK_URL)}` +
    `&response_type=code`;

  res.redirect(kakaoAuthUrl);
});

router.get('/kakao/callback', async (req, res) => {
  if (!isKakaoAuthConfigured) {
    return res.status(503).json({ message: 'Kakao 로그인 설정이 필요합니다.' });
  }

  const code = String(req.query.code ?? '');

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
    const nonce = createSession(user.user_id);
    const token = createAccessToken(user, nonce);

    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    const message =
      axios.isAxiosError(error) && error.response
        ? JSON.stringify(error.response.data)
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error('Kakao login error:', message);
    res.redirect(`${FRONTEND_URL}/auth/callback?error=kakao_login_failed`);
  }
});

export default router;
