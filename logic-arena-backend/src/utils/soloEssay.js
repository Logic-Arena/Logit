// solo_essay: position='pro'|'con'(실제 선택한 입장), result='solo'
// legacy 기록: position='solo'로 직접 저장된 경우도 존재
// 두 형태를 모두 개인 논술로 분류하려면 result와 position을 함께 검사해야 한다.
export const SOLO_ESSAY_WHERE = { OR: [{ result: 'solo' }, { position: 'solo' }] };
export const DEBATE_WHERE = { NOT: SOLO_ESSAY_WHERE };

export function isSoloRecord({ result, position }) {
  return result === 'solo' || position === 'solo';
}
