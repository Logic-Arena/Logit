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
};

const AI_PHASE_SEQUENCE = [
  'waiting', 'topic_selection', 'arguing',
  'pro_p_rebuttal', 'pro_p_defense', 'pro_p_counter',
  'con_p_rebuttal', 'con_p_defense', 'con_p_counter',
  'pro_a_rebuttal', 'pro_a_defense', 'pro_a_counter',
  'con_a_rebuttal', 'con_a_defense', 'con_a_counter',
  'coaching', 'final_argument', 'judging', 'ended',
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

export function getNextPhase(currentPhase) {
  const idx = AI_PHASE_SEQUENCE.indexOf(currentPhase);
  if (idx === -1 || idx >= AI_PHASE_SEQUENCE.length - 1) return 'ended';
  return AI_PHASE_SEQUENCE[idx + 1];
}

// ── Room CRUD ────────────────────────────────────────────────

export function createRoom({ title, mode = 'ai_debate', topicMode = 'ai_auto', topic = null, password = null }) {
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

    host: null,        // socketId
    proPlayer: null,   // { socketId, userId, username }
    conPlayer: null,   // { socketId, userId, username }
    observers: new Map(), // socketId -> { userId, username }

    // 진영 선택
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
  };
  rooms.set(id, room);
  return serializeRoom(room);
}

export function getAllRooms() {
  return Array.from(rooms.values()).map(serializeRoom);
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
    // 게임 대기 중이면 첫 번째 관전자를 proPlayer로 승격
    if (room.phase === 'waiting') {
      const first = room.observers.entries().next();
      if (!first.done) {
        const [sid, data] = first.value;
        room.observers.delete(sid);
        room.proPlayer = { socketId: sid, ...data };
        room.host = sid;
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
  const dur = PHASE_DURATION_MS[phase];
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

export function getContent(roomId) {
  const room = rooms.get(roomId);
  return room ? { ...room.content } : null;
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
