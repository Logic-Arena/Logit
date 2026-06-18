import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRooms } from "../lib/api";
import { socket } from "../lib/socket";
import { RoomList } from "../components/lobby/RoomList";
import { UserTierWidget } from "../components/lobby/UserTierWidget";
import { CommunityVoteWidget } from "../components/lobby/CommunityVoteWidget";
import { CreateRoomModal } from "../pages/CreateRoomPage";
import { useSidebar } from "../hooks/useSidebar";
import { useUserStore } from "../store/useUserStore";
import type { Room } from "../types/room";

export function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { sidebarOpen, closeSidebar } = useSidebar();
  const navigate = useNavigate();
  const { isLoggedIn } = useUserStore();

  useEffect(() => {
    getRooms()
      .then(setRooms)
      .catch(console.error)
      .finally(() => setLoading(false));

    socket.connect();

    const onRoomList = (updatedRooms: Room[]) => setRooms(updatedRooms);
    socket.on("room_list", onRoomList);

    return () => {
      socket.off("room_list", onRoomList);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="lobby-layout">
      <div className={`lobby-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <UserTierWidget />
        <div className="lobby-sidebar__vote-widget">
          <CommunityVoteWidget />
        </div>
      </div>

      {sidebarOpen && (
        <div className="lobby-sidebar-backdrop" onClick={closeSidebar} />
      )}

      <div className="page lobby-page">
        <div className="lobby-actions">
          <div className="lobby-actions__left">
            <h1 className="page__title" style={{ margin: 0 }}>
              토론 목록
            </h1>
          </div>

          <button
            className="btn btn--primary"
            onClick={() => isLoggedIn ? setIsCreateModalOpen(true) : navigate("/login")}
          >
            + 새 방 만들기
          </button>
        </div>

        <div className="lobby-room-stage">
          {loading ? (
            <div className="loading">불러오는 중...</div>
          ) : (
            <RoomList rooms={rooms} />
          )}
        </div>
      </div>

      <div className="lobby-report">
        <CommunityVoteWidget />
      </div>

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
