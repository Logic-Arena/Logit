import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDebateHistory, getTrainingRecommendation, createRoom, type DebateHistoryItem, type TrainingRecommendation } from "../lib/api";
import { useUserStore } from "../store/useUserStore";
import {
  RadarChart,
  Radar,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import styles from "./AnalyticsPage.module.css";

/* ─── 타입 ─────────────────────────────────────────────────── */
type Grade = "A" | "B" | "C";
type Category = "전체" | "사회" | "과학" | "정치" | "자유";
type SortKey = "최신순" | "높은 점수순" | "낮은 점수순";
type Position = "찬성" | "반대";

interface ReportItem {
  id: number;
  date: string;
  dateLabel: string;
  topic: string;
  score: number;
  category: Category;
  position: Position;
  best: string;
  needsImprovement: string;
}

/* ─── 상수 ─────────────────────────────────────────────────── */
const GRADE_COLOR: Record<Grade, string> = {
  A: "var(--color-primary)",
  B: "var(--color-pro)",
  C: "var(--color-con)",
};


const CATEGORIES: Category[] = ["전체", "사회", "과학", "정치", "자유"];
const SORT_KEYS: SortKey[] = ["최신순", "높은 점수순", "낮은 점수순"];

function getGrade(score: number): Grade {
  if (score >= 81) return "A";
  if (score >= 51) return "B";
  return "C";
}

const KPI_ICONS = [
  <svg key="score" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
  </svg>,
  <svg key="count" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
  </svg>,
  <svg key="growth" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
  </svg>,
];



/* ─── 커스텀 툴팁 (AreaChart) ──────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLineTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className={`${styles.kpiCard} !p-3 bg-opacity-90 backdrop-blur-sm z-50`}
    >
      <div style={{ color: 'var(--color-text)' }} className="font-semibold mb-1">{d.topic}</div>
      <div style={{ color: 'var(--color-primary)' }} className="font-bold">{d.score}점</div>
    </div>
  );
}

/* ─── 커스텀 Dot (AreaChart hover) ─────────────────────────── */
function CustomDot(props: any) {
  const { cx, cy, key } = props;
  return (
    <circle
      key={key}
      cx={cx}
      cy={cy}
      r={5}
      fill="var(--color-primary)"
      stroke="var(--color-surface)"
      strokeWidth={2}
    />
  );
}

function RadarCustomTick(props: any) {
  const { x, y, payload, textAnchor, index } = props;

  let dy = 0;
  if (index === 0) dy = -10;
  else if (index === 1 || index === 4) dy = 0;
  else dy = 10;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        textAnchor={textAnchor}
        fill="var(--color-text-muted)"
        fontSize="12"
        fontWeight="500"
        dy={dy}
      >
        <tspan>{payload.value}</tspan>
      </text>
    </g>
  );
}

interface KpiCardData { label: string; value: string; trend: string; trendUp: boolean; icon: React.ReactElement; }

/* ─── 하위 컴포넌트들 ────────────────────────────────────────── */
function KPICard({ data }: { data: KpiCardData }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{data.label}</span>
        <span className={styles.kpiIcon}>{data.icon}</span>
      </div>
      <div>
        <div className={styles.kpiValue}>{data.value}</div>
        <div
          className={`${styles.kpiTrendWrapper} ${data.trendUp ? styles.kpiTrendUp : ""}`}
          style={!data.trendUp ? { color: 'var(--color-con)' } : undefined}
        >
          {data.trend}
        </div>
      </div>
    </div>
  );
}

function RecommendationSection() {
  const navigate = useNavigate();
  const [rec, setRec] = useState<TrainingRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getTrainingRecommendation()
      .then(setRec)
      .finally(() => setLoading(false));
  }, []);

  async function handlePractice() {
    setCreating(true);
    try {
      const title = rec ? `[연습] ${rec.title}` : '연습방';
      const room = rec?.topic
        ? await createRoom(title, 'ai_debate', 'manual', rec.topic)
        : await createRoom(title, 'ai_debate', 'ai_auto');
      navigate(`/rooms/${room.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className={styles.recommendationCard}>
      <div className={styles.recommendationLeft}>
        <div className={styles.recommendationHeader}>
          <span className={styles.recommendationBadge}>오늘의 추천 훈련</span>
          <h3 className={styles.chartTitle}>
            {loading ? '분석 중...' : (rec?.title ?? '훈련을 불러올 수 없습니다')}
          </h3>
        </div>
        <p className={styles.recommendationDesc}>
          {loading ? '' : (rec?.description ?? '')}
        </p>
        {rec?.topic && !loading && (
          <p style={{ fontSize: '12px', color: 'var(--color-primary)', marginTop: '6px', fontWeight: 600 }}>
            추천 주제: {rec.topic}
          </p>
        )}
      </div>
      <button
        className={styles.recommendationBtn}
        onClick={handlePractice}
        disabled={creating || loading}
      >
        {creating ? '방 생성 중...' : '연습방 바로가기'}
      </button>
    </div>
  );
}

const SCORE_CRITERIA_DETAIL = [
  { label: '논리성', key: 'logic' as const },
  { label: '근거', key: 'evidence' as const },
  { label: '설득력', key: 'persuasion' as const },
  { label: '반론', key: 'rebuttal' as const },
];

function DetailModal({ item, onClose }: { item: DebateHistoryItem; onClose: () => void }) {
  const resultLabel = item.result === 'win' ? '승리' : item.result === 'lose' ? '패배' : '무승부';
  const resultColor = item.result === 'win' ? 'var(--color-primary)' : item.result === 'lose' ? 'var(--color-con-orange)' : 'var(--color-text-muted)';
  const positionLabel = item.position === 'pro' ? '찬성' : '반대';
  const positionColor = item.position === 'pro' ? 'var(--color-primary)' : 'var(--color-con-orange)';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '86vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }} onClick={e => e.stopPropagation()}>

        {/* 결과 헤더 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>⚖️</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: resultColor }}>{resultLabel}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '6px' }}>{item.topic}</div>
          <span style={{ display: 'inline-block', marginTop: '8px', padding: '3px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, background: item.position === 'pro' ? 'var(--color-pro-bg)' : 'var(--color-con-bg)', color: positionColor }}>{positionLabel}</span>
        </div>

        {/* 점수 테이블 */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>
            내 점수 (100점 만점)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['참가자', '논리성', '근거', '설득력', '반론', '합계'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: h === '참가자' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: 'var(--color-surface-2)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ fontWeight: 600, color: positionColor }}>{positionLabel}P</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: positionColor, marginLeft: '5px' }}>(나)</span>
                </td>
                {SCORE_CRITERIA_DETAIL.map(({ key }) => (
                  <td key={key} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                    <span style={{ color: item[key] >= 20 ? 'var(--color-pro)' : item[key] >= 13 ? 'var(--color-host)' : 'var(--color-con)' }}>
                      {item[key]}
                    </span>
                  </td>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '15px', color: positionColor }}>{item.score}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* AI 조언 */}
        {item.advice && (
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', fontSize: '14px', lineHeight: 1.8 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>AI 조언</div>
            {item.advice}
          </div>
        )}

        <button onClick={onClose} style={{ alignSelf: 'center', background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '8px 24px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          닫기
        </button>
      </div>
    </div>
  );
}

function ReportCard({ item, onDetail }: { item: ReportItem; onDetail?: () => void }) {
  const grade = getGrade(item.score);

  return (
    <div className={styles.reportCard} onClick={onDetail} style={{ cursor: 'pointer' }}>
      {/* 1. 날짜 + 등급 + 점수 */}
      <div className="flex flex-col gap-2 w-full">
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.dateLabel}</div>
        <div className="flex items-center gap-2">
          <div
            className={styles.gradeBadge}
            style={{ background: GRADE_COLOR[grade] }}
          >
            {grade}
          </div>
          <span className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
            {item.score}점
          </span>
        </div>
      </div>

      {/* 2. 주제 + 포지션 + 카테고리 칩 */}
      <div className="flex flex-col gap-2 w-full min-w-0">
        <h3
          className="text-base font-bold truncate m-0"
          style={{ color: 'var(--color-text)' }}
          title={item.topic}
        >
          {item.topic}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: item.position === "찬성" ? 'var(--color-pro-bg)' : 'var(--color-con-bg)',
              color: item.position === "찬성" ? 'var(--color-pro)' : 'var(--color-con)',
            }}
          >
            {item.position}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
            {item.category}
          </span>
        </div>
      </div>

      {/* 3. Best + 보완점 */}
      <div className="flex flex-col gap-2 w-full min-w-0">
        <div className="flex items-baseline gap-2 min-w-0 w-full">
          <span className="text-xs font-semibold text-[var(--color-text)] flex-shrink-0">Best</span>
          <span className="text-sm text-[var(--color-text-muted)] truncate" title={item.best}>{item.best}</span>
        </div>
        <div className="flex items-baseline gap-2 min-w-0 w-full">
          <span className="text-xs font-semibold text-[var(--color-text)] flex-shrink-0">Needs</span>
          <span className="text-sm text-[var(--color-text-muted)] truncate" title={item.needsImprovement}>{item.needsImprovement}</span>
        </div>
      </div>

      {/* 4. 상세 보기 */}
      <div className="flex justify-end w-full mt-1">
        <button className={styles.reportCardDetailBtn} onClick={onDetail}>
          상세 보기 →
        </button>
      </div>
    </div>
  );
}

/* ─── 섹션 컴포넌트 (MyPage 탭에서도 재사용) ─────────────────── */

export function AnalyticsDashboardSection({ hideKpi = false }: { hideKpi?: boolean } = {}) {
  const user = useUserStore((s) => s.user);
  const [history, setHistory] = useState<DebateHistoryItem[]>([]);

  useEffect(() => {
    getDebateHistory().then(setHistory).catch(() => {});
  }, []);

  const lineData = useMemo(() => {
    if (history.length === 0) return [];
    return [...history]
      .sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime())
      .slice(-10)
      .map((h, i) => {
        const d = new Date(h.played_at);
        return {
          idx: i,  // 고유 인덱스 — 같은 날짜가 여러 개여도 XAxis가 각 점을 구분
          date: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`,
          score: h.score,
          topic: h.topic,
        };
      });
  }, [history]);

  const radarData = useMemo(() => {
    if (history.length === 0) return [
      { axis: "근거 제시", userValue: 0, avgValue: 65 },
      { axis: "반박 능력", userValue: 0, avgValue: 55 },
      { axis: "논리력",   userValue: 0, avgValue: 60 },
      { axis: "일관성",   userValue: 0, avgValue: 62 },
      { axis: "설득력",   userValue: 0, avgValue: 58 },
    ];
    // 세부 항목(logic, evidence 등)은 0~25점 척도로 저장됨.
    // 레이더 차트 도메인(0~100)에 맞게 4를 곱해 정규화.
    const avg = (vals: number[]) => Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const toScale = (val: number) => Math.min(100, val * 4);
    return [
      { axis: "근거 제시", userValue: avg(history.map((h) => toScale(h.evidence))), avgValue: 65 },
      { axis: "반박 능력", userValue: avg(history.map((h) => toScale(h.rebuttal))), avgValue: 55 },
      { axis: "논리력",   userValue: avg(history.map((h) => toScale(h.logic))),    avgValue: 60 },
      { axis: "일관성",   userValue: avg(history.map((h) => h.score)),              avgValue: 62 },
      { axis: "설득력",   userValue: avg(history.map((h) => toScale(h.persuasion))), avgValue: 58 },
    ];
  }, [history]);

  const liveKpi = useMemo(() => {
    const avgScore = history.length > 0
      ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length)
      : Math.round(user?.scoreAverage ?? 0);
    const totalDebates = user?.debateCount ?? 0;
    if (history.length < 2) return { avgScore, totalDebates, growthRate: 0 };
    const sorted = [...history].sort(
      (a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
    );
    const half = Math.max(1, Math.ceil(sorted.length / 2));
    const avgEarly = sorted.slice(0, half).reduce((s, h) => s + h.score, 0) / half;
    const avgRecent = sorted.slice(-half).reduce((s, h) => s + h.score, 0) / half;
    const growthRate = avgEarly > 0 ? Math.round(((avgRecent - avgEarly) / avgEarly) * 100) : 0;
    return { avgScore, totalDebates, growthRate };
  }, [user, history]);

  const kpiCards: KpiCardData[] = [
    { label: "평균 점수",   value: `${liveKpi.avgScore}점`,  trend: "누적 평균 점수", trendUp: true, icon: KPI_ICONS[0] },
    { label: "총 토론 횟수", value: `${liveKpi.totalDebates}회`, trend: "총 누적 횟수",  trendUp: true, icon: KPI_ICONS[1] },
    {
      label: "최근 성장률",
      value: `${liveKpi.growthRate >= 0 ? '+' : ''}${liveKpi.growthRate}%`,
      trend: liveKpi.growthRate >= 0 ? "성장 중" : "하락 중",
      trendUp: liveKpi.growthRate >= 0,
      icon: KPI_ICONS[2],
    },
  ];

  return (
    <div className={styles.bentoGridWrapper}>
      <div className={styles.bentoGridContainer}>
        {/* KPI Row */}
        {!hideKpi && (
          <div className={styles.kpiGrid}>
            {kpiCards.map((kpi) => (
              <KPICard key={kpi.label} data={kpi} />
            ))}
          </div>
        )}

        {/* Charts */}
        <div className={styles.bentoRow}>
          {/* Area Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              <h2 className={styles.chartTitle}>논리 점수 성장 추이</h2>
            </div>
            <div className={styles.chartCardFlex}>
              {lineData.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  토론을 완료하면 점수 추이가 표시됩니다
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%" debounce={0}>
                <AreaChart
                  data={lineData}
                  margin={{ top: 10, right: 20, bottom: 10, left: -20 }}
                >
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="idx"
                    type="number"
                    domain={[0, Math.max(0, lineData.length - 1)]}
                    ticks={lineData.map((_, i) => i)}
                    tickFormatter={(value: number) => lineData[value]?.date ?? ''}
                    tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    content={<CustomLineTooltip />}
                    cursor={{
                      stroke: "var(--color-primary)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--color-primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                    dot={<CustomDot />}
                    activeDot={{
                      r: 7,
                      fill: "var(--color-primary)",
                      stroke: "var(--color-surface)",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Radar Chart */}
          <div className={`${styles.chartCard} ${styles.chartCardRadar}`}>
            <div className={styles.chartHeaderWrap}>
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                <h2 className={styles.chartTitle}>논리 밸런스 비교</h2>
              </div>
              <div className={styles.legend}>
                <div className={styles.legendItem}>
                  <span className={styles.legendIndicatorUser}></span>
                  <span className={styles.legendTextUser}>나의 지표</span>
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendIndicatorAvg}></span>
                  <span className={styles.legendTextAvg}>전체 평균</span>
                </div>
              </div>
            </div>
            <div className={styles.chartCardFlex}>
              <ResponsiveContainer width="100%" height="100%" debounce={0}>
                <RadarChart
                  data={radarData}
                  margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
                >
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="axis" tick={<RadarCustomTick />} />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                    tickCount={5}
                    stroke="var(--color-border)"
                  />
                  <Radar
                    name="전체 평균"
                    dataKey="avgValue"
                    stroke="var(--color-text-muted)"
                    fill="var(--color-text-muted)"
                    fillOpacity={0.1}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    isAnimationActive={false}
                  />
                  <Radar
                    name="나의 점수"
                    dataKey="userValue"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 코칭 팁 — 차트를 다 본 뒤 맥락 있게 읽도록 하단 배치 */}
        <RecommendationSection />
      </div>
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86_400_000
  );
  if (diff < 1) return "오늘";
  if (diff < 7) return `${diff}일 전`;
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
  if (diff < 365) return `${Math.floor(diff / 30)}개월 전`;
  return `${Math.floor(diff / 365)}년 전`;
}


function toReportItem(h: DebateHistoryItem): ReportItem {
  const d = new Date(h.played_at);
  const date = d.toISOString().slice(0, 10);
  const dateLabel = date.replace(/-/g, ".");
  return {
    id: h.id,
    date,
    dateLabel,
    topic: h.topic,
    score: h.score,
    category: "자유",
    position: h.position === "pro" ? "찬성" : "반대",
    best: h.advice ?? "",
    needsImprovement: "",
  };
}

export function AnalyticsHistorySection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<Category>("전체");
  const [sortKey, setSortKey] = useState<SortKey>("최신순");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [rawItems, setRawItems] = useState<DebateHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DebateHistoryItem | null>(null);

  useEffect(() => {
    getDebateHistory().then((data) => {
      setRawItems(data);
      setReports(data.map(toReportItem));
    });
  }, []);

  function openDetail(id: number) {
    const raw = rawItems.find(h => h.id === id);
    if (raw) setSelectedItem(raw);
  }

  const filtered = useMemo(() => {
    let list = [...reports];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => r.topic.toLowerCase().includes(q));
    }
    if (category !== "전체") {
      list = list.filter((r) => r.category === category);
    }
    if (sortKey === "높은 점수순") list.sort((a, b) => b.score - a.score);
    else if (sortKey === "낮은 점수순") list.sort((a, b) => a.score - b.score);
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [searchQuery, category, sortKey, reports]);

  return (
    <>
      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
      {/* 최근 3건 성장 요약 */}
      <div className={styles.recentSummary}>
        <p className={styles.recentSummaryTitle}>최근 성장 요약</p>
        <div className={styles.recentBannerRow}>
          {reports.slice(0, 3).map((item, idx) => {
            const nextItem = reports[idx + 1];
            const delta = nextItem ? item.score - nextItem.score : null;
            const pct =
              delta !== null && nextItem
                ? Math.round((delta / nextItem.score) * 100)
                : null;
            return (
              <div key={item.id} className={styles.recentBannerCard}>
                {/* 날짜 + 상대 시간 */}
                <p className={styles.recentBannerDate}>
                  {relativeTime(item.date)}
                </p>

                {/* 점수 + 변화율 */}
                <div className={styles.recentBannerScoreLine}>
                  <span className={styles.recentBannerScore}>
                    {item.score}
                    <span className={styles.recentBannerScoreUnit}>점</span>
                  </span>
                  {pct !== null && (
                    <span
                      className={
                        pct >= 0 ? styles.recentDeltaUp : styles.recentDeltaDown
                      }
                    >
                      {pct >= 0 ? `+${pct}%` : `${pct}%`}
                    </span>
                  )}
                </div>

                {/* 카테고리 + 주제 + 입장 */}
                <div className={styles.recentBannerMeta}>
                  <span
                    className={styles.recentBannerCategory}
                  >
                    {item.category}
                  </span>
                  <button className={styles.recentBannerTopicBtn}>
                    {item.topic}
                  </button>
                  <span
                    className={styles.recentBannerPosition}
                    style={
                      item.position === "찬성"
                        ? { background: "var(--color-pro-bg)", color: "var(--color-pro)" }
                        : { background: "var(--color-con-bg)", color: "var(--color-con)" }
                    }
                  >
                    {item.position}
                  </span>
                </div>

                <hr className={styles.recentBannerDivider} />


                {/* 상세 보기 */}
                <button className={styles.recentBannerDetailBtn} onClick={() => openDetail(item.id)}>
                  상세 보기 →
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className={styles.controlBar}>
        <div className={styles.searchContainer}>
          <svg
            className={styles.searchIcon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="토론 주제 키워드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.controlsRight}>
          <div className={styles.selectWrapper}>
            <select
              className={styles.sortSelect}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <svg
              className={styles.selectArrow}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <div className={styles.selectWrapper}>
            <select
              className={styles.sortSelect}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              {SORT_KEYS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <svg
              className={styles.selectArrow}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* 리포트 카드 리스트 */}
      <div className={styles.reportGrid}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIconWrapper}>
              <svg
                className={styles.emptyIcon}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>검색 결과가 없습니다.</h3>
            <p className={styles.emptyDescription}>
              다른 키워드나 필터로 검색해보세요.
            </p>
          </div>
        ) : (
          filtered.map((item) => <ReportCard key={item.id} item={item} onDetail={() => openDetail(item.id)} />)
        )}
      </div>
    </>
  );
}

/* ─── 메인 페이지 ───────────────────────────────────────────── */
export function AnalyticsPage() {
  return (
    <div className={styles.analyticsPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>나의 논리 성장 분석 대시보드</h1>
          </div>
        </div>
        <AnalyticsDashboardSection />
        <AnalyticsHistorySection />
      </div>
    </div>
  );
}
