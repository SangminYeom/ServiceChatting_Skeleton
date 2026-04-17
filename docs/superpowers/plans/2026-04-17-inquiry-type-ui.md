# 문의 유형 선택 UI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상담사 연결 전 문의 유형(사용법/오류/결제/원격)을 인라인으로 선택하고, 선택된 유형을 Chatwoot 대화 라벨로 자동 부착한다.

**Architecture:** `consultation-form.tsx`에 문의 유형 선택 버튼 4개를 인라인으로 추가한다. 선택한 유형을 `POST /api/consultation/start`에 `inquiryType`으로 전달하고, API Route에서 Conversation 생성 후 Chatwoot Labels API로 라벨을 부착한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, Chatwoot REST API (`POST /conversations/:id/labels`)

**Spec:** `docs/superpowers/specs/2026-04-17-inquiry-type-ui-design.md`

---

## 사전 준비 (수동 — 코드 작업 전)

Chatwoot 대시보드에서 라벨 4개 생성:
- `app.chatwoot.com` → Settings → Labels → Add Label
- 생성할 라벨: `usage`, `error`, `billing`, `remote`

---

## 파일 구조

```
src/
  lib/
    chatwoot-api.ts        — addLabel() 함수 추가
  app/
    api/consultation/start/
      route.ts             — inquiryType 파라미터 수신, addLabel() 호출
  components/
    consultation-form.tsx  — 문의 유형 선택 버튼 4개 인라인 추가
```

---

## Task 1: Chatwoot API 클라이언트에 addLabel 추가

**Files:**
- Modify: `src/lib/chatwoot-api.ts`

- [ ] **Step 1: `addLabel` 함수 추가**

`src/lib/chatwoot-api.ts` 파일 끝에 추가:

```ts
export async function addLabel(
  conversationId: number,
  labels: string[]
): Promise<void> {
  await chatwootFetch(`/conversations/${conversationId}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels }),
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
git commit -m "Chatwoot API 클라이언트에 addLabel 함수 추가"
```

---

## Task 2: API Route에 inquiryType 파라미터 추가

**Files:**
- Modify: `src/app/api/consultation/start/route.ts`

- [ ] **Step 1: `inquiryType` 파라미터 수신 및 `addLabel` 호출**

`src/app/api/consultation/start/route.ts`를 아래와 같이 수정:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createContact, createConversation, addLabel } from "@/lib/chatwoot-api";
import { insertCustomer, insertConsultationLog } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, hospitalName, inquiryType } = body as {
      customerName: string;
      hospitalName: string;
      inquiryType: string;
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

- [ ] **Step 2: dev 서버에서 API 테스트**

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3000/api/consultation/start \
  -H "Content-Type: application/json" \
  -d '{"customerName":"테스트","hospitalName":"테스트병원","inquiryType":"usage"}'
```

Expected: `{ "conversationId": <number>, "identifier": "...", "identifierHash": "..." }`  
Chatwoot 대시보드에서 대화에 `usage` 라벨이 붙었는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/consultation/start/route.ts
git commit -m "상담 시작 API에 inquiryType 파라미터 추가 및 Chatwoot 라벨 부착"
```

---

## Task 3: 프론트엔드 — 문의 유형 선택 UI 추가

**Files:**
- Modify: `src/components/consultation-form.tsx`

- [ ] **Step 1: 문의 유형 선택 버튼 추가**

`src/components/consultation-form.tsx`를 아래로 교체:

```tsx
"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "connected" | "error";

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
  const [status, setStatus] = useState<Status>("idle");

  const canConnect = customerName.trim() && hospitalName.trim() && inquiryType;

  async function handleConnect() {
    if (!canConnect) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/consultation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, hospitalName, inquiryType }),
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

- [ ] **Step 2: 브라우저에서 전체 흐름 테스트**

`http://localhost:3000` 에서:
1. 이름, 병원명 입력
2. 문의 유형 선택 전 "상담사 연결" 버튼이 비활성화(회색)인지 확인
3. 문의 유형 선택 후 버튼 활성화 확인
4. "상담사 연결" 클릭 → 위젯 열림 확인
5. Chatwoot 대시보드에서 해당 대화에 선택한 라벨이 붙었는지 확인

- [ ] **Step 3: 커밋**

```bash
git add src/components/consultation-form.tsx
git commit -m "문의 유형 선택 UI 추가 — 인라인 버튼 4개, 미선택 시 연결 버튼 비활성화"
```

---

## Task 4: push 및 Vercel 자동 배포 확인

- [ ] **Step 1: push**

```bash
git push
```

- [ ] **Step 2: Vercel 배포 확인**

Vercel 대시보드 또는 https://service-chatting.vercel.app 에서 배포 완료 후 동일 흐름 테스트.
