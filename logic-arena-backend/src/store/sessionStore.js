import { randomUUID } from 'crypto';
import { EventEmitter } from 'node:events';

const store = new Map(); // userId -> nonce
export const sessionEvents = new EventEmitter();
const lifetime = 7 * 24 * 60 * 60_000;
const cleanup = setInterval(() => {
  for (const [id, session] of store) if (session.expires <= Date.now()) revokeSession(id);
}, 60_000);
cleanup.unref();

export function revokeSession(userId) {
  store.delete(userId);
  sessionEvents.emit('revoked', userId);
}

export function createSession(userId) {
  const nonce = randomUUID();
  revokeSession(userId);
  store.set(userId, { nonce, expires: Date.now() + lifetime });
  return nonce;
}

export function validateSession(userId, nonce) {
  const session = store.get(userId);
  return !!session && session.nonce === nonce && session.expires > Date.now();
}
