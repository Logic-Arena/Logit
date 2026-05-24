import { useState, useEffect, useRef } from "react";
import "./DesignTestPage.css";

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
    author: "훈수AI(찬성 플레이어)",
    align: "pro",
    variant: "coach",
    label: "",
    text: "좋은 반론입니다. 추가로 정부의 재교육 프로그램과 사회안전망 강화를 언급하면 더 설득력이 높아질 것입니다."
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
];

const LOGIT_LETTERS = ["L", "O", "G", "I", "T"];

// ============================================================
// Components
// ============================================================

function TypewriterText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");
  const [status, setStatus] = useState<"thinking" | "typing" | "done">("thinking");

  useEffect(() => {
    let active = true;
    const thinkingTimer = setTimeout(() => {
      if (!active) return;
      setStatus("typing");

      const chars = text.split('');
      let index = 0;
      const typingInterval = setInterval(() => {
        if (!active || index >= chars.length) {
          clearInterval(typingInterval);
          setStatus("done");
          return;
        }
        setVisibleText(text.slice(0, index + 1));
        index++;
      }, 30);
    }, 1000);

    return () => {
      active = false;
      clearTimeout(thinkingTimer);
    };
  }, [text]);

  if (status === "thinking") {
    return (
      <span className="debate-bubble__thinking">
        <span>AI가 생각 중입니다...</span>
        <span className="typing-dots">
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
      {status === "typing" && <span className="typewriter-caret" />}
    </>
  );
}

function DebateChatView() {
  const chatRef = useRef<HTMLDivElement>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  });

  return (
    <div className="debate-chat-container">
      <div ref={chatRef} className="debate-chat-scroll">
        {MOCK_MESSAGES.map((item) => {
          const isOnMySide = item.align === "pro"; // 가정: 나는 찬성
          const isMyPlayerMsg = isOnMySide && item.variant === "player";
          const isCollapsed = isMyPlayerMsg && !expandedKeys.has(item.id);
          const avatarChar =
            item.variant === "ai"
              ? "AI"
              : isOnMySide
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
                    <TypewriterText text={item.text} />
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
                <article className={`debate-bubble debate-bubble--${item.align}-${item.variant}`}>
                  {isCollapsed ? (
                    <div className="debate-bubble__collapsed">
                      <span className="debate-bubble__preview">
                        {item.text.slice(0, 55)}
                        {item.text.length > 55 ? "..." : ""}
                      </span>
                      <button
                        className="debate-bubble__expand-btn"
                        onClick={() => toggleExpand(item.id)}
                      >
                        펼치기 ↓
                      </button>
                    </div>
                  ) : (
                    <div className="debate-bubble__body">
                      {item.variant === "ai" ? (
                        <TypewriterText text={item.text} />
                      ) : (
                        item.text
                      )}
                      {isMyPlayerMsg && (
                        <button
                          className="debate-bubble__collapse-btn"
                          onClick={() => toggleExpand(item.id)}
                        >
                          접기 ↑
                        </button>
                      )}
                    </div>
                  )}
                </article>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopicGeneratingCard() {
  return (
    <div className="topic-generating-card">
      <div className="topic-generating-card__logo">
        {LOGIT_LETTERS.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className="topic-generating-card__letter"
            style={{ animationDelay: `${index * 0.09}s` }}
          >
            {letter}
          </span>
        ))}
      </div>
      <div className="topic-generating-card__message">
        <span>주제 생성중</span>
        <span className="topic-generating-card__dots">
          <span />
          <span />
          <span />
        </span>
      </div>
      <p>AI가 더 흥미로운 쟁점을 고르고 있어요.</p>
    </div>
  );
}

function SelectionWaitingCard({ side }: { side: "pro" | "con" }) {
  const label = side === "pro" ? "찬성" : "반대";

  return (
    <div className={`selection-waiting-card selection-waiting-card--${side}`}>
      <div className="selection-waiting-card__header">
        <span className="selection-waiting-card__gear" />
        <span>{label} 선택 완료</span>
      </div>
      <div className="selection-waiting-card__status">
        <span>상대방 선택을 기다리는 중</span>
        <span className="selection-waiting-card__dots">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

function TopicSelectionView() {
  const [stage, setStage] = useState<"generating" | "topic" | "selecting" | "waiting">("generating");
  const [mySelection, setMySelection] = useState<"pro" | "con" | null>(null);

  useEffect(() => {
    if (stage === "generating") {
      const timer = setTimeout(() => setStage("topic"), 2000);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const handleSelect = (side: "pro" | "con") => {
    setMySelection(side);
    setStage("waiting");
  };

  return (
    <div className="topic-selection-view" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {stage === "generating" ? (
        <TopicGeneratingCard />
      ) : (
        <div
          style={{
            background: "var(--color-primary-soft)",
            border: "1px solid rgba(108,99,255,0.3)",
            borderRadius: "var(--radius-md)",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 600, marginBottom: "8px" }}>
            토론 주제
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700 }}>
            인공지능의 발전은 인류에게 이로운가?
          </div>
        </div>
      )}

      {stage === "topic" && (
        <>
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
            원하는 진영을 선택하세요.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {(["pro", "con"] as const).map((side) => {
              const label = side === "pro" ? "찬성" : "반대";
              const color = side === "pro" ? "var(--color-primary)" : "var(--color-con-orange)";
              const bg = side === "pro" ? "var(--color-primary-soft)" : "rgba(212,98,46,0.1)";
              const border = side === "pro" ? "rgba(108,99,255,0.45)" : "rgba(212,98,46,0.45)";
              return (
                <button
                  key={side}
                  onClick={() => handleSelect(side)}
                  style={{
                    padding: "24px",
                    borderRadius: "var(--radius-md)",
                    fontWeight: 700,
                    fontSize: "18px",
                    background: bg,
                    border: `2px solid ${border}`,
                    color,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {stage === "waiting" && mySelection && (
        <SelectionWaitingCard side={mySelection} />
      )}

      <div className="topic-selection-watermark-slot" />
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

  return (
    <div className="judging-wait">
      <div className="judging-wait__scan" />

      <section className="judging-wait__hero">
        <div className="judging-wait__side-chip judging-wait__side-chip--pro">
          찬성
        </div>
        <div className="judging-wait__scale-stage">
          <div className="judging-wait__ring" />
          <div className="judging-wait__scale">⚖️</div>
          <div className="judging-wait__beam" />
        </div>
        <div className="judging-wait__side-chip judging-wait__side-chip--con">
          반대
        </div>
      </section>

      <div className="judging-wait__headline">
        <p className="judging-wait__eyebrow">Cyber Courtroom</p>
        <h2>AI 판정단이 논점을 심문 중...</h2>
        <p>주장, 근거, 반박을 스캔해서 승부를 계산하고 있어요</p>
      </div>

      <div className="judging-wait__analysis-rail">
        {["논리", "근거", "반박", "설득"].map((step) => (
          <span key={step} className="judging-wait__analysis-chip">
            {step}
          </span>
        ))}
      </div>

      <div className="judging-wait__progress">
        <div className="judging-wait__progress-bar" />
      </div>
      <div className="judging-wait__status-badge">
        <span />
        판결문 작성 중
      </div>

      <article className="judging-wait__glass-card judging-wait__glass-card--tip">
        <div className="judging-wait__card-label">토론 꿀팁</div>
        <p key={tipIdx} className="judging-wait__tip-text">
          {DEBATE_TIPS[tipIdx]}
        </p>
      </article>
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
    { key: "persuasion", label: "설득력" },
    { key: "rebuttal", label: "반론" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "20px" }}>
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
          const sideColor = s.vote === "pro" ? "var(--color-primary)" : "var(--color-con-orange)";
          return (
            <div
              key={s.name}
              style={{
                background: s.vote === "pro" ? "var(--color-primary-soft)" : "rgba(212,98,46,0.08)",
                border: `1px solid ${s.vote === "pro" ? "rgba(108,99,255,0.25)" : "rgba(212,98,46,0.25)"}`,
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
          <div style={{ fontSize: "12px", fontWeight: 700, color: s.vote === "pro" ? "var(--color-primary)" : "var(--color-con-orange)", marginBottom: "6px" }}>
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
// Main Component
// ============================================================
export function DesignTestPage() {
  const [activeTab, setActiveTab] = useState<"chat" | "judging" | "topic" | "result">("chat");

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
            className={`design-test-tab ${activeTab === "topic" ? "active" : ""}`}
            onClick={() => setActiveTab("topic")}
          >
            주제 선택
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
        {activeTab === "chat" && <DebateChatView />}
        {activeTab === "topic" && <TopicSelectionView />}
        {activeTab === "judging" && <JudgingWaitView />}
        {activeTab === "result" && <EndedView />}
      </div>
    </div>
  );
}

export default DesignTestPage;
