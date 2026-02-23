import { v4 as uuidv4 } from 'uuid';
import {
  addUserToRoom,
  removeUserFromRoom,
  startDebate,
  castVote,
  getAllRooms,
  getRoom,
  resetVotes,
  setTopic,
  addAiMessage,
  getAiHistory,
  addPastTopic,
  getPastTopics,
} from '../store/rooms.js';
import { generateTopic, generateAiResponse } from '../services/ai.js';

function handleLeaveRoomInternal(io, socket) {
  const { roomId } = socket.data;
  if (!roomId) return;

  const result = removeUserFromRoom(roomId, socket.id);
  if (!result) return;

  socket.data.roomId = null;
  socket.leave(roomId);

  const { user, room, newHostSocketId } = result;

  if (room === null) {
    io.emit('room_list', getAllRooms());
    return;
  }

  io.to(roomId).emit('user_left', { user, room });

  if (newHostSocketId) {
    io.to(roomId).emit('host_changed', { newHostSocketId });
  }
}

export function registerHandlers(io, socket) {
  socket.on('join_room', ({ roomId, userId, username, userRole }) => {
    if (socket.data.roomId && socket.data.roomId !== roomId) {
      handleLeaveRoomInternal(io, socket);
    }

    const room = addUserToRoom(roomId, socket.id, { userId, username, userRole });
    if (!room) {
      return socket.emit('error', { message: '방을 찾을 수 없습니다' });
    }

    socket.data.roomId = roomId;
    socket.data.userId = userId;
    socket.data.username = username;
    socket.join(roomId);

    socket.emit('room_state', { room });
    io.to(roomId).emit('user_joined', { user: room.users[socket.id], room });
  });

  socket.on('leave_room', ({ roomId }) => {
    if (socket.data.roomId !== roomId) return;
    handleLeaveRoomInternal(io, socket);
  });

  socket.on('start_debate', async ({ roomId }) => {
    if (socket.data.roomId !== roomId) {
      return socket.emit('error', { message: '해당 방에 입장하지 않았습니다' });
    }

    const room = getRoom(roomId);
    if (!room) return socket.emit('error', { message: '방을 찾을 수 없습니다' });
    if (room.phase !== 'waiting') return socket.emit('error', { message: '이미 토론이 시작되었습니다' });

    const myUser = room.users[socket.id];
    if (!myUser || myUser.userRole !== 'host') {
      return socket.emit('error', { message: '방장만 시작할 수 있습니다' });
    }

    let topicOverride = null;
    if (room.mode === 'ai_debate') {
      const pastTopics = getPastTopics(roomId);
      try {
        topicOverride = await generateTopic(pastTopics);
      } catch (err) {
        console.error('[Gemini] Topic generation failed:', err);
        return socket.emit('error', { message: 'AI 주제 추천에 실패했습니다' });
      }
    }

    const result = startDebate(roomId, socket.id, topicOverride);
    if (!result) {
      return socket.emit('error', { message: '토론을 시작할 수 없습니다' });
    }

    io.to(roomId).emit('debate_started', { topic: result.topic, phase: 'voting' });
  });

  socket.on('cast_vote', async ({ roomId, vote }) => {
    if (socket.data.roomId !== roomId) {
      return socket.emit('error', { message: '해당 방에 입장하지 않았습니다' });
    }

    const result = castVote(roomId, socket.id, vote);
    if (!result) {
      return socket.emit('error', { message: '투표할 수 없습니다' });
    }

    io.to(roomId).emit('vote_updated', result);

    // AI mode: check team composition when all humans have voted
    const room = getRoom(roomId);
    if (room && room.mode === 'ai_debate') {
      const humanUsers = Object.values(room.users).filter((u) => u.userRole !== 'observer');
      const allVoted = humanUsers.every((u) => u.vote !== null);

      if (allVoted) {
        const proCount = humanUsers.filter((u) => u.vote === 'pro').length;
        const conCount = humanUsers.filter((u) => u.vote === 'con').length;

        // Team composition invalid (both same side)
        if (proCount !== 1 || conCount !== 1) {
          const currentTopic = room.topic;
          addPastTopic(roomId, currentTopic);
          const pastTopics = getPastTopics(roomId);

          try {
            const newTopic = await generateTopic(pastTopics);
            setTopic(roomId, newTopic);
            resetVotes(roomId);
            io.to(roomId).emit('topic_updated', { topic: newTopic });
          } catch (err) {
            console.error('[Gemini] Topic re-generation failed:', err);
            socket.emit('error', { message: '새 주제 추천에 실패했습니다' });
          }
        }
      }
    }
  });

  socket.on('send_message', async ({ roomId, content }) => {
    if (socket.data.roomId !== roomId) {
      return socket.emit('error', { message: '해당 방에 입장하지 않았습니다' });
    }

    const room = getRoom(roomId);
    if (!room) return socket.emit('error', { message: '방을 찾을 수 없습니다' });

    if (room.phase === 'waiting') {
      return socket.emit('error', { message: '토론이 시작되지 않았습니다' });
    }

    const user = room.users[socket.id];
    if (!user) return socket.emit('error', { message: '방에 입장하지 않았습니다' });

    if (user.userRole === 'observer') {
      return socket.emit('error', { message: '관전자는 채팅할 수 없습니다' });
    }
    if (user.vote === null) {
      return socket.emit('error', { message: '투표 후 채팅이 가능합니다' });
    }

    const message = {
      id: uuidv4(),
      userId: user.userId,
      username: user.username,
      userRole: user.userRole,
      vote: user.vote,
      content,
      timestamp: new Date(),
    };

    io.to(roomId).emit('new_message', { message });

    // AI mode: generate AI response from the same team
    if (room.mode === 'ai_debate') {
      const senderVote = user.vote;
      const aiHistory = getAiHistory(roomId);

      addAiMessage(roomId, { username: user.username, content, vote: senderVote });

      try {
        const aiContent = await generateAiResponse({
          topic: room.topic,
          vote: senderVote,
          chatHistory: aiHistory,
          triggerMessage: content,
        });

        const aiUsername = senderVote === 'pro' ? 'AI (찬성)' : 'AI (반대)';
        const aiMessage = {
          id: uuidv4(),
          userId: `ai_${senderVote}`,
          username: aiUsername,
          userRole: 'ai',
          vote: senderVote,
          content: aiContent,
          timestamp: new Date(),
        };

        addAiMessage(roomId, { username: aiUsername, content: aiContent, vote: senderVote });
        io.to(roomId).emit('new_message', { message: aiMessage });
      } catch (err) {
        console.error('[Gemini] AI response generation failed:', err);
      }
    }
  });

  socket.on('disconnect', () => {
    handleLeaveRoomInternal(io, socket);
  });
}
