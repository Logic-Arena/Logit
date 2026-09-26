import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { JWT_SECRET } from '../config.js';
import { DEBATE_WHERE } from '../utils/soloEssay.js';

function sanitizeUser(user) {
  if (!user) return user;

  const { password, ...safeUser } = user;
  return safeUser;
}

// 저장된 total_games는 과거 개인 논술이 섞여 부풀려진 값이 남아 있을 수 있으므로
// 응답 시점에 DebateHistory의 토론 건수로 덮어쓴다 (DB 값은 다음 토론 종료 시 자연 보정).
export async function withDebateGameCount(user) {
  if (!user?.stats) return user;
  const totalGames = await prisma.debateHistory.count({ where: { user_id: user.user_id, ...DEBATE_WHERE } });
  return { ...user, stats: { ...user.stats, total_games: totalGames } };
}

export async function findOrCreateGoogleUser(profile) {
  const providerUserId = profile.id;
  const email = profile.emails?.[0]?.value ?? null;
  const name = profile.displayName ?? 'Google User';
  const profileImage = profile.photos?.[0]?.value ?? null;

  const existingUser = await prisma.user.findFirst({
    where: {
      provider: 'google',
      provider_user_id: providerUserId,
    },
  });

  if (existingUser) {
    return sanitizeUser(existingUser);
  }

  const insertedUser = await prisma.user.create({
    data: {
      provider: 'google',
      provider_user_id: providerUserId,
      email,
      name,
      profile_image: profileImage,
      stats: { create: {} },
    },
    include: { stats: true },
  });

  return sanitizeUser(insertedUser);
}

export async function findOrCreateKakaoUser(kakaoUser) {
  const providerUserId = String(kakaoUser.id);
  const email = kakaoUser.kakao_account?.email ?? null;
  const name = kakaoUser.properties?.nickname ?? 'Kakao User';
  const profileImage = kakaoUser.properties?.profile_image ?? null;

  const existingUser = await prisma.user.findFirst({
    where: {
      provider: 'kakao',
      provider_user_id: providerUserId,
    },
  });

  if (existingUser) {
    return sanitizeUser(existingUser);
  }

  const insertedUser = await prisma.user.create({
    data: {
      provider: 'kakao',
      provider_user_id: providerUserId,
      email,
      name,
      profile_image: profileImage,
      stats: { create: {} },
    },
    include: { stats: true },
  });

  return sanitizeUser(insertedUser);
}

export async function signupLocalUser({ username, password, name, email, isTeacher = false }) {
  const existing = await prisma.user.findUnique({
    where: { login_id: username },
  });
  if (existing) {
    throw new Error('이미 사용 중인 아이디입니다.');
  }

  if (email) {
    const emailExists = await prisma.user.findUnique({
      where: { email },
    });
    if (emailExists) {
      throw new Error('이미 사용 중인 이메일입니다.');
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const displayName = name?.trim() || username;

  try {
    const result = await prisma.user.create({
      data: {
        provider: 'local',
        login_id: username,
        password: passwordHash,
        name: displayName,
        email: email ?? null,
        role: isTeacher ? 'teacher' : 'student',
        stats: { create: {} },
        ...(isTeacher ? { teacher_settings: { create: {} } } : {}),
      },
      include: { stats: true, teacher_settings: true },
    });
    return sanitizeUser(result);
  } catch (error) {
    if (error?.code === 'P2002') {
      throw new Error('이미 사용 중인 아이디 또는 이메일입니다.');
    }
    throw error;
  }
}

export async function loginLocalUser({ username, password }) {
  const user = await prisma.user.findFirst({
    where: {
      provider: 'local',
      login_id: username,
    },
    include: {
      stats: true,
      teacher_settings: true,
    },
  });

  // Equal bcrypt work and a single response for unknown users / wrong passwords.
  const dummyHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  const isMatch = await bcrypt.compare(password, user?.password || dummyHash);
  if (!user?.password || !isMatch) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');

  return withDebateGameCount(sanitizeUser(user));
}

export function serializeAuthUser(user) {
  return {
    id: user.user_id,
    provider: user.provider,
    username: user.login_id ?? null,
    email: user.email ?? null,
    name: user.name ?? null,
    profile_image: user.profile_image ?? null,
    role: user.role ?? 'student',
    stats: user.stats ?? null,
    teacher_settings: user.teacher_settings ?? null,
  };
}

export async function getUserWithStats(userId) {
  const user = await prisma.user.findUnique({
    where: { user_id: userId },
    include: { stats: true, teacher_settings: true },
  });
  return user ? withDebateGameCount(sanitizeUser(user)) : null;
}

export function createAccessToken(user, nonce) {
  return jwt.sign(
    {
      type: 'access',
      id: user.user_id,
      provider: user.provider,
      username: user.login_id,
      email: user.email,
      name: user.name,
      role: user.role ?? 'student',
      ...(nonce ? { nonce } : {}),
    },
    JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256', issuer: 'logit', audience: 'logit-api' }
  );
}
