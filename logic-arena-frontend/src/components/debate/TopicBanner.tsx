interface Props {
  topic: string;
}

export function TopicBanner({ topic }: Props) {
  return (
    <div className="topic-banner">
      <div className="topic-banner__label">토론 주제</div>
      <div className="topic-banner__text">{topic}</div>
    </div>
  );
}
