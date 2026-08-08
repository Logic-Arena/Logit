# Project Git Conventions

이 문서는 프로젝트의 일관된 협업과 효율적인 코드 리뷰를 위한 Git 사용 규칙을 정의합니다.

---

## 1. 브랜치 네이밍 컨벤션 (Branch Naming)
우리 프로젝트는 **`이름/할일`** 형식을 사용합니다. 모든 문자는 소문자 사용을 권장하며, 단어 사이는 하이픈(-)으로 연결합니다.

| 구분 | 형식 (Format) | 예시 (Example) |
| :--- | :--- | :--- |
| **기능 개발** | `이름/feat-기능명` | `sowon/feat-login` |
| **버그 수정** | `이름/fix-오류명` | `sowon/fix-db-error` |
| **문서 수정** | `이름/docs-항목` | `sowon/docs-readme` |
| **리팩토링** | `이름/refactor-대상` | `sowon/refactor-ui` |
| **기타 작업** | `이름/chore-작업명` | `sowon/chore-config` |

---

## 2. 커밋 메시지 컨벤션 (Commit Message)
커밋 메시지는 **`Type: Subject`** 형태의 제목과 필요한 경우 상세한 **`Body`**를 작성합니다.

### 타입(Type) 정의
| 타입 | 설명 | 비고 |
| :--- | :--- | :--- |
| **Feat** | 새로운 기능 추가 | 기능 구현 시 사용 |
| **Fix** | 버그 수정 | 오류 해결 시 사용 |
| **Docs** | 문서 수정 | README 등 문서 작업 |
| **Style** | 코드 포맷팅 | 세미콜론, 줄바꿈 등 |
| **Refactor** | 코드 리팩토링 | 로직 개선 (기능 변화 없음) |
| **Test** | 테스트 코드 | 테스트 케이스 추가/수정 |
| **Chore** | 기타 작업 | 빌드 설정, 패키지 관리 등 |

### 작성 규칙
- 제목은 50자 이내로 작성하며 마침표를 찍지 않습니다.
- 제목의 첫 글자는 대문자로 시작합니다.
- 본문은 '무엇을', '왜' 변경했는지 상세히 설명합니다 (72자 이내 줄바꿈).

---

## 3. PR(Pull Request) 메시지 컨벤션
코드 리뷰의 효율을 위해 아래 양식에 맞춰 PR을 생성합니다.

### PR 제목 형식
`[타입] 제목 (#이슈번호)`
> 예: `[Feat] 소셜 로그인 연동 구현 (#12)`

### PR 본문 양식
```markdown
## 개요
- 변경 사항에 대한 간략한 요약을 작성합니다.

## 주요 변경 사항
- 어떤 파일이나 로직이 수정되었는지 나열합니다.

## 관련 이슈
- #이슈번호
```

---

## 4. 의존성/설치물 커밋 정책
- `node_modules`는 절대 커밋하지 않습니다.
- 루트 및 하위 프로젝트의 `package.json`, `package-lock.json`은 커밋 대상입니다.
- 의존성 변경 시에는 반드시 `package.json`과 lock 파일 변경을 함께 포함합니다.
- 로컬 설치물(`node_modules`, 빌드 산출물, 캐시)은 `.gitignore`로 관리합니다.

---

## 5. 운영 배포

- 운영 주소: <https://logit.woo-zu.com>
- 운영 브랜치: `main`
- 서버 경로: `/opt/logit`
- 실행 환경: EC2의 Docker Compose와 호스트 Nginx

`main`에 push하면 `.github/workflows/deploy-production.yml`이 다음 순서로 실행됩니다.

1. 프론트엔드 의존성 설치 및 프로덕션 빌드
2. 백엔드 의존성 설치 및 JavaScript 문법 검사
3. Docker 및 CI/CD 구성 검사
4. EC2에 SSH 접속
5. `main` fast-forward, Docker 이미지 빌드, Prisma migration, 컨테이너 재생성
6. 컨테이너와 공개 HTTPS health check

GitHub 저장소에는 다음 Actions Secrets가 필요합니다.

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_PRIVATE_KEY`
- `EC2_KNOWN_HOSTS`

GitHub의 Actions 화면에서 `Deploy production`을 선택하면 `workflow_dispatch`로 같은 배포를 수동 실행할 수 있습니다.

로컬에서는 `~/.ssh/config`의 `Host logit` 별칭을 통해 접속합니다.

```bash
ssh logit
```

프론트엔드의 기존 lint 오류는 현재 배포 차단 조건이 아닙니다. 별도 수정 후 lint를 CI 필수 단계로 추가합니다.
