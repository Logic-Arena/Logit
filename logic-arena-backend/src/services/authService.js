import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { JWT_SECRET } from '../config.js';

function sanitizeUser(user) {
  if (!user) return user;

  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export async function findOrCreateGoogleUser(profile) {
  const provider = 'google';
  const providerId = profile.id;
  const email = profile.emails?.[0]?.value ?? null;
  const name = profile.displayName ?? null;
  const profileImage = profile.photos?.[0]?.value ?? null;

  const existingUser = await pool.query(
    `
    SELECT * FROM users
    WHERE provider = $1 AND provider_id = $2
    `,
    [provider, providerId]
  );

  if (existingUser.rows.length > 0) {
    return sanitizeUser(existingUser.rows[0]);
  }

  const insertedUser = await pool.query(
    `
    INSERT INTO users (provider, provider_id, email, name, profile_image)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [provider, providerId, email, name, profileImage]
  );

  return sanitizeUser(insertedUser.rows[0]);
}

export async function findOrCreateKakaoUser(kakaoUser) {
  const provider = 'kakao';
  const providerId = String(kakaoUser.id);
  const email = kakaoUser.kakao_account?.email ?? null;
  const name = kakaoUser.properties?.nickname ?? null;
  const profileImage = kakaoUser.properties?.profile_image ?? null;

  const existingUser = await pool.query(
    `
    SELECT * FROM users
    WHERE provider = $1 AND provider_id = $2
    `,
    [provider, providerId]
  );

  if (existingUser.rows.length > 0) {
    return sanitizeUser(existingUser.rows[0]);
  }

  const insertedUser = await pool.query(
    `
    INSERT INTO users (provider, provider_id, email, name, profile_image)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [provider, providerId, email, name, profileImage]
  );

  return sanitizeUser(insertedUser.rows[0]);
}

export async function signupLocalUser({ username, password, name, email }) {
  const existing = await pool.query(
    `SELECT id FROM users WHERE username = $1`,
    [username]
  );

  if (existing.rows.length > 0) {
    throw new Error('이미 사용 중인 아이디입니다.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (provider, provider_id, username, password_hash, name, email)
     VALUES ('local', NULL, $1, $2, $3, $4)
     RETURNING *`,
    [username, passwordHash, name ?? null, email ?? null]
  );

  return sanitizeUser(result.rows[0]);
}

export async function loginLocalUser({ username, password }) {
  const result = await pool.query(
    `SELECT * FROM users
     WHERE provider = 'local' AND username = $1`,
    [username]
  );

  const user = result.rows[0];

  if (!user) {
    throw new Error('존재하지 않는 아이디입니다.');
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    throw new Error('비밀번호가 올바르지 않습니다.');
  }

  return sanitizeUser(user);
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      provider: user.provider,
      username: user.username,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}
