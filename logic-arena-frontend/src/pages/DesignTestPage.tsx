import { useState, useEffect, useRef } from "react";
import "./DesignTestPage.css";
import DotSphereLoader from "../components/common/DotSphereLoader";

type AlignSide = "pro" | "con";
type BubbleVariant = "player" | "ai" | "coach";

interface Message {
  id: string;
  author: string;
  align: AlignSide;
  variant: BubbleVariant;
  label: string;
  text: string;
}

interface ScoreData {
  name: string;
  vote: 'pro' | 'con';
  type: 'player' | 'ai';
  logic: number;
  evidence: number;
  persuasion: number;
  rebuttal: number;
  total: number;
  rank: number;
  advice: string;
}

// ============================================================
// Mock Data
// ============================================================
const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    author: "찬성 플레이어",
    align: "pro",
    variant: "player",
    label: "최초 주장",
    text: "인공지능의 발전은 인류에게 긍정적인 영향을 미칩니다. 첫째, AI는 반복적인 업무를 자동화하여 인간이 더 창의적인 일에 집중할 수 있게 합니다. 둘째, 의료 분야에서 AI는 질병 조기 진단을 통해 생명을 구할 수 있습니다. 셋째, AI 기반 교육은 개인 맞춤형 학습을 가능하게 하여 교육 효율성을 높입니다."
  },
  {
    id: "2",
    author: "반대 플레이어",
    align: "con",
    variant: "player",
    label: "최초 주장",
    text: "인공지능의 무분별한 발전은 위험합니다. AI로 인한 일자리 감소는 사회적 불평등을 심화시킬 것입니다. 또한 AI의 의사결정 과정은 불투명하여 편향성 문제를 야기할 수 있으며, 개인정보 침해와 감시 사회로 이어질 우려가 있습니다."
  },
  {
    id: "3",
    author: "AI 보조·반대",
    align: "con",
    variant: "ai",
    label: "AI 주장",
    text: "반대 측의 주장을 보완하자면, AI로 인한 실업 문제는 단순히 일자리 전환의 문제가 아닙니다. 특히 저숙련 노동자들은 재교육이 어려워 사회적 양극화가 심화될 수 있으며, AI의 편향된 알고리즘은 차별을 자동화할 위험이 있습니다."
  },
  {
    id: "4",
    author: "AI 보조·찬성",
    align: "pro",
    variant: "ai",
    label: "AI 주장",
    text: "찬성 측의 주장을 보완하자면, AI 기술은 환경 문제 해결에도 기여합니다. 기후 변화 예측, 에너지 효율 최적화, 폐기물 관리 등에서 AI는 이미 실질적인 성과를 내고 있습니다. 또한 의료 접근성이 낮은 지역에서도 AI 진단 시스템으로 더 많은 생명을 구할 수 있습니다."
  },
  {
    id: "5",
    author: "찬성 플레이어",
    align: "pro",
    variant: "player",
    label: "반론",
    text: "AI가 일자리를 대체한다는 우려는 이해하지만, 역사적으로 기술 발전은 항상 새로운 일자리를 창출해왔습니다. 또한 정부의 재교육 프로그램과 사회안전망 강화를 통해 전환 과정의 부작용을 최소화할 수 있습니다."
  },
  {
    id: "6",
    author: "훈수 AI (찬성P)",
    align: "pro",
    variant: "coach",
    label: "",
    text: "좋은 반론입니다. 다음에는 상대방의 핵심 논점을 더 직접적으로 공략하면 좋겠습니다."
  },
];

const MOCK_SCORES: ScoreData[] = [
  {
    name: "논리왕",
    vote: "pro",
    type: "player",
    logic: 22,
    evidence: 20,
    persuasion: 21,
    rebuttal: 19,
    total: 82,
    rank: 1,
    advice: "논리적 구조가 탄탄합니다. 다음에는 상대방의 핵심 논점을 더 직접적으로 공략하면 좋겠습니다."
  },
  {
    name: "AI 보조 (찬성)",
    vote: "pro",
    type: "ai",
    logic: 23,
    evidence: 22,
    persuasion: 20,
    rebuttal: 18,
    total: 83,
    rank: 2,
    advice: ""
  },
  {
    name: "반박의제왕",
    vote: "con",
    type: "player",
    logic: 19,
    evidence: 18,
    persuasion: 20,
    rebuttal: 21,
    total: 78,
    rank: 3,
    advice: "반론이 날카롭습니다. 다음에는 더 구체적인 데이터를 제시하면 설득력이 높아질 것입니다."
  },
  {
    name: "AI 보조 (반대)",
    vote: "con",
    type: "ai",
    logic: 20,
    evidence: 19,
    persuasion: 18,
    rebuttal: 19,
    total: 76,
    rank: 4,
    advice: ""
  },
];

const DEBATE_TIPS = [
  "강한 논거는 구체적인 사례나 통계로 뒷받침됩니다.",
  "상대방의 주장을 먼저 인정한 뒤 반박하면 설득력이 높아집니다.",
  "감정적인 언어보다 논리적 근거가 판정에서 더 높은 점수를 받습니다.",
  "최종 변론에서는 핵심 논점만 간결하게 요약하세요.",
  "반론 시에는 상대방이 실제로 말한 내용을 정확히 인용하세요.",
  "증거 제시 시 출처가 명확할수록 신뢰도가 올라갑니다.",
  "논증 구조: 주장 → 근거 → 예시 순서가 가장 명확합니다.",
  "긴 문장보다 짧고 명확한 문장이 설득력이 강합니다.",
];

const TYPEWRITER_THINKING_MS = 3000;
const TYPEWRITER_CHAR_MS = 36;
const TYPEWRITER_MAX_MS = 9000;

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};

function splitGraphemes(text: string) {
  const Segmenter = (
    Intl as typeof Intl & {
      Segmenter?: new (
        locale: string,
        options: { granularity: "grapheme" },
      ) => GraphemeSegmenter;
    }
  ).Segmenter;

  if (Segmenter) {
    return Array.from(
      new Segmenter("ko", { granularity: "grapheme" }).segment(text),
      ({ segment }) => segment,
    );
  }

  return Array.from(text);
}

// ============================================================
// Components
// ============================================================

function TypewriterText({
  text,
  animationKey,
  thinkingLabel = "AI가 생각 중입니다...",
}: {
  text: string;
  animationKey: string;
  thinkingLabel?: string;
}) {
  const [visibleText, setVisibleText] = useState("");
  const [status, setStatus] = useState<"thinking" | "typing" | "done">(
    "thinking",
  );

  useEffect(() => {
    let active = true;
    const timers: number[] = [];

    const thinkingTimer = window.setTimeout(() => {
      if (!active) return;

      const segments = splitGraphemes(text);
      if (segments.length === 0) {
        setStatus("done");
        return;
      }

      const maxTicks = Math.max(
        1,
        Math.floor(TYPEWRITER_MAX_MS / TYPEWRITER_CHAR_MS),
      );
      const segmentsPerTick = Math.max(
        1,
        Math.ceil(segments.length / maxTicks),
      );
      const tickCount = Math.ceil(segments.length / segmentsPerTick);

      setStatus("typing");
      Array.from({ length: tickCount }).forEach((_, index) => {
        const endIndex = Math.min(
          segments.length,
          (index + 1) * segmentsPerTick,
        );
        const timer = window.setTimeout(
          () => {
            if (!active) return;

            setVisibleText(segments.slice(0, endIndex).join(""));
            if (endIndex === segments.length) setStatus("done");
          },
          TYPEWRITER_CHAR_MS * (index + 1),
        );
        timers.push(timer);
      });
    }, TYPEWRITER_THINKING_MS);

    timers.push(thinkingTimer);

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [animationKey, text]);

  if (status === "thinking") {
    return (
      <span className="debate-bubble__thinking">
        <span>{thinkingLabel}</span>
        <span className="typing-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
    );
  }

  return (
    <>
      {visibleText}
      {status === "typing" && (
        <span className="typewriter-caret" aria-hidden="true" />
      )}
    </>
  );
}

function DebateChatView() {
  const chatRef = useRef<HTMLDivElement>(null);
  const mySide: AlignSide | null = "pro"; // 가정: 나는 찬성
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        ref={chatRef}
        className="debate-chat-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {MOCK_MESSAGES.map((item) => {
          const isOnMySide = mySide ? item.align === mySide : false;
          const avatarChar =
            item.variant === "ai"
              ? "AI"
              : mySide && mySide === item.align
                ? "나"
                : item.align === "pro"
                  ? "찬"
                  : "반";

          if (item.variant === "coach") {
            return (
              <div key={item.id} className="bubble-row bubble-row--coach">
                <article className="debate-bubble debate-bubble--coach">
                  <div className="debate-bubble__meta">
                    <strong>{item.author}</strong>
                    {item.label && <span>{item.label}</span>}
                  </div>
                  <div className="debate-bubble__body">
                    <TypewriterText
                      text={item.text}
                      animationKey={item.id}
                      thinkingLabel="논점을 정리 중입니다..."
                    />
                  </div>
                </article>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={`bubble-row ${isOnMySide ? "bubble-row--right" : "bubble-row--left"}`}
            >
              <div className={`bubble-avatar bubble-avatar--${item.align}`}>
                {avatarChar}
              </div>
              <div className="bubble-content">
                <div className="bubble-meta">
                  <strong className="bubble-meta__author">{item.author}</strong>
                  <span className="bubble-meta__type">{item.label}</span>
                </div>
                <article
                  className={`debate-bubble debate-bubble--${item.align}-${item.variant}`}
                >
                  <div className="debate-bubble__body">
                    {item.variant === "ai" ? (
                      <TypewriterText
                        text={item.text}
                        animationKey={item.id}
                      />
                    ) : (
                      item.text
                    )}
                  </div>
                </article>
              </div>
            </div>
          );
        })}
      </div>

      {/* 입력 패널 */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--color-border)",
          padding: "14px 20px",
          background: "var(--color-surface)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--color-text-muted)" }}>
          <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>내 차례</span>
          <span>•</span>
          <span>찬성P · 주장 작성 중</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="주장을 작성하세요..."
            style={{
              flex: 1,
              minHeight: "80px",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              color: "var(--color-text)",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "none",
            }}
          />
          <button
            className="btn btn--primary"
            style={{
              alignSelf: "flex-end",
              minWidth: "80px",
              height: "38px",
            }}
          >
            제출
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicGeneratingCard({ attempts: _attempts }: { attempts: number }) {
  return (
    <div className="topic-generating-view">
      {/* 타이틀 영역 */}
      <div className="topic-generating-view__header">
        <div className="topic-generating-view__title-row">
          <div className="topic-generating-view__icon">
            <div className="topic-generating-view__icon-inner" />
          </div>
          <span className="topic-generating-view__title-text">AI가 주제를 만드는 중</span>
          <div className="topic-generating-view__dots">
            <span />
            <span />
            <span />
          </div>
        </div>
        {/* 시머 스켈레톤 바 1 */}
        <div className="topic-generating-view__shimmer-bar topic-generating-view__shimmer-bar--long" />
        {/* 시머 스켈레톤 바 2 */}
        <div className="topic-generating-view__shimmer-bar topic-generating-view__shimmer-bar--short" />
      </div>

      {/* 보조 텍스트 */}
      <p className="topic-generating-view__subtitle">AI가 더 흥미로운 쟁점을 고르고 있어요.</p>

      {/* 흰 패널 (ghosted 찬성/반대 프리뷰) */}
      <div className="topic-generating-view__panel">
        <div className="topic-generating-view__ghosted-choices">
          {/* 찬성 placeholder */}
          <div className="topic-generating-view__ghosted-item">
            <div className="topic-generating-view__ghosted-icon" />
            <div className="topic-generating-view__ghosted-text" />
          </div>
          {/* 반대 placeholder */}
          <div className="topic-generating-view__ghosted-item">
            <div className="topic-generating-view__ghosted-icon" />
            <div className="topic-generating-view__ghosted-text" />
          </div>
        </div>
        <p className="topic-generating-view__panel-footer">주제가 확정되면 진영을 선택할 수 있어요.</p>
      </div>
    </div>
  );
}

function SelectionWaitingCard({ side }: { side: "pro" | "con" }) {
  const myLabel = side === "pro" ? "찬성" : "반대";
  // Mock data: 상대가 대기 중
  const opponentReady = false;
  const opponentSide = side === "pro" ? "con" : "pro";
  const opponentLabel = opponentSide === "pro" ? "찬성" : "반대";

  return (
    <div className="selection-dual-card-wrapper" aria-live="polite">
      <p className="selection-dual-card-wrapper__guidance">
        상대방이 진영을 선택하면 토론이 시작됩니다.
      </p>
      <div className="selection-dual-card">
        {/* 내 선택 행 */}
        <div className={`selection-dual-item selection-dual-item--my selection-dual-item--${side}`}>
          <div className={`selection-dual-item__icon selection-dual-item__icon--filled selection-dual-item__icon--${side}`}>
            {side === "pro" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          <div className="selection-dual-item__content">
            <div className="selection-dual-item__label">{myLabel}</div>
          </div>
          <div className="selection-dual-item__desc">
            {side === "pro" ? "주제에 동의합니다" : "주제에 반대합니다"}
          </div>
        </div>

        {/* 상대 선택 행 (대기 중 / 완료) */}
        <div className={`selection-dual-item selection-dual-item--opponent${opponentReady ? ' selection-dual-item--ready' : ''}${opponentSide ? ` selection-dual-item--${opponentSide}` : ''}`}>
          <div className="selection-dual-item__icon selection-dual-item__icon--dashed">
            {opponentReady && opponentSide ? (
              opponentSide === "pro" ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )
            ) : (
              <div className="selection-dual-item__icon-placeholder" />
            )}
          </div>
          <div className="selection-dual-item__content">
            <div className={`selection-dual-item__label${opponentReady ? '' : ' selection-dual-item__label--pending'}`}>
              {opponentReady ? opponentLabel : "반대"}
            </div>
          </div>
          <div className="selection-dual-item__desc">
            {opponentReady ? (opponentSide === "pro" ? "주제에 동의합니다" : "주제에 반대합니다") : "주제에 반대합니다"}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopicGeneratingView() {
  return (
    <div className="topic-selection-view topic-selection-view-centered" style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      <TopicGeneratingCard attempts={0} />
      <div className="watermark-slot topic-selection-watermark-slot" aria-hidden="true" />
    </div>
  );
}

function SideSelectionView() {
  const [mySelection, setMySelection] = useState<"pro" | "con" | null>(null);

  const handleSelect = (side: "pro" | "con") => {
    setMySelection(side);
  };

  return (
    <div className="topic-selection-view topic-selection-view-centered" style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>
      <div
        style={{
          padding: "12px 0 20px 0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            토론 주제
          </span>
        </div>
        <div style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.4, color: "var(--color-text)" }}>
          인공지능의 발전은 인류에게 이로운가?
        </div>
      </div>

      {!mySelection && (
        <div className="selection-dual-card-wrapper">
          <p className="selection-dual-card-wrapper__guidance">
            원하는 진영을 선택하세요
          </p>
          <div className="side-selection-container">
            {(["pro", "con"] as const).map((side) => {
              const label = side === "pro" ? "찬성" : "반대";
              const desc = side === "pro" ? "주제에 동의합니다" : "주제에 반대합니다";
              return (
                <button
                  key={side}
                  className={`side-selection-card side-selection-card--${side}`}
                  onClick={() => handleSelect(side)}
                >
                  <div className="side-selection-card__icon">
                    {side === "pro" ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                  </div>
                  <div className="side-selection-card__content">
                    <div className="side-selection-card__label">{label}</div>
                    <div className="side-selection-card__desc">{desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mySelection && (
        <SelectionWaitingCard side={mySelection} />
      )}

      <div className="watermark-slot topic-selection-watermark-slot" aria-hidden="true" />
    </div>
  );
}

function JudgingWaitView() {
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setTipIdx((i) => (i + 1) % DEBATE_TIPS.length),
      4000,
    );
    return () => clearInterval(timer);
  }, []);

  const JUDGING_ANALYSIS_STEPS = ["논리", "근거", "반박", "설득"];

  return (
    <div className="judging-wait">
      <section className="judging-wait__hero" aria-live="polite">
        <div className="judging-wait__scale-stage">
          <DotSphereLoader size={240} hue={243} speed={0.008} wobbleAmount={0.08} />
        </div>
      </section>

      <div className="judging-wait__headline">
        <h2>AI 판정단이 논점을 심문 중.</h2>
        <p>주장, 근거, 반박을 스캔해서 승부를 계산하고 있어요</p>
      </div>

      <div className="judging-wait__stepper" aria-label="분석 단계">
        {JUDGING_ANALYSIS_STEPS.map((step, i) => (
          <div key={step} className="judging-wait__step">
            <div className="judging-wait__step-dot-wrapper">
              {i < JUDGING_ANALYSIS_STEPS.length - 1 && (
                <div className={`judging-wait__step-line ${i < 2 ? 'judging-wait__step-line--filled' : ''}`} />
              )}
              <div className={`judging-wait__step-dot ${i < 3 ? 'judging-wait__step-dot--filled' : 'judging-wait__step-dot--current'}`} />
            </div>
            <span className="judging-wait__step-label">{step}</span>
          </div>
        ))}
      </div>

      <div className="judging-wait__status-badge">
        <span />
        판결문 작성 중
      </div>

      <p key={tipIdx} className="judging-wait__tip-inline">
        <strong>토론 꿀팁</strong> · {DEBATE_TIPS[tipIdx]}
      </p>
    </div>
  );
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div
        style={{
          flex: 1,
          height: "6px",
          background: "var(--color-surface-2)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(value / 25) * 100}%`,
            background:
              value >= 20
                ? "var(--color-pro)"
                : value >= 13
                  ? "var(--color-host)"
                  : "var(--color-con)",
            borderRadius: "3px",
            transition: "width 0.4s",
          }}
        />
      </div>
      <span style={{ fontSize: "12px", minWidth: "22px", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function EndedView() {
  const winnerLabel = "찬성 팀 승리";
  const winnerColor = "var(--color-primary)";
  const RANK_BADGE = ["🥇", "🥈", "🥉", "4위"];
  const SCORE_CRITERIA: { key: keyof ScoreData; label: string }[] = [
    { key: "logic", label: "논리성" },
    { key: "evidence", label: "근거" },
    { key: "persuasion", label: "표현 명확성" },
    { key: "rebuttal", label: "반론" },
  ];

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "24px",
      padding: "20px"
    }}>
      <div style={{ textAlign: "center", paddingTop: "16px" }}>
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>⚖️</div>
        <div style={{ fontSize: "24px", fontWeight: 700, color: winnerColor }}>
          {winnerLabel}
        </div>
      </div>

      <div
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          fontSize: "14px",
          lineHeight: 1.8,
        }}
      >
        <div style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 600, marginBottom: "8px" }}>
          AI 총평
        </div>
        찬성 측이 더 논리적이고 구체적인 근거를 제시했습니다. 특히 AI의 긍정적 활용 사례를 잘 설명했으며, 반대 측의 우려에 대한 합리적인 반박을 제시했습니다.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
        {MOCK_SCORES.map((s) => {
          const sideColor = s.vote === "pro" ? "var(--color-pro)" : "var(--color-con)";
          return (
            <div
              key={s.name}
              style={{
                background: s.vote === "pro" ? "var(--color-pro-bg)" : "var(--color-con-bg)",
                border: `1px solid ${s.vote === "pro" ? "var(--color-pro)" : "var(--color-con)"}`,
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: sideColor }}>
                  {RANK_BADGE[s.rank - 1]} {s.name}
                </span>
                <span style={{ fontWeight: 700, fontSize: "15px" }}>
                  {s.total}점
                </span>
              </div>
              {SCORE_CRITERIA.map(({ key, label }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {label}
                  </span>
                  <ScoreBar value={s[key] as number} />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {MOCK_SCORES.filter((s) => s.type === "player" && s.advice).map((s) => (
        <div
          key={s.name}
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: s.vote === "pro" ? "var(--color-pro)" : "var(--color-con)", marginBottom: "6px" }}>
            {s.name}에게
          </div>
          <p style={{ fontSize: "13px", lineHeight: 1.7, margin: 0 }}>
            {s.advice}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Full Page Wrapper Components
// ============================================================

function DebatePageHeader({ title, phase }: { title: string; phase: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "12px 20px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        flexShrink: 0,
        gap: "4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          <span className="phase-status-badge">
            <span className="phase-status-badge__dot" />
            {phase}
          </span>
        </div>
      </div>
    </div>
  );
}

function FullPageWrapper({
  children,
  title = "토론방 #1234",
  phase = "주장 단계",
  showSidebar = true,
  showStageProgress = true
}: {
  children: React.ReactNode;
  title?: string;
  phase?: string;
  showSidebar?: boolean;
  showStageProgress?: boolean;
}) {
  return (
    <div className={`debate-page${showSidebar ? " debate-page--with-sidebar" : ""}`}>
      <div className="debate-main">
        <DebatePageHeader title={title} phase={phase} />
        {children}
      </div>
      {showSidebar && (
        <aside className="debate-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section__title">토론 주제</div>
            <p className="sidebar-topic">인공지능의 발전은 인류에게 이로운가?</p>
            <div className="sidebar-positions">
              <span className="sidebar-badge sidebar-badge--pro sidebar-badge--me">
                나·찬성
              </span>
              <span className="sidebar-badge sidebar-badge--con">
                상대·반대
              </span>
            </div>
          </div>

          {showStageProgress && (
            <div className="sidebar-section">
              <div className="sidebar-section__title">진행 단계</div>
              <div className="stage-item stage-item--done">
                <span className="stage-item__dot" />
                <span className="stage-item__label">1단계·주장</span>
                <span className="stage-item__badge">완료</span>
              </div>
              <div className="stage-item stage-item--active">
                <span className="stage-item__dot" />
                <span className="stage-item__label">2단계·반론</span>
                <span className="stage-item__badge stage-item__badge--active">진행 중</span>
              </div>
              <div className="stage-item stage-item--upcoming">
                <span className="stage-item__dot" />
                <span className="stage-item__label">3단계·최종 변론</span>
              </div>
              <div className="stage-item stage-item--upcoming">
                <span className="stage-item__dot" />
                <span className="stage-item__label">4단계·판정</span>
              </div>
            </div>
          )}

          <div className="sidebar-section">
            <div className="sidebar-section__title">최초 주장 요약</div>
            <div className="claim-summary claim-summary--pro">
              <div className="claim-summary__label">찬성 측</div>
              <p className="claim-summary__text">
                AI는 반복적인 업무를 자동화하고, 의료 분야에서 생명을 구하며, 교육의 효율성을 높입니다...
              </p>
            </div>
            <div className="claim-summary claim-summary--con">
              <div className="claim-summary__label">반대 측</div>
              <p className="claim-summary__text">
                AI로 인한 일자리 감소는 사회적 불평등을 심화시킬 것이며, 개인정보 침해와 감시 사회로...
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================
export function DesignTestPage() {
  const [activeTab, setActiveTab] = useState<"chat" | "judging" | "topic-generating" | "topic-selection" | "result">("chat");

  return (
    <div className="design-test-container">
      <div className="design-test-header">
        <h1>토론 페이지 디자인 테스트</h1>
        <div className="design-test-tabs">
          <button
            className={`design-test-tab ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            토론 채팅
          </button>
          <button
            className={`design-test-tab ${activeTab === "topic-generating" ? "active" : ""}`}
            onClick={() => setActiveTab("topic-generating")}
          >
            주제 생성 중
          </button>
          <button
            className={`design-test-tab ${activeTab === "topic-selection" ? "active" : ""}`}
            onClick={() => setActiveTab("topic-selection")}
          >
            진영 선택
          </button>
          <button
            className={`design-test-tab ${activeTab === "judging" ? "active" : ""}`}
            onClick={() => setActiveTab("judging")}
          >
            판정 대기
          </button>
          <button
            className={`design-test-tab ${activeTab === "result" ? "active" : ""}`}
            onClick={() => setActiveTab("result")}
          >
            결과 화면
          </button>
        </div>
      </div>

      <div className="design-test-content">
        {activeTab === "chat" && (
          <FullPageWrapper title="토론방 #1234" phase="주장 단계" showSidebar={true} showStageProgress={true}>
            <DebateChatView />
          </FullPageWrapper>
        )}
        {activeTab === "topic-generating" && (
          <FullPageWrapper title="토론방 #1234" phase="주제 생성 중" showSidebar={false} showStageProgress={false}>
            <TopicGeneratingView />
          </FullPageWrapper>
        )}
        {activeTab === "topic-selection" && (
          <FullPageWrapper title="토론방 #1234" phase="진영 선택" showSidebar={false} showStageProgress={false}>
            <SideSelectionView />
          </FullPageWrapper>
        )}
        {activeTab === "judging" && (
          <FullPageWrapper title="토론방 #1234" phase="AI 판정 중" showSidebar={true} showStageProgress={false}>
            <JudgingWaitView />
          </FullPageWrapper>
        )}
        {activeTab === "result" && (
          <FullPageWrapper title="토론방 #1234" phase="토론 종료" showSidebar={true} showStageProgress={false}>
            <EndedView />
          </FullPageWrapper>
        )}
      </div>
    </div>
  );
}

export default DesignTestPage;
