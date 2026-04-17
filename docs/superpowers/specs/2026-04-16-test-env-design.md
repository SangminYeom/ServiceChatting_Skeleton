# 테스트 환경 설계서 — Chatwoot Cloud + Vercel + Neon.tech

## 개요

상담 채팅 시스템의 핵심 흐름을 내부 테스트하기 위한 경량 환경.
Chatwoot Cloud(무료 플랜)를 상담 엔진으로, Next.js(Vercel)를 프론트+백엔드로, Neon.tech를 DB로 사용한다.

## 구성

| 영역 | 기술 | 역할 |
|------|------|------|
| 프론트 + 백엔드 | Next.js (Vercel 배포) | 상담 요청 UI + API Routes |
| 상담 엔진 | Chatwoot Cloud (무료 플랜) | 실시간 채팅, 상담사 대시보드 |
| DB | Neon.tech (PostgreSQL) | 고객 매핑, 상담 로그, 챗봇 내역, Webhook 로그 |

## 테스트 범위

### 포함 (최소 흐름)

1. 웹 페이지에서 "상담사 연결" 클릭
2. Next.js API Route → Chatwoot API로 Contact 생성, Conversation 생성
3. 프론트에서 Chatwoot 위젯 활성화 (conversation 연결)
4. Chatwoot Cloud 상담사 대시보드에서 응답
5. 실시간 채팅 동작 확인

### 제외 (이후 단계)

- HMAC 인증 (Identity Validation)
- 문의 유형 선택 UI
- 챗봇 대화 맥락 전달 (Conversation Note)
- Webhook 수신 처리
- 오프라인 모드
- 대기열 화면

## 페이지 구성

### `/` — 테스트 메인 페이지

바로바로 챗봇을 흉내내는 간단한 테스트 페이지.

- 테스트용 고객 정보 입력 (병원명, 이름)
- "상담사 연결" 버튼
- 클릭 시 API 호출 → Chatwoot 위젯 활성화

### `/api/consultation/start` — 상담 시작 API

요청:
```json
{
  "customerName": "홍길동",
  "hospitalName": "테스트병원"
}
```

처리:
1. Chatwoot API: `POST /api/v1/contacts` — Contact 생성 또는 기존 조회
2. Chatwoot API: `POST /api/v1/conversations` — Conversation 생성
3. Neon.tech DB: 상담 요청 로그 저장 (고객 정보, Chatwoot contact_id, conversation_id, 요청 시각)
4. 응답: `{ conversationId, websiteToken, chatwootUrl }` → 프론트에서 위젯 초기화에 사용

## DB 스키마 (Neon.tech)

### customers — 고객 매핑

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial PK | |
| customer_name | varchar | 고객 이름 |
| hospital_name | varchar | 병원명 |
| chatwoot_contact_id | integer | Chatwoot Contact ID |
| created_at | timestamp | 생성 시각 |

### consultation_logs — 상담 요청 로그

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial PK | |
| customer_id | integer FK | customers 참조 |
| chatwoot_conversation_id | integer | Chatwoot Conversation ID |
| status | varchar | requested / active / resolved |
| requested_at | timestamp | 요청 시각 |
| resolved_at | timestamp | 종료 시각 (nullable) |

## Chatwoot Cloud 설정

1. 계정 생성 (app.chatwoot.com)
2. Website Inbox 생성 → website_token 발급
3. API Access Token 발급 (API 호출용)
4. 테스트 상담사 계정 1~2개 생성

## 환경 변수

`CLAUDE.md` > 환경 변수 섹션 참조. 환경 변수 목록은 CLAUDE.md에서 단일 관리한다.

## 운영 환경과의 차이

| 항목 | 테스트 (이번) | 운영 (최종) |
|------|---------------|-------------|
| Chatwoot | Cloud 무료 플랜 | Docker 자체 호스팅 |
| 백엔드 | Next.js API Routes | .NET (C#) |
| 프론트 | Next.js (Vercel) | React (바로바로 크로미움 앱) |
| DB | Neon.tech | PostgreSQL (자체 호스팅) |
| 인증 | 없음 (테스트용) | HMAC Identity Validation |
| 도메인 | Vercel 자동 도메인 | chat.ubcare.co.kr |
