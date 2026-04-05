import { useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { AnalyticsDashboardSection, AnalyticsHistorySection } from './AnalyticsPage';
import styles from './MyPage.module.css';

type Tab = 'dashboard' | 'history';

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

export function MyPage() {
  const user = useUserStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  if (!user) {
    return (
      <div className={styles.myPage}>
        <div className={styles.container}>
          <div className={styles.skeleton} />
        </div>
      </div>
    );
  }

  const tier = user.tier ?? '브론즈 5';
  const tierRank = user.tierRank ?? 0;
  const nextTier = user.nextTier ?? '—';
  const debateCount = user.debateCount ?? 0;
  const winCount = user.winCount ?? 0;
  const winRate = debateCount > 0 ? Math.round((winCount / debateCount) * 100) : 0;
  const badges = user.badges ?? [];
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <div className={styles.myPage}>
      <div className={styles.container}>

        {/* ── 프로필 카드 ──────────────────────────────────── */}
        <div className={styles.profileCard}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className={styles.avatarImg} />
          ) : (
            <div className={styles.avatar}>{initial}</div>
          )}

          <div className={styles.profileInfo}>
            <h1 className={styles.profileName}>{user.name}</h1>
            {user.email && <p className={styles.profileHandle}>{user.email}</p>}
            {badges.length > 0 && (
              <div className={styles.profileBadges}>
                {badges.map((b) => (
                  <span key={b.label} className={styles.badge}>
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.tierSection}>
            <div className={styles.tierRow}>
              <PillarIcon className={styles.pillarIcon} />
              <span className={styles.tierName}>{tier}</span>
            </div>
            <div className={styles.tierProgressWrap}>
              <div className={styles.tierProgressFill} style={{ width: `${tierRank}%` }} />
            </div>
            <div className={styles.tierLabels}>
              <span>{tier}</span>
              <span>{nextTier}</span>
            </div>
          </div>
        </div>

        {/* ── 통계 카드 ────────────────────────────────────── */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>이긴 횟수</div>
            <div className={styles.statValue}>
              {winCount}<span className={styles.statUnit}>회</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>승률</div>
            <div className={styles.statValue}>
              {winRate}<span className={styles.statUnit}>%</span>
            </div>
          </div>
        </div>

        {/* ── 탭 메뉴 ──────────────────────────────────────── */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'dashboard' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            대시보드
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('history')}
          >
            이력
          </button>
        </div>

        {/* ── 탭 콘텐츠 ────────────────────────────────────── */}
        <div className={styles.tabContent}>
          {activeTab === 'dashboard' && <AnalyticsDashboardSection />}
          {activeTab === 'history' && <AnalyticsHistorySection />}
        </div>

      </div>
    </div>
  );
}
