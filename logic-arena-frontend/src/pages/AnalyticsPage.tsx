import { useState, useMemo } from 'react';
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
} from 'recharts';
import styles from './AnalyticsPage.module.css';

/* ─── 타입 ─────────────────────────────────────────────── */
type Grade = 'A' | 'B' | 'C';
type Category = '전체' | '사회' | '과학' | '정치' | '자유';
type SortKey = '최신순' | '높은 점수순' | '낮은 점수순';
type Position = '찬성' | '반대';

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

/* ─── 상수 ─────────────────────────────────────────────── */
const GRADE_COLOR: Record<Grade, string> = {
  A: '#7b74ff',
  B: '#00f5a0',
  C: '#fe7250',
};

const CATEGORY_COLOR: Record<Category, { bg: string; text: string; border: string }> = {
  '전체': { bg: 'bg-[#30363D]', text: 'text-gray-200', border: 'border-[#30363D]' },
  '사회': { bg: 'bg-[#3B82F6]/15', text: 'text-[#3B82F6]', border: 'border-[#3B82F6]/30' },
  '과학': { bg: 'bg-[#10B981]/15', text: 'text-[#10B981]', border: 'border-[#10B981]/30' },
  '정치': { bg: 'bg-[#F59E0B]/15', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/30' },
  '자유': { bg: 'bg-[#8B5CF6]/15', text: 'text-[#8B5CF6]', border: 'border-[#8B5CF6]/30' },
};

const CATEGORIES: Category[] = ['전체', '사회', '과학', '정치', '자유'];
const SORT_KEYS: SortKey[] = ['최신순', '높은 점수순', '낮은 점수순'];

function getGrade(score: number): Grade {
  if (score >= 81) return 'A';
  if (score >= 51) return 'B';
  return 'C';
}

/* ─── 목 데이터 ─────────────────────────────────────────── */
const RADAR_DATA = [
  { axis: '근거 제시', userValue: 82, avgValue: 65 },
  { axis: '반박 능력', userValue: 68, avgValue: 55 },
  { axis: '문해력', userValue: 75, avgValue: 60 },
  { axis: '일관성', userValue: 88, avgValue: 62 },
  { axis: '설득력', userValue: 71, avgValue: 58 },
];

const LINE_DATA = [
  { date: '02/10', score: 54, topic: '사형제도 폐지 여부' },
  { date: '02/17', score: 61, topic: '학생 스마트폰 교내 사용 금지' },
  { date: '02/24', score: 65, topic: '수행평가 절대평가 전환' },
  { date: '03/03', score: 72, topic: '인공지능 저작권 찬반' },
  { date: '03/08', score: 78, topic: '원전 에너지 확대 정책' },
  { date: '03/13', score: 88, topic: '기본소득제 도입 찬반' },
];
// KPI_DATA 배열 수정
const KPI_DATA = [
  { 
    label: '평균 점수', 
    value: '76점', 
    trend: '+4점', 
    trendUp: true, 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
      </svg>
    )
  },
  { 
    label: '총 토론 횟수', 
    value: '34회', 
    trend: '+2회 (이번 주)', 
    trendUp: true, 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    )
  },
  { 
    label: '최근 성장률', 
    value: '12%', 
    trend: '상위 15%', 
    trendUp: true, 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
      </svg>
    )
  },
];


const RECOMMENDED_TRAINING = {
  title: '반박 논리 보충 및 감정적 어조 순화',
  description: '최근 토론에서 감정적인 표현이 잦아 객관적 논거의 신뢰도가 떨어지는 경향이 있습니다. 주장을 인정한 뒤 논리적으로 재반박하는 연습을 해보세요.',
  actionLabel: '연습방 바로가기',
};

const MOCK_REPORTS: ReportItem[] = [
  {
    id: 1,
    date: '2026-03-13',
    dateLabel: '2026.03.13',
    topic: '기본소득제 도입 찬반',
    score: 88,
    category: '정치',
    position: '찬성',
    best: '구체적인 통계 자료를 활용한 근거 제시가 탁월하며 논리 흐름이 매우 체계적임',
    needsImprovement: '상대방의 반박에 대한 재반박 논리 보충 필요',
  },
  {
    id: 2,
    date: '2026-03-08',
    dateLabel: '2026.03.08',
    topic: '원전 에너지 확대 정책',
    score: 78,
    category: '과학',
    position: '반대',
    best: '과학적 데이터 인용이 정확하고 신뢰도 높은 출처를 활용함',
    needsImprovement: '감정적 어조를 줄이고 객관적 논거를 더 강화할 필요 있음',
  },
  {
    id: 3,
    date: '2026-03-03',
    dateLabel: '2026.03.03',
    topic: '인공지능 저작권 찬반',
    score: 72,
    category: '사회',
    position: '찬성',
    best: '다양한 관점에서 근거를 균형 있게 제시함',
    needsImprovement: '결론부에서 논리적 연결 구조 보강 필요',
  },
  {
    id: 4,
    date: '2026-02-24',
    dateLabel: '2026.02.24',
    topic: '수행평가 절대평가 전환',
    score: 65,
    category: '사회',
    position: '반대',
    best: '전체 논리 흐름이 체계적으로 구성됨',
    needsImprovement: '상대 주장을 인정한 후 반박 시도 논리 보완 필요',
  },
  {
    id: 5,
    date: '2026-02-17',
    dateLabel: '2026.02.17',
    topic: '학생 스마트폰 교내 사용 금지',
    score: 61,
    category: '자유',
    position: '찬성',
    best: '주제에 대한 사전 지식이 풍부하며 사례 활용이 적절함',
    needsImprovement: '감정적 표현 줄이고 객관적 논거 강화 필요',
  },
  {
    id: 6,
    date: '2026-02-10',
    dateLabel: '2026.02.10',
    topic: '사형제도 폐지 여부',
    score: 54,
    category: '정치',
    position: '반대',
    best: '인권적 관점의 논거가 일관되게 유지됨',
    needsImprovement: '반박 능력 및 재반박 논리 전반적으로 보완 시급',
  },
];

/* ─── 커스텀 툴팁 (AreaChart) ──────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLineTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className={`${styles.kpiCard} !p-3 bg-opacity-90 backdrop-blur-sm z-50`}>
      <div className="text-gray-100 font-semibold mb-1">{d.topic}</div>
      <div className="text-[#8B5CF6] font-bold">{d.score}점</div>
    </div>
  );
}

/* ─── 커스텀 Dot (AreaChart hover) ─────────────────────── */
function CustomDot(props: any) {
  const { cx, cy, key } = props;
  return <circle key={key} cx={cx} cy={cy} r={5} fill="#8B5CF6" stroke="#0D1117" strokeWidth={2} />;
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
        fill="#8B949E"
        fontSize="12"
        fontWeight="500"
        dy={dy}
      >
        <tspan>{payload.value}</tspan>
      </text>
    </g>
  );
}

/* ─── 하위 컴포넌트들 ───────────────────────────────────── */
function KPICard({ data }: { data: typeof KPI_DATA[0] }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{data.label}</span>
        <span className={styles.kpiIcon}>{data.icon}</span>
      </div>
      <div>
        <div className={styles.kpiValue}>{data.value}</div>
        <div className={`${styles.kpiTrendWrapper} ${data.trendUp ? styles.kpiTrendUp : 'text-[#EF4444]'}`}>
          {data.trend}
        </div>
      </div>
    </div>
  );
}

function RecommendationSection() {
  return (
    <div className={styles.recommendationCard}>
      <div className={styles.recommendationLeft}>
        <div className={styles.recommendationHeader}>
          <span className={styles.recommendationBadge}>오늘의 추천 훈련</span>
          <h3 className={styles.chartTitle}>{RECOMMENDED_TRAINING.title}</h3>
        </div>
        <p className={styles.recommendationDesc}>{RECOMMENDED_TRAINING.description}</p>
      </div>
      <button className={styles.recommendationBtn}>
        {RECOMMENDED_TRAINING.actionLabel}
      </button>
    </div>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  const grade = getGrade(item.score);
  const catColor = CATEGORY_COLOR[item.category] || CATEGORY_COLOR['전체'];

  return (
    <div className={styles.reportCard}>
      {/* LEFT: 날짜 + 등급 */}
      <div className="flex items-center md:flex-col md:items-start md:w-32 flex-shrink-0 gap-3 md:gap-2">
        <div className="text-sm text-[#8B949E] font-medium">{item.dateLabel}</div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-[#0D1117] text-sm"
            style={{ background: GRADE_COLOR[grade] }}
          >
            {grade}
          </div>
          <div className="text-lg font-bold text-gray-200 md:hidden">{item.score}점</div>
        </div>
      </div>

      {/* CENTER: 주제 + 포지션 + 카테고리 칩 */}
      <div className="flex-1 flex flex-col min-w-0 pr-4 border-r-0 md:border-r border-[#30363D] gap-2">
        <h3 className="text-lg font-bold text-gray-100 truncate" title={item.topic}>
          {item.topic}
        </h3>
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              item.position === '찬성' ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-[#EF4444]/15 text-[#EF4444]'
            }`}
          >
            {item.position}
          </span>
          {/* 카테고리 컬러 칩 적용 */}
          <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${catColor.bg} ${catColor.text} ${catColor.border}`}>
            {item.category}
          </span>
          <span className="hidden md:inline-block text-sm font-bold text-[#8B5CF6] ml-auto mr-4">{item.score}점</span>
        </div>
      </div>

      {/* RIGHT: Best + 보완점 + 상세 버튼 */}
      <div className="flex flex-col flex-shrink-0 md:w-80 w-full gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 text-sm max-w-full">
            <span className="text-xs font-bold text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded flex-shrink-0">Best</span>
            <span className="text-gray-300 truncate" title={item.best}>
              {item.best}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm max-w-full">
            <span className="text-xs font-bold text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded flex-shrink-0">Needs</span>
            <span className="text-gray-300 truncate" title={item.needsImprovement}>
              {item.needsImprovement}
            </span>
          </div>
        </div>
        <div className="flex justify-end mt-1">
          <button className="px-4 py-1.5 text-sm font-medium text-[#8B5CF6] border border-[#8B5CF6]/30 bg-[#8B5CF6]/5 rounded-lg hover:bg-[#8B5CF6] hover:text-white transition-colors duration-200 cursor-pointer">
            상세 보기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── 메인 페이지 ───────────────────────────────────────── */
export function AnalyticsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<Category>('전체');
  const [sortKey, setSortKey] = useState<SortKey>('최신순');

  const filtered = useMemo(() => {
    let list = [...MOCK_REPORTS];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => r.topic.toLowerCase().includes(q));
    }
    if (category !== '전체') {
      list = list.filter((r) => r.category === category);
    }
    if (sortKey === '높은 점수순') list.sort((a, b) => b.score - a.score);
    else if (sortKey === '낮은 점수순') list.sort((a, b) => a.score - b.score);
    else list.sort((a, b) => b.date.localeCompare(a.date));

    return list;
  }, [searchQuery, category, sortKey]);

  return (
    <div className={styles.analyticsPage}>
      <div className={styles.container}>
        
        {/* 헤더 */}
        <div className={styles.header}>
          <div >
            <h1 className={styles.headerTitle}>
              나의 논리 성장 분석 대시보드
            </h1>
          </div>
        </div>

        {/* ── Bento Grid ────────────────────────────────────────── */}
        <div className={styles.bentoGridWrapper}>
          <div className={styles.bentoGridContainer}>
            
            {/* Top Row: KPIs & Recommendation */}
            <div className={styles.bentoRow}>
              {/* 1. KPI Cards (span 5) */}
              <div className={styles.kpiGrid}>
                {KPI_DATA.map(kpi => <KPICard key={kpi.label} data={kpi} />)}
              </div>

              {/* 2. 오늘의 추천 훈련 (span 7) */}
              <div className={styles.recommendationContainer}>
                <RecommendationSection />
              </div>
            </div>
            
            {/* Bottom Row: Charts */}
            <div className={styles.bentoRow}>
              {/* 3. Area Chart - 성장 추이 (span 7) */}
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                  <h2 className={styles.chartTitle}>논리 점수 성장 추이</h2>
                </div>
                <div className={styles.chartCardFlex}>
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <AreaChart data={LINE_DATA} margin={{ top: 10, right: 20, bottom: 10, left: -20 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#30363D" strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#8B949E', fontSize: 12 }} 
                        axisLine={false} 
                        tickLine={false} 
                        dy={10}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tick={{ fill: '#8B949E', fontSize: 12 }} 
                        axisLine={false} 
                        tickLine={false} 
                        dx={-10}
                      />
                      <Tooltip 
                        content={<CustomLineTooltip />} 
                        cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '4 4' }} 
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#8B5CF6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorScore)"
                        dot={<CustomDot />}
                        activeDot={{ r: 7, fill: '#8B5CF6', stroke: '#0D1117', strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 4. Radar Chart (span 5) */}
              <div className={`${styles.chartCard} ${styles.chartCardRadar}`}>
                <div className={styles.chartHeaderWrap}>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                    <h2 className={styles.chartTitle}>논리 밸런스 비교</h2>
                  </div>
                  <div className={styles.legend}>
                    <div className={styles.legendItem}><span className={styles.legendIndicatorUser}></span><span className={styles.legendTextUser}>나의 지표</span></div>
                    <div className={styles.legendItem}><span className={styles.legendIndicatorAvg}></span><span className={styles.legendTextAvg}>전체 평균</span></div>
                  </div>
                </div>
                <div className={styles.chartCardFlex}>
                  <ResponsiveContainer width="100%" height="100%" debounce={0}>
                    <RadarChart data={RADAR_DATA} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="#30363D" />
                      <PolarAngleAxis
                        dataKey="axis"
                        tick={<RadarCustomTick />}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: '#8B949E', fontSize: 10 }}
                        tickCount={5}
                        stroke="#30363D"
                      />
                      <Radar
                        name="전체 평균"
                        dataKey="avgValue"
                        stroke="#8B949E"
                        fill="#8B949E"
                        fillOpacity={0.15}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        isAnimationActive={false}
                      />
                      <Radar
                        name="나의 점수"
                        dataKey="userValue"
                        stroke="#8B5CF6"
                        fill="#8B5CF6"
                        fillOpacity={0.25}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 중단: 컨트롤 바 ─────────────────────────────────── */}
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
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <svg className={styles.selectArrow} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div className={styles.selectWrapper}>
              <select
                className={styles.sortSelect}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                {SORT_KEYS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <svg className={styles.selectArrow} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </div>

        {/* ── 하단: 리포트 카드 리스트 ────────────────────────── */}
        <div className={styles.reportGrid}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#161B22] border border-[#30363D] border-dashed rounded-xl">
              <svg className="text-[#8B949E] mb-4" xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <p className="text-[#8B949E] text-lg font-medium">검색 결과가 없습니다.</p>
              <p className="text-[#8B949E]/70 text-sm mt-1">다른 키워드나 필터로 검색해보세요.</p>
            </div>
          ) : (
            filtered.map((item) => <ReportCard key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}
