import { createHash, randomBytes } from 'node:crypto';
import { FRONTEND_URL } from '../config.js';
import { createAccessToken, serializeAuthUser } from './authService.js';
import { createSession } from '../store/sessionStore.js';

const secure = process.env.NODE_ENV === 'production';
const browserCookie = secure ? '__Host-logit-oauth-browser' : 'logit-oauth-browser';
const ticketCookie = secure ? '__Host-logit-oauth-ticket' : 'logit-oauth-ticket';
const options = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
const states = new Map();
const tickets = new Map();
const digest = value => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('base64url');
const valid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const sweep = setInterval(() => {
  for (const store of [states, tickets]) for (const [key, entry] of store) if (entry.expires <= Date.now()) store.delete(key);
}, 60_000);
sweep.unref();

function cookie(req, name) {
  const values = (req.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  // Ambiguous cookies fail closed rather than allowing a sibling path override.
  const value = values.length === 1 ? values[0].slice(name.length + 1) : '';
  return valid(value) ? value : null;
}

export function beginOAuth(req, res, provider) {
  if (states.size >= 5000) throw new Error('OAuth capacity reached');
  const binding = cookie(req, browserCookie) ?? random();
  res.cookie(browserCookie, binding, { ...options, maxAge: 10 * 60_000 });
  const state = random();
  states.set(digest(state), { provider, binding: digest(binding), expires: Date.now() + 10 * 60_000 });
  return state;
}

export function verifyOAuthState(provider) {
  return (req, res, next) => {
    const state = req.query.state;
    const binding = cookie(req, browserCookie);
    const entry = valid(state) ? states.get(digest(state)) : null;
    if (!entry || !binding || entry.provider !== provider || entry.expires <= Date.now() || entry.binding !== digest(binding)) {
      return res.status(403).json({ error: '로그인 요청을 확인할 수 없습니다. 다시 로그인해주세요.' });
    }
    states.delete(digest(state));
    req.oauthBinding = entry.binding;
    next();
  };
}

export function finishOAuth(req, res, user) {
  if (!req.oauthBinding || tickets.size >= 5000) throw new Error('Invalid OAuth completion');
  const ticket = random();
  tickets.set(digest(ticket), { user, binding: req.oauthBinding, expires: Date.now() + 60_000 });
  res.cookie(ticketCookie, ticket, { ...options, maxAge: 60_000 });
  res.set('Cache-Control', 'no-store');
  // Neither an access token nor an exchange credential appears in the URL.
  res.redirect(new URL('/auth/callback', FRONTEND_URL).href);
}

export function exchangeOAuth(req, res) {
  res.set('Cache-Control', 'no-store');
  if (req.headers.origin !== new URL(FRONTEND_URL).origin) return res.status(403).json({ error: '허용되지 않은 로그인 요청입니다.' });
  const ticket = cookie(req, ticketCookie);
  const binding = cookie(req, browserCookie);
  const entry = ticket ? tickets.get(digest(ticket)) : null;
  if (!entry || !binding || entry.expires <= Date.now() || entry.binding !== digest(binding)) {
    return res.status(401).json({ error: '로그인 요청이 만료되었습니다. 다시 로그인해주세요.' });
  }
  tickets.delete(digest(ticket));
  res.clearCookie(ticketCookie, options);
  res.clearCookie(browserCookie, options);
  const token = createAccessToken(entry.user, createSession(entry.user.user_id));
  return res.json({ token, user: serializeAuthUser(entry.user) });
}
