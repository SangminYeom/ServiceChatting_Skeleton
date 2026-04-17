# Chatwoot Webhook 수신 처리 설계

> 작성일: 2026-04-17

## 목표

Chatwoot에서 발생하는 상담 이벤트를 수신하여 DB의 `consultation_logs`를 최신 상태로 유지하고, 만족도 데이터를 수집한다.

## 엔드포인트

```
POST /api/webhook/chatwoot
```

단일 엔드포인트에서 모든 이벤트를 수신하고 `event` 필드로 분기 처리한다.

## 이벤트 처리 정책

| 이벤트 | 처리 |
|--------|------|
| `conversation_created` | `consultation_logs.status` = `'active'` |
| `conversation_resolved` | `consultation_logs.status` = `'resolved'`, `resolved_at` = now |
| `message_created` | 200 OK 반환, 무처리 |
| `csat_created` | `consultation_logs.csat_rating`, `csat_comment` 저장 |

## 서명 검증

Chatwoot는 Webhook 요청에 `x-chatwoot-signature` 헤더를 포함한다.  
요청 수신 시 HMAC-SHA256으로 서명을 검증하고, 불일치 시 401 반환.

```
HMAC-SHA256(CHATWOOT_WEBHOOK_SECRET, requestBody) === x-chatwoot-signature
```

## DB 스키마 변경

`consultation_logs` 테이블에 컬럼 3개 추가:

```sql
ALTER TABLE consultation_logs
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN csat_rating INTEGER,
  ADD COLUMN csat_comment TEXT;
```

## 데이터 흐름

```
Chatwoot 이벤트 발생
  → POST /api/webhook/chatwoot
  → x-chatwoot-signature 검증 (불일치 → 401)
  → body.event 분기
      conversation_created  → updateConsultationStatus(conversationId, 'active')
      conversation_resolved → updateConsultationStatus(conversationId, 'resolved', resolvedAt)
      message_created       → return 200
      csat_created          → saveCSAT(conversationId, rating, comment)
  → return 200
```

## Chatwoot Webhook Payload 형식

### conversation_created / conversation_resolved

```json
{
  "event": "conversation_created",
  "id": 123,
  "status": "open"
}
```

### csat_created

```json
{
  "event": "csat_created",
  "conversation": { "id": 123 },
  "csat_survey_link": "...",
  "rating": "satisfied",
  "feedback_message": "친절했습니다"
}
```

CSAT rating 값 → DB integer 변환:
- `"satisfied"` → 5
- `"neutral"` → 3
- `"dissatisfied"` → 1

## 파일 구조

```
src/
  app/api/webhook/chatwoot/
    route.ts              — 수신, 서명 검증, 이벤트 분기
  lib/
    db.ts                 — updateConsultationStatus(), saveCSAT() 추가
scripts/
  migrate-webhook.ts      — resolved_at, csat_rating, csat_comment 컬럼 추가
```

## 환경 변수

| 변수 | 용도 |
|------|------|
| `CHATWOOT_WEBHOOK_SECRET` | Webhook 서명 검증용 시크릿 |

Vercel 환경 변수에 추가 필요. `.env.local`에도 추가.

## 에러 처리

- 서명 불일치: 401 반환
- DB 에러: 500 반환, `console.error` 로깅
- 알 수 없는 이벤트: 200 반환 (무시)
- DB에서 `chatwoot_conversation_id`로 `consultation_logs` 조회 실패 시: 200 반환 (무시, 테스트 데이터 등 예외 케이스)

## 테스트

Chatwoot 대시보드에서:
1. 대화 생성 → `consultation_logs.status` = `'active'` 확인
2. 대화 종료(Resolve) → `status` = `'resolved'`, `resolved_at` 설정 확인
3. CSAT 응답 → `csat_rating`, `csat_comment` 저장 확인
