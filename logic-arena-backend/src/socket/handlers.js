import {
  addPlayerToRoom,
  removePlayerFromRoom,
  getAllRooms,
  getRoom,
  getRoomSerialized,
  getPlayerRole,
  setPhase,
  setTopic,
  setContent,
  setResult,
  selectSide,
  getNextPhase,
  PHASE_DURATION_MS,
  AI_AUTO_PHASES,
  AI_DEFENSE_PHASES,
  PHASE_SUBMIT_KEY,
  addPastTopic,
  getPastTopics,
  phaseTimers,
} from '../store/rooms.js';

import {
  generateTopic,
  generateArgument,
  generateRebuttal,
  generateDefense,
  generateCounter,
  generateCoaching,
  judgeDebate,
} from '../services/ai.js';

import { updateStats } from '../services/statsService.js';

// ── Timer helpers ─────────────────────────────────────────────

function clearPhaseTimer(roomId) {
  const t = phaseTimers.get(roomId);
  if (t) { clearTimeout(t); phaseTimers.delete(roomId); }
}

async function startPhase(io, roomId, phase) {
  const room = getRoom(roomId);
  if (!room) return;

  setPhase(roomId, phase);
  const serialized = getRoomSerialized(roomId);
  io.to(roomId).emit('phase_changed', { phase, room: serialized });

  if (phase === 'ended') return;

  const duration = PHASE_DURATION_MS[phase];
  if (!duration) return;

  clearPhaseTimer(roomId);
  const timer = setTimeout(() => advancePhase(io, roomId), duration);
  phaseTimers.set(roomId, timer);

  // AI 자동 페이즈 처리
  if (AI_AUTO_PHASES.has(phase)) {
    handleAiAutoPhase(io, roomId, phase).catch((e) =>
      console.error(`[AI] ${phase} 자동 생성 실패:`, e.message)
    );
  }

  // Defense 페이즈에서 AI 자동 변론 생성
  if (AI_DEFENSE_PHASES.has(phase)) {
    handleAiDefense(io, roomId, phase).catch((e) =>
      console.error(`[AI] ${phase} 변론 자동 생성 실패:`, e.message)
    );
  }

  // arguing 페이즈에서 AI 주장 자동 생성
  if (phase === 'arguing') {
    handleAiArguing(io, roomId).catch((e) =>
      console.error('[AI] arguing 자동 생성 실패:', e.message)
    );
  }

  // topic_selection 시작 즉시 주제 생성 (ai_auto) — 35초 타이머 기다리지 않음
  if (phase === 'topic_selection' && room.topicMode === 'ai_auto') {
    (async () => {
      try {
        const past = getPastTopics(roomId);
        const topic = await generateTopic(past);
        if (getRoom(roomId)?.phase === 'topic_selection') {
          setTopic(roomId, topic);
          io.to(roomId).emit('topic_set', { topic, room: getRoomSerialized(roomId) });
        }
      } catch (e) {
        console.error('[AI] topic_selection 주제 생성 실패:', e.message);
      }
    })();
  }
}

async function advancePhase(io, roomId) {
  clearPhaseTimer(roomId);
  const room = getRoom(roomId);
  if (!room || room.phase === 'ended') return;

  if (room.phase === 'topic_selection') {
    await handleTopicSelectionEnd(io, roomId);
    return;
  }

  const next = getNextPhase(room.phase);
  await startPhase(io, roomId, next);
}

async function handleTopicSelectionEnd(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.phase !== 'topic_selection') return;

  // 주제 생성 (ai_auto인 경우)
  if (!room.topic && room.topicMode === 'ai_auto') {
    try {
      const past = getPastTopics(roomId);
      const topic = await generateTopic(past);
      setTopic(roomId, topic);
    } catch (e) {
      console.error('[AI] 주제 생성 실패:', e.message);
    }
  }

  // 진영 미선택자 자동 배정 (한쪽이 선택 안 했을 때) — 현재 슬롯 그대로 유지
  io.to(roomId).emit('topic_set', {
    topic: getRoom(roomId)?.topic,
    room: getRoomSerialized(roomId),
  });

  await startPhase(io, roomId, 'arguing');
}

// ── AI 자동 생성 ─────────────────────────────────────────────

async function handleAiArguing(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  const [proContent, conContent] = await Promise.all([
    generateArgument({ topic: room.topic, vote: 'pro' }),
    generateArgument({ topic: room.topic, vote: 'con' }),
  ]);

  if (getRoom(roomId)?.phase !== 'arguing') return;
  setContent(roomId, 'pro_ai_argument', proContent);
  setContent(roomId, 'con_ai_argument', conContent);
  io.to(roomId).emit('ai_content', {
    pro_ai_argument: proContent,
    con_ai_argument: conContent,
    room: getRoomSerialized(roomId),
  });

  checkArguingDone(io, roomId);
}

async function handleAiAutoPhase(io, roomId, phase) {
  const room = getRoom(roomId);
  if (!room) return;

  let contentKey = null;
  let content = null;

  const c = room.content;

  switch (phase) {
    case 'pro_a_rebuttal':
      content = await generateRebuttal({
        topic: room.topic, vote: 'pro',
        opponentArguments: [c.con_argument, c.con_ai_argument],
      });
      contentKey = 'pro_a_rebuttal';
      break;
    case 'pro_a_counter':
      content = await generateCounter({
        topic: room.topic, vote: 'pro',
        defenseContent: [c.pro_a_defense_player, c.pro_a_defense_ai].filter(Boolean).join('\n'),
      });
      contentKey = 'pro_a_counter';
      break;
    case 'con_a_rebuttal':
      content = await generateRebuttal({
        topic: room.topic, vote: 'con',
        opponentArguments: [c.pro_argument, c.pro_ai_argument],
      });
      contentKey = 'con_a_rebuttal';
      break;
    case 'con_a_counter':
      content = await generateCounter({
        topic: room.topic, vote: 'con',
        defenseContent: [c.con_a_defense_player, c.con_a_defense_ai].filter(Boolean).join('\n'),
      });
      contentKey = 'con_a_counter';
      break;
    case 'coaching':
      content = await generateCoaching({ topic: room.topic, content: c });
      contentKey = 'coaching';
      break;
    case 'judging': {
      const result = await judgeDebate({ topic: room.topic, content: room.content });
      setResult(roomId, result);
      const participants = [];
      if (room.proPlayer) participants.push({ userId: room.proPlayer.userId, vote: 'pro' });
      if (room.conPlayer) participants.push({ userId: room.conPlayer.userId, vote: 'con' });
      await updateStats(participants, result.winner).catch(() => {});
      io.to(roomId).emit('debate_ended', { result, room: getRoomSerialized(roomId) });
      await startPhase(io, roomId, 'ended');
      return;
    }
    default:
      return;
  }

  if (content && contentKey) {
    const currentRoom = getRoom(roomId);
    if (!currentRoom) return;
    // 페이즈가 넘어갔더라도 항상 저장 (다음 페이즈에서 참조 가능)
    setContent(roomId, contentKey, content);
    io.to(roomId).emit('ai_content', { [contentKey]: content, room: getRoomSerialized(roomId) });

    // 순수 AI 반론/재반론: 완료 즉시 다음 페이즈로
    const immediatePhases = new Set(['pro_a_rebuttal', 'pro_a_counter', 'con_a_rebuttal', 'con_a_counter']);
    if (immediatePhases.has(phase) && currentRoom.phase === phase) {
      clearPhaseTimer(roomId);
      await advancePhase(io, roomId);
    }
  }
}

async function handleAiDefense(io, roomId, phase) {
  const room = getRoom(roomId);
  if (!room) return;

  const c = room.content;
  let contentKey = null;
  let content = null;

  switch (phase) {
    case 'pro_p_defense':
      content = await generateDefense({ topic: room.topic, vote: 'con', rebuttalContent: c.pro_p_rebuttal });
      contentKey = 'pro_p_defense_ai';
      break;
    case 'con_p_defense':
      content = await generateDefense({ topic: room.topic, vote: 'pro', rebuttalContent: c.con_p_rebuttal });
      contentKey = 'con_p_defense_ai';
      break;
    case 'pro_a_defense':
      content = await generateDefense({ topic: room.topic, vote: 'con', rebuttalContent: c.pro_a_rebuttal });
      contentKey = 'pro_a_defense_ai';
      break;
    case 'con_a_defense':
      content = await generateDefense({ topic: room.topic, vote: 'pro', rebuttalContent: c.con_a_rebuttal });
      contentKey = 'con_a_defense_ai';
      break;
    default:
      return;
  }

  if (content && contentKey && getRoom(roomId)) {
    setContent(roomId, contentKey, content);
    io.to(roomId).emit('ai_content', { [contentKey]: content, room: getRoomSerialized(roomId) });
  }
}

// ── Early advance checks ──────────────────────────────────────

function checkArguingDone(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.phase !== 'arguing') return;
  const c = room.content;
  const humanDone = c.pro_argument && c.con_argument;
  const aiDone = c.pro_ai_argument && c.con_ai_argument;
  if (humanDone && aiDone) {
    advancePhase(io, roomId);
  }
}

function checkSinglePlayerDone(io, roomId, phase) {
  const room = getRoom(roomId);
  if (!room || room.phase !== phase) return;
  // single-player phases advance immediately after submission
  advancePhase(io, roomId);
}

function checkFinalDone(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.phase !== 'final_argument') return;
  if (room.content.pro_final && room.content.con_final) {
    advancePhase(io, roomId);
  }
}

// ── Disconnect helper ─────────────────────────────────────────

function handleLeaveInternal(io, socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const result = removePlayerFromRoom(roomId, socket.id);
  socket.data.roomId = null;
  socket.leave(roomId);

  if (!result) return;
  const { room } = result;

  if (!room) {
    clearPhaseTimer(roomId);
    io.emit('room_list', getAllRooms());
    return;
  }

  io.to(roomId).emit('player_left', { room });
  io.emit('room_list', getAllRooms());
}

// ── Main handler registration ─────────────────────────────────

export function registerHandlers(io, socket) {
  // ── join_room ──────────────────────────────────────────────
  socket.on('join_room', ({ roomId, userId, username, password }) => {
    if (socket.data.roomId && socket.data.roomId !== roomId) {
      handleLeaveInternal(io, socket);
    }

    const result = addPlayerToRoom(roomId, socket.id, { userId, username, password });

    if (result.error) {
      const messages = {
        room_not_found: '방을 찾을 수 없습니다',
        wrong_password: '비밀번호가 틀렸습니다',
        duplicate_name: '이미 같은 닉네임이 사용 중입니다',
      };
      return socket.emit('error', { message: messages[result.error] ?? '입장 오류' });
    }

    socket.data.roomId = roomId;
    socket.data.userId = userId;
    socket.data.username = username;
    socket.join(roomId);

    socket.emit('room_state', { room: result.room, myRole: result.role });
    io.to(roomId).emit('player_joined', { room: result.room });
    io.emit('room_list', getAllRooms());
  });

  // ── leave_room ─────────────────────────────────────────────
  socket.on('leave_room', () => {
    handleLeaveInternal(io, socket);
  });

  // ── start_game (방장이 게임 시작) ──────────────────────────
  socket.on('start_game', async ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) return socket.emit('error', { message: '방을 찾을 수 없습니다' });
    if (room.host !== socket.id) return socket.emit('error', { message: '방장만 시작할 수 있습니다' });
    if (room.phase !== 'waiting') return socket.emit('error', { message: '이미 게임이 시작됐습니다' });
    if (!room.proPlayer || !room.conPlayer) return socket.emit('error', { message: '플레이어가 2명 이상 필요합니다' });

    // manual 주제면 topic_selection 스킵 가능
    if (room.topicMode === 'manual' && room.topic) {
      io.to(roomId).emit('topic_set', { topic: room.topic, room: getRoomSerialized(roomId) });
      await startPhase(io, roomId, 'arguing');
    } else {
      await startPhase(io, roomId, 'topic_selection');
    }
  });

  // ── select_side (진영 선택) ────────────────────────────────
  socket.on('select_side', ({ roomId, side }) => {
    const room = getRoom(roomId);
    if (!room) return socket.emit('error', { message: '방을 찾을 수 없습니다' });
    if (room.phase !== 'topic_selection') return socket.emit('error', { message: '진영 선택 시간이 아닙니다' });

    const result = selectSide(roomId, socket.id, side);
    if (!result) return socket.emit('error', { message: '진영을 선택할 수 없습니다' });

    if (result.status === 'waiting') {
      io.to(roomId).emit('side_selection_update', { room: result.room });
    } else if (result.status === 'assigned' || result.status === 'random_assigned') {
      io.to(roomId).emit('sides_assigned', {
        random: result.status === 'random_assigned',
        room: result.room,
      });
      // 진영 확정 → 즉시 주제 생성 후 arguing 단계 진입 (타이머 기다리지 않음)
      clearPhaseTimer(roomId);
      handleTopicSelectionEnd(io, roomId).catch((e) =>
        console.error('[select_side] 조기 진행 실패:', e.message)
      );
    } else if (result.status === 'retry') {
      io.to(roomId).emit('side_selection_retry', {
        attempts: result.attempts,
        room: result.room,
      });
      const retryRoom = getRoom(roomId);
      if (retryRoom && retryRoom.topicMode === 'ai_auto') {
        setTopic(roomId, null);
        ;(async () => {
          try {
            const past = getPastTopics(roomId);
            const newTopic = await generateTopic(past);
            if (getRoom(roomId)?.phase === 'topic_selection') {
              setTopic(roomId, newTopic);
              io.to(roomId).emit('topic_set', { topic: newTopic, room: getRoomSerialized(roomId) });
            }
          } catch (e) {
            console.error('[AI] 재시도 주제 생성 실패:', e.message);
          }
        })();
      }
    }
  });

  // ── submit_content (콘텐츠 제출) ───────────────────────────
  socket.on('submit_content', ({ roomId, text, skip }) => {

    const room = getRoom(roomId);
    if (!room) return socket.emit('error', { message: '방을 찾을 수 없습니다' });

    const phase = room.phase;
    const phaseKeys = PHASE_SUBMIT_KEY[phase];
    if (!phaseKeys) return socket.emit('error', { message: '지금은 제출할 수 없습니다' });

    const role = getPlayerRole(roomId, socket.id);
    const contentKey = phaseKeys[role];
    if (!contentKey) return socket.emit('error', { message: '지금 당신의 차례가 아닙니다' });

    const trimmed = text?.trim?.() ?? '';
    const optionalPhases = new Set(['pro_a_defense', 'con_a_defense']);
    if (!trimmed && !(skip && optionalPhases.has(phase))) {
      return socket.emit('error', { message: '내용을 입력해주세요' });
    }

    setContent(roomId, contentKey, trimmed || null);
    io.to(roomId).emit('content_submitted', {
      phase,
      contentKey,
      room: getRoomSerialized(roomId),
    });

    // 조기 종료 체크
    if (phase === 'arguing') {
      checkArguingDone(io, roomId);
    } else if (phase === 'final_argument') {
      checkFinalDone(io, roomId);
    } else {
      // 단일 플레이어 제출 페이즈: 제출 즉시 다음으로
      const singlePlayerPhases = new Set([
        'pro_p_rebuttal', 'pro_p_counter',
        'con_p_rebuttal', 'con_p_counter',
        'pro_p_defense', 'con_p_defense',
        'pro_a_defense', 'con_a_defense',
      ]);
      if (singlePlayerPhases.has(phase)) {
        checkSinglePlayerDone(io, roomId, phase);
      }
    }
  });

  // ── disconnect ─────────────────────────────────────────────
  socket.on('disconnect', () => {
    handleLeaveInternal(io, socket);
  });
}
