# 챗봇 대화 맥락 전달 설계

> 작성일: 2026-04-17

## 목표

상담사 연결 시 이전 챗봇 대화 내역을 Chatwoot Conversation Note(내부 메모)로 전달하여, 상담사가 고객 문의 맥락을 즉시 파악할 수 있도록 한다.

## 데이터 형식

챗봇 대화 내역은 메시지 배열로 전달된다:

```ts
type ChatMessage = {
  role: "user" | "bot";
  content: string;
};
```

## Note 형식

Chatwoot에 저장되는 내부 메모 형식:

```
[챗봇 대화 내역]

사용자: 안녕하세요
챗봇: 무엇을 도와드릴까요?
사용자: 결제가 안 돼요
챗봇: 자세히 설명해 드리겠습니다...

---
📌 마지막 고객 문의:
"결제가 안 돼요"
```

- 전체 대화를 시간순으로 나열
- 마지막 `role: "user"` 메시지를 별도로 강조
- `private: true` 옵션으로 고객에게는 보이지 않음

## 데이터 흐름

1. 프론트에서 `chatHistory: ChatMessage[]`를 `POST /api/consultation/start` body에 포함
2. API Route에서 배열을 텍스트로 포맷팅
3. `addConversationNote(conversationId, formattedNote)` 호출
4. `chatHistory`가 비어있거나 없으면 Note 생략

## 변경 파일

- `src/lib/chatwoot-api.ts` — `addConversationNote(conversationId, content)` 함수 추가
- `src/app/api/consultation/start/route.ts` — `chatHistory` 파라미터 수신, 포맷팅 함수, Note 추가 호출
- `src/components/consultation-form.tsx` — 테스트용 textarea 추가 (선택 입력, JSON 배열 형식)

## Chatwoot API

```
POST /api/v1/accounts/:account_id/conversations/:conversation_id/messages
Body: {
  content: "<note text>",
  message_type: "outgoing",
  private: true
}
```

## 테스트 환경

- 폼에 "챗봇 대화 내역 (선택)" textarea 추가
- JSON 배열 형식으로 입력: `[{"role":"user","content":"..."},{"role":"bot","content":"..."}]`
- 빈 값이면 Note 생략 (정상 동작)

## 실제 연동

바로바로 앱에서 상담사 연결 시 챗봇 대화 배열을 API body의 `chatHistory` 필드로 전달.
