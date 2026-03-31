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
} from '../config.js';
import {
  findOrCreateGoogleUser,
  findOrCreateKakaoUser,
  signupLocalUser,
  loginLocalUser,
  serializeAuthUser,
  createAccessToken,
} from '../services/authService.js';

const router = express.Router();

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

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/fail' }),
  (req, res) => {
    const token = createAccessToken(req.user);
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

router.get('/me', (_req, res) => {
  res.json({ message: 'JWT 인증 미들웨어 연결이 필요합니다.' });
});

router.post('/signup', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: '아이디와 비밀번호는 필수입니다.',
      });
    }

    const user = await signupLocalUser({ username, password, name, email });
    const token = createAccessToken(user);

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
    const token = createAccessToken(user);

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

router.get('/kakao', (_req, res) => {
  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_CALLBACK_URL)}` +
    `&response_type=code`;

  res.redirect(kakaoAuthUrl);
});

router.get('/kakao/callback', async (req, res) => {
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
    const token = createAccessToken(user);

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
