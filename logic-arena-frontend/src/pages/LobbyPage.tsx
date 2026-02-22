import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRooms } from '../lib/api';
import { socket } from '../lib/socket';
import { RoomList } from '../components/lobby/RoomList';
import type { Room } from '../types/room';

export function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getRooms()
      .then(setRooms)
      .catch(console.error)
      .finally(() => setLoading(false));

    socket.connect();

    const onRoomList = (updatedRooms: Room[]) => setRooms(updatedRooms);
    socket.on('room_list', onRoomList);

    return () => {
      socket.off('room_list', onRoomList);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="page lobby-page">
      <div className="lobby-actions">
        <h1 className="page__title" style={{ margin: 0 }}>토론 목록</h1>
        <button className="btn btn--primary" onClick={() => navigate('/rooms/new')}>
          + 새 방 만들기
        </button>
      </div>

      {loading ? (
        <div className="loading">불러오는 중...</div>
      ) : (
        <RoomList rooms={rooms} />
      )}
    </div>
  );
}
