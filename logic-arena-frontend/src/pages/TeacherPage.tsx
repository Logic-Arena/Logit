import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/useUserStore";
import styles from "./TeacherPage.module.css";
import type {
  ClassInfo,
  StudentStat,
  ClassSummary,
} from "../lib/api";
import {
  getTeacherClasses,
  createClass,
  deleteClass,
  getClassStudents,
  getClassSummary,
} from "../lib/api";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

type Tab = "classes" | "stats" | "settings";

// ─── AI 설정 타입 ──────────────────────────────────────────────────

interface Handicap {
  enabled: boolean;
  vocab: boolean;
  evidenceLimit: boolean;
  rebuttalLimit: boolean;
  shortGameMode: boolean;
}

const DEFAULT_HANDICAP: Handicap = {
  enabled: true,
  vocab: true,
  evidenceLimit: true,
  rebuttalLimit: true,
  shortGameMode: false,
};

const PRESETS = [
  { label: "쉬움", desc: "모든 제약 ON", value: { enabled: true, vocab: true, evidenceLimit: true, rebuttalLimit: true, shortGameMode: false } },
  { label: "보통", desc: "어휘만 제한", value: { enabled: true, vocab: true, evidenceLimit: false, rebuttalLimit: false, shortGameMode: false } },
  { label: "어려움", desc: "제약 없음", value: { enabled: false, vocab: false, evidenceLimit: false, rebuttalLimit: false, shortGameMode: false } },
];

const CATEGORY_LABELS: Record<string, string> = {
  logic: "논리성", evidence: "근거", persuasion: "설득력", rebuttal: "반론", consistency: "일관성",
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button className={styles.copyBtn} onClick={copy}>
      {copied ? "✓ 복사됨" : "복사"}
    </button>
  );
}

function MiniBar({ value, max = 25 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 80 ? "#4ade80" : pct >= 52 ? "#facc15" : "#fb923c";
  return (
    <div className={styles.miniBarWrap}>
      <div className={styles.miniBar} style={{ width: `${pct}%`, background: color }} />
      <span className={styles.miniBarVal}>{value}</span>
    </div>
  );
}

function GrowthBadge({ rate }: { rate: number }) {
  if (rate === 0) return <span className={styles.growthNeutral}>—</span>;
  return rate > 0
    ? <span className={styles.growthUp}>+{rate}%</span>
    : <span className={styles.growthDown}>{rate}%</span>;
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
        <div className={styles.cardTitle}>새 학급 만들기</div>
        <div className={styles.createRow}>
          <input
            className={styles.textInput}
            placeholder="예: 3학년 2반"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />
          <button className="btn btn--primary" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? "생성 중..." : "만들기"}
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
              >
                삭제
              </button>
            </div>
            <div className={styles.codeRow}>
              <span className={styles.codeLabel}>학급 참가 코드</span>
              <span className={styles.code}>{cls.classCode}</span>
              <CopyButton text={cls.classCode} />
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
        <StudentDetailView student={selectedStudent} onBack={() => setSelectedStudent(null)} />
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
                    <th>논리성</th>
                    <th>근거</th>
                    <th>설득력</th>
                    <th>반론</th>
                    <th>일관성</th>
                    <th>성장률</th>
                    <th>판수</th>
                  </tr>
                </thead>
                <tbody>
                  {students
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((s, i) => (
                      <tr key={s.userId} className={styles.studentRow} onClick={() => setSelectedStudent(s)}>
                        <td>
                          <div className={styles.studentName}>
                            {i < 3 && <span className={styles.rankMedal}>{["🥇","🥈","🥉"][i]}</span>}
                            {s.name}
                          </div>
                          <div className={styles.studentTier}>{s.tier}</div>
                        </td>
                        <td><strong>{s.avgScore}</strong></td>
                        <td><MiniBar value={s.avgLogic} /></td>
                        <td><MiniBar value={s.avgEvidence} /></td>
                        <td><MiniBar value={s.avgPersuasion} /></td>
                        <td><MiniBar value={s.avgRebuttal} /></td>
                        <td><MiniBar value={s.avgConsistency} /></td>
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
            <div className={styles.summaryVal} style={{ color: "#4ade80" }}>{strongest.label}</div>
            <div className={styles.summaryKey}>가장 강한 항목</div>
          </div>
        )}
        {summary.weakestCategory && (
          <div className={styles.summaryItem}>
            <div className={styles.summaryVal} style={{ color: "#fb923c" }}>{CATEGORY_LABELS[summary.weakestCategory.key] ?? summary.weakestCategory.key}</div>
            <div className={styles.summaryKey}>개선 필요 항목</div>
          </div>
        )}
      </div>

      {catEntries.length > 0 && (
        <>
          <div className={styles.catLabel}>항목별 학급 평균</div>
          {catEntries.map(e => (
            <div key={e.key} className={styles.catRow}>
              <div className={styles.catName}>{e.label}</div>
              <MiniBar value={e.value} max={25} />
            </div>
          ))}
        </>
      )}

      {summary.topStudents.length > 0 && (
        <>
          <div className={styles.catLabel} style={{ marginTop: 16 }}>우수 학생 TOP 5</div>
          {summary.topStudents.map((s, i) => (
            <div key={s.userId} className={styles.topStudentRow}>
              <span className={styles.topRank}>{i + 1}</span>
              <span className={styles.topName}>{s.name}</span>
              <span className={styles.topScore}>{s.avgScore}점 avg</span>
              <span className={styles.topGames}>{s.debateCount}판</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StudentDetailView({ student, onBack }: { student: StudentStat; onBack: () => void }) {
  const categories = [
    { key: "avgLogic", label: "논리성" },
    { key: "avgEvidence", label: "근거" },
    { key: "avgPersuasion", label: "설득력" },
    { key: "avgRebuttal", label: "반론" },
    { key: "avgConsistency", label: "일관성" },
  ] as const;

  return (
    <div>
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
        {categories.map(c => (
          <div key={c.key} className={styles.catRow}>
            <div className={styles.catName}>{c.label}</div>
            <MiniBar value={student[c.key]} max={25} />
          </div>
        ))}

        <div className={styles.growthRow}>
          <span>성장률</span>
          <GrowthBadge rate={student.growthRate} />
          {student.growthRate === 0 && <span className={styles.growthHint}>(토론 4판 이상 시 집계)</span>}
        </div>
      </div>

      {student.recentDebates.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>최근 토론 이력</div>
          {student.recentDebates.map((d, i) => (
            <div key={i} className={styles.debateHistoryRow}>
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

// ─── Tab 3: AI 설정 ───────────────────────────────────────────────

function SettingsTab({ token }: { token: string }) {
  const [handicap, setHandicap] = useState<Handicap>(DEFAULT_HANDICAP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/teacher/settings`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(d => setHandicap({ ...DEFAULT_HANDICAP, ...d }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const update = (patch: Partial<Handicap>) => setHandicap(prev => ({ ...prev, ...patch }));

  const activePreset = PRESETS.findIndex(p =>
    p.value.enabled === handicap.enabled &&
    p.value.vocab === handicap.vocab &&
    p.value.evidenceLimit === handicap.evidenceLimit &&
    p.value.rebuttalLimit === handicap.rebuttalLimit
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/teacher/settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(handicap),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setHandicap({ ...DEFAULT_HANDICAP, ...saved });
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
      <div className={styles.settingsDesc}>
        여기서 설정한 AI 핸디캡은 내가 만드는 방에 자동으로 적용됩니다. 학생 화면에는 표시되지 않습니다.
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

      {/* 수업 시간 설정 */}
      <div className={styles.card}>
        <div className={styles.masterRow}>
          <div>
            <div className={styles.masterLabel}>수업 시간 단축 모드</div>
            <div className={styles.masterDesc}>모든 발언·단계 시간이 50% 단축됩니다 (수업 45분 활용 최적화)</div>
          </div>
          <ToggleSwitch checked={handicap.shortGameMode} onChange={v => update({ shortGameMode: v })} />
        </div>
        {handicap.shortGameMode && (
          <div className={styles.shortGameInfo}>
            <div className={styles.shortGameInfoItem}>준비 단계 30초 → 15초</div>
            <div className={styles.shortGameInfoItem}>발언 시간 90초 → 45초</div>
            <div className={styles.shortGameInfoItem}>동료 투표 30초 → 15초</div>
          </div>
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
              onClick={() => setHandicap({ ...p.value, shortGameMode: handicap.shortGameMode })}
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

  useEffect(() => {
    if (user && user.role !== "teacher") navigate("/");
  }, [user, navigate]);

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
        {tab === "settings" && <SettingsTab token={token} />}
      </div>
    </div>
  );
}
