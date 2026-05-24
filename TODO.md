# 우측 사이드바 (커뮤니티 투표 위젯) 개선 작업

> 📍 위치: 메인페이지(LobbyPage) 우측 "이 주제, 어떻게 생각해?" 사이드바

## ✅ 완료된 작업 (Phase 1)

### 1. API 엔드포인트 수정 및 에러 처리 개선
**완료 시간**: 2시간  
**완료 날짜**: 2026-05-24

#### 프론트엔드 개선
- [x] `getCommunityTopics()` 에러 처리 강화
  - 네트워크 연결 오류 감지 (TypeError)
  - HTTP 상태 코드별 구체적인 에러 메시지
  - 서버 응답 에러 메시지 파싱
  - 📄 파일: `logic-arena-frontend/src/lib/api.ts:146-165`

- [x] `voteOnTopic()` 에러 처리 강화
  - 401: 로그인 필요
  - 404: 주제를 찾을 수 없음
  - 409: 이미 투표함
  - 410: 주제 만료
  - 503: 서버 일시 오류
  - 📄 파일: `logic-arena-frontend/src/lib/api.ts:167-195`

#### 백엔드 개선
- [x] GET `/community-topics` 에러 처리 개선
  - 빈 주제 목록 처리
  - Prisma 에러 코드별 처리
  - 구체적인 에러 메시지
  - 📄 파일: `logic-arena-backend/src/routes/community.js:32-55`

- [x] POST `/community-topics/:id/vote` 에러 처리 개선
  - 주제 ID 유효성 검사
  - 투표 값 검증 강화
  - 주제 만료 확인 (410 응답)
  - Prisma 에러 코드별 처리 (P2025, P2002, P1001)
  - 📄 파일: `logic-arena-backend/src/routes/community.js:57-119`

#### UI/UX 개선
- [x] 토스트 알림 시스템 통합
  - 투표 실패 시 에러 메시지 표시
  - 로그인 필요 시 안내 메시지
  - 주제 만료 시 자동 새로고침 안내
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx`

- [x] 낙관적 UI 업데이트 구현
  - 투표 즉시 UI 반영 (서버 응답 대기 없음)
  - 에러 시 자동 롤백
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx:41-94`

- [x] 로딩 상태 표시
  - 주제 로딩 중 표시
  - 투표 진행 중 버튼 비활성화 및 시각적 피드백
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx`

- [x] 에러 상태 UI 추가
  - 에러 메시지 표시
  - "다시 시도" 버튼 제공
  - 빈 주제 목록 안내
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx:119-127`

- [x] 접근성 개선
  - 버튼에 `aria-label` 추가
  - 키보드 네비게이션 지원
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx:178-189`

#### 스타일 개선
- [x] `.is-voting` 클래스 추가 (투표 중 상태)
- [x] `:disabled` 스타일 개선
- 📄 파일: `logic-arena-frontend/src/styles/globals.css:671-681`

---

## 🔄 진행 예정 작업

### Phase 2: 핵심 기능 완성 (3-4시간)
**우선순위**: 🟡 중간

#### 2.1 실시간 투표 업데이트 (Socket.io 연동)
**예상 시간**: 2시간

**백엔드 작업**
- [ ] Socket.io 이벤트 추가
  - 투표 시 `community_vote_update` 이벤트 발송
  - 📄 파일: `logic-arena-backend/src/routes/community.js`
  ```javascript
  // 투표 성공 후
  req.app.get('io').emit('community_vote_update', {
    topicId,
    topic: updated
  });
  ```

**프론트엔드 작업**
- [ ] Socket 리스너 추가
  - `community_vote_update` 이벤트 수신
  - 실시간으로 다른 사용자의 투표 반영
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx`
  ```typescript
  useEffect(() => {
    socket.on('community_vote_update', ({ topicId, topic }) => {
      setTopics(prev => prev.map(t => t.id === topicId ? topic : t));
    });
    return () => socket.off('community_vote_update');
  }, []);
  ```

**테스트 시나리오**
- [ ] 두 개의 브라우저 창에서 동시 투표
- [ ] 한 창에서 투표 시 다른 창에 실시간 반영 확인

#### 2.2 주제 자동 갱신 (만료된 주제 처리)
**예상 시간**: 1시간

- [ ] 주기적 만료 확인 타이머 추가
  - 1분마다 `expires_at` 확인
  - 만료된 주제 발견 시 자동 새로고침
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx`
  ```typescript
  useEffect(() => {
    const checkExpiration = () => {
      const now = Date.now();
      const shouldRefresh = topics.some(t => 
        new Date(t.expires_at).getTime() < now
      );
      if (shouldRefresh) loadTopics();
    };
    
    const timer = setInterval(checkExpiration, 60000);
    return () => clearInterval(timer);
  }, [topics]);
  ```

- [ ] 만료 임박 시 UI 표시
  - 만료 24시간 전 "곧 종료" 배지 추가

---

### Phase 3: UX/UI 개선 (2-3시간)
**우선순위**: 🟢 낮음

#### 3.1 로딩 & 에러 상태 스켈레톤
**예상 시간**: 1시간

- [ ] `VoteWidgetSkeleton` 컴포넌트 생성
  - 로딩 중 스켈레톤 UI 표시
  - 📄 파일: `logic-arena-frontend/src/components/lobby/VoteWidgetSkeleton.tsx`

- [ ] `ErrorState` 컴포넌트 생성
  - 에러 상태 UI 컴포넌트화
  - 재시도 버튼 포함
  - 📄 파일: `logic-arena-frontend/src/components/lobby/ErrorState.tsx`

#### 3.2 투표 애니메이션 개선
**예상 시간**: 1시간

- [ ] 퍼센트 바 부드러운 전환 애니메이션
  - 📄 파일: `logic-arena-frontend/src/styles/globals.css`
  ```css
  .vote-card__bar-fill {
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  ```

- [ ] 투표 버튼 클릭 시 펄스 애니메이션
  ```css
  @keyframes vote-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(0.95); }
  }
  ```

---

### Phase 4: 고급 기능 추가 (4-5시간)
**우선순위**: 🟢 낮음

#### 4.1 투표 결과 상세 표시
**예상 시간**: 2시간

- [ ] 투표 수 표시 추가
  - `찬성 123명 (65%) | 반대 45명 (35%)`
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx`

- [ ] 참여율 배지
  - "🔥 200명 참여" 표시

- [ ] 내 투표 히스토리
  - 사용자가 투표한 주제 목록 저장
  - 마이페이지에서 확인 가능

#### 4.2 주제 필터링 & 정렬
**예상 시간**: 1.5시간

- [ ] 필터 UI 추가
  - 전체 / HOT / NEW 탭
  - 📄 파일: `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx`

- [ ] 카테고리별 필터링
  - 교육, 기술·사회, 환경, 정치, 문화

#### 4.3 투표 알림 시스템
**예상 시간**: 1.5시간

- [ ] 새 주제 등록 알림
  - "새로운 주제가 등록되었습니다!" 토스트

- [ ] 주제 만료 임박 알림
  - 만료 1일 전 알림

- [ ] 푸시 알림 (선택 사항)
  - 브라우저 푸시 알림 권한 요청

#### 4.4 주제 상세 모달
**예상 시간**: 2시간

- [ ] 모달 컴포넌트 생성
  - 투표 분포 그래프 (Chart.js)
  - 시간별 투표 추이
  - 📄 파일: `logic-arena-frontend/src/components/lobby/TopicDetailModal.tsx`

- [ ] 관련 토론방 연결
  - 해당 주제로 개설된 토론방 목록
  - "이 주제로 토론하기" 버튼

- [ ] 공유 기능
  - URL 복사, SNS 공유

---

### Phase 5: 성능 최적화 (2시간)
**우선순위**: 🟢 낮음

#### 5.1 React 최적화
**예상 시간**: 1시간

- [ ] `VoteCard` 컴포넌트 분리 및 메모이제이션
  - 📄 파일: `logic-arena-frontend/src/components/lobby/VoteCard.tsx`
  ```typescript
  const MemoizedVoteCard = memo(VoteCard, (prev, next) => 
    prev.topic.id === next.topic.id &&
    prev.topic.pro_votes === next.topic.pro_votes &&
    prev.topic.myVote === next.topic.myVote
  );
  ```

- [ ] `useCallback` 최적화
  - `handleVote`, `loadTopics` 함수

#### 5.2 API 캐싱 (SWR 도입)
**예상 시간**: 1시간

- [ ] SWR 라이브러리 설치
  ```bash
  npm install swr
  ```

- [ ] `useCommunityTopics` 커스텀 훅 생성
  - 📄 파일: `logic-arena-frontend/src/hooks/useCommunityTopics.ts`
  ```typescript
  const { data: topics, mutate } = useSWR(
    '/community-topics',
    getCommunityTopics,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000 
    }
  );
  ```

---

## 🐛 발견된 기존 문제점 (해결됨)

- [x] ~~API 엔드포인트 불일치~~ → 이미 올바름 (`${BASE}/community-topics`)
- [x] ~~실시간 업데이트 부재~~ → Phase 2에서 구현 예정
- [x] ~~에러 처리 부족~~ → ✅ 완료
- [x] ~~낙관적 업데이트 없음~~ → ✅ 완료
- [x] ~~주제 만료 처리 미흡~~ → 부분 완료 (자동 갱신은 Phase 2)
- [x] ~~접근성 문제~~ → 기본 개선 완료 (추가 개선은 Phase 3)

---

## 📋 우선순위 요약

| 우선순위 | Phase | 작업 | 예상 시간 | 상태 |
|---------|------|------|---------|------|
| 🔴 높음 | Phase 1 | API 에러 처리 개선 | 2시간 | ✅ 완료 |
| 🟡 중간 | Phase 2.1 | 실시간 투표 업데이트 | 2시간 | ⏳ 대기 |
| 🟡 중간 | Phase 2.2 | 주제 자동 갱신 | 1시간 | ⏳ 대기 |
| 🟢 낮음 | Phase 3 | UX/UI 개선 | 2-3시간 | ⏳ 대기 |
| 🟢 낮음 | Phase 4 | 고급 기능 | 4-5시간 | ⏳ 대기 |
| 🟢 낮음 | Phase 5 | 성능 최적화 | 2시간 | ⏳ 대기 |

**총 예상 시간**: 13-17시간  
**완료된 시간**: 2시간  
**남은 시간**: 11-15시간

---

## 🧪 테스트 체크리스트

### 완료된 테스트
- [x] 로그인 안 한 상태에서 투표 시도 → 토스트 메시지 확인
- [x] 네트워크 오류 시 에러 메시지 확인
- [x] 투표 시 낙관적 UI 업데이트 확인
- [x] 투표 중 버튼 비활성화 확인
- [x] 에러 시 롤백 동작 확인

### 진행 예정 테스트
- [ ] 실시간 업데이트 (두 브라우저 창)
- [ ] 주제 만료 시 자동 갱신
- [ ] 성능 테스트 (많은 동시 투표)
- [ ] 접근성 테스트 (스크린 리더)
- [ ] 모바일 반응형 테스트

---

## 📝 참고 파일

### 프론트엔드
- `logic-arena-frontend/src/lib/api.ts` - API 함수
- `logic-arena-frontend/src/components/lobby/CommunityVoteWidget.tsx` - 메인 컴포넌트
- `logic-arena-frontend/src/pages/LobbyPage.tsx` - 페이지 레이아웃
- `logic-arena-frontend/src/styles/globals.css` - 스타일
- `logic-arena-frontend/src/hooks/useToast.ts` - 토스트 훅

### 백엔드
- `logic-arena-backend/src/routes/community.js` - API 라우트
- `logic-arena-backend/src/services/openai.js` - AI 주제 생성
- `logic-arena-backend/prisma/schema.prisma` - DB 스키마

---

## 💡 다음 단계 제안

1. **즉시 진행 권장**: Phase 2.1 (실시간 투표 업데이트)
   - 사용자 경험 크게 향상
   - 기존 Socket.io 인프라 활용

2. **선택적 진행**: Phase 4.2 (필터링) 또는 Phase 3.2 (애니메이션)
   - 빠른 시간에 시각적 개선 가능

3. **장기 계획**: Phase 4.4 (주제 상세 모달)
   - 사용자 참여도 향상
   - 토론방 연결로 플랫폼 활성화

---

**마지막 업데이트**: 2026-05-24  
**작성자**: Claude Code
