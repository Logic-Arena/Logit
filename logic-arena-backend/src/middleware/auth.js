import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { validateSession } from '../store/sessionStore.js';

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
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
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.nonce && !validateSession(decoded.id, decoded.nonce)) {
      return res.status(401).json({ error: '다른 기기에서 로그인되어 로그아웃되었습니다.' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}
