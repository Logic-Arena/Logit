import { useUserStore } from '../../store/useUserStore';

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
  const user = useUserStore((s) => s.user);

  if (!user) return <GuestWidget />;

  const initial = user.name.charAt(0).toUpperCase();
  const tier = user.tier ?? '브론즈 5';
  const tierRank = user.tierRank ?? 0;
  const nextTier = user.nextTier ?? '—';
  const scoreAverage = user.scoreAverage ?? 0;
  const debateCount = user.debateCount ?? 0;
  const winCount = user.winCount ?? 0;
  const badges = user.badges ?? [];

  return (
    <aside className="tier-widget">
      <div className="tier-widget__profile">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={`${user.name} 프로필`} className="tier-widget__avatar-img" />
        ) : (
          <div className="tier-widget__avatar">{initial}</div>
        )}
        <div className="tier-widget__name">{user.name}</div>
      </div>

      <div className="tier-widget__tier-section">
        <div className="tier-widget__tier-row">
          <PillarIcon className="tier-widget__pillar-icon" />
          <span className="tier-widget__tier-name">{tier}</span>
        </div>
        <div className="tier-widget__progress-wrap">
          <div
            className="tier-widget__progress-fill"
            style={{ width: `${tierRank}%` }}
          />
        </div>
        <div className="tier-widget__progress-labels">
          <span>{tier}</span>
          <span>{nextTier}</span>
        </div>
      </div>

      <div className="tier-widget__box-row">
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">평균점수</div>
          <div className="tier-widget__box-value">{scoreAverage.toLocaleString()}</div>
        </div>
        <div className="tier-widget__stat-divider" />
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">토론횟수</div>
          <div className="tier-widget__box-value">{debateCount}</div>
        </div>
        <div className="tier-widget__stat-divider" />
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">이긴횟수</div>
          <div className="tier-widget__box-value">{winCount}</div>
        </div>
      </div>

      {badges.length > 0 && (
        <>
          <div className="tier-widget__divider" />
          <div className="tier-widget__badges-section">
            <div className="tier-widget__badges-label">획득배지</div>
            <div className="tier-widget__badges">
              {badges.map((b) => (
                <div key={b.label} className="tier-widget__badge" title={b.label}>
                  {b.icon}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

export { TIERS };
