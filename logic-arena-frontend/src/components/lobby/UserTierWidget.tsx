/* UserTierWidget ─────────────────────────────────────────
   로비 사이드바에 표시되는 사용자 티어 & 성과 위젯
   (실제 유저 데이터 기반 - useUserStore)
───────────────────────────────────────────────────────────── */

import { useUserStore } from '../../store/useUserStore';

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

export function UserTierWidget() {
  const user = useUserStore((s) => s.user);

  // 유저 데이터가 없으면 스켈레톤 표시
  if (!user) {
    return (
      <aside className="tier-widget">
        <div className="tier-widget__skeleton" aria-label="유저 정보 로딩 중" />
      </aside>
    );
  }

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

      <div className="tier-widget__divider" />

      <div className="tier-widget__box tier-widget__box--wide">
        <div className="tier-widget__box-label">평균점수</div>
        <div className="tier-widget__box-value">{scoreAverage.toLocaleString()}</div>
      </div>

      <div className="tier-widget__box-row">
        <div className="tier-widget__box">
          <div className="tier-widget__box-label">토론횟수</div>
          <div className="tier-widget__box-value">{debateCount}</div>
        </div>
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
