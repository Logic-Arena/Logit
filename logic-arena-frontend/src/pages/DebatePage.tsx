import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { socket } from "../lib/socket";
import { useSocket } from "../hooks/useSocket";
import { useRoomEvents } from "../hooks/useRoomEvents";
import { useRoomStore } from "../store/useRoomStore";
import { useUserStore } from "../store/useUserStore";
import { PhaseTimer } from "../components/debate/PhaseTimer";
import { SubmitPanel } from "../components/debate/SubmitPanel";
import { StructuredArgumentPanel } from "../components/debate/StructuredArgumentPanel";
import { Popover } from "../components/common/Popover";
import DotSphereLoader from "../components/common/DotSphereLoader";
import { parseStructuredArgument } from "../utils/parseStructuredArgument";
import type { Room, Phase, PlayerRole, RoomContent, ParticipantScore, DebateResult, VoteOption } from "../types/room";

// ─── 상수 ──────────────────────────────────────────────────────

const PHASE_LABELS: Record<Phase, string> = {
  waiting: "대기 중",
  topic_selection: "주제 선택 & 진영 배정",
  arguing: "주장 단계",
  pro_p_rebuttal: "찬성P 반론",
  pro_p_defense: "반대P 변론",
  pro_p_counter: "찬성P 재반론",
  con_p_rebuttal: "반대P 반론",
  con_p_defense: "찬성P 변론",
  con_p_counter: "반대P 재반론",
  pro_a_rebuttal: "찬성AI 반론 (자동)",
  pro_a_defense: "반대P 변론 (vs 찬성AI)",
  pro_a_counter: "찬성AI 재반론 (자동)",
  con_a_rebuttal: "반대AI 반론 (자동)",
  con_a_defense: "찬성P 변론 (vs 반대AI)",
  con_a_counter: "반대AI 재반론 (자동)",
  coaching: "AI 훈수 (자동)",
  final_argument: "최종 변론",
  essay_writing: "주장문 작성",
  essay_feedback: "AI 피드백",
  essay_revision: "퇴고",
  judging: "AI 판정 중",
  peer_voting: "동료 평가 투표",
  ended: "토론 종료",
};

const PHASE_SUBMIT_MAP: Partial<
  Record<Phase, Partial<Record<PlayerRole, keyof RoomContent>>>
> = {
  arguing: { pro_player: "pro_argument", con_player: "con_argument" },
  pro_p_rebuttal: { pro_player: "pro_p_rebuttal" },
  pro_p_defense: { con_player: "pro_p_defense_player" },
  pro_p_counter: { pro_player: "pro_p_counter" },
  con_p_rebuttal: { con_player: "con_p_rebuttal" },
  con_p_defense: { pro_player: "con_p_defense_player" },
  con_p_counter: { con_player: "con_p_counter" },
  pro_a_defense: { con_player: "pro_a_defense_player" },
  con_a_defense: { pro_player: "con_a_defense_player" },
  final_argument: { pro_player: "pro_final", con_player: "con_final" },
  essay_writing: { pro_player: "pro_argument" },
  essay_revision: { pro_player: "essay_final" },
};

const PHASE_ACTIVE_ROLE: Partial<Record<Phase, string>> = {
  arguing: "양쪽 플레이어 · 주장 작성 중",
  pro_p_rebuttal: "찬성P 차례",
  pro_p_defense: "반대P 차례",
  pro_p_counter: "찬성P 차례",
  con_p_rebuttal: "반대P 차례",
  con_p_defense: "찬성P 차례",
  con_p_counter: "반대P 차례",
  pro_a_defense: "반대P 차례 (선택)",
  con_a_defense: "찬성P 차례 (선택)",
  final_argument: "양쪽 플레이어 · 최종 변론",
};

type AlignSide = "pro" | "con";
type BubbleVariant = "player" | "ai" | "coach";

const CONTENT_FLOW: Array<{
  key: keyof RoomContent;
  author: string;
  align: AlignSide;
  variant: BubbleVariant;
}> = [
    {
      key: "pro_argument",
      author: "찬성 플레이어",
      align: "pro",
      variant: "player",
    },
    {
      key: "con_argument",
      author: "반대 플레이어",
      align: "con",
      variant: "player",
    },
    {
      key: "pro_ai_argument",
      author: "AI 보조·찬성",
      align: "pro",
      variant: "ai",
    },
    {
      key: "con_ai_argument",
      author: "AI 보조·반대",
      align: "con",
      variant: "ai",
    },
    {
      key: "pro_p_rebuttal",
      author: "찬성 플레이어",
      align: "pro",
      variant: "player",
    },
    {
      key: "pro_p_defense_player",
      author: "반대 플레이어",
      align: "con",
      variant: "player",
    },
    {
      key: "pro_p_defense_ai",
      author: "AI 보조·반대",
      align: "con",
      variant: "ai",
    },
    {
      key: "pro_p_counter",
      author: "찬성 플레이어",
      align: "pro",
      variant: "player",
    },
    {
      key: "con_p_rebuttal",
      author: "반대 플레이어",
      align: "con",
      variant: "player",
    },
    {
      key: "con_p_defense_player",
      author: "찬성 플레이어",
      align: "pro",
      variant: "player",
    },
    {
      key: "con_p_defense_ai",
      author: "AI 보조·찬성",
      align: "pro",
      variant: "ai",
    },
    {
      key: "con_p_counter",
      author: "반대 플레이어",
      align: "con",
      variant: "player",
    },
    {
      key: "pro_a_rebuttal",
      author: "AI 보조·찬성",
      align: "pro",
      variant: "ai",
    },
    {
      key: "pro_a_defense_player",
      author: "반대 플레이어",
      align: "con",
      variant: "player",
    },
    {
      key: "pro_a_defense_ai",
      author: "AI 보조·반대",
      align: "con",
      variant: "ai",
    },
    { key: "pro_a_counter", author: "AI 보조·찬성", align: "pro", variant: "ai" },
    {
      key: "con_a_rebuttal",
      author: "AI 보조·반대",
      align: "con",
      variant: "ai",
    },
    {
      key: "con_a_defense_player",
      author: "찬성 플레이어",
      align: "pro",
      variant: "player",
    },
    {
      key: "con_a_defense_ai",
      author: "AI 보조·찬성",
      align: "pro",
      variant: "ai",
    },
    { key: "con_a_counter", author: "AI 보조·반대", align: "con", variant: "ai" },
    {
      key: "coaching_pro",
      author: "훈수 AI (찬성P)",
      align: "pro",
      variant: "coach",
    },
    {
      key: "coaching_con",
      author: "훈수 AI (반대P)",
      align: "con",
      variant: "coach",
    },
    {
      key: "pro_final",
      author: "찬성 플레이어",
      align: "pro",
      variant: "player",
    },
    {
      key: "con_final",
      author: "반대 플레이어",
      align: "con",
      variant: "player",
    },
  ];

const CONTENT_LABELS: Partial<Record<keyof RoomContent, string>> = {
  pro_argument: "최초 주장",
  con_argument: "최초 주장",
  pro_ai_argument: "AI 주장",
  con_ai_argument: "AI 주장",
  pro_p_rebuttal: "반론",
  pro_p_defense_player: "변론",
  pro_p_defense_ai: "AI 변론",
  pro_p_counter: "재반론",
  con_p_rebuttal: "반론",
  con_p_defense_player: "변론",
  con_p_defense_ai: "AI 변론",
  con_p_counter: "재반론",
  pro_a_rebuttal: "AI 반론",
  pro_a_defense_player: "변론 (vs AI)",
  pro_a_defense_ai: "AI 변론",
  pro_a_counter: "AI 재반론",
  con_a_rebuttal: "AI 반론",
  con_a_defense_player: "변론 (vs AI)",
  con_a_defense_ai: "AI 변론",
  con_a_counter: "AI 재반론",
  coaching_pro: "훈수 (찬성P)",
  coaching_con: "훈수 (반대P)",
  pro_final: "최종 변론",
  con_final: "최종 변론",
};

const SUBMIT_LABELS: Partial<Record<Phase, string>> = {
  arguing: "내 주장 작성",
  pro_p_rebuttal: "반론 작성 (찬성P)",
  pro_p_defense: "변론 작성 (반대P)",
  pro_p_counter: "재반론 작성 (찬성P)",
  con_p_rebuttal: "반론 작성 (반대P)",
  con_p_defense: "변론 작성 (찬성P)",
  con_p_counter: "재반론 작성 (반대P)",
  pro_a_defense: "변론 작성 (반대P, 선택사항)",
  con_a_defense: "변론 작성 (찬성P, 선택사항)",
  final_argument: "최종 변론 작성",
};

const OPTIONAL_PHASES = new Set<Phase>(["pro_a_defense", "con_a_defense"]);
const AUTO_PHASES = new Set<Phase>([
  "pro_a_rebuttal",
  "pro_a_counter",
  "con_a_rebuttal",
  "con_a_counter",
  "coaching",
  "judging",
]);

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

// 4단계 매핑
const DEBATE_STAGES: Array<{ label: string; phases: Set<Phase> }> = [
  { label: "최초 주장", phases: new Set<Phase>(["arguing"]) },
  {
    label: "반론",
    phases: new Set<Phase>([
      "pro_p_rebuttal",
      "pro_p_defense",
      "con_p_rebuttal",
      "con_p_defense",
      "pro_a_rebuttal",
      "pro_a_defense",
      "con_a_rebuttal",
      "con_a_defense",
    ]),
  },
  {
    label: "재반박",
    phases: new Set<Phase>([
      "pro_p_counter",
      "con_p_counter",
      "pro_a_counter",
      "con_a_counter",
      "coaching",
    ]),
  },
  { label: "최종 주장", phases: new Set<Phase>(["final_argument"]) },
];

function getStageIndex(phase: Phase): number {
  return DEBATE_STAGES.findIndex((s) => s.phases.has(phase));
}

// ─── 공통 UI ────────────────────────────────────────────────────

function StatusChip({
  label,
  done,
  isMe,
}: {
  label: string;
  done: boolean;
  isMe?: boolean;
}) {
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 500,
        background: done
          ? "var(--color-pro-bg)"
          : isMe
            ? "var(--color-primary-soft)"
            : "var(--color-surface-2)",
        color: done
          ? "var(--color-pro)"
          : isMe
            ? "var(--color-primary)"
            : "var(--color-text-muted)",
        border: `1px solid ${done ? "rgba(22,163,74,0.3)" : isMe ? "rgba(108,99,255,0.3)" : "var(--color-border)"}`,
      }}
    >
      {done ? "✓" : "⏳"} {label}
      {isMe ? " (나)" : ""}
    </span>
  );
}

function NotMyTurnBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        fontSize: "13px",
        color: "var(--color-text-muted)",
        textAlign: "center",
        fontStyle: "italic",
      }}
    >
      {message}
    </div>
  );
}

// ─── DebateChatView ─────────────────────────────────────────────

function DebateChatView({
  room,
  myRole,
}: {
  room: Room;
  myRole: PlayerRole | null;
}) {
  const { phase, content } = room;
  const myKey = myRole ? PHASE_SUBMIT_MAP[phase]?.[myRole] : undefined;
  const alreadySubmitted = myKey ? !!content[myKey] : false;
  const mySide: AlignSide | null =
    myRole === "pro_player" ? "pro" : myRole === "con_player" ? "con" : null;
  const isAutoPhase = AUTO_PHASES.has(phase);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  });

  const isHumanMode = room.mode === "human_debate";
  const messages = CONTENT_FLOW.flatMap((item) => {
    const text = content[item.key];
    if (!text) return [];
    if (isHumanMode && item.variant === "ai" && item.key !== "coaching_pro" && item.key !== "coaching_con") {
      return [];
    }
    if (phase === "arguing") {
      const both = !!(content.pro_argument && content.con_argument);
      if (!both) {
        if (item.key === "pro_argument" && myRole !== "pro_player") return [];
        if (item.key === "con_argument" && myRole !== "con_player") return [];
        if (item.key === "pro_ai_argument" || item.key === "con_ai_argument")
          return [];
      }
    }
    // 훈수: 플레이어는 자신의 진영 훈수만 표시, 관전자는 둘 다 표시
    if (item.key === "coaching_pro" && myRole === "con_player") return [];
    if (item.key === "coaching_con" && myRole === "pro_player") return [];
    return [{ ...item, text }];
  });

  const hasSubmitRole = Object.keys(PHASE_SUBMIT_MAP[phase] ?? {}).length > 0;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 스크롤 채팅 영역 */}
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
        {phase === "arguing" && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <StatusChip
              label="찬성P"
              done={!!content.pro_argument}
              isMe={myRole === "pro_player"}
            />
            <StatusChip
              label="반대P"
              done={!!content.con_argument}
              isMe={myRole === "con_player"}
            />
            {!isHumanMode && <StatusChip label="찬성AI" done={!!content.pro_ai_argument} />}
            {!isHumanMode && <StatusChip label="반대AI" done={!!content.con_ai_argument} />}
          </div>
        )}
        {phase === "final_argument" && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <StatusChip
              label="찬성P 최종"
              done={!!content.pro_final}
              isMe={myRole === "pro_player"}
            />
            <StatusChip
              label="반대P 최종"
              done={!!content.con_final}
              isMe={myRole === "con_player"}
            />
          </div>
        )}

        {messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: isAutoPhase ? "var(--color-ai)" : "var(--color-text-muted)",
              padding: "40px 0",
              fontSize: "13px",
              fontStyle: "italic",
            }}
          >
            {isAutoPhase
              ? "AI가 자동으로 생성 중입니다... 잠시 기다려 주세요"
              : "아직 작성된 내용이 없습니다."}
          </div>
        )}

        {messages.map((item) => {
          const isOnMySide = mySide === item.align;
          const avatarChar =
            item.variant === "ai"
              ? "AI"
              : mySide === item.align
                ? "나"
                : item.align === "pro"
                  ? "찬"
                  : "반";

          // 훈수 AI는 중앙 배치
          if (item.variant === "coach") {
            return (
              <div key={item.key} className="bubble-row bubble-row--coach">
                <article className="debate-bubble debate-bubble--coach">
                  <div className="debate-bubble__meta">
                    <strong>{item.author}</strong>
                    <span>{CONTENT_LABELS[item.key]}</span>
                  </div>
                  <div className="debate-bubble__body">
                    <TypewriterText
                      key={`${item.key}:${item.text}`}
                      text={item.text}
                      animationKey={`${item.key}:${item.text}`}
                      thinkingLabel="논점을 정리 중입니다..."
                    />
                  </div>
                </article>
              </div>
            );
          }

          return (
            <div
              key={item.key}
              className={`bubble-row ${isOnMySide ? "bubble-row--right" : "bubble-row--left"}`}
            >
              <div className={`bubble-avatar bubble-avatar--${item.align}`}>
                {avatarChar}
              </div>
              <div className="bubble-content">
                <div className="bubble-meta">
                  <strong className="bubble-meta__author">{item.author}</strong>
                  <span className="bubble-meta__type">
                    {CONTENT_LABELS[item.key]}
                  </span>
                </div>
                <article
                  className={`debate-bubble debate-bubble--${item.align}-${item.variant}`}
                >
                  <div className="debate-bubble__body">
                    {item.variant === "ai" ? (
                      <TypewriterText
                        key={`${item.key}:${item.text}`}
                        text={item.text}
                        animationKey={`${item.key}:${item.text}`}
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

      {/* 하단 입력 패널 */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--color-border)",
          padding: "10px 20px",
          background: "var(--color-surface)",
        }}
      >
        {myKey ? (
          (phase === "arguing" || phase === "essay_writing") ? (
            <StructuredArgumentPanel
              key={phase}
              roomId={room.id}
              alreadySubmitted={alreadySubmitted}
              submittedText={alreadySubmitted ? content[myKey] : null}
              phaseEndAt={room.phaseEndAt}
            />
          ) : phase === "essay_feedback" ? (
            <EssayFeedbackView room={room} />
          ) : phase === "essay_revision" ? (
            <EssayRevisionView room={room} myKey={myKey} alreadySubmitted={alreadySubmitted} />
          ) : (
            <SubmitPanel
              key={phase}
              roomId={room.id}
              label={SUBMIT_LABELS[phase] ?? "내용 제출"}
              placeholder="내용을 입력하세요..."
              alreadySubmitted={alreadySubmitted}
              submittedText={alreadySubmitted ? content[myKey] : null}
              optional={OPTIONAL_PHASES.has(phase)}
              phaseEndAt={room.phaseEndAt}
            />
          )
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "8px 0",
              fontSize: "13px",
              color: isAutoPhase ? "var(--color-ai)" : "var(--color-text-muted)",
            }}
          >
            {isAutoPhase
              ? "AI가 자동으로 내용을 생성하고 있습니다."
              : hasSubmitRole
                ? (PHASE_ACTIVE_ROLE[phase] ??
                  "현재는 다른 참가자의 입력 차례입니다.")
                : "잠시 기다려 주세요."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase 별 뷰 (특수 케이스) ──────────────────────────────────

function EssayFeedbackView({ room }: { room: Room }) {
  const feedbackRaw = room.content.essay_feedback;
  let feedback: {
    claim?: string;
    evidence?: string;
    example?: string;
    counterArgument?: string;
    rebuttal?: string;
    overall?: string;
  } | null = null;

  try {
    feedback = feedbackRaw ? JSON.parse(feedbackRaw) : null;
  } catch {
    // 파싱 실패 시 null 유지
  }

  if (!feedback) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)" }}>
        AI가 피드백을 준비 중입니다...
      </div>
    );
  }

  const sections = [
    { label: "① 주장", key: "claim" as const },
    { label: "② 근거", key: "evidence" as const },
    { label: "③ 예시", key: "example" as const },
    { label: "④ 예상 반론", key: "counterArgument" as const },
    { label: "⑤ 재반론", key: "rebuttal" as const },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text)" }}>
        AI 피드백
      </div>
      <div
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {sections.map(({ label, key }) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)" }}>
              {label}
            </div>
            <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--color-text)" }}>
              {feedback?.[key] || "피드백이 없습니다."}
            </div>
          </div>
        ))}
        {feedback.overall && (
          <div
            style={{
              marginTop: "8px",
              paddingTop: "14px",
              borderTop: "1px solid var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)" }}>
              총평
            </div>
            <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--color-text)" }}>
              {feedback.overall}
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: "12px", color: "var(--color-text-muted)", textAlign: "center" }}>
        다음 단계에서 피드백을 참고하여 글을 다듬어 보세요.
      </div>
    </div>
  );
}

function EssayRevisionView({
  room,
  myKey,
  alreadySubmitted,
}: {
  room: Room;
  myKey: keyof RoomContent;
  alreadySubmitted: boolean;
}) {
  const originalEssay = room.content.pro_argument ?? "";
  const parsedSections = parseStructuredArgument(originalEssay);
  const feedbackRaw = room.content.essay_feedback;

  let feedback: {
    claim?: string;
    evidence?: string;
    example?: string;
    counterArgument?: string;
    rebuttal?: string;
    overall?: string;
  } | null = null;

  try {
    feedback = feedbackRaw ? JSON.parse(feedbackRaw) : null;
  } catch {
    // 파싱 실패 시 null
  }

  const sections = [
    { label: "① 주장", key: "claim" as const },
    { label: "② 근거", key: "evidence" as const },
    { label: "③ 예시", key: "example" as const },
    { label: "④ 예상 반론", key: "counterArgument" as const },
    { label: "⑤ 재반론", key: "rebuttal" as const },
  ];

  if (alreadySubmitted) {
    return (
      <div
        style={{
          background: "linear-gradient(180deg, #6AC982 0%, #52A068 100%)",
          border: "1px solid rgba(82,160,104,0.4)",
          borderRadius: "var(--radius-md)",
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "#fff",
            fontWeight: 700,
            marginBottom: "6px",
            textShadow: "0 1px 2px rgba(0,0,0,0.2)",
          }}
        >
          퇴고 완료
        </div>
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#fff",
            margin: 0,
            fontWeight: 500,
            whiteSpace: "pre-wrap",
          }}
        >
          {room.content[myKey] || "제출 완료"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
      {/* 피드백 영역 (접기 가능, 기본 펼침) */}
      {feedback && (
        <details open style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px 14px" }}>
          <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "var(--color-text)", userSelect: "none" }}>
            AI 피드백 (클릭하여 접기/펼치기)
          </summary>
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {sections.map(({ label, key }) => (
              <div key={key} style={{ fontSize: "12px", lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>{label}:</span>{" "}
                <span style={{ color: "var(--color-text)" }}>{feedback[key]}</span>
              </div>
            ))}
            {feedback.overall && (
              <div style={{ fontSize: "12px", lineHeight: 1.6, marginTop: "4px", paddingTop: "8px", borderTop: "1px solid var(--color-border)" }}>
                <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>총평:</span>{" "}
                <span style={{ color: "var(--color-text)" }}>{feedback.overall}</span>
              </div>
            )}
          </div>
        </details>
      )}

      {/* 퇴고 폼 */}
      {parsedSections ? (
        <StructuredArgumentPanel
          key="essay_revision"
          roomId={room.id}
          alreadySubmitted={false}
          phaseEndAt={room.phaseEndAt}
          initialSections={parsedSections}
          submitLabel="퇴고 완료"
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
            }}
          >
            이전 제출문의 형식을 인식할 수 없어 새로 작성해야 합니다. 아래 참고:
            <pre
              style={{
                marginTop: "8px",
                fontSize: "12px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "var(--color-surface)",
                padding: "8px",
                borderRadius: "4px",
              }}
            >
              {originalEssay || "(제출문 없음)"}
            </pre>
          </div>
          <StructuredArgumentPanel
            key="essay_revision_fallback"
            roomId={room.id}
            alreadySubmitted={false}
            phaseEndAt={room.phaseEndAt}
            submitLabel="퇴고 완료"
          />
        </div>
      )}
    </div>
  );
}

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

const JUDGING_ANALYSIS_STEPS = ["논리", "근거", "반박", "설득"];

function JudgingWaitView({
  room: _room,
  myRole: _myRole,
}: {
  room: Room;
  myRole: PlayerRole | null;
}) {
  const [tipIdx, setTipIdx] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setTipIdx((i) => (i + 1) % DEBATE_TIPS.length),
      4000,
    );
    return () => clearInterval(timer);
  }, []);

  // 단계바 순차 활성화 애니메이션
  useEffect(() => {
    const stepTimers: number[] = [];
    JUDGING_ANALYSIS_STEPS.forEach((_, i) => {
      const timer = window.setTimeout(() => {
        setCurrentStepIndex(i);
      }, i * 400); // 각 단계마다 400ms 간격으로 활성화
      stepTimers.push(timer);
    });
    return () => stepTimers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <div className="judging-wait">
      <section className="judging-wait__hero" aria-live="polite">
        <div className="judging-wait__scale-stage">
          <DotSphereLoader size={240} hue={243} speed={0.008} wobbleAmount={0.08} />
        </div>
      </section>

      <div className="judging-wait__headline">
        <h2>AI 판정단이 논점을 심문 중</h2>
        <p>주장, 근거, 반박을 스캔해서 승부를 계산하고 있어요</p>
      </div>

      <div className="judging-wait__stepper" aria-label="분석 단계">
        {JUDGING_ANALYSIS_STEPS.map((step, i) => (
          <div key={step} className="judging-wait__step">
            <div className="judging-wait__step-dot-wrapper">
              {i < JUDGING_ANALYSIS_STEPS.length - 1 && (
                <div className={`judging-wait__step-line ${i <= currentStepIndex ? 'judging-wait__step-line--filled' : ''}`} />
              )}
              <div className={`judging-wait__step-dot ${i < currentStepIndex ? 'judging-wait__step-dot--filled' : i === currentStepIndex ? 'judging-wait__step-dot--current' : ''}`} />
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

function WaitingView({
  room,
  myRole: _myRole,
  mySocketId,
}: {
  room: Room;
  myRole: PlayerRole | null;
  mySocketId: string;
}) {
  const isHost = room.host === mySocketId;
  const canStart = !!room.proPlayer && !!room.conPlayer;
  return (
    <div className="waiting-view-centered" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
        찬성P, 반대P 두 명이 모이면 방장이 게임을 시작합니다.
      </p>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        {[
          { label: "플레이어 1 (방장)", player: room.proPlayer },
          { label: "플레이어 2", player: room.conPlayer },
        ].map(({ label, player }) => (
          <div
            key={label}
            style={{
              background: player ? "var(--color-surface-2)" : "transparent",
              border: `1px solid ${player ? "var(--color-primary)" : "var(--color-border)"}`,
              borderRadius: "var(--radius-md)",
              padding: "20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--color-text-muted)",
                fontWeight: 600,
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontWeight: 600,
                color: player ? "var(--color-text)" : "var(--color-text-muted)",
              }}
            >
              {player ? player.username : "대기 중..."}
            </div>
          </div>
        ))}
      </div>
      {room.observers.length > 0 && (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
          관전자 {room.observers.length}명
        </p>
      )}
      {isHost ? (
        <button
          className="btn btn--primary"
          disabled={!canStart}
          onClick={() => socket.emit("start_game", { roomId: room.id })}
          style={{ alignSelf: "flex-start" }}
        >
          {canStart ? "게임 시작하기" : "플레이어 2명 필요"}
        </button>
      ) : (
        <NotMyTurnBanner message="방장이 게임을 시작할 때까지 기다려 주세요" />
      )}
      <div className="watermark-slot topic-selection-watermark-slot" aria-hidden="true" />
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

function SelectionWaitingCard({ side, room }: { side: "pro" | "con"; room: Room }) {
  const myLabel = side === "pro" ? "찬성" : "반대";

  // 상대가 선택을 완료했는지 감지:
  // - 양쪽 플레이어가 모두 방에 배정되어 있고 (proPlayer && conPlayer)
  // - 양쪽 모두 pendingSelections에 선택이 기록되어 있어야 함
  const proSid = room.proPlayer?.socketId;
  const conSid = room.conPlayer?.socketId;
  const bothSelected = !!(
    proSid &&
    conSid &&
    room.pendingSelections?.[proSid] &&
    room.pendingSelections?.[conSid]
  );
  const opponentReady = bothSelected;

  // 상대 진영 (내가 찬성이면 상대는 반대, 내가 반대면 상대는 찬성)
  // 단, opponentReady가 true일 때만 진영 정보 노출
  const opponentSide = opponentReady ? (side === "pro" ? "con" : "pro") : null;
  const opponentLabel = opponentSide === "pro" ? "찬성" : opponentSide === "con" ? "반대" : "대기 중";

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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          <div className="selection-dual-item__content">
            <div className="selection-dual-item__label-group">
              <div className="selection-dual-item__small-label">내 선택</div>
              <div className="selection-dual-item__value">{myLabel}</div>
            </div>
          </div>
          <div className={`selection-dual-item__badge selection-dual-item__badge--${side}`}>
            선택 완료
          </div>
        </div>

        {/* 상대 선택 행 (대기 중 / 완료) */}
        <div className={`selection-dual-item selection-dual-item--opponent${opponentReady ? ' selection-dual-item--ready' : ''}${opponentSide ? ` selection-dual-item--${opponentSide}` : ''}`}>
          <div className="selection-dual-item__icon selection-dual-item__icon--dashed">
            {opponentReady && opponentSide ? (
              opponentSide === "pro" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )
            ) : (
              <div className="selection-dual-item__icon-placeholder" />
            )}
          </div>
          <div className="selection-dual-item__content">
            <div className="selection-dual-item__label-group">
              <div className="selection-dual-item__small-label">상대 선택</div>
              <div className={`selection-dual-item__value${opponentReady ? '' : ' selection-dual-item__value--pending'}`}>
                {opponentReady ? opponentLabel : "선택하는 중..."}
              </div>
            </div>
          </div>
          {!opponentReady && (
            <div className="selection-dual-item__dots">
              <span />
              <span />
              <span />
            </div>
          )}
          {opponentReady && opponentSide && (
            <div className={`selection-dual-item__badge selection-dual-item__badge--${opponentSide}`}>
              선택 완료
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicSelectionView({
  room,
  myRole,
}: {
  room: Room;
  myRole: PlayerRole | null;
}) {
  const [mySelection, setMySelection] = useState<"pro" | "con" | null>(null);
  const isPlayer = myRole === "pro_player" || myRole === "con_player";
  const isSoloEssay = room.mode === "solo_essay";
  const attempts = room.sideSelectionAttempts;
  useEffect(() => {
    if (attempts > 0) setMySelection(null);
  }, [attempts]);
  const handleSelect = (side: "pro" | "con") => {
    setMySelection(side);
    socket.emit("select_side", { roomId: room.id, side });
  };
  return (
    <div
      className="topic-selection-view topic-selection-view-centered"
      style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}
    >
      {room.topic ? (
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
              {isSoloEssay ? "논술 주제" : "토론 주제"}
            </span>
            {room.topicSource === "fallback" && (
              <span
                style={{
                  border: "1px solid rgba(240,160,112,0.55)",
                  borderRadius: "999px",
                  color: "var(--color-con)",
                  fontSize: "10px",
                  fontWeight: 700,
                  lineHeight: 1,
                  padding: "4px 7px",
                }}
              >
                폴백 데이터
              </span>
            )}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.4, color: "var(--color-text)" }}>
            {room.topic}
          </div>
        </div>
      ) : (
        <TopicGeneratingCard attempts={attempts} />
      )}
      {isPlayer && !isSoloEssay && !mySelection && !!room.topic && (
        <div className="selection-dual-card-wrapper">
          <p className="selection-dual-card-wrapper__guidance">
            원하는 진영을 선택하세요
            {attempts > 0 ? ` (진영 선택 중복 ${attempts}/7회)` : ""}
          </p>
          <div className="side-selection-container">
            {(["pro", "con"] as const).map((side) => {
              const label = side === "pro" ? "찬성" : "반대";
              const desc = side === "pro" ? "주제에 동의합니다" : "주제에 반대합니다";
              return (
                <div
                  key={side}
                  className={`side-selection-item side-selection-item--${side}`}
                  onClick={() => handleSelect(side)}
                >
                  <div className="side-selection-item__icon">
                    {side === "pro" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                  </div>
                  <div className="side-selection-item__content">
                    <div className="side-selection-item__label">{label}</div>
                    <div className="side-selection-item__desc">{desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {isPlayer && !isSoloEssay && mySelection && (
        <SelectionWaitingCard side={mySelection} room={room} />
      )}
      {!isPlayer && !isSoloEssay && (
        <NotMyTurnBanner message="플레이어들이 진영을 선택 중입니다..." />
      )}

      <div className="watermark-slot topic-selection-watermark-slot" aria-hidden="true" />
    </div>
  );
}

// ─── 동료 평가 투표 화면 ────────────────────────────────────────

function PeerVoteView({
  room,
  myRole,
}: {
  room: Room;
  myRole: PlayerRole | null;
}) {
  const [voted, setVoted] = useState(false);
  const [voteProgress, setVoteProgress] = useState({ voted: 0, total: 0, proVotes: 0, conVotes: 0 });
  const isObserver = myRole === "observer";
  const observerCount = room.observers?.length ?? 0;

  useEffect(() => {
    const handleProgress = (data: { voted: number; total: number; proVotes: number; conVotes: number }) => {
      setVoteProgress(data);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on("peer_vote_progress", handleProgress);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return () => { (socket as any).off("peer_vote_progress", handleProgress); };
  }, []);

  const handleVote = (votedFor: "pro" | "con") => {
    if (voted || !isObserver) return;
    socket.emit("peer_vote", { votedFor });
    setVoted(true);
  };

  const totalVotes = voteProgress.proVotes + voteProgress.conVotes;
  const proRatio = totalVotes === 0 ? 50 : Math.round((voteProgress.proVotes / totalVotes) * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        padding: "48px 20px",
      }}
    >
      <div style={{ fontSize: "40px" }}>🗳️</div>
      <div style={{ fontSize: "20px", fontWeight: 700 }}>관전자 투표</div>
      <p
        style={{
          fontSize: "14px",
          color: "var(--color-text-muted)",
          textAlign: "center",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {isObserver
          ? "어느 팀의 토론이 더 설득력 있었나요?"
          : `관전자 ${observerCount}명이 투표하는 중입니다...`}
      </p>

      {/* 줄다리기 바 — 관전자에게만 실시간 투표 현황 표시 */}
      {isObserver && (
        <div style={{ width: "100%", maxWidth: "440px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <span style={{ color: "var(--color-pro)" }}>찬성팀</span>
            <span style={{ color: "var(--color-con)" }}>반대팀</span>
          </div>
          <div
            style={{
              height: "18px",
              borderRadius: "9px",
              overflow: "hidden",
              background: "var(--color-con)",
              display: "flex",
            }}
          >
            <div
              style={{
                width: `${proRatio}%`,
                background: "var(--color-pro)",
                transition: "width 0.4s ease",
                height: "100%",
              }}
            />
          </div>
        </div>
      )}

      {isObserver ? (
        !voted ? (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              className="btn btn--primary"
              onClick={() => handleVote("pro")}
              style={{ minWidth: "180px" }}
            >
              찬성팀이 더 설득력 있었다
            </button>
            <button
              className="btn"
              onClick={() => handleVote("con")}
              style={{
                minWidth: "180px",
                background: "rgba(212,98,46,0.12)",
                border: "1px solid var(--color-con)",
                color: "var(--color-con)",
                cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                padding: "8px 16px",
                fontWeight: 600,
              }}
            >
              반대팀이 더 설득력 있었다
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, color: "var(--color-success, #4caf50)", margin: "0 0 4px" }}>
              투표 완료 ✓
            </p>
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
              결과를 기다리는 중...
            </p>
          </div>
        )
      ) : (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
          AI 채점 결과를 집계하는 중입니다...
        </p>
      )}

      {isObserver && voteProgress.total > 0 && (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
          {voteProgress.voted} / {voteProgress.total}명 투표 완료
        </p>
      )}
    </div>
  );
}

// ─── 결과 화면 ──────────────────────────────────────────────────

const RANK_BADGE = ["🥇", "🥈", "🥉", "4위", "5위"];
const SCORE_CRITERIA: {
  key: "logic" | "evidence" | "persuasion" | "rebuttal" | "consistency";
  label: string;
}[] = [
    { key: "logic", label: "논리성" },
    { key: "evidence", label: "근거" },
    { key: "persuasion", label: "표현 명확성" },
    { key: "rebuttal", label: "반론" },
    { key: "consistency", label: "일관성" },
  ];

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

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let startTime: number | null = null;
    let raf: number;
    const step = (ts: number) => {
      if (startTime === null) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AnimatedScore({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{animated}</>;
}

function TeamCompareBar({ scores }: { scores: ParticipantScore[] }) {
  const proTotal = scores.filter(s => s.vote === 'pro' && s.type === 'player').reduce((sum, s) => sum + s.total, 0);
  const conTotal = scores.filter(s => s.vote === 'con' && s.type === 'player').reduce((sum, s) => sum + s.total, 0);
  const sum = proTotal + conTotal || 1;
  const proRatio = (proTotal / sum) * 100;
  return (
    <div style={{ padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>
        팀 대결 종합
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
        <span style={{ color: 'var(--color-pro)' }}>찬성팀 {proTotal}점</span>
        <span style={{ color: 'var(--color-con)' }}>반대팀 {conTotal}점</span>
      </div>
      <div style={{ height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'var(--color-con)', display: 'flex' }}>
        <div style={{ width: `${proRatio}%`, background: 'var(--color-pro)', height: '100%', transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {proTotal > conTotal ? `찬성팀 ${proTotal - conTotal}점 앞섬` : conTotal > proTotal ? `반대팀 ${conTotal - proTotal}점 앞섬` : '동점'}
      </div>
    </div>
  );
}

function DecisiveEdgeBadge({ scores }: { scores: ParticipantScore[] }) {
  const pro = scores.find(s => s.vote === 'pro' && s.type === 'player');
  const con = scores.find(s => s.vote === 'con' && s.type === 'player');
  if (!pro || !con) return null;
  let maxDiff = 0;
  let bestLabel = '논리성';
  let bestKey: typeof SCORE_CRITERIA[0]['key'] = 'logic';
  let winner: 'pro' | 'con' = 'pro';
  SCORE_CRITERIA.forEach(({ key, label }) => {
    const diff = (pro[key] ?? 0) - (con[key] ?? 0);
    if (Math.abs(diff) > maxDiff) {
      maxDiff = Math.abs(diff);
      bestLabel = label;
      bestKey = key;
      winner = diff >= 0 ? 'pro' : 'con';
    }
  });
  if (maxDiff === 0) return null;
  const color = winner === 'pro' ? 'var(--color-pro)' : 'var(--color-con)';
  const proScore = pro[bestKey] ?? 0;
  const conScore = con[bestKey] ?? 0;
  return (
    <div style={{ padding: '12px 14px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>🎯</span>
        <span style={{ fontSize: '13px' }}>
          <strong style={{ color }}>{bestLabel}</strong>에서 승부가 갈렸습니다
        </span>
      </div>
      {/* 결정적 항목 점수 비교 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <span style={{ fontWeight: 700, color: 'var(--color-pro)', minWidth: '60px' }}>{pro.name}</span>
        <span style={{ fontWeight: 700, color: 'var(--color-pro)', fontSize: '18px' }}>{proScore}</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>vs</span>
        <span style={{ fontWeight: 700, color: 'var(--color-con)', fontSize: '18px' }}>{conScore}</span>
        <span style={{ fontWeight: 700, color: 'var(--color-con)', minWidth: '60px' }}>{con.name}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color, fontSize: '12px', background: `${color}22`, padding: '2px 8px', borderRadius: '999px' }}>
          {winner === 'pro' ? `찬성 +${maxDiff}` : `반대 +${maxDiff}`}
        </span>
      </div>
      {/* 전체 항목 차이 요약 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {SCORE_CRITERIA.map(({ key, label }) => {
          const diff = (pro[key] ?? 0) - (con[key] ?? 0);
          const isDecisive = key === bestKey;
          const chipColor = diff > 0 ? 'var(--color-pro)' : diff < 0 ? 'var(--color-con)' : 'var(--color-text-muted)';
          return (
            <span key={key} style={{
              fontSize: '11px', fontWeight: isDecisive ? 700 : 400,
              padding: '2px 8px', borderRadius: '999px',
              background: isDecisive ? `${chipColor}22` : 'var(--color-surface)',
              border: `1px solid ${isDecisive ? chipColor : 'var(--color-border)'}`,
              color: chipColor,
            }}>
              {label} {diff === 0 ? '동점' : diff > 0 ? `+${diff}` : diff}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function RpChangeCard({ result, myRole }: { result: DebateResult; myRole: PlayerRole | null }) {
  if (!myRole || myRole === 'observer') return null;
  const myVote: VoteOption = myRole === 'pro_player' ? 'pro' : 'con';
  const WIN_RP = 20, LOSE_RP = 20;
  const isDraw = result.winner === 'draw';
  const isWin = !isDraw && result.winner === myVote;
  const delta = isDraw ? 0 : isWin ? WIN_RP : -LOSE_RP;
  const label = isDraw ? '무승부 — RP 변동 없음' : isWin ? `+${WIN_RP} RP 획득` : `-${LOSE_RP} RP 차감`;
  const color = delta > 0 ? 'var(--color-primary)' : delta < 0 ? '#dc3545' : 'var(--color-text-muted)';
  const bg = delta > 0 ? 'var(--color-primary-soft)' : delta < 0 ? 'rgba(220,53,69,0.08)' : 'var(--color-surface-2)';
  const border = delta > 0 ? 'rgba(108,99,255,0.3)' : delta < 0 ? 'rgba(220,53,69,0.3)' : 'var(--color-border)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: bg, borderRadius: 'var(--radius-md)', border: `1px solid ${border}` }}>
      <span style={{ fontSize: '26px' }}>{delta > 0 ? '🏆' : delta < 0 ? '💔' : '🤝'}</span>
      <div>
        <div style={{ fontWeight: 700, color, fontSize: '16px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>이번 토론 결과</div>
      </div>
    </div>
  );
}

function RadarChart({ pro, con }: { pro: ParticipantScore; con: ParticipantScore }) {
  const cx = 130, cy = 120, r = 85;
  const axes = SCORE_CRITERIA.map(({ key, label }, i) => ({
    key, label,
    deg: (i / SCORE_CRITERIA.length) * 360,
  }));
  const toXY = (pct: number, deg: number) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + pct * r * Math.cos(rad), y: cy + pct * r * Math.sin(rad) };
  };
  const toPath = (s: ParticipantScore) => {
    const pts = axes.map(a => toXY((s[a.key] ?? 0) / 25, a.deg));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
  };
  return (
    <div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>
        항목별 비교
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <svg width="260" height="240" viewBox="0 0 260 240">
          {[1, 0.75, 0.5, 0.25].map(lvl => {
            const pts = axes.map(a => toXY(lvl, a.deg));
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
            return <path key={lvl} d={d} fill="none" stroke="var(--color-border)" strokeWidth="1" />;
          })}
          {axes.map(a => {
            const end = toXY(1, a.deg);
            return <line key={a.key} x1={cx} y1={cy} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke="var(--color-border)" strokeWidth="1" />;
          })}
          <path d={toPath(con)} fill="var(--color-con-glow)" stroke="var(--color-con)" strokeWidth="2" />
          <path d={toPath(pro)} fill="var(--color-pro-glow)" stroke="var(--color-pro)" strokeWidth="2" />
          {axes.map(a => {
            const pos = toXY(1.32, a.deg);
            const degNorm = ((a.deg % 360) + 360) % 360;
            const anchor = degNorm > 45 && degNorm < 135 ? 'start' : degNorm > 225 && degNorm < 315 ? 'end' : 'middle';
            return (
              <text key={a.key} x={pos.x.toFixed(1)} y={pos.y.toFixed(1)}
                textAnchor={anchor} dominantBaseline="middle"
                fill="var(--color-text-muted)" fontSize="11" fontWeight="600">
                {a.label}
              </text>
            );
          })}
        </svg>
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px', fontWeight: 600 }}>
          <span><span style={{ color: 'var(--color-pro)' }}>■</span> {pro.name} (찬성)</span>
          <span><span style={{ color: 'var(--color-con)' }}>■</span> {con.name} (반대)</span>
        </div>
      </div>
    </div>
  );
}

function EndedView({
  room,
  myRole,
}: {
  room: Room;
  myRole: PlayerRole | null;
}) {
  const result = room.result;
  const navigate = useNavigate();
  const isSoloEssay = room.mode === "solo_essay";

  if (!result)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          paddingTop: "40px",
        }}
      >
        <p style={{ color: "var(--color-text-muted)" }}>
          결과를 집계하는 중입니다...
        </p>
      </div>
    );

  const winnerLabel = isSoloEssay
    ? "논술 평가 결과"
    : result.winner === "pro"
      ? "찬성 팀 승리"
      : result.winner === "con"
        ? "반대 팀 승리"
        : "무승부";
  const winnerColor = isSoloEssay
    ? "var(--color-text)"
    : result.winner === "pro"
      ? "var(--color-pro)"
      : result.winner === "con"
        ? "var(--color-con)"
        : "var(--color-text-muted)";

  const sorted = [...(result.scores ?? [])].sort((a, b) => a.rank - b.rank);
  const playerScores = sorted.filter((s) => s.type === "player");
  const proPlayerVotes = playerScores.find((s) => s.vote === "pro")?.peerVotes ?? 0;
  const conPlayerVotes = playerScores.find((s) => s.vote === "con")?.peerVotes ?? 0;

  const getPeerLabel = (s: (typeof sorted)[0]) => {
    if (s.type !== "player") return null;
    const myVotes = s.vote === "pro" ? proPlayerVotes : conPlayerVotes;
    const oppVotes = s.vote === "pro" ? conPlayerVotes : proPlayerVotes;
    if (myVotes > oppVotes) return { text: "우세", color: "var(--color-pro, #4caf50)" };
    if (myVotes < oppVotes) return { text: "열세", color: "var(--color-con)" };
    return { text: "동점", color: "var(--color-text-muted)" };
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        paddingBottom: "40px",
      }}
    >
      <div style={{ textAlign: "center", paddingTop: "16px" }}>
        <div style={{ fontSize: "40px", marginBottom: "8px" }}>
          {isSoloEssay ? "📝" : "⚖️"}
        </div>
        <div style={{ fontSize: "24px", fontWeight: 700, color: winnerColor }}>
          {winnerLabel}
        </div>
      </div>
      {!isSoloEssay && <TeamCompareBar scores={sorted} />}
      {!isSoloEssay && <DecisiveEdgeBadge scores={sorted} />}
      <RpChangeCard result={result} myRole={myRole} />
      {result.summary && (
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
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              marginBottom: "8px",
            }}
          >
            AI 총평
          </div>
          {result.summary}
        </div>
      )}
      {sorted.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.4px",
              marginBottom: "10px",
            }}
          >
            참가자별 점수
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {[
                  "순위",
                  "참가자",
                  "논리성",
                  "근거",
                  "표현 명확성",
                  "반론",
                  "일관성",
                  "AI점수",
                  ...(isSoloEssay ? [] : ["동료평가"]),
                  "최종",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 12px",
                      color: "var(--color-text-muted)",
                      fontWeight: 600,
                      textAlign:
                        h === "참가자" || h === "순위" ? "left" : "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.filter((s) => s.type === "player").map((s) => {
                const sideColor = s.vote === "pro" ? "var(--color-pro)" : "var(--color-con)";
                const isMe = (s.vote === "pro" && myRole === "pro_player") || (s.vote === "con" && myRole === "con_player");
                const displayName = (s.vote === "pro" ? room.proPlayer?.username : room.conPlayer?.username) ?? s.name;
                return (
                  <tr
                    key={s.name}
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      ...(isMe ? { background: "var(--color-surface-2)" } : {}),
                    }}
                  >
                    <td style={{ padding: "10px 12px", fontSize: "16px" }}>
                      {RANK_BADGE[s.rank - 1] ?? s.rank}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontWeight: 600, color: sideColor }}>
                        {displayName}
                      </span>
                      {isMe && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: sideColor,
                            marginLeft: "5px",
                          }}
                        >
                          (나)
                        </span>
                      )}
                    </td>
                    {SCORE_CRITERIA.map(({ key }) => (
                      <td
                        key={key}
                        style={{
                          padding: "10px 12px",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            color:
                              s[key] >= 20
                                ? "var(--color-pro)"
                                : s[key] >= 13
                                  ? "var(--color-host)"
                                  : "var(--color-con)",
                          }}
                        >
                          {s[key]}
                        </span>
                      </td>
                    ))}
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600 }}>
                      {s.aiScore ?? Math.round(s.total * 0.7)}
                    </td>
                    {!isSoloEssay && (
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        {(() => {
                          const label = getPeerLabel(s);
                          if (!label) return <span style={{ color: "var(--color-text-muted)" }}>-</span>;
                          return (
                            <span style={{ fontSize: "11px", fontWeight: 700, color: label.color }}>
                              {label.text}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    <td
                      style={{
                        padding: "10px 12px",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: "15px",
                        color: sideColor,
                      }}
                    >
                      {s.finalScore ?? s.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isSoloEssay && (() => {
        const proPlayer = playerScores.find(s => s.vote === 'pro');
        const conPlayer = playerScores.find(s => s.vote === 'con');
        if (!proPlayer || !conPlayer) return null;
        return <RadarChart pro={proPlayer} con={conPlayer} />;
      })()}
      {sorted.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
          }}
        >
          {sorted.map((s) => {
            const sideColor = s.vote === "pro" ? "var(--color-pro)" : "var(--color-con)";
            return (
              <div
                key={s.name}
                style={{
                  background:
                    s.vote === "pro"
                      ? "var(--color-pro-bg)"
                      : "var(--color-con-bg)",
                  border: `1px solid ${s.vote === "pro" ? "var(--color-pro)" : "var(--color-con)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 700, color: sideColor }}>
                    {RANK_BADGE[s.rank - 1]} {s.name}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "15px", color: sideColor }}>
                    <AnimatedScore value={s.finalScore ?? s.total} />점
                  </span>
                </div>
                {SCORE_CRITERIA.map(({ key, label }) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {label}
                    </span>
                    <ScoreBar value={s[key] ?? 0} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {playerScores.filter((s) => s.advice).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            플레이어 개인 조언
          </div>
          {playerScores
            .filter((s) => s.advice)
            .filter((s) => {
              if (myRole === "pro_player") return s.vote === "pro";
              if (myRole === "con_player") return s.vote === "con";
              return true; // observer는 모두 표시
            })
            .map((s) => (
              <div
                key={s.name}
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: s.vote === "pro" ? "var(--color-pro)" : "var(--color-con)",
                    marginBottom: "6px",
                  }}
                >
                  {s.name}에게
                </div>
                <p style={{ fontSize: "13px", lineHeight: 1.7, margin: 0 }}>
                  {s.advice}
                </p>
              </div>
            ))}
        </div>
      )}
      <button
        className="btn btn--ghost"
        onClick={() => navigate("/")}
        style={{ alignSelf: "center" }}
      >
        로비로 돌아가기
      </button>
    </div>
  );
}

// ─── 사이드바 (우측 정보 패널) ──────────────────────────────────

function DebateSidebar({
  room,
  myRole,
  sidebarOpen,
  onClose,
}: {
  room: Room;
  myRole: PlayerRole | null;
  mySocketId: string;
  sidebarOpen: boolean;
  onClose: () => void;
}) {
  const mySide: AlignSide | null =
    myRole === "pro_player" ? "pro" : myRole === "con_player" ? "con" : null;
  const { phase, content } = room;
  const stageIdx = getStageIndex(phase);

  return (
    <>
      <div
        className={`sidebar-backdrop${sidebarOpen ? " is-open" : ""}`}
        onClick={onClose}
      />
      <div className={`debate-sidebar${sidebarOpen ? " is-open" : ""}`}>
        {/* 토론 주제 + 포지션 */}
        <div className="sidebar-section">
          <div className="sidebar-section__title">토론 주제</div>
          <p className="sidebar-topic">{room.topic ?? "주제 생성 중..."}</p>
          <div className="sidebar-positions">
            <span
              className={`sidebar-badge sidebar-badge--pro${mySide === "pro" ? " sidebar-badge--me" : ""}`}
            >
              {mySide === "pro" ? "나" : mySide === "con" ? "상대" : "찬성"}
              ·찬성
            </span>
            <span
              className={`sidebar-badge sidebar-badge--con${mySide === "con" ? " sidebar-badge--me" : ""}`}
            >
              {mySide === "con" ? "나" : mySide === "pro" ? "상대" : "반대"}
              ·반대
            </span>
          </div>
        </div>

        {/* 진행 단계 */}
        <div className="sidebar-section">
          <div className="sidebar-section__title">진행 단계</div>
          {DEBATE_STAGES.map((stage, i) => {
            const status =
              stageIdx < 0
                ? "upcoming"
                : i < stageIdx
                  ? "done"
                  : i === stageIdx
                    ? "active"
                    : "upcoming";
            return (
              <div key={i} className={`stage-item stage-item--${status}`}>
                <span className="stage-item__dot" />
                <span className="stage-item__label">
                  {i + 1}단계·{stage.label}
                </span>
                {status === "done" && (
                  <span className="stage-item__badge">완료</span>
                )}
                {status === "active" && (
                  <span className="stage-item__badge stage-item__badge--active">
                    진행 중
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 최초 주장 요약 */}
        <div className="sidebar-section">
          <div className="sidebar-section__title">최초 주장 요약</div>
          {content.pro_argument ? (
            <Popover
              width={300}
              content={
                <div className="popover__claim">
                  <div className="popover__claim-label popover__claim-label--pro">
                    찬성 측 최초 주장
                  </div>
                  <p className="popover__claim-text">
                    {content.pro_argument}
                  </p>
                </div>
              }
            >
              <div className="claim-summary claim-summary--pro">
                <div className="claim-summary__label">찬성 측</div>
                <p className="claim-summary__text">
                  {content.pro_argument.length > 90
                    ? content.pro_argument.slice(0, 90) + "..."
                    : content.pro_argument}
                </p>
              </div>
            </Popover>
          ) : (
            <div className="claim-summary claim-summary--pro">
              <div className="claim-summary__label">찬성 측</div>
              <p className="claim-summary__text claim-summary__text--empty">
                제출 전
              </p>
            </div>
          )}
          {content.con_argument ? (
            <Popover
              width={300}
              content={
                <div className="popover__claim">
                  <div className="popover__claim-label popover__claim-label--con">
                    반대 측 최초 주장
                  </div>
                  <p className="popover__claim-text">
                    {content.con_argument}
                  </p>
                </div>
              }
            >
              <div className="claim-summary claim-summary--con">
                <div className="claim-summary__label">반대 측</div>
                <p className="claim-summary__text">
                  {content.con_argument.length > 90
                    ? content.con_argument.slice(0, 90) + "..."
                    : content.con_argument}
                </p>
              </div>
            </Popover>
          ) : (
            <div className="claim-summary claim-summary--con">
              <div className="claim-summary__label">반대 측</div>
              <p className="claim-summary__text claim-summary__text--empty">
                제출 전
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── 메인 DebatePage ────────────────────────────────────────────

interface LocationState {
  password?: string;
}

const DEBATE_PHASES = new Set<Phase>([
  "arguing",
  "pro_p_rebuttal",
  "pro_p_defense",
  "pro_p_counter",
  "con_p_rebuttal",
  "con_p_defense",
  "con_p_counter",
  "pro_a_rebuttal",
  "pro_a_defense",
  "pro_a_counter",
  "con_a_rebuttal",
  "con_a_defense",
  "con_a_counter",
  "coaching",
  "final_argument",
  "essay_writing",
  "essay_feedback",
  "essay_revision",
]);

export function DebatePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const userId = currentUser?.id;
  const username = currentUser?.name;
  const { room, myRole, mySocketId, resetRoom } = useRoomStore();
  const didJoin = useRef(false);
  const joinSucceeded = useRef(false);
  const isLeavingRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useSocket();
  useRoomEvents();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;
    const handlePreJoinError = ({ message }: { message: string }) => {
      if (!joinSucceeded.current) setJoinError(message);
    };
    const handleRoomState = () => { joinSucceeded.current = true; };
    s.on("error", handlePreJoinError);
    s.on("room_state", handleRoomState);
    return () => {
      s.off("error", handlePreJoinError);
      s.off("room_state", handleRoomState);
    };
  }, []);

  useEffect(() => {
    resetRoom();
    joinSucceeded.current = false;
    if (!roomId || !username) {
      navigate(`/rooms/${roomId}`, { replace: true });
      return;
    }
    const { password } = (location.state as LocationState) ?? {};
    socket.connect();
    const onConnect = () => {
      if (didJoin.current) return;
      didJoin.current = true;
      socket.emit("join_room", {
        roomId: roomId!,
        userId: userId!,
        username,
        password: password ?? undefined,
      });
    };
    socket.on("connect", onConnect);

    if (socket.connected && !didJoin.current) {
      didJoin.current = true;
      socket.emit("join_room", {
        roomId: roomId!,
        userId: userId!,
        username,
        password: password ?? undefined,
      });
    }

    return () => {
      socket.off("connect", onConnect);
      if (!isLeavingRef.current) socket.emit("leave_room");
      resetRoom();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (joinError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "16px",
        }}
      >
        <div style={{ fontSize: "36px" }}>🚫</div>
        <p
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--color-danger)",
          }}
        >
          {joinError}
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            className="btn btn--ghost"
            onClick={() => navigate(`/rooms/${roomId}`, { state: { hasPassword: true } })}
          >
            다시 입장하기
          </button>
          <button className="btn btn--ghost" onClick={() => navigate("/")}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!room) return <div className="loading">방에 접속 중...</div>;

  const { phase } = room;
  const isDebatePhase = DEBATE_PHASES.has(phase);
  const stageIdx = getStageIndex(phase);

  return (
    <div className={`debate-page${phase !== "waiting" && phase !== "topic_selection" ? " debate-page--with-sidebar" : ""}`}>
      <div className="debate-main">
        {/* 모바일 헤더 (대기/주제선택 phase에서는 숨김) */}
        {phase !== "waiting" && phase !== "topic_selection" && (
          <div className="debate-mobile-header">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              정보 ▸
            </button>
            {room.topic && (
              <span className="debate-mobile-header__topic">{room.topic}</span>
            )}
          </div>
        )}

        {/* 통합 페이즈 헤더 */}
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
          {/* 1행: 제목(좌) + 상태 뱃지 | 타이머(가운데) | n/4단계(우) */}
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
                {room.title}
              </span>
              <span className="phase-status-badge">
                <span className="phase-status-badge__dot" />
                {PHASE_LABELS[phase]}
              </span>
            </div>
            <PhaseTimer phaseEndAt={room.phaseEndAt} />
            <div
              style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}
            >
              {stageIdx >= 0 && (
                <span className="slim-phase-bar__chip">
                  {stageIdx + 1}/{DEBATE_STAGES.length}단계
                </span>
              )}
            </div>
          </div>
          {/* 2행: 타임라인 바 (stageIdx >= 0일 때만 표시) */}
          {stageIdx >= 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {DEBATE_STAGES[stageIdx].label} 진행 중
              </div>
              <div
                style={{ flex: 1, display: "flex", gap: "4px", minWidth: 0 }}
              >
                {DEBATE_STAGES.map((_, i) => (
                  <div
                    key={i}
                    className={`slim-phase-bar__seg slim-phase-bar__seg--${i < stageIdx ? "done" : i === stageIdx ? "active" : "upcoming"}`}
                    style={{ flex: 1 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 퇴장 확인 모달 */}
        {showLeaveConfirm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "12px",
                padding: "28px 24px",
                maxWidth: "360px",
                width: "90%",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <p style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                퇴장하시겠습니까?
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--color-danger)",
                  margin: 0,
                }}
              >
                지금 나가면 이 토론은 <strong>패배 처리</strong>됩니다.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-border)",
                    background: "transparent",
                    color: "var(--color-text)",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  계속하기
                </button>
                <button
                  onClick={() => {
                    isLeavingRef.current = true;
                    socket.emit("leave_room");
                    navigate("/");
                  }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "6px",
                    border: "none",
                    background: "var(--color-danger)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  퇴장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 메인 컨텐츠 */}
        {isDebatePhase ? (
          <DebateChatView room={room} myRole={myRole} />
        ) : phase === "judging" ? (
          <JudgingWaitView room={room} myRole={myRole} />
        ) : phase === "peer_voting" ? (
          <div style={{ flex: 1, overflow: "auto" }}>
            <PeerVoteView room={room} myRole={myRole} />
          </div>
        ) : (
          <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
            {phase === "waiting" && (
              <WaitingView
                room={room}
                myRole={myRole}
                mySocketId={mySocketId}
              />
            )}
            {phase === "topic_selection" && (
              <TopicSelectionView room={room} myRole={myRole} />
            )}
            {phase === "ended" && <EndedView room={room} myRole={myRole} />}
          </div>
        )}
      </div>

      {phase !== "waiting" && phase !== "topic_selection" && (
        <DebateSidebar
          room={room}
          myRole={myRole}
          mySocketId={mySocketId}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
