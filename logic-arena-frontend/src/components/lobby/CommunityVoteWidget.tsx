import { useState, useEffect } from "react";
import { getCommunityTopics, voteOnTopic, type CommunityTopic } from "../../lib/api";
import { useUserStore } from "../../store/useUserStore";

export function CommunityVoteWidget() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommunityTopics()
      .then(setTopics)
      .finally(() => setLoading(false));
  }, []);

  async function handleVote(id: number, side: "pro" | "con") {
    if (!isLoggedIn) return;
    try {
      const res = await voteOnTopic(id, side);
      setTopics((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...res.topic, myVote: res.myVote } : t
        )
      );
    } catch {
      // ignore
    }
  }

  return (
    <aside className="vote-widget">
      <div className="vote-widget__header">
        <h2 className="vote-widget__title">이 주제, 어떻게 생각해?</h2>
        <p className="vote-widget__subtitle">투표하고 Logit에서 토론하세요</p>
      </div>

      <div className="vote-widget__status">
        <span className="vote-widget__live-dot" />
        <span className="vote-widget__live-label">투표 진행 중</span>
      </div>

      {loading ? (
        <div style={{ padding: "16px", color: "var(--color-text-muted)", fontSize: "13px", textAlign: "center" }}>
          주제를 불러오는 중...
        </div>
      ) : (
        <div className="vote-widget__list">
          {(() => {
            const maxVotes = Math.max(...topics.map((t) => t.pro_votes + t.con_votes));
            return topics.map((topic) => {
              const total = topic.pro_votes + topic.con_votes;
              const proPercent = total > 0 ? Math.round((topic.pro_votes / total) * 100) : 50;
              const conPercent = 100 - proPercent;
              const myVote = topic.myVote;
              const isHot = total > 0 && total === maxVotes;
              const badge = isHot ? "HOT" : topic.badge === "NEW" ? "NEW" : null;

              return (
                <div key={topic.id} className="vote-card">
                  <div className="vote-card__tags">
                    {badge && (
                      <span className={`vote-card__badge vote-card__badge--${badge.toLowerCase()}`}>
                        {badge}
                      </span>
                    )}
                    <span className="vote-card__category">{topic.category}</span>
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

                  <div className="vote-card__buttons">
                    <button
                      className={`vote-card__btn vote-card__btn--pro${myVote === "pro" ? " is-active" : ""}`}
                      onClick={() => handleVote(topic.id, "pro")}
                      disabled={!isLoggedIn}
                    >
                      찬성
                    </button>
                    <button
                      className={`vote-card__btn vote-card__btn--con${myVote === "con" ? " is-active" : ""}`}
                      onClick={() => handleVote(topic.id, "con")}
                      disabled={!isLoggedIn}
                    >
                      반대
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </aside>
  );
}
