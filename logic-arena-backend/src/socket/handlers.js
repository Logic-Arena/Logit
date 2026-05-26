import {
  addPlayerToRoom,
  removePlayerFromRoom,
  getAllRooms,
  getRoom,
  getRoomSerialized,
  getPlayerRole,
  setPhase,
  setPhaseEndAt,
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
  bumpTopicGenerationSeq,
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

import { updateStats, saveDebateHistory } from '../services/statsService.js';

// ── Timer helpers ─────────────────────────────────────────────

function clearPhaseTimer(roomId) {
  const t = phaseTimers.get(roomId);
  if (t) { clearTimeout(t); phaseTimers.delete(roomId); }
}

function pausePhaseTimer(roomId) {
  clearPhaseTimer(roomId);
  setPhaseEndAt(roomId, null);
}

function startPhaseTimer(io, roomId, phase) {
  const duration = PHASE_DURATION_MS[phase];
  if (!duration) return false;

  clearPhaseTimer(roomId);
  setPhaseEndAt(roomId, Date.now() + duration);
  const timer = setTimeout(() => advancePhase(io, roomId), duration);
  phaseTimers.set(roomId, timer);
  return true;
}

async function generateAndApplyTopic(io, roomId, { emit = true } = {}) {
  const generationSeq = bumpTopicGenerationSeq(roomId);
  if (generationSeq === null) return null;

  try {
    const past = getPastTopics(roomId);
    const generatedTopic = await generateTopic(past);
    const { topic, source } = generatedTopic;
    const currentRoom = getRoom(roomId);
    if (
      !currentRoom ||
      currentRoom.phase !== 'topic_selection' ||
      currentRoom.topicGenerationSeq !== generationSeq
    ) {
      return null;
    }

    setTopic(roomId, topic, source);
    addPastTopic(roomId, topic);
    startPhaseTimer(io, roomId, 'topic_selection');
    const serialized = getRoomSerialized(roomId);
    if (emit) {
      io.to(roomId).emit('topic_set', { topic, room: serialized });
    }
    return generatedTopic;
  } catch (e) {
    console.error('[AI] 주제 생성 실패:', e.message);
    return null;
  }
}

async function startPhase(io, roomId, phase) {
  const room = getRoom(roomId);
  if (!room) return;

  setPhase(roomId, phase);
  const waitsForAiTopic = phase === 'topic_selection' && room.topicMode === 'ai_auto';
  if (waitsForAiTopic) {
    pausePhaseTimer(roomId);
  } else {
    startPhaseTimer(io, roomId, phase);
  }

  const serialized = getRoomSerialized(roomId);
  io.to(roomId).emit('phase_changed', { phase, room: serialized });

  if (phase === 'ended') return;

  const isHumanMode = room.mode === 'human_debate';

  if (isHumanMode) {
    // 인간 vs 인간: coaching과 judging만 AI 사용
    if (phase === 'coaching' || phase === 'judging') {
      handleAiAutoPhase(io, roomId, phase).catch((e) =>
        console.error(`[AI] ${phase} 생성 실패:`, e.message)
      );
    }
  } else {
    // ai_debate: 기존 로직 그대로
    if (AI_AUTO_PHASES.has(phase)) {
      handleAiAutoPhase(io, roomId, phase).catch((e) =>
        console.error(`[AI] ${phase} 자동 생성 실패:`, e.message)
      );
    }
    if (AI_DEFENSE_PHASES.has(phase)) {
      handleAiDefense(io, roomId, phase).catch((e) =>
        console.error(`[AI] ${phase} 변론 자동 생성 실패:`, e.message)
      );
    }
    if (phase === 'arguing') {
      handleAiArguing(io, roomId).catch((e) =>
        console.error('[AI] arguing 자동 생성 실패:', e.message)
      );
    }
  }

  // topic_selection 시작 즉시 주제 생성 (ai_auto) — 35초 타이머 기다리지 않음
  if (phase === 'topic_selection' && room.topicMode === 'ai_auto') {
    generateAndApplyTopic(io, roomId).catch((e) =>
      console.error('[AI] topic_selection 주제 생성 실패:', e.message)
    );
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

  const next = getNextPhase(room.phase, room.mode);
  await startPhase(io, roomId, next);
}

async function handleTopicSelectionEnd(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.phase !== 'topic_selection') return;

  // 주제 생성 (ai_auto인 경우)
  if (!room.topic && room.topicMode === 'ai_auto') {
    await generateAndApplyTopic(io, roomId, { emit: false });
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
  // 사람 플레이어가 모두 제출한 후에 공개 (checkArguingDone에서 emit)
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
    case 'coaching': {
      const coachingResult = await generateCoaching({ topic: room.topic, content: c });
      if (getRoom(roomId)) {
        setContent(roomId, 'coaching_pro', coachingResult.pro);
        setContent(roomId, 'coaching_con', coachingResult.con);
        io.to(roomId).emit('ai_content', {
          coaching_pro: coachingResult.pro,
          coaching_con: coachingResult.con,
          room: getRoomSerialized(roomId),
        });
        clearPhaseTimer(roomId);
        await advancePhase(io, roomId);
      }
      return;
    }
    case 'judging': {
      const result = await judgeDebate({ topic: room.topic, content: room.content, mode: room.mode });
      setResult(roomId, result);
      const participants = [];
      if (room.proPlayer) participants.push({ userId: room.proPlayer.userId, vote: 'pro' });
      if (room.conPlayer) participants.push({ userId: room.conPlayer.userId, vote: 'con' });
      await updateStats(participants, result.winner).catch((e) => console.error('[judging] updateStats 실패:', e.message));
      await saveDebateHistory(participants, result, room.topic).catch((e) => console.error('[judging] saveDebateHistory 실패:', e.message));
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
    // 사람이 이미 변론을 제출한 경우에만 AI 변론 공개 (사람 먼저, AI 나중)
    const playerKey = contentKey.replace('_ai', '_player');
    const currentRoom = getRoom(roomId);
    if (currentRoom?.content[playerKey]) {
      io.to(roomId).emit('ai_content', { [contentKey]: content, room: getRoomSerialized(roomId) });
    }
    // 사람이 아직 미제출이면 submit_content 핸들러에서 공개
  }
}

// ── Early advance checks ──────────────────────────────────────

function checkArguingDone(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.phase !== 'arguing') return;
  const c = room.content;
  const isHumanMode = room.mode === 'human_debate';

  if (isHumanMode) {
    if (c.pro_argument && c.con_argument) {
      advancePhase(io, roomId);
    }
  } else {
    const humanDone = c.pro_argument && c.con_argument;
    const aiDone = c.pro_ai_argument && c.con_ai_argument;
    if (humanDone && aiDone) {
      io.to(roomId).emit('ai_content', {
        pro_ai_argument: c.pro_ai_argument,
        con_ai_argument: c.con_ai_argument,
        room: getRoomSerialized(roomId),
      });
      advancePhase(io, roomId);
    }
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

// 페이즈 → 단계 번호 (2 이하: 단순 승패, 3 이상: 부분 리포트 생성)
const PHASE_STAGE = {
  topic_selection: 1, arguing: 2,
  pro_p_rebuttal: 3, pro_p_defense: 3, pro_p_counter: 3,
  con_p_rebuttal: 4, con_p_defense: 4, con_p_counter: 4,
  pro_a_rebuttal: 5, pro_a_defense: 5, pro_a_counter: 5,
  con_a_rebuttal: 6, con_a_defense: 6, con_a_counter: 6,
  coaching: 7, final_argument: 7, judging: 8,
};

async function handleLeaveInternal(io, socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = getRoom(roomId);
  const phase = room?.phase;

  // 퇴장자의 진영 및 상대방 승리 여부 파악 (removePlayerFromRoom 전에)
  const leaverIsPro = room?.proPlayer?.socketId === socket.id;
  const leaverIsCon = room?.conPlayer?.socketId === socket.id;
  const winnerVote = leaverIsPro ? 'con' : leaverIsCon ? 'pro' : null;

  const result = removePlayerFromRoom(roomId, socket.id);
  socket.data.roomId = null;
  socket.leave(roomId);

  if (!result) return;
  const { room: updatedRoom } = result;

  const stage = PHASE_STAGE[phase] ?? 0;
  const isActiveGame = stage > 0 && winnerVote !== null;

  if (isActiveGame) {
    clearPhaseTimer(roomId);

    const participants = [];
    if (room.proPlayer) participants.push({ userId: room.proPlayer.userId, vote: 'pro' });
    if (room.conPlayer) participants.push({ userId: room.conPlayer.userId, vote: 'con' });

    if (stage <= 2) {
      // 2단계 이하: 단순 승패만 처리, 리포트 없음
      const earlyResult = {
        winner: winnerVote,
        summary: '상대방이 퇴장하여 게임이 조기 종료되었습니다.',
        scores: [],
      };
      if (updatedRoom) setResult(roomId, earlyResult);
      await updateStats(participants, earlyResult.winner).catch((e) => console.error('[earlyExit] updateStats 실패:', e.message));
      await saveDebateHistory(participants, earlyResult, room.topic ?? '').catch((e) => console.error('[earlyExit] saveDebateHistory 실패:', e.message));
      io.to(roomId).emit('debate_ended', { result: earlyResult, room: getRoomSerialized(roomId) });
      if (updatedRoom) await startPhase(io, roomId, 'ended');
    } else {
      // 3단계 이상: 현재까지 내용으로 부분 리포트 생성
      try {
        const judgeResult = await judgeDebate({ topic: room.topic ?? '', content: room.content, mode: room.mode });
        judgeResult.winner = winnerVote; // 퇴장자는 무조건 패배
        if (updatedRoom) setResult(roomId, judgeResult);
        await updateStats(participants, judgeResult.winner).catch((e) => console.error('[earlyExit-judge] updateStats 실패:', e.message));
        await saveDebateHistory(participants, judgeResult, room.topic ?? '').catch((e) => console.error('[earlyExit-judge] saveDebateHistory 실패:', e.message));
        io.to(roomId).emit('debate_ended', { result: judgeResult, room: getRoomSerialized(roomId) });
        if (updatedRoom) await startPhase(io, roomId, 'ended');
      } catch (e) {
        console.error('[EarlyExit] 판정 실패:', e.message);
        const fallback = {
          winner: winnerVote,
          summary: '상대방이 퇴장하여 게임이 종료되었습니다.',
          scores: [],
        };
        if (updatedRoom) setResult(roomId, fallback);
        await updateStats(participants, fallback.winner).catch((e) => console.error('[earlyExit-fallback] updateStats 실패:', e.message));
        await saveDebateHistory(participants, fallback, room.topic ?? '').catch((e) => console.error('[earlyExit-fallback] saveDebateHistory 실패:', e.message));
        io.to(roomId).emit('debate_ended', { result: fallback, room: getRoomSerialized(roomId) });
        if (updatedRoom) await startPhase(io, roomId, 'ended');
      }
    }

    io.emit('room_list', getAllRooms());
    return;
  }

  if (!updatedRoom) {
    clearPhaseTimer(roomId);
    io.emit('room_list', getAllRooms());
    return;
  }

  io.to(roomId).emit('player_left', { room: updatedRoom });
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
    if (!room.topic) return socket.emit('error', { message: 'AI가 주제를 생성 중입니다. 잠시만 기다려 주세요.' });

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
      const retryRoom = getRoom(roomId);
      if (retryRoom && retryRoom.topicMode === 'ai_auto') {
        addPastTopic(roomId, retryRoom.topic);
        setTopic(roomId, null);
        pausePhaseTimer(roomId);
        io.to(roomId).emit('side_selection_retry', {
          attempts: result.attempts,
          room: getRoomSerialized(roomId),
        });
        generateAndApplyTopic(io, roomId).catch((e) =>
          console.error('[AI] 재시도 주제 생성 실패:', e.message)
        );
      } else {
        io.to(roomId).emit('side_selection_retry', {
          attempts: result.attempts,
          room: result.room,
        });
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
        // 변론 페이즈: AI가 이미 생성 완료했으면 지금 공개 (사람 제출 후 AI 순서)
        const defensePhases = new Set(['pro_p_defense', 'con_p_defense', 'pro_a_defense', 'con_a_defense']);
        if (defensePhases.has(phase)) {
          const aiKey = contentKey.replace('_player', '_ai');
          const updatedRoom = getRoom(roomId);
          if (updatedRoom?.content[aiKey]) {
            io.to(roomId).emit('ai_content', { [aiKey]: updatedRoom.content[aiKey], room: getRoomSerialized(roomId) });
          }
        }
        checkSinglePlayerDone(io, roomId, phase);
      }
    }
  });

  // ── disconnect ─────────────────────────────────────────────
  socket.on('disconnect', () => {
    handleLeaveInternal(io, socket);
  });
}
