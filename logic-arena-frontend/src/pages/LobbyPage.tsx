import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRooms } from '../lib/api';
import { socket } from '../lib/socket';
import { RoomList } from '../components/lobby/RoomList';
import { UserTierWidget } from '../components/lobby/UserTierWidget';
import { LogicReportWidget } from '../components/lobby/LogicReportWidget';
import { useSidebar } from '../context/SidebarContext';
import type { Room } from '../types/room';

export function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const { sidebarOpen, closeSidebar } = useSidebar();
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
    <div className="lobby-layout">
      {/* 데스크탑: 고정 사이드바 / 모바일: 드로어 */}
      <div className={`lobby-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        <UserTierWidget />
      </div>

      {/* 모바일 배경 오버레이 - 클릭 시 사이드바 닫힘 */}
      {sidebarOpen && (
        <div
          className="lobby-sidebar-backdrop"
          onClick={closeSidebar}
        />
      )}

      <div className="page lobby-page">
        <div className="lobby-actions">
          <div className="lobby-actions__left">
            <h1 className="page__title" style={{ margin: 0 }}>토론 목록</h1>
          </div>
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

      {/* 오른쪽: 논리 성장 리포트 */}
      <div className="lobby-report">
        <LogicReportWidget />
      </div>
    </div>
  );
}
