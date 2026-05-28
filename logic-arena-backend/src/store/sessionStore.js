import { randomUUID } from 'crypto';

const store = new Map(); // userId -> nonce

export function createSession(userId) {
  const nonce = randomUUID();
  store.set(userId, nonce);
  return nonce;
}

export function validateSession(userId, nonce) {
  return store.get(userId) === nonce;
}
