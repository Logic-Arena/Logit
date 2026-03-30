import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { JWT_SECRET } from '../config.js';

function sanitizeUser(user) {
  if (!user) return user;

  const { password, ...safeUser } = user;
  return safeUser;
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
    },
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
    },
  });

  return sanitizeUser(insertedUser);
}

export async function signupLocalUser({ username, password, name, email }) {
  const existing = await prisma.user.findUnique({
    where: {
      login_id: username,
    },
  });

  if (existing) {
    throw new Error('이미 사용 중인 아이디입니다.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const displayName = name?.trim() || username;

  const result = await prisma.user.create({
    data: {
      provider: 'local',
      login_id: username,
      password: passwordHash,
      name: displayName,
      email: email ?? null,
      stats: {
        create: {},
      },
    },
    include: {
      stats: true,
    },
  });

  return sanitizeUser(result);
}

export async function loginLocalUser({ username, password }) {
  const user = await prisma.user.findFirst({
    where: {
      provider: 'local',
      login_id: username,
    },
    include: {
      stats: true,
    },
  });

  if (!user) {
    throw new Error('존재하지 않는 아이디입니다.');
  }

  const isMatch = await bcrypt.compare(password, user.password ?? '');

  if (!isMatch) {
    throw new Error('비밀번호가 올바르지 않습니다.');
  }

  return sanitizeUser(user);
}

export function serializeAuthUser(user) {
  return {
    id: user.user_id,
    provider: user.provider,
    username: user.login_id ?? null,
    email: user.email ?? null,
    name: user.name ?? null,
    profile_image: user.profile_image ?? null,
    stats: user.stats ?? null,
  };
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      id: user.user_id,
      provider: user.provider,
      username: user.login_id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
