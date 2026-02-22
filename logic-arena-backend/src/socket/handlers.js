import { v4 as uuidv4 } from 'uuid';
import {
  addUserToRoom,
  removeUserFromRoom,
  startDebate,
  castVote,
  getAllRooms,
  getRoom,
} from '../store/rooms.js';

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

  socket.on('start_debate', ({ roomId }) => {
    if (socket.data.roomId !== roomId) {
      return socket.emit('error', { message: '해당 방에 입장하지 않았습니다' });
    }

    const result = startDebate(roomId, socket.id);
    if (!result) {
      const room = getRoom(roomId);
      if (!room) return socket.emit('error', { message: '방을 찾을 수 없습니다' });
      if (room.phase !== 'waiting') return socket.emit('error', { message: '이미 토론이 시작되었습니다' });
      return socket.emit('error', { message: '방장만 시작할 수 있습니다' });
    }

    io.to(roomId).emit('debate_started', { topic: result.topic, phase: 'voting' });
  });

  socket.on('cast_vote', ({ roomId, vote }) => {
    if (socket.data.roomId !== roomId) {
      return socket.emit('error', { message: '해당 방에 입장하지 않았습니다' });
    }

    const result = castVote(roomId, socket.id, vote);
    if (!result) {
      return socket.emit('error', { message: '투표할 수 없습니다' });
    }

    io.to(roomId).emit('vote_updated', result);
  });

  socket.on('send_message', ({ roomId, content }) => {
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

    if (user.userRole !== 'observer' && user.vote === null) {
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
  });

  socket.on('disconnect', () => {
    handleLeaveRoomInternal(io, socket);
  });
}
