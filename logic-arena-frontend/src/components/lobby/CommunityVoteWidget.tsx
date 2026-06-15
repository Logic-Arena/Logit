import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCommunityTopics, voteOnTopic, createRoom, type CommunityTopic } from "../../lib/api";
import { useUserStore } from "../../store/useUserStore";
import { useToast } from "../../hooks/useToast";

// 슬롯별 카테고리 레이블
const SLOT_LABEL: Record<string, string> = {
  A: '사회·정치',
  B: '경제·과학',
  C: '문화·환경',
};

// NEW 배지 판단: activated_at이 가장 최신인 주제 1개만
function isNew(topic: CommunityTopic, allTopics: CommunityTopic[]): boolean {
  if (!topic.activated_at) return false;

  // 모든 주제 중 activated_at이 가장 최신인지 확인
  const mostRecent = allTopics.reduce((latest, t) => {
    if (!t.activated_at) return latest;
    if (!latest.activated_at) return t;
    return new Date(t.activated_at) > new Date(latest.activated_at) ? t : latest;
  });

  return mostRecent.id === topic.id;
}

// 정렬 함수: HOT+NEW > NEW > HOT > none
function sortTopics(topics: CommunityTopic[]): CommunityTopic[] {
  return [...topics].sort((a, b) => {
    const aHasHot = a.badge === 'HOT';
    const bHasHot = b.badge === 'HOT';
    const aHasNew = isNew(a, topics);
    const bHasNew = isNew(b, topics);

    // HOT+NEW
    if (aHasHot && aHasNew && !(bHasHot && bHasNew)) return -1;
    if (bHasHot && bHasNew && !(aHasHot && aHasNew)) return 1;

    // NEW only
    if (aHasNew && !bHasNew && !bHasHot) return -1;
    if (bHasNew && !aHasNew && !aHasHot) return 1;

    // HOT only
    if (aHasHot && !bHasHot && !bHasNew) return -1;
    if (bHasHot && !aHasHot && !aHasNew) return 1;

    // 동일 우선순위면 activated_at으로 정렬 (최신순)
    const aTime = new Date(a.activated_at || 0).getTime();
    const bTime = new Date(b.activated_at || 0).getTime();
    return bTime - aTime;
  });
}

export function CommunityVoteWidget() {
  const navigate = useNavigate();
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<number | null>(null);
  const [creatingDebateId, setCreatingDebateId] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadTopics();
  }, []);

  async function loadTopics() {
    try {
      setLoading(true);
      setError(null);
      const data = await getCommunityTopics();
      setTopics(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "주제를 불러올 수 없습니다.";
      setError(message);
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(id: number, side: "pro" | "con") {
    if (!isLoggedIn) {
      toast("로그인 후 투표할 수 있습니다.", "info");
      return;
    }

    // 낙관적 업데이트를 위해 이전 상태 저장
    const prevTopics = topics;
    const currentTopic = topics.find(t => t.id === id);
    if (!currentTopic) return;

    const myPrevVote = currentTopic.myVote;
    const isSameVote = myPrevVote === side;

    try {
      setVotingId(id);

      // 낙관적 UI 업데이트
      setTopics((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;

          let newProVotes = t.pro_votes;
          let newConVotes = t.con_votes;

          // 이전 투표 취소
          if (myPrevVote === "pro") newProVotes--;
          if (myPrevVote === "con") newConVotes--;

          // 새 투표 (같은 버튼을 다시 누르면 취소)
          if (!isSameVote) {
            if (side === "pro") newProVotes++;
            if (side === "con") newConVotes++;
          }

          return {
            ...t,
            pro_votes: Math.max(0, newProVotes),
            con_votes: Math.max(0, newConVotes),
            myVote: isSameVote ? null : side,
          };
        })
      );

      // 서버에 투표 요청
      const res = await voteOnTopic(id, side);

      // 서버 응답으로 최종 업데이트
      setTopics((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...res.topic, myVote: res.myVote } : t
        )
      );
    } catch (err) {
      // 에러 발생 시 이전 상태로 롤백
      setTopics(prevTopics);
      const message = err instanceof Error ? err.message : "투표에 실패했습니다.";

      // 주제가 만료된 경우 자동으로 새 주제 불러오기
      if (message.includes("만료")) {
        toast(message + " 새로운 주제를 불러옵니다.", "info");
        setTimeout(() => loadTopics(), 1500);
      } else {
        toast(message, "error");
      }
    } finally {
      setVotingId(null);
    }
  }

  async function handleRevote(id: number) {
    if (!isLoggedIn) return;

    const currentTopic = topics.find(t => t.id === id);
    if (!currentTopic || !currentTopic.myVote) return;

    // 현재 투표한 쪽을 다시 클릭하면 취소됨
    await handleVote(id, currentTopic.myVote);
  }

  async function handleDebate(id: number) {
    if (!isLoggedIn) {
      toast("로그인 후 토론방을 생성할 수 있습니다.", "info");
      return;
    }

    const currentTopic = topics.find(t => t.id === id);
    if (!currentTopic) return;

    setCreatingDebateId(id);
    try {
      const title = `[커뮤니티] ${currentTopic.question}`;
      const room = await createRoom(title, 'ai_debate', 'manual', currentTopic.question);
      navigate(`/rooms/${room.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "토론방 생성에 실패했습니다.";
      toast(message, "error");
      setCreatingDebateId(null);
    }
  }

  // 정렬된 주제 목록
  const sortedTopics = sortTopics(topics);

  return (
    <aside className="vote-widget">
      <div className="vote-widget__header">
        <h2 className="vote-widget__title">이 주제, 어떻게 생각해?</h2>
        <p className="vote-widget__subtitle">투표하고 Logit에서 토론하세요</p>
      </div>

      {!loading && !error && (
        <div className="vote-widget__status">
          <span className="vote-widget__live-label">투표 진행 중</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "16px", color: "var(--color-text-muted)", fontSize: "13px", textAlign: "center" }}>
          주제를 불러오는 중...
        </div>
      ) : error ? (
        <div style={{ padding: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "13px", color: "var(--color-con)", marginBottom: "12px" }}>
            {error}
          </p>
          <button
            className="btn btn--secondary"
            onClick={loadTopics}
            style={{ fontSize: "13px", padding: "6px 14px" }}
          >
            다시 시도
          </button>
        </div>
      ) : topics.length === 0 ? (
        <div style={{ padding: "16px", color: "var(--color-text-muted)", fontSize: "13px", textAlign: "center" }}>
          현재 진행 중인 투표가 없습니다.
        </div>
      ) : (
        <div className="vote-widget__list">
          {sortedTopics.map((topic) => {
            const total = topic.pro_votes + topic.con_votes;
            const proPercent = total > 0 ? Math.round((topic.pro_votes / total) * 100) : 50;
            const conPercent = 100 - proPercent;
            const myVote = topic.myVote;
            const hasHot = topic.badge === 'HOT'; // 서버의 HOT 배지
            const hasNew = isNew(topic, topics); // 프론트엔드 NEW 배지 계산
            const isVoting = votingId === topic.id;
            const slotLabel = SLOT_LABEL[topic.slot as string] || topic.category;

            return (
              <div key={topic.id} className="vote-card">
                <div className="vote-card__tags">
                  {hasHot && (
                    <span className="vote-card__badge vote-card__badge--hot">
                      HOT
                    </span>
                  )}
                  {hasNew && (
                    <span className="vote-card__badge vote-card__badge--new">
                      NEW
                    </span>
                  )}
                  <span className="vote-card__category">{slotLabel}</span>
                </div>

                  <p className="vote-card__question">{topic.question}</p>

                  <div className="vote-card__stats">
                    <span className="vote-card__stat vote-card__stat--pro">찬성 {proPercent}%</span>
                    <span className="vote-card__stat vote-card__stat--con">반대 {conPercent}%</span>
                  </div>

                  <div className="vote-card__bar">
                    <div className="vote-card__bar-fill" style={{ width: `${proPercent}%` }} />
                  </div>

                  {!isLoggedIn && (
                    <p style={{ fontSize: "11px", color: "var(--color-text-muted)", margin: "4px 0 0", textAlign: "center" }}>
                      로그인 후 투표 가능합니다
                    </p>
                  )}

                  {/* 투표 전: 찬성/반대 버튼 */}
                  {!myVote && (
                    <div className="vote-card__buttons">
                      <button
                        className={`vote-card__btn vote-card__btn--pro${isVoting ? " is-voting" : ""}`}
                        onClick={() => handleVote(topic.id, "pro")}
                        disabled={!isLoggedIn || isVoting}
                        aria-label={`${topic.question}에 찬성 투표`}
                      >
                        찬성
                      </button>
                      <button
                        className={`vote-card__btn vote-card__btn--con${isVoting ? " is-voting" : ""}`}
                        onClick={() => handleVote(topic.id, "con")}
                        disabled={!isLoggedIn || isVoting}
                        aria-label={`${topic.question}에 반대 투표`}
                      >
                        반대
                      </button>
                    </div>
                  )}

                  {/* 투표 후: 다시투표/토론하기 버튼 */}
                  {myVote && (
                    <div className="vote-card__buttons">
                      <button
                        className={`vote-card__btn vote-card__btn--secondary${isVoting ? " is-voting" : ""}`}
                        onClick={() => handleRevote(topic.id)}
                        disabled={!isLoggedIn || isVoting}
                        aria-label="투표 취소하기"
                      >
                        다시투표
                      </button>
                      <button
                        className={`vote-card__btn vote-card__btn--primary${creatingDebateId === topic.id ? " is-voting" : ""}`}
                        onClick={() => handleDebate(topic.id)}
                        disabled={!isLoggedIn || creatingDebateId === topic.id}
                        aria-label={`${topic.question}로 토론하기`}
                      >
                        {creatingDebateId === topic.id ? "생성 중..." : "토론하기"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </aside>
  );
}
