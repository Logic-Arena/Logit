import { useState, useEffect, useMemo, useRef } from "react";
import { useUserStore } from "../store/useUserStore";
import { getDebateHistory, updateProfile, joinClass, getMe, type DebateHistoryItem } from "../lib/api";
import {
  AnalyticsDashboardSection,
  AnalyticsHistorySection,
} from "./AnalyticsPage";
import styles from "./MyPage.module.css";

type Tab = "dashboard" | "history";

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

function ClassJoinSection() {
  const token = useUserStore(s => s.token);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleJoin = async () => {
    if (!code.trim() || !token) return;
    setJoining(true);
    setMsg(null);
    try {
      const res = await joinClass(token, code.trim());
      setMsg({ text: res.alreadyJoined ? `이미 "${res.className}"에 속해 있습니다.` : `"${res.className}"에 참가했습니다!`, ok: true });
      setCode("");
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "참가에 실패했습니다.", ok: false });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className={styles.classJoinCard}>
      <div className={styles.classJoinTitle}>학급 참가</div>
      <div className={styles.classJoinRow}>
        <input
          className={styles.classJoinInput}
          placeholder="학급 코드 6자리"
          value={code}
          maxLength={8}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleJoin()}
        />
        <button className="btn btn--primary" onClick={handleJoin} disabled={joining || !code.trim()}>
          {joining ? "참가 중..." : "참가"}
        </button>
      </div>
      {msg && (
        <div className={msg.ok ? styles.classJoinSuccess : styles.classJoinError}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

export function MyPage() {
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [history, setHistory] = useState<DebateHistoryItem[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDebateHistory().then(setHistory).catch(() => {});
    getMe().then(setUser).catch(() => {});
  }, []);

  const growthRate = useMemo(() => {
    if (history.length < 2) return 0;
    const sorted = [...history].sort(
      (a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
    );
    const half = Math.ceil(sorted.length / 2);
    const avgEarly = sorted.slice(0, half).reduce((s, h) => s + h.score, 0) / half;
    const avgRecent = sorted.slice(-half).reduce((s, h) => s + h.score, 0) / half;
    return avgEarly > 0 ? Math.round(((avgRecent - avgEarly) / avgEarly) * 100) : 0;
  }, [history]);

  if (!user) {
    return (
      <div className={styles.myPage}>
        <div className={styles.container}>
          <div className={styles.skeleton} />
        </div>
      </div>
    );
  }

  const tier = user.tier ?? "브론즈 5";
  const tierRank = user.tierRank ?? 0;
  const nextTier = user.nextTier ?? "—";
  const debateCount = user.debateCount ?? 0;
  const winCount = user.winCount ?? 0;
  const winRate =
    debateCount > 0 ? Math.round((winCount / debateCount) * 100) : 0;
  const badges = user.badges ?? [];
  const initial = user.name.charAt(0).toUpperCase();

  const avgScore = Math.round(user.scoreAverage ?? 0);
  const totalDebates = user.debateCount ?? 0;

  async function handleSaveName() {
    if (!user || !nameInput.trim() || nameInput.trim() === user.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateProfile({ name: nameInput.trim() });
      setUser(updated);
      setEditingName(false);
    } catch {
      // ignore
    } finally {
      setSavingName(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const updated = await updateProfile({ profileImage: base64 });
        setUser(updated);
      } catch {
        // ignore
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className={styles.myPage}>
      <div className={styles.container}>
        {/* ── 프로필 카드 ──────────────────────────────────── */}
        <div className={styles.profileCard}>
          <div className={styles.avatarWrapper} onClick={() => fileInputRef.current?.click()} title="사진 변경">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className={styles.avatarImg} />
            ) : (
              <div className={styles.avatar}>{initial}</div>
            )}
            <div className={styles.avatarOverlay}>변경</div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />

          <div className={styles.profileInfo}>
            {editingName ? (
              <div className={styles.nameEditRow}>
                <input
                  className={styles.nameInput}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                  maxLength={20}
                />
                <button className={`btn btn--primary ${styles.nameSaveBtn}`} onClick={handleSaveName} disabled={savingName}>
                  {savingName ? '저장 중...' : '저장'}
                </button>
                <button className="btn btn--ghost" onClick={() => setEditingName(false)}>취소</button>
              </div>
            ) : (
              <h1 className={styles.profileName}>
                {user.name}
                <button
                  className={styles.nameEditBtn}
                  onClick={() => { setNameInput(user.name); setEditingName(true); }}
                  title="이름 변경"
                >
                  ✏️
                </button>
              </h1>
            )}
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
              <div
                className={styles.tierProgressFill}
                style={{ width: `${tierRank}%` }}
              />
            </div>
            <div className={styles.tierLabels}>
              <span>{tier}</span>
              <span>{nextTier}</span>
            </div>
          </div>
        </div>

        {/* ── 전체 성과 요약 ───────────────────────────────── */}
        <div className={styles.summarySection}>
          <div className={styles.summaryLabel}>전체 성과 요약</div>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>이긴 횟수</div>
              <div className={styles.statValue}>
                {winCount}
                <span className={styles.statUnit}>회</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>승률</div>
              <div className={styles.statValue}>
                {winRate}
                <span className={styles.statUnit}>%</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>평균 점수</div>
              <div className={styles.statValue}>
                {avgScore}<span className={styles.statUnit}>점</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>총 토론 횟수</div>
              <div className={styles.statValue}>
                {totalDebates}<span className={styles.statUnit}>회</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>최근 성장률</div>
              <div className={styles.statValue}>
                {growthRate >= 0 ? '+' : ''}{growthRate}<span className={styles.statUnit}>%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 학급 참가 (학생 계정) ───────────────────────── */}
        {user.role !== 'teacher' && <ClassJoinSection />}

        {/* ── 탭 메뉴 ──────────────────────────────────────── */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === "dashboard" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            대시보드
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("history")}
          >
            이력
          </button>
        </div>

        {/* ── 탭 콘텐츠 ────────────────────────────────────── */}
        <div className={styles.tabContent}>
          {activeTab === "dashboard" && (
            <AnalyticsDashboardSection hideKpi />
          )}
          {activeTab === "history" && <AnalyticsHistorySection />}
        </div>
      </div>
    </div>
  );
}
