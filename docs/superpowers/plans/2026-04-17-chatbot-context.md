# 챗봇 대화 맥락 전달 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상담사 연결 시 챗봇 대화 내역을 Chatwoot Conversation Note(내부 메모)로 전달하여 상담사가 고객 맥락을 즉시 파악할 수 있게 한다.

**Architecture:** 프론트에서 `chatHistory: {role, content}[]` 배열을 API에 전달하고, API Route에서 텍스트로 포맷팅 후 Chatwoot `POST /conversations/:id/messages` (private: true)로 내부 메모를 추가한다. chatHistory가 없거나 비어있으면 Note를 생략한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Chatwoot REST API

**Spec:** `docs/superpowers/specs/2026-04-17-chatbot-context-design.md`

---

## 파일 구조

```
src/
  lib/
    chatwoot-api.ts        — addConversationNote() 함수 추가
  app/
    api/consultation/start/
      route.ts             — chatHistory 파라미터 수신, formatChatHistory(), addConversationNote() 호출
  components/
    consultation-form.tsx  — 테스트용 chatHistory textarea 추가
```

---

## Task 1: Chatwoot API 클라이언트에 addConversationNote 추가

**Files:**
- Modify: `src/lib/chatwoot-api.ts`

- [ ] **Step 1: `addConversationNote` 함수 추가**

`src/lib/chatwoot-api.ts` 파일 끝에 추가:

```ts
export async function addConversationNote(
  conversationId: number,
  content: string
): Promise<void> {
  await chatwootFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content,
      message_type: "outgoing",
      private: true,
    }),
  });
}
```

- [ ] **Step 2: TypeScript 타입 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/lib/chatwoot-api.ts
git commit -m "Chatwoot API 클라이언트에 addConversationNote 함수 추가"
```

---

## Task 2: API Route에 chatHistory 처리 추가

**Files:**
- Modify: `src/app/api/consultation/start/route.ts`

- [ ] **Step 1: route.ts 전체 교체**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createContact, createConversation, addLabel, addConversationNote } from "@/lib/chatwoot-api";
import { insertCustomer, insertConsultationLog } from "@/lib/db";

type ChatMessage = {
  role: "user" | "bot";
  content: string;
};

function formatChatHistory(messages: ChatMessage[]): string {
  const lines = messages.map((m) =>
    m.role === "user" ? `사용자: ${m.content}` : `챗봇: ${m.content}`
  );

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  const parts = ["[챗봇 대화 내역]", "", ...lines];

  if (lastUserMessage) {
    parts.push("", "---", "📌 마지막 고객 문의:", `"${lastUserMessage.content}"`);
  }

  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, hospitalName, inquiryType, chatHistory } = body as {
      customerName: string;
      hospitalName: string;
      inquiryType: string;
      chatHistory?: ChatMessage[];
    };

    if (!customerName || !hospitalName || !inquiryType) {
      return NextResponse.json(
        { error: "customerName, hospitalName, inquiryType은 필수입니다." },
        { status: 400 }
      );
    }

    const identifier = `${hospitalName}-${Date.now()}`;
    const contact = await createContact(customerName, identifier);

    const inboxId = parseInt(process.env.CHATWOOT_INBOX_ID!, 10);
    const conversation = await createConversation(contact.id, inboxId);

    await addLabel(conversation.id, [inquiryType]);

    if (chatHistory && chatHistory.length > 0) {
      await addConversationNote(conversation.id, formatChatHistory(chatHistory));
    }

    const customer = await insertCustomer(customerName, hospitalName, contact.id);
    await insertConsultationLog(customer.id, conversation.id);

    const identifierHash = createHmac("sha256", process.env.CHATWOOT_HMAC_SECRET!)
      .update(identifier)
      .digest("hex");

    return NextResponse.json({
      conversationId: conversation.id,
      identifier,
      identifierHash,
    });
  } catch (error) {
    console.error("상담 시작 실패:", error);
    return NextResponse.json(
      { error: "상담사 연결에 실패했습니다." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: TypeScript 타입 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: curl로 API 테스트 (dev 서버 실행 중일 때)**

```bash
curl -X POST http://localhost:3000/api/consultation/start \
  -H "Content-Type: application/json" \
  -d '{"customerName":"테스트","hospitalName":"테스트병원","inquiryType":"usage","chatHistory":[{"role":"user","content":"안녕하세요"},{"role":"bot","content":"무엇을 도와드릴까요?"},{"role":"user","content":"결제가 안 돼요"}]}'
```

Expected: `{ "conversationId": <number>, "identifier": "...", "identifierHash": "..." }`
Chatwoot 대시보드에서 해당 대화의 내부 메모에 챗봇 대화 내역이 표시되는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/consultation/start/route.ts
git commit -m "상담 시작 API에 챗봇 대화 맥락 전달 추가 (Conversation Note)"
```

---

## Task 3: 프론트엔드 — 테스트용 chatHistory 입력 추가

**Files:**
- Modify: `src/components/consultation-form.tsx`

- [ ] **Step 1: consultation-form.tsx 전체 교체**

```tsx
"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "connected" | "error";

type ChatMessage = {
  role: "user" | "bot";
  content: string;
};

const INQUIRY_TYPES = [
  { label: "사용법 문의", value: "usage" },
  { label: "오류/장애 신고", value: "error" },
  { label: "결제 문의", value: "billing" },
  { label: "원격 요청", value: "remote" },
] as const;

export default function ConsultationForm() {
  const [customerName, setCustomerName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [inquiryType, setInquiryType] = useState("");
  const [chatHistoryInput, setChatHistoryInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const canConnect = customerName.trim() && hospitalName.trim() && inquiryType;

  function parseChatHistory(): ChatMessage[] | undefined {
    const trimmed = chatHistoryInput.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as ChatMessage[];
    } catch {
      // 파싱 실패 시 무시
    }
    return undefined;
  }

  async function handleConnect() {
    if (!canConnect) return;

    setStatus("loading");

    try {
      const chatHistory = parseChatHistory();

      const res = await fetch("/api/consultation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, hospitalName, inquiryType, chatHistory }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();

      await waitForChatwoot();

      window.$chatwoot.setUser(data.identifier, {
        name: customerName,
        identifier_hash: data.identifierHash,
      });
      window.$chatwoot.toggle("open");

      setStatus("connected");
    } catch {
      setStatus("error");
    }
  }

  const isDisabled = status === "connected";

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">이름</label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="홍길동"
          className="w-full border rounded px-3 py-2"
          disabled={isDisabled}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">병원명</label>
        <input
          type="text"
          value={hospitalName}
          onChange={(e) => setHospitalName(e.target.value)}
          placeholder="테스트병원"
          className="w-full border rounded px-3 py-2"
          disabled={isDisabled}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">문의 유형</label>
        <div className="grid grid-cols-2 gap-2">
          {INQUIRY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setInquiryType(type.value)}
              disabled={isDisabled}
              className={`border rounded px-3 py-2 text-sm transition-colors ${
                inquiryType === type.value
                  ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                  : "border-gray-300 hover:border-blue-400"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          챗봇 대화 내역 <span className="text-gray-400 font-normal">(테스트용, 선택)</span>
        </label>
        <textarea
          value={chatHistoryInput}
          onChange={(e) => setChatHistoryInput(e.target.value)}
          placeholder={'[{"role":"user","content":"안녕하세요"},{"role":"bot","content":"무엇을 도와드릴까요?"}]'}
          className="w-full border rounded px-3 py-2 text-xs font-mono h-24 resize-none"
          disabled={isDisabled}
        />
      </div>
      <button
        onClick={handleConnect}
        disabled={!canConnect || status === "loading" || status === "connected"}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400"
      >
        {status === "loading" && "연결 중..."}
        {status === "idle" && "상담사 연결"}
        {status === "connected" && "상담 중"}
        {status === "error" && "다시 시도"}
      </button>
      {status === "error" && (
        <p className="text-red-600 text-sm">
          상담사 연결에 실패했습니다. 다시 시도해주세요.
        </p>
      )}
    </div>
  );
}

function waitForChatwoot(): Promise<void> {
  return new Promise((resolve) => {
    if (window.$chatwoot) {
      resolve();
      return;
    }
    window.addEventListener("chatwoot:ready", () => resolve(), { once: true });
  });
}
```

- [ ] **Step 2: TypeScript 타입 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/consultation-form.tsx
git commit -m "테스트용 챗봇 대화 내역 입력 textarea 추가"
```

---

## Task 4: push 및 배포 확인

- [ ] **Step 1: push**

```bash
git push
```

Expected: GitHub Actions가 Vercel Production 배포 트리거.

- [ ] **Step 2: E2E 테스트**

https://service-chatting.vercel.app 에서:
1. 이름, 병원명, 문의 유형 입력
2. 챗봇 대화 내역 textarea에 아래 JSON 붙여넣기:
   ```json
   [{"role":"user","content":"안녕하세요"},{"role":"bot","content":"무엇을 도와드릴까요?"},{"role":"user","content":"결제가 안 돼요"}]
   ```
3. 상담사 연결 클릭
4. app.chatwoot.com 대시보드 → 해당 대화 → 내부 메모에 챗봇 대화 내역 표시 확인
