import cron from 'node-cron';
import { prisma } from '../db/prisma.js';
import { generateCommunityTopicForSlot } from '../services/openai.js';

/**
 * 서버 시작 시 빈 슬롯 초기화
 * - 슬롯 A/B/C 중 활성 주제가 없는 슬롯만 AI로 생성
 * @param {import('socket.io').Server} io - Socket.IO 서버 인스턴스
 */
export async function initializeSlots(io) {
  console.log('[PollScheduler] 슬롯 초기화 시작...');

  const slots = ['A', 'B', 'C'];

  for (const slot of slots) {
    try {
      // 활성 주제 확인
      const active = await prisma.communityTopic.findFirst({
        where: { slot, status: 'active' },
      });

      if (!active) {
        console.log(`[PollScheduler] 슬롯 ${slot} 비어있음 → AI 생성 시작`);
        await refreshSlot(slot, io, true); // isInitializing = true
      } else {
        console.log(`[PollScheduler] 슬롯 ${slot} 활성 주제 있음 → 유지: ${active.question}`);
      }
    } catch (error) {
      console.error(`[PollScheduler] 슬롯 ${slot} 초기화 실패:`, error.message);
      console.log(`[PollScheduler] 슬롯 ${slot} 건너뛰고 계속 진행...`);
    }
  }

  console.log('[PollScheduler] 슬롯 초기화 완료\n');
}

/**
 * 특정 슬롯의 주제를 새로 갱신
 * @param {string} slot - 슬롯 이름 ('A', 'B', 'C')
 * @param {import('socket.io').Server} io - Socket.IO 서버 인스턴스
 * @param {boolean} isInitializing - 초기화 모드 여부 (기존 주제 closed 처리 안 함)
 */
async function refreshSlot(slot, io, isInitializing = false) {
  console.log(`[Scheduler] ${slot} 슬롯 주제 ${isInitializing ? '초기 생성' : '갱신'} 시작`);

  try {
    // 1. 기존 슬롯 주제를 closed 처리 (초기화 모드가 아닐 때만)
    if (!isInitializing) {
      await prisma.communityTopic.updateMany({
        where: { slot, status: 'active' },
        data: { status: 'closed' },
      });
    }

    // 2. AI로 새 주제 생성 (1회 재시도)
    let generated;
    try {
      generated = await generateCommunityTopicForSlot(slot);
    } catch (err) {
      console.error(`[Scheduler] AI 생성 실패, 재시도:`, err.message);
      generated = await generateCommunityTopicForSlot(slot);
    }

    // 3. DB에 새 주제 삽입
    const newTopic = await prisma.communityTopic.create({
      data: {
        question: generated.question,
        category: generated.category,
        slot,
        status: 'active',
        activated_at: new Date(), // 활성화 시각 기록
        badge: null, // HOT는 나중에 updateHotBadges에서 계산
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 임시값 (사용 안 함)
      },
    });

    console.log(`[Scheduler] ${slot} 슬롯 새 주제 생성 완료:`, newTopic.question);

    // 4. Socket.io로 실시간 브로드캐스트
    io.emit('poll_slot_updated', { slot, poll: newTopic });

    // 5. HOT 배지 재계산
    await updateHotBadges(io);

  } catch (error) {
    console.error(`[Scheduler] ${slot} 슬롯 갱신 실패:`, error);
    // 롤백 또는 fallback 로직 추가 가능
  }
}

/**
 * HOT 배지 재산정 (1시간마다)
 * - 3개 주제 중 총 투표수 1위
 * - 단, 1위와 2위 차이가 1위 기준 20% 미만이면 HOT 없음 (박빙)
 * - 동점 시 activated_at 최신 우선
 * @param {import('socket.io').Server} io - Socket.IO 서버 인스턴스
 */
async function updateHotBadges(io) {
  console.log('[Scheduler] HOT 배지 재산정 시작');

  try {
    // 1. 모든 active 주제 조회
    const topics = await prisma.communityTopic.findMany({
      where: { status: 'active' },
      orderBy: { activated_at: 'desc' },
    });

    if (topics.length === 0) {
      console.log('[Scheduler] active 주제가 없음');
      return;
    }

    // 2. 총 투표수 계산 및 정렬
    const sorted = topics
      .map((t) => ({
        ...t,
        totalVotes: t.pro_votes + t.con_votes,
      }))
      .sort((a, b) => {
        if (b.totalVotes !== a.totalVotes) {
          return b.totalVotes - a.totalVotes; // 투표수 내림차순
        }
        // 동점이면 activated_at 최신 우선
        return new Date(b.activated_at) - new Date(a.activated_at);
      });

    const first = sorted[0];
    const second = sorted[1];

    let hotTopicId = null;

    // 3. HOT 배지 조건 판단
    if (first.totalVotes > 0) {
      if (sorted.length === 1) {
        // 주제가 1개뿐이면 무조건 HOT
        hotTopicId = first.id;
      } else {
        // 1위와 2위 차이가 1위 기준 20% 이상이면 HOT
        const diff = first.totalVotes - second.totalVotes;
        const diffPercent = (diff / first.totalVotes) * 100;

        if (diffPercent >= 20) {
          hotTopicId = first.id;
          console.log(`[Scheduler] HOT 배지 조건 충족: 1위=${first.totalVotes}표, 2위=${second.totalVotes}표, 차이=${diffPercent.toFixed(1)}%`);
        } else {
          console.log(`[Scheduler] HOT 배지 박빙: 1위=${first.totalVotes}표, 2위=${second.totalVotes}표, 차이=${diffPercent.toFixed(1)}% (20% 미만)`);
        }
      }
    }

    // 4. 모든 주제의 badge를 null로 초기화
    await prisma.communityTopic.updateMany({
      where: { status: 'active' },
      data: { badge: null },
    });

    // 5. HOT 주제만 badge 업데이트
    if (hotTopicId) {
      await prisma.communityTopic.update({
        where: { id: hotTopicId },
        data: { badge: 'HOT' },
      });
      console.log(`[Scheduler] HOT 배지 부여: topic_id=${hotTopicId}`);
    } else {
      console.log('[Scheduler] HOT 배지 부여 대상 없음');
    }

    // 6. 업데이트된 주제들 브로드캐스트
    const updated = await prisma.communityTopic.findMany({
      where: { status: 'active' },
      orderBy: { activated_at: 'desc' },
    });

    io.emit('hot_badges_updated', { topics: updated });

  } catch (error) {
    console.error('[Scheduler] HOT 배지 재산정 실패:', error);
  }
}

/**
 * 스케줄러 시작
 * @param {import('socket.io').Server} io - Socket.IO 서버 인스턴스
 */
export function startPollScheduler(io) {
  console.log('[Scheduler] 커뮤니티 투표 스케줄러 시작');

  // 슬롯 A: 매일 00:00 (KST)
  cron.schedule('0 0 * * *', () => refreshSlot('A', io), {
    timezone: 'Asia/Seoul',
  });

  // 슬롯 B: 매일 16:00 (KST)
  cron.schedule('0 16 * * *', () => refreshSlot('B', io), {
    timezone: 'Asia/Seoul',
  });

  // 슬롯 C: 매일 08:00 (KST)
  cron.schedule('0 8 * * *', () => refreshSlot('C', io), {
    timezone: 'Asia/Seoul',
  });

  // HOT 배지: 매시간 정각 (KST)
  cron.schedule('0 * * * *', () => updateHotBadges(io), {
    timezone: 'Asia/Seoul',
  });

  console.log('[Scheduler] Cron jobs 등록 완료 (A:00:00, B:16:00, C:08:00, HOT:매시간)');
}
