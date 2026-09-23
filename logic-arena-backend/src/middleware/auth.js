import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { validateSession } from '../store/sessionStore.js';

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'logit', audience: 'logit-api' });
  if (decoded.type !== 'access' || !Number.isSafeInteger(decoded.id) || decoded.id <= 0 ||
      typeof decoded.nonce !== 'string' || !Number.isFinite(decoded.exp) ||
      !['student', 'teacher'].includes(decoded.role) || !validateSession(decoded.id, decoded.nonce)) {
    throw new Error('유효하지 않은 인증 정보입니다. 다시 로그인해주세요.');
  }
  return decoded;
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try { req.user = verifyAccessToken(token); } catch {}
  }
  next();
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}
