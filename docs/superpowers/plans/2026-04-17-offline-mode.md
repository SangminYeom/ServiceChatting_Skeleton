# 오프라인 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 업무 시간(평일 09:00~18:00 KST) 외에 "상담사 연결" 버튼을 비활성화하고 안내문을 표시한다.

**Architecture:** `GET /api/consultation/status`가 서버의 KST 시각을 기준으로 `{ online: boolean }`을 반환하고, `ConsultationForm`이 마운트 시 이를 조회하여 오프라인이면 버튼 비활성화 + 안내문을 표시한다. API 에러 시 `online: true`로 폴백한다.

**Tech Stack:** Next.js 16 App Router, TypeScript, React

**Spec:** `docs/superpowers/specs/2026-04-17-offline-mode-design.md`

---

## 파일 구조

```
src/
  app/api/consultation/status/
    route.ts              — 신규: GET, KST 기준 업무 시간 판단
  components/
    consultation-form.tsx — 수정: status 조회, online 상태, 오프라인 UI
```

---

## Task 1: 업무 시간 상태 API Route

**Files:**
- Create: `src/app/api/consultation/status/route.ts`

- [ ] **Step 1: `src/app/api/consultation/status/route.ts` 파일 생성**

```ts
import { NextResponse } from "next/server";

function isBusinessHours(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const day = kst.getUTCDay(); // 0=일, 1=월, ..., 5=금, 6=토
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const isWorkingTime = minutes >= 9 * 60 && minutes < 18 * 60;

  return isWeekday && isWorkingTime;
}

export async function GET() {
  return NextResponse.json({ online: isBusinessHours() });
}
```

- [ ] **Step 2: TypeScript 타입 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 로컬에서 API 테스트**

dev 서버 실행 중일 때:

```bash
curl http://localhost:3000/api/consultation/status
```

Expected: `{"online":true}` (업무 시간 내) 또는 `{"online":false}` (업무 시간 외)

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/consultation/status/route.ts
git commit -m "업무 시간 상태 API Route 추가 (GET /api/consultation/status)"
```

---

## Task 2: ConsultationForm에 오프라인 UI 추가

**Files:**
- Modify: `src/components/consultation-form.tsx`

- [ ] **Step 1: `src/components/consultation-form.tsx` 전체 교체**

```tsx
"use client";

import { useState, useEffect } from "react";

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
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/consultation/status")
      .then((res) => res.json())
      .then((data: { online: boolean }) => setOnline(data.online))
      .catch(() => setOnline(true));
  }, []);

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
        disabled={
          !canConnect ||
          status === "loading" ||
          status === "connected" ||
          online === false ||
          online === null
        }
        className="w-full bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400"
      >
        {status === "loading" && "연결 중..."}
        {status === "idle" && "상담사 연결"}
        {status === "connected" && "상담 중"}
        {status === "error" && "다시 시도"}
      </button>
      {online === false && (
        <p className="text-amber-600 text-sm">
          현재 상담 가능 시간이 아닙니다 (평일 09:00~18:00).
        </p>
      )}
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
git commit -m "오프라인 모드 UI 추가 — 업무 시간 외 버튼 비활성화"
```

---

## Task 3: push 및 E2E 테스트

- [ ] **Step 1: push**

```bash
git push
```

Expected: GitHub Actions가 Vercel Production 배포 트리거.

- [ ] **Step 2: 오프라인 상태 수동 테스트**

로컬에서 `isBusinessHours()`가 항상 `false`를 반환하도록 임시 수정:

```ts
export async function GET() {
  return NextResponse.json({ online: false }); // 테스트용
}
```

브라우저에서 `http://localhost:3000` 확인:
- "상담사 연결" 버튼이 회색으로 비활성화됨
- "현재 상담 가능 시간이 아닙니다 (평일 09:00~18:00)." 안내문 표시

테스트 후 원래대로 복원:

```ts
export async function GET() {
  return NextResponse.json({ online: isBusinessHours() });
}
```
