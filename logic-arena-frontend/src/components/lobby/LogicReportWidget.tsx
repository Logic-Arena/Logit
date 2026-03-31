import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

/* ── 타입 ───────────────────────────────────────────────── */
interface ReportItem {
  topic: string;
  score: number;
  best: string;
  needsImprovement: string;
  growth: string;
  timeAgo: string;
}

/* ── 등급 계산 ──────────────────────────────────────────── */
function getGrade(score: number): 'A' | 'B' | 'C' {
  if (score >= 81) return 'A';
  if (score >= 51) return 'B';
  return 'C';
}

const GRADE_COLOR: Record<'A' | 'B' | 'C', string> = {
  A: '#7b74ff',
  B: '#00f5a0',
  C: '#fe7250',
};

/* ── 목 데이터 ──────────────────────────────────────────── */
const MOCK_REPORTS: ReportItem[] = [
  {
    timeAgo: '1일 전',
    topic: '인공지능 저작권 찬반',
    score: 88,
    best: '구체적인 통계 자료를 활용한 근거 제시가 탁월함',
    needsImprovement: '상대방의 반박에 대한 재반박 논리 보충 필요',
    growth: "지난번보다 '어휘 적절성' 점수 10% 상승",
  },
  {
    timeAgo: '3일 전',
    topic: '사형제도 폐지 여부',
    score: 72,
    best: '다양한 관점에서 근거를 균형 있게 제시함',
    needsImprovement: '결론부에서 논리적 연결 구조 보강 필요',
    growth: "지난번보다 '논리적 일관성' 점수 5% 상승",
  },
  {
    timeAgo: '5일 전',
    topic: '학생 스마트폰 교내 사용 금지',
    score: 45,
    best: '주제에 대한 사전 지식이 풍부함',
    needsImprovement: '감정적 표현 줄이고 객관적 논거 강화 필요',
    growth: '전반적인 발표 유창성 전 회차 대비 개선됨',
  },
  {
    timeAgo: '1주 전',
    topic: '수행평가 절대평가 전환',
    score: 65,
    best: '전체 논리 흐름이 체계적으로 구성됨',
    needsImprovement: '상대 주장 인정 후 반박 시도 논리 보완 필요',
    growth: "지난번보다 '근거 구체성' 점수 8% 상승",
  },
];

/* ── 포털 툴팁 ──────────────────────────────────────────── */
interface TooltipPortalProps {
  item: ReportItem;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

function TooltipPortal({ item, anchorRef }: TooltipPortalProps) {
  const grade = getGrade(item.score);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const GAP = 8;

    setStyle({
      position: 'fixed',
      top: rect.top,
      right: window.innerWidth - rect.left + GAP,
      visibility: 'visible',
    });
  }, [anchorRef]);

  // Hide tooltip on mobile devices (width <= 768px)
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    return null;
  }

  return createPortal(
    <div className="report-tooltip" style={style}>
      <div className="report-tooltip__header">
        <span className="report-tooltip__topic">{item.topic}</span>
        <span className="report-tooltip__score">({item.score}점)</span>
        <span
          className="report-tooltip__badge"
          style={{ background: GRADE_COLOR[grade] }}
        >
          {grade}
        </span>
      </div>
      <div className="report-tooltip__section">
        <span className="report-tooltip__label report-tooltip__label--best">Best</span>
        <span className="report-tooltip__text">{item.best}</span>
      </div>
      <div className="report-tooltip__section">
        <span className="report-tooltip__label report-tooltip__label--improve">보완점</span>
        <span className="report-tooltip__text">{item.needsImprovement}</span>
      </div>
      <div className="report-tooltip__section">
        <span className="report-tooltip__label report-tooltip__label--growth">성장</span>
        <span className="report-tooltip__text">{item.growth}</span>
      </div>
    </div>,
    document.body
  );
}

/* ── 각 아이템 ──────────────────────────────────────────── */
function ReportItemCard({ item, isLast }: { item: ReportItem; isLast: boolean }) {
  const [hovered, setHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const grade = getGrade(item.score);

  return (
    <div className={`report-item${isLast ? ' report-item--last' : ''}`}>
      {/* Dot + 수직선 */}
      <div className="report-item__dot-col">
        <div
          className="report-item__dot"
          style={{ background: GRADE_COLOR[grade], color: GRADE_COLOR[grade] }}
        />
        {!isLast && <div className="report-item__line" />}
      </div>

      {/* 본문 */}
      <div
        ref={wrapperRef}
        className="report-item__content-wrapper"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="report-item__time">{item.timeAgo}</div>

        {/* 제목 + 점수 */}
        <div className="report-item__title-row">
          <span className="report-item__topic">{item.topic}</span>
          <span className="report-item__score">({item.score}점)</span>
        </div>

        {/* Best */}
        <div className="report-item__line-text report-item__line-text--best">
          <span className="report-item__label">Best</span>
          <span className="report-item__detail report-item__detail--ellipsis">{item.best}</span>
        </div>

        {/* 보완점 */}
        <div className="report-item__line-text report-item__line-text--improve">
          <span className="report-item__label">보완점</span>
          <span className="report-item__detail report-item__detail--ellipsis">{item.needsImprovement}</span>
        </div>

        {/* 성장 지표 */}
        <div className="report-item__line-text report-item__line-text--growth">
          <span className="report-item__label">성장</span>
          <span className="report-item__detail report-item__detail--ellipsis">{item.growth}</span>
        </div>

        {/* 포털 툴팁 */}
        {hovered && <TooltipPortal item={item} anchorRef={wrapperRef} />}
      </div>
    </div>
  );
}

/* ── 메인 위젯 ──────────────────────────────────────────── */
export function LogicReportWidget() {
  const navigate = useNavigate();
  return (
    <aside className="report-widget">
      <h2 className="report-widget__title">나의 논리 성장 리포트</h2>

      <div className="report-timeline">
        {MOCK_REPORTS.map((item, idx) => (
          <ReportItemCard
            key={idx}
            item={item}
            isLast={idx === MOCK_REPORTS.length - 1}
          />
        ))}
      </div>

      <button className="report-widget__footer-link" onClick={() => navigate('/analytics')}>전체 리포트 보기 →</button>
    </aside>
  );
}
