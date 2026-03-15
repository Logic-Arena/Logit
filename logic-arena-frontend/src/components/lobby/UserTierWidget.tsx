/* ── UserTierWidget ─────────────────────────────────────────
   로비 사이드바에 표시되는 사용자 티어 & 성과 위젯
   (Mock Data 기반)
───────────────────────────────────────────────────────────── */

// ── Pillar SVG (신전 기둥) ────────────────────────────────────
function PillarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 기단 */}
      <rect x="2" y="20" width="20" height="2" rx="1" fill="currentColor" />
      {/* 기둥 3개 */}
      <rect x="3"  y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="10.5" y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="18" y="6" width="3" height="14" rx="1" fill="currentColor" />
      {/* 엔타블라처 */}
      <rect x="2" y="3" width="20" height="3" rx="1" fill="currentColor" />
      {/* 페디먼트 (삼각형) */}
      <path d="M2 3 L12 0 L22 3 Z" fill="currentColor" />
    </svg>
  );
}

interface Badge {
  icon: string;
  label: string;
}

interface UserStats {
  name: string;
  tier: string;
  tierRank: number;   // 현재 티어 내 포인트 (0~100)
  nextTier: string;
  highScore: number;  // 최고점
  winRate: number;    // %
  debateCount: number;
  winCount: number;
  badges: Badge[];
}

// ── Mock Data ────────────────────────────────────────────────
const MOCK_USER: UserStats = {
  name: 'Logit User',
  tier: 'Silver II',
  tierRank: 62,
  nextTier: 'Silver I',
  highScore: 84,
  winRate: 65,
  debateCount: 42,
  winCount: 27,
  badges: [
    { icon: '🔥', label: '열정 토론가' },
    { icon: '🎯', label: '논리 명수'  },
    { icon: '⚡', label: '속전속결'   },
  ],
};

// ── Component ────────────────────────────────────────────────
export function UserTierWidget() {
  const user = MOCK_USER;
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <aside className="tier-widget">
      {/* 프로필 — 상단 중앙 */}
      <div className="tier-widget__profile">
        <div className="tier-widget__avatar">{initial}</div>
        <div className="tier-widget__name">{user.name}</div>
      </div>

      {/* 티어 섹션 박스 */}
      <div className="tier-widget__tier-section">
        <div className="tier-widget__tier-row">
          <PillarIcon className="tier-widget__pillar-icon" />
          <span className="tier-widget__tier-name">{user.tier}</span>
        </div>
        {/* 티어 진행 바 */}
        <div className="tier-widget__progress-wrap">
          <div
            className="tier-widget__progress-fill"
            style={{ width: `${user.tierRank}%` }}
          />
        </div>
        <div className="tier-widget__progress-labels">
          <span>{user.tier}</span>
          <span>{user.nextTier}</span>
        </div>
      </div>

      {/* 구분선 */}
      <div className="tier-widget__divider" />

      {/* 데이터 박스 — 최고점 (wide) */}
      <div className="tier-widget__box tier-widget__box--wide">
        <div className="tier-widget__box-label">최고점</div>
        <div className="tier-widget__box-value">{user.highScore.toLocaleString()}</div>
      </div>

      {/* 데이터 박스 — 토론횟수 + 이긴횟수 (2열) */}
      <div className="tier-widget__box-row">
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">토론횟수</div>
          <div className="tier-widget__box-value">{user.debateCount}</div>
        </div>
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">이긴횟수</div>
          <div className="tier-widget__box-value">{user.winCount}</div>
        </div>
      </div>

      {/* 구분선 */}
      <div className="tier-widget__divider" />

      {/* 배지 */}
      <div className="tier-widget__badges-section">
        <div className="tier-widget__badges-label">획득배지</div>
        <div className="tier-widget__badges">
          {user.badges.map((b) => (
            <div key={b.label} className="tier-widget__badge" title={b.label}>
              {b.icon}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
