import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getRooms } from '../lib/api';
import { socket } from '../lib/socket';
import { RoomList } from '../components/lobby/RoomList';
import type { Room } from '../types/room';

export function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  const handleKakaoLogin = () => {
    window.location.href = 'http://localhost:4000/auth/kakao';
  };

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
        <h1 className="page__title" style={{ margin: 0 }}>
          토론 목록
        </h1>

        <div className="lobby-actions__controls">
          <button className="btn btn--primary" onClick={() => navigate('/rooms/new')}>
            + 방 만들기
          </button>
          <Link className="btn btn--ghost" to="/auth/login">
            자체 로그인
          </Link>
          <Link className="btn btn--ghost" to="/auth/signup">
            회원가입
          </Link>
          <button className="btn btn--ghost" onClick={handleGoogleLogin}>
            구글 로그인
          </button>
          <button className="btn btn--ghost" onClick={handleKakaoLogin}>
            카카오 로그인
          </button>
        </div>
      </div>

      {loading ? <div className="loading">불러오는 중...</div> : <RoomList rooms={rooms} />}
    </div>
  );
}
