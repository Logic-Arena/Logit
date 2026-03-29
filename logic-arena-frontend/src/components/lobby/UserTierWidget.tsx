function PillarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="20" width="20" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="10.5" y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="18" y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="2" y="3" width="20" height="3" rx="1" fill="currentColor" />
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
  tierProgress: number;
  nextTier: string;
  highScore: number;
  debateCount: number;
  winCount: number;
  badges: Badge[];
}

const MOCK_USER: UserStats = {
  name: 'Logit User',
  tier: 'Silver II',
  tierProgress: 62,
  nextTier: 'Silver I',
  highScore: 84,
  debateCount: 42,
  winCount: 27,
  badges: [
    { icon: 'T', label: '토론 참가자' },
    { icon: 'W', label: '승리 기록' },
    { icon: 'A', label: '활동 배지' },
  ],
};

export function UserTierWidget() {
  const user = MOCK_USER;
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <aside className="tier-widget">
      <div className="tier-widget__profile">
        <div className="tier-widget__avatar">{initial}</div>
        <div className="tier-widget__name">{user.name}</div>
      </div>

      <div className="tier-widget__tier-section">
        <div className="tier-widget__tier-row">
          <PillarIcon className="tier-widget__pillar-icon" />
          <span className="tier-widget__tier-name">{user.tier}</span>
        </div>
        <div className="tier-widget__progress-wrap">
          <div className="tier-widget__progress-fill" style={{ width: `${user.tierProgress}%` }} />
        </div>
        <div className="tier-widget__progress-labels">
          <span>{user.tier}</span>
          <span>{user.nextTier}</span>
        </div>
      </div>

      <div className="tier-widget__divider" />

      <div className="tier-widget__box tier-widget__box--wide">
        <div className="tier-widget__box-label">최고 점수</div>
        <div className="tier-widget__box-value">{user.highScore.toLocaleString()}</div>
      </div>

      <div className="tier-widget__box-row">
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">토론 수</div>
          <div className="tier-widget__box-value">{user.debateCount}</div>
        </div>
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">승리 수</div>
          <div className="tier-widget__box-value">{user.winCount}</div>
        </div>
      </div>

      <div className="tier-widget__divider" />

      <div className="tier-widget__badges-section">
        <div className="tier-widget__badges-label">Badges</div>
        <div className="tier-widget__badges">
          {user.badges.map((badge) => (
            <div key={badge.label} className="tier-widget__badge" title={badge.label}>
              {badge.icon}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
