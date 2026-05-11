import { useAuthStore } from '../../store/useAuthStore';

const TIERS = [
  { name: 'Bronze 5', min: 0 },
  { name: 'Bronze 4', min: 100 },
  { name: 'Bronze 3', min: 200 },
  { name: 'Bronze 2', min: 300 },
  { name: 'Bronze 1', min: 400 },
  { name: 'Silver 5', min: 500 },
  { name: 'Silver 4', min: 650 },
  { name: 'Silver 3', min: 800 },
  { name: 'Silver 2', min: 950 },
  { name: 'Silver 1', min: 1100 },
  { name: 'Gold 5', min: 1300 },
  { name: 'Gold 4', min: 1500 },
  { name: 'Gold 3', min: 1750 },
  { name: 'Gold 2', min: 2000 },
  { name: 'Gold 1', min: 2300 },
  { name: 'Platinum 5', min: 2600 },
  { name: 'Platinum 4', min: 3000 },
  { name: 'Platinum 3', min: 3500 },
  { name: 'Platinum 2', min: 4000 },
  { name: 'Platinum 1', min: 4600 },
  { name: 'Diamond', min: 5000 },
];

function getTierProgress(rankPoint: number) {
  let tierIndex = 0;
  for (let index = 0; index < TIERS.length; index += 1) {
    if (rankPoint >= TIERS[index].min) tierIndex = index;
    else break;
  }

  const current = TIERS[tierIndex];
  const next = TIERS[tierIndex + 1];
  if (!next) return { tierIndex, progress: 100 };

  const progress = Math.floor(((rankPoint - current.min) / (next.min - current.min)) * 100);
  return { tierIndex, progress };
}

function PillarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="20" width="20" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="10.5" y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="18" y="6" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="2" y="3" width="20" height="3" rx="1" fill="currentColor" />
      <path d="M2 3 L12 0 L22 3 Z" fill="currentColor" />
    </svg>
  );
}

function GuestWidget() {
  return (
    <aside className="tier-widget">
      <div className="tier-widget__profile">
        <div className="tier-widget__avatar">?</div>
        <div className="tier-widget__name">게스트</div>
      </div>
      <div className="tier-widget__divider" />
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '0 8px' }}>
        로그인하면 등급, 전적, 배지 정보를 함께 관리할 수 있습니다.
      </p>
    </aside>
  );
}

export function UserTierWidget() {
  const user = useAuthStore((state) => state.user);

  if (!user || !user.stats) return <GuestWidget />;

  const displayName = user.name ?? user.username ?? user.email ?? 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const { tierIndex, progress } = getTierProgress(user.stats.rank_point);
  const currentTierName = TIERS[tierIndex].name;
  const nextTierName = TIERS[tierIndex + 1]?.name ?? 'Top Tier';
  const badges = Array.isArray(user.stats.badges) ? (user.stats.badges as Array<{ icon?: string; label: string }>) : [];

  return (
    <aside className="tier-widget">
      <div className="tier-widget__profile">
        {user.profile_image ? (
          <img className="tier-widget__avatar tier-widget__avatar--img" src={user.profile_image} alt={displayName} />
        ) : (
          <div className="tier-widget__avatar">{initial}</div>
        )}
        <div className="tier-widget__name">{displayName}</div>
      </div>

      <div className="tier-widget__tier-section">
        <div className="tier-widget__tier-row">
          <PillarIcon className="tier-widget__pillar-icon" />
          <span className="tier-widget__tier-name">{currentTierName}</span>
        </div>
        <div className="tier-widget__progress-wrap">
          <div className="tier-widget__progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="tier-widget__progress-labels">
          <span>{currentTierName}</span>
          <span>{nextTierName}</span>
        </div>
      </div>

      <div className="tier-widget__divider" />

      <div className="tier-widget__box tier-widget__box--wide">
        <div className="tier-widget__box-label">랭크 포인트</div>
        <div className="tier-widget__box-value">{user.stats.rank_point.toLocaleString()}</div>
      </div>

      <div className="tier-widget__box-row">
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">총 토론 수</div>
          <div className="tier-widget__box-value">{user.stats.total_games}</div>
        </div>
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">승리 수</div>
          <div className="tier-widget__box-value">{user.stats.win_count}</div>
        </div>
      </div>

      {badges.length > 0 && (
        <>
          <div className="tier-widget__divider" />
          <div className="tier-widget__badges-section">
            <div className="tier-widget__badges-label">Badges</div>
            <div className="tier-widget__badges">
              {badges.map((badge) => (
                <div key={badge.label} className="tier-widget__badge" title={badge.label}>
                  {badge.icon ?? badge.label.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
