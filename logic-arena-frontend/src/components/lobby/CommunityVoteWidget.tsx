import { useState } from "react";

interface VoteTopic {
  id: number;
  badge?: "HOT" | "NEW";
  category: string;
  question: string;
  proPercent: number;
}

const MOCK_TOPICS: VoteTopic[] = [
  {
    id: 1,
    badge: "HOT",
    category: "교육",
    question: "학교 스마트폰 전면 금지, 찬성하시나요?",
    proPercent: 62,
  },
  {
    id: 2,
    category: "교육",
    question: "대입 수능, 절대평가로 전환해야 한다",
    proPercent: 45,
  },
  {
    id: 3,
    badge: "NEW",
    category: "기술·사회",
    question: "AI 면접관 도입, 공정한가?",
    proPercent: 31,
  },
];

export function CommunityVoteWidget() {
  const [voted, setVoted] = useState<Record<number, "pro" | "con">>({});

  function handleVote(id: number, side: "pro" | "con") {
    setVoted((prev) => ({ ...prev, [id]: side }));
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

      <div className="vote-widget__list">
        {MOCK_TOPICS.map((topic) => {
          const conPercent = 100 - topic.proPercent;
          const myVote = voted[topic.id];
          return (
            <div key={topic.id} className="vote-card">
              <div className="vote-card__tags">
                {topic.badge && (
                  <span className={`vote-card__badge vote-card__badge--${topic.badge.toLowerCase()}`}>
                    {topic.badge}
                  </span>
                )}
                <span className="vote-card__category">{topic.category}</span>
              </div>

              <p className="vote-card__question">{topic.question}</p>

              <div className="vote-card__stats">
                <span className="vote-card__stat vote-card__stat--pro">찬성 {topic.proPercent}%</span>
                <span className="vote-card__stat vote-card__stat--con">반대 {conPercent}%</span>
              </div>

              <div className="vote-card__bar">
                <div
                  className="vote-card__bar-fill"
                  style={{ width: `${topic.proPercent}%` }}
                />
              </div>

              <div className="vote-card__buttons">
                <button
                  className={`vote-card__btn vote-card__btn--pro${myVote === "pro" ? " is-active" : ""}`}
                  onClick={() => handleVote(topic.id, "pro")}
                >
                  찬성
                </button>
                <button
                  className={`vote-card__btn vote-card__btn--con${myVote === "con" ? " is-active" : ""}`}
                  onClick={() => handleVote(topic.id, "con")}
                >
                  반대
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
