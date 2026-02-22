import { v4 as uuidv4 } from 'uuid';
import { MAX_PARTICIPANTS } from '../config.js';
import { pickRandomTopic } from '../topics.js';

const rooms = new Map();

function getActiveCount(room) {
  let count = 0;
  for (const user of room.users.values()) {
    if (user.userRole !== 'observer') count++;
  }
  return count;
}

function getHostSocketId(room) {
  for (const [socketId, user] of room.users.entries()) {
    if (user.userRole === 'host') return socketId;
  }
  return null;
}

function serializeRoom(room) {
  return {
    ...room,
    users: Object.fromEntries(room.users),
  };
}

export function createRoom({ title }) {
  const id = uuidv4();
  const room = {
    id,
    title,
    topic: null,
    phase: 'waiting',
    createdAt: new Date(),
    users: new Map(),
  };
  rooms.set(id, room);
  return serializeRoom(room);
}

export function getAllRooms() {
  return Array.from(rooms.values()).map(serializeRoom);
}

export function getRoom(roomId) {
  const room = rooms.get(roomId);
  return room ? serializeRoom(room) : null;
}

export function addUserToRoom(roomId, socketId, { userId, username, userRole }) {
  const room = rooms.get(roomId);
  if (!room) return null;

  let resolvedRole = userRole;

  if (resolvedRole === 'host' && getHostSocketId(room) !== null) {
    resolvedRole = 'participant';
  }

  if (
    (resolvedRole === 'host' || resolvedRole === 'participant') &&
    getActiveCount(room) >= MAX_PARTICIPANTS
  ) {
    resolvedRole = 'observer';
  }

  room.users.set(socketId, {
    userId,
    username,
    userRole: resolvedRole,
    vote: null,
  });

  return serializeRoom(room);
}

export function removeUserFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const user = room.users.get(socketId);
  if (!user) return null;

  room.users.delete(socketId);

  if (room.users.size === 0) {
    rooms.delete(roomId);
    return { user, room: null, newHostSocketId: null };
  }

  let newHostSocketId = null;

  if (user.userRole === 'host') {
    for (const [sid, u] of room.users.entries()) {
      if (u.userRole === 'participant') {
        u.userRole = 'host';
        newHostSocketId = sid;
        break;
      }
    }
  }

  return { user, room: serializeRoom(room), newHostSocketId };
}

export function startDebate(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const user = room.users.get(socketId);
  if (!user || user.userRole !== 'host') return null;
  if (room.phase !== 'waiting') return null;

  room.topic = pickRandomTopic();
  room.phase = 'voting';

  return { topic: room.topic, room: serializeRoom(room) };
}

export function castVote(roomId, socketId, vote) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const user = room.users.get(socketId);
  if (!user) return null;
  if (user.userRole === 'observer') return null;
  if (room.phase !== 'voting') return null;

  user.vote = vote;

  let pro = 0;
  let con = 0;
  for (const u of room.users.values()) {
    if (u.vote === 'pro') pro++;
    else if (u.vote === 'con') con++;
  }

  return { pro, con, socketId, vote };
}
