export const TOPICS = [
  'AI는 인류에게 이롭다',
  '사형제도는 폐지해야 한다',
  '원격 근무는 생산성을 높인다',
  '소셜 미디어는 민주주의를 약화시킨다',
  '기본소득제는 도입해야 한다',
  '채식주의는 윤리적 의무다',
  '게임은 폭력성을 조장한다',
  '대학 입시는 폐지해야 한다',
  '로봇세를 도입해야 한다',
  '인터넷 실명제는 필요하다',
];

export function pickRandomTopic() {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}
