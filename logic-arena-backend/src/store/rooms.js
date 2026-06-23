import { v4 as uuidv4 } from 'uuid';

const rooms = new Map();
export const phaseTimers = new Map(); // roomId -> timeoutId

// ── Phase definitions ────────────────────────────────────────

export const PHASE_DURATION_MS = {
  topic_selection: 35_000,
  arguing: 120_000,
  pro_p_rebuttal: 150_000, // 2분 + 30초 보너스 (첫 플레이어 주제 읽기 시간)
  pro_p_defense: 90_000,   // 1분 30초
  pro_p_counter: 60_000,   // 1분
  con_p_rebuttal: 90_000,  // 1분 30초
  con_p_defense: 90_000,   // 1분 30초
  con_p_counter: 60_000,   // 1분
  pro_a_rebuttal: 10_000,  // AI 자동 생성 후 즉시 진행 (fallback 10초)
  pro_a_defense: 90_000,   // 1분 30초
  pro_a_counter: 10_000,   // AI 자동 생성 후 즉시 진행 (fallback 10초)
  con_a_rebuttal: 10_000,  // AI 자동 생성 후 즉시 진행 (fallback 10초)
  con_a_defense: 90_000,   // 1분 30초
  con_a_counter: 10_000,   // AI 자동 생성 후 즉시 진행 (fallback 10초)
  coaching: 10_000,        // 훈수 AI (fallback 10초)
  final_argument: 60_000,  // 1분
  judging: 30_000,         // 30초
  peer_voting: 30_000,     // 동료 평가 투표 (30초)
  ended: 0,                // 종료 페이즈 — 타이머 없음 (phaseEndAt = null)
};

const AI_PHASE_SEQUENCE = [
  'waiting', 'topic_selection', 'arguing',
  'pro_p_rebuttal', 'pro_p_defense', 'pro_p_counter',
  'con_p_rebuttal', 'con_p_defense', 'con_p_counter',
  'pro_a_rebuttal', 'pro_a_defense', 'pro_a_counter',
  'con_a_rebuttal', 'con_a_defense', 'con_a_counter',
  'coaching', 'final_argument', 'judging', 'peer_voting', 'ended',
];

const HUMAN_PHASE_SEQUENCE = [
  'waiting', 'topic_selection', 'arguing',
  'pro_p_rebuttal', 'pro_p_defense', 'pro_p_counter',
  'con_p_rebuttal', 'con_p_defense', 'con_p_counter',
  'coaching', 'final_argument', 'judging', 'peer_voting', 'ended',
];

// 각 페이즈에서 AI가 자동으로 콘텐츠를 생성하는지
export const AI_AUTO_PHASES = new Set([
  'pro_a_rebuttal', 'pro_a_counter',
  'con_a_rebuttal', 'con_a_counter',
  'coaching', 'judging',
]);

// 각 페이즈에서 AI가 함께 변론을 생성하는 defense 페이즈
export const AI_DEFENSE_PHASES = new Set([
  'pro_p_defense', 'con_p_defense',
  'pro_a_defense', 'con_a_defense',
]);

// 각 페이즈에서 사람이 제출할 content 키
export const PHASE_SUBMIT_KEY = {
  arguing: { pro_player: 'pro_argument', con_player: 'con_argument' },
  pro_p_rebuttal: { pro_player: 'pro_p_rebuttal' },
  pro_p_defense: { con_player: 'pro_p_defense_player' },
  pro_p_counter: { pro_player: 'pro_p_counter' },
  con_p_rebuttal: { con_player: 'con_p_rebuttal' },
  con_p_defense: { pro_player: 'con_p_defense_player' },
  con_p_counter: { con_player: 'con_p_counter' },
  pro_a_defense: { con_player: 'pro_a_defense_player' },
  con_a_defense: { pro_player: 'con_a_defense_player' },
  final_argument: { pro_player: 'pro_final', con_player: 'con_final' },
};

export function getNextPhase(currentPhase, mode = 'ai_debate', coachingEnabled = true) {
  const sequence = mode === 'human_debate' ? HUMAN_PHASE_SEQUENCE : AI_PHASE_SEQUENCE;
  const idx = sequence.indexOf(currentPhase);
  if (idx === -1 || idx >= sequence.length - 1) return 'ended';
  const next = sequence[idx + 1];
  // coaching이 꺼져있으면 coaching phase 건너뜀
  if (next === 'coaching' && !coachingEnabled) {
    return sequence[idx + 2] ?? 'ended';
  }
  return next;
}

// ── Room CRUD ────────────────────────────────────────────────

const PHASE_TO_CATEGORY = {
  arguing: 'arguing',
  pro_p_rebuttal: 'rebuttal',
  con_p_rebuttal: 'rebuttal',
  pro_p_defense: 'defense',
  con_p_defense: 'defense',
  pro_p_counter: 'counter',
  con_p_counter: 'counter',
  final_argument: 'finalArgument',
  peer_voting: 'peerVoting',
};

export function getPhaseDuration(phase, phaseDurations = null) {
  const base = PHASE_DURATION_MS[phase] ?? 30_000;
  if (!phaseDurations) return base;
  const cat = PHASE_TO_CATEGORY[phase];
  if (!cat) return base;
  const customSec = phaseDurations[cat];
  if (customSec == null) return base;
  // pro_p_rebuttal은 주제 읽기 시간 30초 보너스 유지
  const bonus = phase === 'pro_p_rebuttal' ? 30_000 : 0;
  return customSec * 1_000 + bonus;
}

export function createRoom({ title, mode = 'ai_debate', topicMode = 'ai_auto', topic = null, password = null, handicap = null, coachingEnabled = true }) {
  const defaultHandicap = { enabled: true, vocab: true, evidenceLimit: true, rebuttalLimit: true, phaseDurations: null };
  const resolvedHandicap = (handicap && typeof handicap === 'object') ? handicap : defaultHandicap;
  const id = uuidv4();
  const room = {
    id,
    title,
    password: password || null,
    mode,
    topicMode,
    topic,
    topicSource: null,
    phase: 'waiting',
    phaseEndAt: null,
    createdAt: new Date(),
    status: 'pending', // 방장이 아직 입장하지 않은 상태. 방장 입장 시 'active'로 전환
    coachingEnabled: coachingEnabled !== false,

    host: null,        // socketId
    proPlayer: null,   // { socketId, userId, username }
    conPlayer: null,   // { socketId, userId, username }
    observers: new Map(), // socketId -> { userId, username }
    sideSelectionAttempts: 0,
    pendingSelections: new Map(), // socketId -> 'pro' | 'con'

    // 각 페이즈 콘텐츠
    content: {
      pro_argument: null,
      con_argument: null,
      pro_ai_argument: null,
      con_ai_argument: null,
      pro_p_rebuttal: null,
      pro_p_defense_player: null,
      pro_p_defense_ai: null,
      pro_p_counter: null,
      con_p_rebuttal: null,
      con_p_defense_player: null,
      con_p_defense_ai: null,
      con_p_counter: null,
      pro_a_rebuttal: null,
      pro_a_defense_player: null,
      pro_a_defense_ai: null,
      pro_a_counter: null,
      con_a_rebuttal: null,
      con_a_defense_player: null,
      con_a_defense_ai: null,
      con_a_counter: null,
      coaching_pro: null,
      coaching_con: null,
      pro_final: null,
      con_final: null,
    },

    result: null,
    pastTopics: [],
    topicGenerationSeq: 0,

    handicap: resolvedHandicap,
    peerVotes: { pro: 0, con: 0, voters: new Set(), initialObserverCount: null },
  };
  rooms.set(id, room);
  return serializeRoom(room);
}

export function getAllRooms() {
  return Array.from(rooms.values())
    .filter((room) => room.status !== 'pending')
    .map(serializeRoom);
}

export function getRoom(id) {
  return rooms.get(id) || null;
}

export function getRoomSerialized(id) {
  const room = rooms.get(id);
  return room ? serializeRoom(room) : null;
}

// ── Player management ────────────────────────────────────────

export function addPlayerToRoom(roomId, socketId, { userId, username, password }) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'room_not_found' };

  if (room.password && room.password !== password) {
    return { error: 'wrong_password' };
  }

  // 중복 닉네임 검사
  const taken = new Set();
  if (room.proPlayer) taken.add(room.proPlayer.username);
  if (room.conPlayer) taken.add(room.conPlayer.username);
  for (const o of room.observers.values()) taken.add(o.username);
  if (taken.has(username)) return { error: 'duplicate_name' };

  let role;
  if (!room.proPlayer) {
    room.proPlayer = { socketId, userId, username };
    room.host = socketId;
    role = 'pro_player';
    // 방장이 처음 입장하는 순간 방을 활성화 (방 목록에 노출)
    if (room.status === 'pending') {
      room.status = 'active';
    }
  } else if (!room.conPlayer) {
    room.conPlayer = { socketId, userId, username };
    role = 'con_player';
  } else {
    room.observers.set(socketId, { userId, username });
    role = 'observer';
  }

  return { role, room: serializeRoom(room) };
}

export function removePlayerFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  let removedRole = null;

  if (room.proPlayer?.socketId === socketId) {
    removedRole = 'pro_player';
    room.proPlayer = null;
    // 게임 대기 중이면 conPlayer를 먼저 proPlayer(방장)로 승격, 없으면 관전자 승격
    if (room.phase === 'waiting') {
      if (room.conPlayer) {
        room.proPlayer = room.conPlayer;
        room.conPlayer = null;
        room.host = room.proPlayer.socketId;

        // conPlayer 자리가 비었으니 관전자 중 한 명을 conPlayer로 승격
        const first = room.observers.entries().next();
        if (!first.done) {
          const [sid, data] = first.value;
          room.observers.delete(sid);
          room.conPlayer = { socketId: sid, ...data };
        }
      } else {
        const first = room.observers.entries().next();
        if (!first.done) {
          const [sid, data] = first.value;
          room.observers.delete(sid);
          room.proPlayer = { socketId: sid, ...data };
          room.host = sid;
        }
      }
    }
  } else if (room.conPlayer?.socketId === socketId) {
    removedRole = 'con_player';
    room.conPlayer = null;
    if (room.phase === 'waiting') {
      const first = room.observers.entries().next();
      if (!first.done) {
        const [sid, data] = first.value;
        room.observers.delete(sid);
        room.conPlayer = { socketId: sid, ...data };
      }
    }
  } else if (room.observers.has(socketId)) {
    removedRole = 'observer';
    room.observers.delete(socketId);
  }

  if (room.host === socketId) {
    room.host = room.proPlayer?.socketId ?? room.conPlayer?.socketId ?? null;
  }

  const total = (room.proPlayer ? 1 : 0) + (room.conPlayer ? 1 : 0) + room.observers.size;
  if (total === 0) {
    rooms.delete(roomId);
    return { removedRole, room: null };
  }

  return { removedRole, room: serializeRoom(room) };
}

export function getPlayerRole(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.proPlayer?.socketId === socketId) return 'pro_player';
  if (room.conPlayer?.socketId === socketId) return 'con_player';
  if (room.observers.has(socketId)) return 'observer';
  return null;
}

// ── Side selection ────────────────────────────────────────────

export function selectSide(roomId, socketId, side) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'topic_selection') return null;

  const isProSlot = room.proPlayer?.socketId === socketId;
  const isConSlot = room.conPlayer?.socketId === socketId;
  if (!isProSlot && !isConSlot) return null;

  room.pendingSelections.set(socketId, side);

  const proSid = room.proPlayer?.socketId;
  const conSid = room.conPlayer?.socketId;
  const proSel = room.pendingSelections.get(proSid);
  const conSel = room.pendingSelections.get(conSid);

  if (!proSel || !conSel) {
    return { status: 'waiting', room: serializeRoom(room) };
  }

  if (proSel !== conSel) {
    // 다른 진영 선택 → 선택대로 배정
    if (proSel === 'con') {
      const tmp = room.proPlayer;
      room.proPlayer = room.conPlayer;
      room.conPlayer = tmp;
    }
    room.pendingSelections.clear();
    return { status: 'assigned', room: serializeRoom(room) };
  }

  // 같은 진영 선택
  room.sideSelectionAttempts++;
  room.pendingSelections.clear();

  if (room.sideSelectionAttempts > 7) {
    if (Math.random() < 0.5) {
      const tmp = room.proPlayer;
      room.proPlayer = room.conPlayer;
      room.conPlayer = tmp;
    }
    return { status: 'random_assigned', room: serializeRoom(room) };
  }

  return { status: 'retry', attempts: room.sideSelectionAttempts, room: serializeRoom(room) };
}

// ── Phase management ─────────────────────────────────────────

export function setPhase(roomId, phase) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const phaseDurations = room.handicap?.phaseDurations ?? null;
  const dur = getPhaseDuration(phase, phaseDurations);
  room.phase = phase;
  room.phaseEndAt = dur ? Date.now() + dur : null;
  return serializeRoom(room);
}

export function setPhaseEndAt(roomId, phaseEndAt) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.phaseEndAt = phaseEndAt;
  return serializeRoom(room);
}

export function setTopic(roomId, topic, source = null) {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.topic = topic;
  room.topicSource = topic ? source : null;
  return true;
}

export function bumpTopicGenerationSeq(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.topicGenerationSeq++;
  return room.topicGenerationSeq;
}

// ── Content ──────────────────────────────────────────────────

export function setContent(roomId, key, value) {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.content[key] = value;
  return true;
}

export function setResult(roomId, result) {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.result = result;
  return true;
}

export function addPastTopic(roomId, topic) {
  const room = rooms.get(roomId);
  if (!room) return false;
  const cleanTopic = typeof topic === 'string' ? topic.trim() : '';
  const normalizedTopic = normalizeTopic(cleanTopic);
  if (!normalizedTopic) return false;

  const alreadyAdded = room.pastTopics.some((pastTopic) =>
    normalizeTopic(pastTopic) === normalizedTopic
  );
  if (alreadyAdded) return false;

  room.pastTopics.push(cleanTopic);
  return true;
}

export function getPastTopics(roomId) {
  const room = rooms.get(roomId);
  return room ? [...room.pastTopics] : [];
}

// ── Serialization ─────────────────────────────────────────────

function serializeRoom(room) {
  return {
    id: room.id,
    title: room.title,
    hasPassword: !!room.password,
    mode: room.mode,
    topicMode: room.topicMode,
    topic: room.topic,
    topicSource: room.topicSource,
    phase: room.phase,
    phaseEndAt: room.phaseEndAt,
    host: room.host,
    proPlayer: room.proPlayer,
    conPlayer: room.conPlayer,
    observers: Array.from(room.observers.entries()).map(([sid, u]) => ({ socketId: sid, ...u })),
    content: room.content,
    result: room.result,
    createdAt: room.createdAt,
    sideSelectionAttempts: room.sideSelectionAttempts,
    status: room.status,
    coachingEnabled: room.coachingEnabled,
    pendingSelections: Object.fromEntries(room.pendingSelections.entries()),
  };
}

function normalizeTopic(topic) {
  if (typeof topic !== 'string') return '';
  return topic
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.。．!?？！…]+$/u, '')
    .trim()
    .toLowerCase();
}
