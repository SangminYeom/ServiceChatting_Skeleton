# 의사랑 상담 채팅 시스템 (ServiceChatting)

## 대화 시작 시 필수 확인

**매 대화 시작 시 `PROGRESS.md`를 먼저 읽고**, 현재 진행 상황을 사용자에게 간단히 요약한 뒤 작업을 시작한다.
작업 완료 후에는 `PROGRESS.md`를 업데이트하여 진행 상황을 반영한다.

## 프로젝트 개요

바로바로 챗봇에서 해결되지 않는 문의를 실시간 상담사 채팅으로 연결하는 시스템.
Chatwoot 오픈소스를 상담 엔진으로 사용하며, 바로바로(React 크로미움 웹앱) + 기존 .NET 백엔드와 연동한다.

- 설계 문서: `docs/superpowers/specs/2026-04-16-service-chatting-design.md`
- 다이어그램: `docs/superpowers/specs/diagrams/` (HTML 3종)

## 기술 스택

| 영역 | 기술 |
|------|------|
| 고객 앱 (바로바로) | React (크로미움 웹앱) |
| 상담 엔진 | Chatwoot (Docker 자체 호스팅) |
| 백엔드 | .NET (C#) |
| 실시간 통신 | Chatwoot WebSocket (내장) |
| DB | PostgreSQL + Redis (Chatwoot 내장) |
| 리버스 프록시 | Nginx → Chatwoot (:3000) |

## 아키텍처 원칙

### 역할 분리

- **Chatwoot가 담당하는 것**: 실시간 메시지, 파일 첨부, 상담사 대시보드, 자동 배정, 대기열, CSAT, Business Hours, WebSocket. 이 기능들은 직접 구현하지 않는다.
- **직접 개발하는 것**: 챗봇→상담사 전환 연동, 챗봇 대화 맥락 전달, 고객 인증(HMAC), Webhook 처리, 위젯 스타일 커스터마이징.
- **상담사 UI는 별도 개발하지 않는다**: Chatwoot 내장 대시보드를 그대로 사용.

### 연동 흐름 (반드시 준수)

1. 고객이 "상담사 연결" 클릭 → 문의 유형 선택
2. .NET 서버에 상담 요청 API 호출 (문의 유형 + 챗봇 대화 내역)
3. .NET 서버 → Chatwoot API: Contact 생성/조회 → Conversation 생성 → 챗봇 요약 노트 전달
4. 바로바로 앱에서 Chatwoot 위젯 활성화 (conversation_id 연결)
5. 상담사 대시보드에 새 대화 알림 도착

### 인증 흐름 (반드시 준수)

- HMAC 토큰은 반드시 .NET 서버에서 생성 (클라이언트에서 secret key 노출 금지)
- Chatwoot Identity Validation 사용: identifier + identifier_hash
- 바로바로 앱 로그인 시 .NET 서버에 HMAC 토큰 요청 → SDK 초기화 시 전달

## 개발 규칙

### 프론트엔드 (React / 바로바로)

- Chatwoot 위젯은 스크립트 태그로 연동한다 (공식 npm 패키지 없음, `window.$chatwoot` API 사용)
- Chatwoot 위젯은 바로바로 UI 스타일에 맞게 커스터마이징한다
- 챗봇 화면과 상담 채팅 화면 간 전환은 명확한 상태 관리로 처리한다
- 대기열 진입 시 대기 순서 + 예상 대기 시간을 표시하고 대기 취소를 지원한다

### 백엔드 (.NET / C#)

- Chatwoot API 호출은 전용 서비스 클래스로 캡슐화한다
- Webhook 엔드포인트는 이벤트 유형별로 처리한다: `conversation_created`, `conversation_resolved`, `message_created`, `csat_created`
- Chatwoot API 키와 HMAC secret은 환경 변수 또는 안전한 설정 관리를 사용한다 (코드에 하드코딩 금지)
- 챗봇 대화 내역을 Chatwoot에 전달할 때는 Conversation Note(내부 메모)로 전달한다

### 인프라 (Docker)

- Chatwoot는 Docker Compose로 배포: `chatwoot-web`, `chatwoot-worker`, `postgres`, `redis`
- 서버 최소 사양: CPU 2코어, RAM 4GB, 디스크 20GB
- 도메인: `chat.ubcare.co.kr` (Nginx 리버스 프록시)

### 에러 처리

- Chatwoot 서버 다운 시: "상담사 연결" 버튼에서 "일시적 장애" 안내 → 챗봇으로 복귀
- 네트워크 끊김: Chatwoot SDK 자동 재연결에 의존, 대화 유지
- 업무 시간 외: 오프라인 모드 전환 → 메시지 남기기 안내 (평일 09:00~18:00)

### 파일 첨부

- 최대 40MB, 허용 형식: 이미지(png, jpg, gif), 문서(pdf, docx), 스크린샷
- 업로드 실패 시 사용자에게 재시도 안내

## 규모

- 상담사: 5~20명
- 동시 채팅: 수십 건
- 상담사 1인당 동시 채팅 권장: 5~8건

## 환경 변수

### 테스트 환경 (Vercel + Chatwoot Cloud + Neon.tech)

**서버 전용 (API Routes에서 사용):**

| 변수 | 용도 |
|------|------|
| `CHATWOOT_BASE_URL` | Chatwoot Cloud API URL (`https://app.chatwoot.com`) |
| `CHATWOOT_API_TOKEN` | Chatwoot API Access Token |
| `CHATWOOT_ACCOUNT_ID` | Chatwoot 계정 ID |
| `CHATWOOT_INBOX_ID` | Website Inbox ID |
| `DATABASE_URL` | Neon.tech PostgreSQL 연결 문자열 |

**클라이언트 (브라우저 위젯에서 사용):**

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_CHATWOOT_BASE_URL` | Chatwoot URL (위젯 스크립트 로드용) |
| `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN` | 위젯 초기화용 토큰 |

- 코드에 절대 하드코딩 금지. `.env.local`에만 실제 값을 넣고, `.env.local`은 `.gitignore`에 포함.
- Vercel에는 Environment Variables 설정으로 주입.

## 커밋 컨벤션

- 한국어 커밋 메시지 허용
- 커밋 메시지는 변경의 "이유"에 집중
