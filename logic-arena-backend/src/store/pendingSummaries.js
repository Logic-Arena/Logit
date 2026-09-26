// 교사용 AI 요약(teacher_summary)을 생성 중인 DebateHistory id 목록.
// 토론 종료 시 생성(statsService)과 교사 조회 시 생성(routes/teacher)이 같은 잠금을 공유해
// 같은 기록에 대해 AI를 두 번 호출하거나 나중에 끝난 쪽이 덮어쓰는 것을 막는다.
export const pendingSummaries = new Set();
