import test from 'node:test';
import assert from 'node:assert/strict';
import { playerAuthor, stageStatus } from '../src/lib/debatePresentation.ts';

test('solo author follows the selected stance, not the internal pro player slot', () => {
  assert.equal(playerAuthor('solo_essay', 'con', '찬성 플레이어'), '반대 논술 작성자');
  assert.equal(playerAuthor('solo_essay', 'pro', '찬성 플레이어'), '찬성 논술 작성자');
  assert.equal(playerAuthor('solo_essay', null, '찬성 플레이어'), '논술 작성자');
  for (const mode of ['human_debate', 'ai_debate']) {
    assert.equal(playerAuthor(mode, 'con', '찬성 플레이어'), '찬성 플레이어');
  }
});

test('evaluation stays active while judging, then every stage completes on ended', () => {
  assert.deepEqual([0, 1, 2, 3].map(i => stageStatus(i, 3, false)), ['done', 'done', 'done', 'active']);
  assert.deepEqual([0, 1, 2, 3].map(i => stageStatus(i, 3, true)), ['done', 'done', 'done', 'done']);
  assert.deepEqual([0, 1, 2, 3].map(i => stageStatus(i, -1, false)), ['upcoming', 'upcoming', 'upcoming', 'upcoming']);
});
