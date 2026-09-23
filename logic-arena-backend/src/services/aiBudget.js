import { createBudget } from '../middleware/rateLimit.js';

export function createAiGuard({ hourlyLimit = 1000, concurrency = 16 } = {}) {
  const consume = createBudget(hourlyLimit, 60 * 60_000);
  let active = 0;
  return fn => async (...args) => {
    if (active >= concurrency || consume('global')) {
      throw new Error('AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.');
    }
    active++;
    try { return await fn(...args); } finally { active--; }
  };
}
