import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/useUserStore";
import { InvitePanel } from "../components/common/InvitePanel";
import styles from "./TeacherPage.module.css";
import {
  RadarChart, Radar, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer,
} from "recharts";
import type {
  ClassInfo,
  StudentStat,
  ClassSummary,
  TeacherDebateSummary,
} from "../lib/api";
import {
  getTeacherClasses,
  createClass,
  deleteClass,
  getClassStudents,
  getClassSummary,
  getStoredDebateSummary,
} from "../lib/api";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type Tab = "classes" | "stats" | "settings";

// ─── AI 설정 타입 ──────────────────────────────────────────────────

interface PhaseDurations {
  arguing: number;
  rebuttal: number;
  defense: number;
  counter: number;
  finalArgument: number;
  peerVoting: number;
}

interface Handicap {
  enabled: boolean;
  vocab: boolean;
  evidenceLimit: boolean;
  rebuttalLimit: boolean;
  phaseDurations: PhaseDurations | null;
}

const DEFAULT_PHASE_DURATIONS: PhaseDurations = {
  arguing: 120,
  rebuttal: 90,
  defense: 90,
  counter: 60,
  finalArgument: 60,
  peerVoting: 30,
};

const DEFAULT_HANDICAP: Handicap = {
  enabled: true,
  vocab: true,
  evidenceLimit: true,
  rebuttalLimit: true,
  phaseDurations: null,
};

const PRESETS = [
  { label: "쉬움", desc: "모든 제약 ON", value: { enabled: true, vocab: true, evidenceLimit: true, rebuttalLimit: true } },
  { label: "보통", desc: "어휘만 제한", value: { enabled: true, vocab: true, evidenceLimit: false, rebuttalLimit: false } },
  { label: "어려움", desc: "제약 없음", value: { enabled: false, vocab: false, evidenceLimit: false, rebuttalLimit: false } },
];

const PHASE_CONFIG: { key: keyof PhaseDurations; label: string; min: number; max: number; step: number }[] = [
  { key: "arguing",       label: "입론",       min: 30,  max: 300, step: 15 },
  { key: "rebuttal",      label: "반론",       min: 15,  max: 180, step: 15 },
  { key: "defense",       label: "방어",       min: 15,  max: 180, step: 15 },
  { key: "counter",       label: "재반론",     min: 15,  max: 120, step: 15 },
  { key: "finalArgument", label: "마무리 발언", min: 15, max: 120, step: 15 },
  { key: "peerVoting",    label: "동료 투표",  min: 15,  max: 60,  step: 15 },
];

const CATEGORY_LABELS: Record<string, string> = {
  logic: "논리성", evidence: "근거", persuasion: "표현 명확성", rebuttal: "반론", consistency: "일관성",
};

// ─── 공용 컴포넌트 ────────────────────────────────────────────────

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.slider} />
    </label>
  );
}

function MiniBar({ value, max = 25, warning = false }: { value: number; max?: number; warning?: boolean }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={styles.miniBarWrap}>
      <div className={styles.miniBarTrack}>
        <div className={`${styles.miniBar} ${warning ? styles.miniBarWarning : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.miniBarVal}>{value}</span>
    </div>
  );
}

function MetricSparkline({ values }: { values: { label: string; value: number }[] }) {
  return (
    <div className={styles.metricSparkline} aria-label="평가 지표">
      {values.map(({ label, value }) => (
        <span
          key={label}
          className={styles.metricSparkBar}
          style={{ height: `${Math.max(4, Math.min(100, (value / 20) * 100))}%` }}
          title={`${label}: ${value}/20`}
        />
      ))}
    </div>
  );
}

type DebateRow = StudentStat['recentDebates'][number];

function DebateSummaryModal({ debate, token, onClose }: {
  debate: DebateRow;
  token: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TeacherDebateSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setPending(false);
    getStoredDebateSummary(token, debate.id)
      .then(res => {
        if ('pending' in res && res.pending) {
          setPending(true);
        } else {
          setData(res as TeacherDebateSummary);
        }
      })
      .catch(() => setError('요약을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [token, debate.id]);

  useEffect(() => { load(); }, [load]);

  const isSolo = debate.position === 'solo';
  const positionLabel = isSolo ? '개인 논술' : (debate.position === 'pro' ? '찬성' : '반대');
  const positionColor = isSolo ? 'var(--color-primary)' : (debate.position === 'pro' ? 'var(--color-pro)' : 'var(--color-con)');
  const resultLabel = isSolo ? '논술' : (debate.result === 'win' ? '승리' : debate.result === 'lose' ? '패배' : '무승부');
  const dateStr = new Date(debate.playedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div
      className={styles.debateSummaryOverlay}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        className={styles.debateSummaryModal}
        style={{ background: 'var(--color-surface)', borderRadius: '20px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '6px' }}>{dateStr}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.5 }}>{debate.topic}</div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: debate.position === 'pro' ? 'var(--color-pro-bg)' : 'var(--color-con-bg)', color: positionColor }}>{positionLabel}측</span>
            <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>{resultLabel}</span>
            <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: 'var(--color-surface-2)', color: 'var(--color-primary)' }}>{debate.score}점</span>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
            <div style={{ fontSize: '14px' }}>불러오는 중...</div>
          </div>
        )}

        {pending && !loading && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '20px', marginBottom: '10px' }}>🔄</div>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '14px', lineHeight: 1.6 }}>
              AI 요약이 아직 생성 중입니다.<br />잠시 후 다시 확인해주세요.
            </div>
            <button
              onClick={load}
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 20px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text)' }}
            >
              다시 확인
            </button>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-con-orange)', fontSize: '14px' }}>{error}</div>
        )}

        {data && !loading && (
          <>
            <p style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--color-text)', margin: 0 }}>{data.summary}</p>

            {/* 잘한 점 */}
            <div style={{ background: 'var(--color-surface-2)', borderRadius: '12px', padding: '16px 18px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-pro)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>잘한 점</div>
              <ul className={styles.debateSummaryList} style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.strengths.map((s, i) => (
                  <li key={i} style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text)' }}>{s}</li>
                ))}
              </ul>
            </div>

            {/* 개선할 점 */}
            <div style={{ background: 'var(--color-surface-2)', borderRadius: '12px', padding: '16px 18px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-con)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>개선할 점</div>
              <ul className={styles.debateSummaryList} style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.improvements.map((s, i) => (
                  <li key={i} style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--color-text)' }}>{s}</li>
                ))}
              </ul>
            </div>

            {/* 다음 토론을 위한 한마디 */}
            {data.coaching && (
              <div style={{ background: 'rgba(59,130,246,0.06)', borderRadius: '12px', padding: '16px 18px', border: '1px solid rgba(59,130,246,0.3)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>다음 토론을 위한 한마디</div>
                <p style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--color-text)', margin: 0, fontStyle: 'italic' }}>{data.coaching}</p>
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          style={{ alignSelf: 'center', background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 28px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '13px' }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function GrowthBadge({ rate }: { rate: number }) {
  if (rate === 0) return <span className={styles.growthNeutral}>− 0%</span>;
  return rate > 0
    ? <span className={styles.growthUp}>↗ +{rate}%</span>
    : <span className={styles.growthDown}>↘ {rate}%</span>;
}

// ─── Tab 1: 학급 관리 ─────────────────────────────────────────────

function ClassesTab({ token }: { token: string }) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    getTeacherClasses(token)
      .then(setClasses)
      .catch(() => setError("학급 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const cls = await createClass(token, newName.trim());
      setClasses(prev => [cls, ...prev]);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 학급을 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      await deleteClass(token, id);
      setClasses(prev => prev.filter(c => c.id !== id));
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className={styles.loadingMsg}>불러오는 중...</div>;

  return (
    <div>
      {error && <div className={styles.errorMsg}>{error}</div>}

      {/* 학급 생성 */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>새 학급 생성</div>
        <div className={styles.createRow}>
          <input
            className={styles.textInput}
            placeholder="예: 3학년 2반"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />
          <button className="btn btn--primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? "생성 중..." : "생성"}
          </button>
        </div>
        <div className={styles.createHint}>
          학급을 만들면 참가 코드가 자동 발급됩니다. 학생들은 코드로 학급에 참가할 수 있습니다.
        </div>
      </div>

      {/* 학급 목록 */}
      {classes.length === 0 ? (
        <div className={styles.emptyMsg}>아직 만든 학급이 없습니다.</div>
      ) : (
        classes.map(cls => (
          <div key={cls.id} className={styles.classCard}>
            <div className={styles.classCardHeader}>
              <div>
                <div className={styles.className}>{cls.name}</div>
                <div className={styles.classMeta}>학생 {cls.memberCount}명 · {new Date(cls.createdAt).toLocaleDateString("ko-KR")}</div>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(cls.id)}
                disabled={deletingId === cls.id}
                aria-label={`${cls.name} 삭제`}
                title="학급 삭제"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
                </svg>
              </button>
            </div>
            <div className={styles.inviteRow}>
              <InvitePanel
                code={cls.classCode}
                joinUrl={`${window.location.origin}/mypage?joinClass=${cls.classCode}`}
                codeLabel="학급 코드"
                hint="QR 코드를 스캔하거나 학급 코드로 직접 참가하세요"
                variant="compact"
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Tab 2: 학생 통계 ─────────────────────────────────────────────

function StatsTab({ token }: { token: string }) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentStat[]>([]);
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentStat | null>(null);

  useEffect(() => {
    getTeacherClasses(token)
      .then(cls => {
        setClasses(cls);
        if (cls.length > 0) setSelectedId(cls[0].id);
      })
      .finally(() => setLoadingClasses(false));
  }, [token]);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingStudents(true);
    setSelectedStudent(null);
    Promise.all([
      getClassStudents(token, selectedId),
      getClassSummary(token, selectedId),
    ]).then(([studs, sum]) => {
      setStudents(studs);
      setSummary(sum);
    }).finally(() => setLoadingStudents(false));
  }, [token, selectedId]);

  if (loadingClasses) return <div className={styles.loadingMsg}>불러오는 중...</div>;
  if (classes.length === 0) {
    return <div className={styles.emptyMsg}>먼저 학급을 만들어주세요.</div>;
  }

  const selectedClass = classes.find(c => c.id === selectedId);

  return (
    <div>
      {/* 학급 선택 탭 */}
      <div className={styles.classTabs}>
        {classes.map(c => (
          <button
            key={c.id}
            className={`${styles.classTab} ${selectedId === c.id ? styles["classTab--active"] : ""}`}
            onClick={() => setSelectedId(c.id)}
          >
            {c.name}
            <span className={styles.classTabCount}>{c.memberCount}</span>
          </button>
        ))}
      </div>

      {loadingStudents ? (
        <div className={styles.loadingMsg}>학생 데이터 불러오는 중...</div>
      ) : selectedStudent ? (
        <StudentDetailView student={selectedStudent} onBack={() => setSelectedStudent(null)} token={token} summary={summary} />
      ) : (
        <>
          {/* 학급 요약 */}
          {summary && selectedClass && (
            <ClassSummaryPanel summary={summary} className={selectedClass.name} />
          )}

          {/* 학생 목록 */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>학생별 성과</div>
            {students.length === 0 ? (
              <div className={styles.emptyMsg}>아직 참가한 학생이 없습니다.</div>
            ) : (
              <table className={styles.studentTable}>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>평균점수</th>
                    <th>평가 지표</th>
                    <th>성장률</th>
                    <th>토론 수</th>
                  </tr>
                </thead>
                <tbody>
                  {students
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((s, i) => (
                      <tr key={s.userId} className={styles.studentRow} onClick={() => setSelectedStudent(s)}>
                        <td>
                          <div className={styles.studentIdentity}>
                            {i < 3 && <span className={styles.rankMedal}>{["🥇","🥈","🥉"][i]}</span>}
                            <div>
                              <div className={styles.studentName}>{s.name}</div>
                              <div className={styles.studentTier}>{s.tier}</div>
                            </div>
                          </div>
                        </td>
                        <td><strong>{s.avgScore}</strong></td>
                        <td>
                          <MetricSparkline values={[
                            { label: "논리성", value: s.avgLogic },
                            { label: "근거", value: s.avgEvidence },
                            { label: "표현 명확성", value: s.avgPersuasion },
                            { label: "반론", value: s.avgRebuttal },
                            { label: "일관성", value: s.avgConsistency },
                          ]} />
                        </td>
                        <td><GrowthBadge rate={s.growthRate} /></td>
                        <td>{s.totalGames}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ClassSummaryPanel({ summary, className }: { summary: ClassSummary; className: string }) {
  const catEntries = summary.avgByCategory
    ? Object.entries(summary.avgByCategory).map(([k, v]) => ({ key: k, label: CATEGORY_LABELS[k] ?? k, value: v }))
    : [];
  const strongest = catEntries.length > 0 ? catEntries.reduce((a, b) => a.value > b.value ? a : b) : null;

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{className} 학급 현황</div>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryVal}>{summary.totalDebates}</div>
          <div className={styles.summaryKey}>총 토론 수</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryVal}>{summary.avgScore}</div>
          <div className={styles.summaryKey}>평균 점수</div>
        </div>
        {strongest && (
          <div className={styles.summaryItem}>
            <div className={`${styles.summaryVal} ${styles.summaryStrong}`}>{strongest.label}</div>
            <div className={styles.summaryKey}>가장 강한 항목</div>
          </div>
        )}
        {summary.weakestCategory && (
          <div className={styles.summaryItem}>
            <div className={`${styles.summaryVal} ${styles.summaryWarning}`}>{CATEGORY_LABELS[summary.weakestCategory.key] ?? summary.weakestCategory.key}</div>
            <div className={styles.summaryKey}>개선 필요 항목</div>
          </div>
        )}
      </div>

      {catEntries.length > 0 && (
        <>
          <div className={styles.catLabel}>항목별 학급 평균</div>
          <div className={styles.classMetricsGrid}>
            <div className={styles.studentMetricBars}>
              {catEntries.map(e => (
                <div key={e.key} className={styles.catRow}>
                  <div className={styles.catName}>{e.label}</div>
                  <MiniBar value={e.value} max={20} warning={e.key === summary.weakestCategory?.key} />
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={catEntries.map(e => ({ axis: e.label, value: e.value }))}>
                <PolarGrid gridType="polygon" stroke="var(--color-text-muted)" strokeOpacity={0.35} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                <PolarRadiusAxis domain={[0, 20]} tick={false} axisLine={false} />
                <Radar name="학급 평균" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="var(--color-primary)" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {summary.topStudents.length > 0 && (
        <>
          <div className={styles.catLabel} style={{ marginTop: 16 }}>우수 학생 TOP 5</div>
          {summary.topStudents.map((s, i) => (
            <div key={s.userId} className={styles.topStudentRow}>
              <span className={styles.topRank}>{i + 1}</span>
              <span className={styles.topName}>{s.name}</span>
              <span className={styles.topScore}>평균 {s.avgScore}점</span>
              <span className={styles.topGames}>토론 {s.debateCount}회</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StudentDetailView({ student, onBack, token, summary }: {
  student: StudentStat;
  onBack: () => void;
  token: string;
  summary: ClassSummary | null;
}) {
  const [selectedDebate, setSelectedDebate] = useState<DebateRow | null>(null);

  const categories = [
    { key: 'avgLogic' as const, label: '논리성', classKey: 'logic' as const },
    { key: 'avgEvidence' as const, label: '근거', classKey: 'evidence' as const },
    { key: 'avgPersuasion' as const, label: '표현 명확성', classKey: 'persuasion' as const },
    { key: 'avgRebuttal' as const, label: '반론', classKey: 'rebuttal' as const },
    { key: 'avgConsistency' as const, label: '일관성', classKey: 'consistency' as const },
  ];

  const barColor = (v: number) => v >= 17 ? '#4ade80' : v >= 13 ? '#facc15' : v >= 8 ? '#fb923c' : '#f87171';

  const radarData = categories.map(c => ({
    axis: c.label,
    student: student[c.key],
    classAvg: summary?.avgByCategory[c.classKey] ?? 0,
  }));

  return (
    <div>
      {selectedDebate && (
        <DebateSummaryModal
          debate={selectedDebate}
          token={token}
          onClose={() => setSelectedDebate(null)}
        />
      )}

      <button className={styles.backBtn} onClick={onBack}>← 목록으로</button>

      <div className={styles.card}>
        <div className={styles.studentDetailHeader}>
          <div>
            <div className={styles.studentDetailName}>{student.name}</div>
            <div className={styles.studentDetailMeta}>{student.tier} · {student.rankPoint} RP · {student.totalGames}판 · {student.winCount}승</div>
          </div>
          <div className={styles.studentDetailScore}>
            <div className={styles.studentDetailScoreVal}>{student.avgScore}</div>
            <div className={styles.studentDetailScoreKey}>평균 점수</div>
          </div>
        </div>

        <hr className={styles.divider} />

        <div className={styles.catLabel}>항목별 평균 (최근 10판)</div>

        <div className={styles.studentMetricsGrid}>
          {/* 왼쪽: 가로 막대그래프 */}
          <div className={styles.studentMetricBars}>
            {categories.map(c => {
              const val = student[c.key];
              const color = barColor(val);
              return (
                <div key={c.key} className={styles.studentMetricRow}>
                  <div className={styles.studentMetricLabel}>{c.label}</div>
                  <div style={{ flex: 1, height: '10px', background: 'var(--color-surface-2)', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (val / 20) * 100)}%`,
                      background: color,
                      borderRadius: '5px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color, minWidth: '22px', textAlign: 'right' }}>{val}</span>
                </div>
              );
            })}
          </div>

          {/* 오른쪽: 방사형 차트 */}
          <div className={styles.studentRadarPanel}>
            <div className={styles.studentRadarLegend}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '3px', background: '#3b82f6', borderRadius: '2px' }} />
                {student.name}의 지표
              </span>
              {summary && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 2" /></svg>
                  학급 평균
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData}>
                <PolarGrid gridType="polygon" stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                <PolarRadiusAxis domain={[0, 20]} tick={false} axisLine={false} />
                <Radar name={`${student.name}의 지표`} dataKey="student" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                {summary && (
                  <Radar name="학급 평균" dataKey="classAvg" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 3" fill="none" />
                )}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.growthRow}>
            <span>성장률</span>
            <GrowthBadge rate={student.growthRate} />
            {student.growthRate === 0 && <span className={styles.growthHint}>(토론 4판 이상 시 집계)</span>}
          </div>
        </div>
      </div>

      {student.recentDebates.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>최근 토론 이력 <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-muted)' }}>— 클릭하면 AI 요약을 볼 수 있어요</span></div>
          {student.recentDebates.map((d, i) => (
            <div
              key={i}
              className={styles.debateHistoryRow}
              onClick={() => setSelectedDebate(d)}
              style={{ cursor: 'pointer' }}
            >
              <div className={`${styles.resultBadge} ${styles[`result--${d.result}`]}`}>
                {d.result === "win" ? "승" : d.result === "lose" ? "패" : "무"}
              </div>
              <div className={styles.debateTopic}>{d.topic}</div>
              <div className={styles.debateScore}>{d.score}점</div>
              <div className={styles.debateDate}>{new Date(d.playedAt).toLocaleDateString("ko-KR")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 단계별 시간 편집 컴포넌트 ───────────────────────────────────────

function PhaseDurationEditor({
  durations,
  onChange,
}: {
  durations: PhaseDurations;
  onChange: (d: PhaseDurations) => void;
}) {
  const setVal = (key: keyof PhaseDurations, val: number) =>
    onChange({ ...durations, [key]: val });

  return (
    <div className={styles.phaseDurationTable}>
      {PHASE_CONFIG.map(cfg => {
        const val = durations[cfg.key];
        const isDefault = val === DEFAULT_PHASE_DURATIONS[cfg.key];
        const fmt = (s: number) => s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60 > 0 ? `${s % 60}초` : ""}`.trim() : `${s}초`;
        return (
          <div key={cfg.key} className={styles.phaseRow}>
            <div className={styles.phaseLabel}>
              {cfg.label}
              {isDefault && <span className={styles.phaseDefault}>기본</span>}
            </div>
            <div className={styles.phaseStepper}>
              <button
                className={styles.stepBtn}
                disabled={val <= cfg.min}
                onClick={() => setVal(cfg.key, Math.max(cfg.min, val - cfg.step))}
              >−</button>
              <span className={styles.stepVal}>{fmt(val)}</span>
              <button
                className={styles.stepBtn}
                disabled={val >= cfg.max}
                onClick={() => setVal(cfg.key, Math.min(cfg.max, val + cfg.step))}
              >+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 3: AI 설정 ───────────────────────────────────────────────

function SettingsTab({ token, classes }: { token: string; classes: { id: number; name: string }[] }) {
  const [selectedClassId, setSelectedClassId] = useState<number | "global">("global");
  const [handicap, setHandicap] = useState<Handicap>(DEFAULT_HANDICAP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const loadSettings = (classId: number | "global") => {
    setLoading(true);
    const url = classId === "global"
      ? `${BASE}/teacher/settings`
      : `${BASE}/teacher/classes/${classId}/settings`;
    fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(d => {
        const raw = classId === "global" ? d : (d.settings ?? null);
        setHandicap(raw ? { ...DEFAULT_HANDICAP, ...raw } : DEFAULT_HANDICAP);
      })
      .catch(() => setHandicap(DEFAULT_HANDICAP))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSettings(selectedClassId); }, [selectedClassId]);

  const update = (patch: Partial<Handicap>) => setHandicap(prev => ({ ...prev, ...patch }));

  const durations = handicap.phaseDurations ?? DEFAULT_PHASE_DURATIONS;
  const hasCustomDurations = handicap.phaseDurations !== null;

  const activePreset = PRESETS.findIndex(p =>
    p.value.enabled === handicap.enabled &&
    p.value.vocab === handicap.vocab &&
    p.value.evidenceLimit === handicap.evidenceLimit &&
    p.value.rebuttalLimit === handicap.rebuttalLimit
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedClassId === "global") {
        const res = await fetch(`${BASE}/teacher/settings`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(handicap),
        });
        if (!res.ok) throw new Error();
        const saved = await res.json();
        setHandicap({ ...DEFAULT_HANDICAP, ...saved });
      } else {
        const res = await fetch(`${BASE}/teacher/classes/${selectedClassId}/settings`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ settings: handicap }),
        });
        if (!res.ok) throw new Error();
        const saved = await res.json();
        setHandicap(saved.settings ? { ...DEFAULT_HANDICAP, ...saved.settings } : DEFAULT_HANDICAP);
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loadingMsg}>설정 불러오는 중...</div>;

  return (
    <div>
      {/* 설정 대상 선택 */}
      <div className={styles.classSelector}>
        <button
          className={`${styles.classSelectorBtn} ${selectedClassId === "global" ? styles["classSelectorBtn--active"] : ""}`}
          onClick={() => setSelectedClassId("global")}
        >전체 기본값</button>
        {classes.map(c => (
          <button
            key={c.id}
            className={`${styles.classSelectorBtn} ${selectedClassId === c.id ? styles["classSelectorBtn--active"] : ""}`}
            onClick={() => setSelectedClassId(c.id)}
          >{c.name}</button>
        ))}
      </div>
      <div className={styles.settingsDesc}>
        {selectedClassId === "global"
          ? "모든 반에 적용되는 기본값입니다. 반별 설정이 없을 때 이 값이 사용됩니다."
          : "이 반에만 적용되는 설정입니다. 저장하면 전체 기본값보다 우선 적용됩니다."}
      </div>

      {/* AI 핸디캡 */}
      <div className={styles.card}>
        <div className={styles.masterRow}>
          <div>
            <div className={styles.masterLabel}>AI 핸디캡</div>
            <div className={styles.masterDesc}>AI의 발언 수준을 제한해 학생과의 토론 난이도 조절</div>
          </div>
          <ToggleSwitch checked={handicap.enabled} onChange={v => update({ enabled: v })} />
        </div>

        {handicap.enabled && (
          <>
            <hr className={styles.divider} />
            {[
              { key: "vocab" as const, label: "어휘 수준 제한", desc: "초등학교 교과서 수준의 어휘만 사용" },
              { key: "evidenceLimit" as const, label: "근거 제시 횟수 제한", desc: "발언당 근거(통계·사례·인용)를 1개만 제시" },
              { key: "rebuttalLimit" as const, label: "반론 강도 제한", desc: "상대 주장 전체가 아닌 한 가지 논점만 반박" },
            ].map(item => (
              <div key={item.key} className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>{item.label}</div>
                  <div className={styles.toggleDesc}>{item.desc}</div>
                </div>
                <ToggleSwitch checked={handicap[item.key]} onChange={v => update({ [item.key]: v })} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* 단계별 시간 설정 */}
      <div className={styles.card}>
        <div className={styles.masterRow}>
          <div>
            <div className={styles.masterLabel}>단계별 시간 설정</div>
            <div className={styles.masterDesc}>각 단계의 발언 시간을 직접 조정합니다</div>
          </div>
          <ToggleSwitch
            checked={hasCustomDurations}
            onChange={v => update({ phaseDurations: v ? { ...DEFAULT_PHASE_DURATIONS } : null })}
          />
        </div>
        {hasCustomDurations && (
          <>
            <hr className={styles.divider} />
            <PhaseDurationEditor
              durations={durations}
              onChange={d => update({ phaseDurations: d })}
            />
          </>
        )}
      </div>

      {/* 난이도 프리셋 */}
      <div className={styles.card}>
        <div className={styles.presetLabel}>난이도 프리셋</div>
        <div className={styles.presets}>
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              className={`${styles.presetBtn} ${activePreset === i ? styles["presetBtn--active"] : ""}`}
              onClick={() => setHandicap({ ...handicap, ...p.value })}
            >
              {p.label}
              <div className={styles.presetDesc}>{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div className={`${styles.toast} ${showToast ? "" : styles["toast--hidden"]}`}>
        설정이 저장되었습니다 ✓
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export function TeacherPage() {
  const navigate = useNavigate();
  const token = useUserStore(s => s.token);
  const user = useUserStore(s => s.user);
  const [tab, setTab] = useState<Tab>("classes");
  const [classList, setClassList] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (user && user.role !== "teacher") navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/teacher/classes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: { id: number; name: string }[]) => setClassList(data.map(c => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, [token]);

  if (!token || !user) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "classes", label: "학급 관리" },
    { key: "stats", label: "학생 통계" },
    { key: "settings", label: "AI 설정" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>선생님 대시보드</div>
        <div className={styles.teacherBadge}>교사 계정</div>
      </div>

      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles["tabBtn--active"] : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === "classes" && <ClassesTab token={token} />}
        {tab === "stats" && <StatsTab token={token} />}
        {tab === "settings" && <SettingsTab token={token} classes={classList} />}
      </div>
    </div>
  );
}
