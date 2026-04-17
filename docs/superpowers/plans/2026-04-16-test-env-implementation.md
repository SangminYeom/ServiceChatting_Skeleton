# 테스트 환경 구현 계획 — Chatwoot Cloud + Vercel + Neon.tech

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chatwoot Cloud + Next.js(Vercel) + Neon.tech로 상담 채팅 최소 흐름을 내부 테스트할 수 있는 환경 구축

**Architecture:** Next.js App Router 풀스택 앱. API Routes에서 Chatwoot REST API를 호출해 Contact/Conversation을 생성하고, 프론트에서 Chatwoot 위젯 스크립트를 로드해 `setUser`로 identifier를 매칭하여 실시간 채팅을 연결한다. Neon.tech PostgreSQL에 고객 매핑과 상담 로그를 저장한다.

**Tech Stack:** Next.js 15 (App Router), TypeScript, @neondatabase/serverless, Chatwoot widget (script embed), Vercel

**Spec:** `docs/superpowers/specs/2026-04-16-test-env-design.md`

---

## 파일 구조

```
src/
  app/
    layout.tsx                          — Root layout
    page.tsx                            — 테스트 메인 페이지 (서버 컴포넌트)
    globals.css                         — 기본 스타일
    api/
      consultation/
        start/
          route.ts                      — POST: Contact + Conversation 생성, DB 로그
  lib/
    chatwoot-api.ts                     — Chatwoot REST API 클라이언트 (서버 전용)
    db.ts                               — Neon.tech 쿼리 함수
  components/
    chatwoot-widget.tsx                 — Chatwoot 위젯 로드/제어 (클라이언트 컴포넌트)
    consultation-form.tsx               — 고객 정보 입력 + 상담사 연결 버튼 (클라이언트 컴포넌트)
scripts/
  migrate.ts                            — DB 마이그레이션 스크립트
.env.example                            — 환경 변수 템플릿
```

---

## Task 1: Next.js 프로젝트 초기화

**Files:**
- Create: 프로젝트 루트 전체 (create-next-app)
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `CLAUDE.md` (환경 변수 업데이트)

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

프로젝트 루트에서 실행. 이미 파일이 있으므로 기존 파일을 덮어쓰지 않도록 주의.

- [ ] **Step 2: 의존성 설치**

```bash
npm install @neondatabase/serverless
npm install -D tsx
```

- `@neondatabase/serverless`: Vercel 서버리스 환경에서 Neon.tech 연결용
- `tsx`: 마이그레이션 스크립트 실행용

- [ ] **Step 3: .env.example 생성**

```bash
# .env.example
# Server-side (API Routes)
CHATWOOT_BASE_URL=https://app.chatwoot.com
CHATWOOT_API_TOKEN=
CHATWOOT_ACCOUNT_ID=
CHATWOOT_INBOX_ID=
DATABASE_URL=

# Client-side (브라우저에서 사용)
NEXT_PUBLIC_CHATWOOT_BASE_URL=https://app.chatwoot.com
NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN=
```

- [ ] **Step 4: .env.local 생성 (gitignore 확인)**

```bash
cp .env.example .env.local
```

`.gitignore`에 `.env.local`이 포함되어 있는지 확인 (create-next-app 기본값에 포함됨).

- [ ] **Step 5: CLAUDE.md 환경 변수 섹션 업데이트**

기존 환경 변수 테이블에 `NEXT_PUBLIC_*` 변수 추가:

| 변수 | 용도 |
|------|------|
| `CHATWOOT_BASE_URL` | Chatwoot Cloud API URL (서버 전용) |
| `CHATWOOT_API_TOKEN` | Chatwoot API Access Token (서버 전용) |
| `CHATWOOT_ACCOUNT_ID` | Chatwoot 계정 ID (서버 전용) |
| `CHATWOOT_INBOX_ID` | Website Inbox ID (서버 전용) |
| `DATABASE_URL` | Neon.tech PostgreSQL 연결 문자열 (서버 전용) |
| `NEXT_PUBLIC_CHATWOOT_BASE_URL` | Chatwoot URL (브라우저 위젯용) |
| `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN` | 위젯 초기화용 토큰 (브라우저용) |

`@chatwoot/sdk` npm 패키지 관련 내용 삭제 — 공식 npm 패키지 없음, 스크립트 태그로 위젯 연동.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "Next.js 프로젝트 초기화 및 의존성 설치"
```

---

## Task 2: DB 스키마 + 클라이언트

**Files:**
- Create: `scripts/migrate.ts`
- Create: `src/lib/db.ts`

- [ ] **Step 1: 마이그레이션 스크립트 작성**

`scripts/migrate.ts`:

```ts
import { neon } from "@neondatabase/serverless";

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      customer_name VARCHAR(100) NOT NULL,
      hospital_name VARCHAR(200) NOT NULL,
      chatwoot_contact_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS consultation_logs (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      chatwoot_conversation_id INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'requested',
      requested_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    )
  `;

  console.log("Migration complete");
}

migrate().catch(console.error);
```

- [ ] **Step 2: .env.local에 DATABASE_URL 입력 후 마이그레이션 실행**

Neon.tech 대시보드에서 연결 문자열 복사 → `.env.local`의 `DATABASE_URL`에 입력.

```bash
npx tsx scripts/migrate.ts
```

Expected: `Migration complete` 출력.

- [ ] **Step 3: DB 클라이언트 모듈 작성**

`src/lib/db.ts`:

```ts
import { neon } from "@neondatabase/serverless";

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

export async function insertCustomer(
  customerName: string,
  hospitalName: string,
  chatwootContactId: number
) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO customers (customer_name, hospital_name, chatwoot_contact_id)
    VALUES (${customerName}, ${hospitalName}, ${chatwootContactId})
    RETURNING id, customer_name, hospital_name, chatwoot_contact_id, created_at
  `;
  return rows[0] as {
    id: number;
    customer_name: string;
    hospital_name: string;
    chatwoot_contact_id: number;
    created_at: string;
  };
}

export async function insertConsultationLog(
  customerId: number,
  chatwootConversationId: number
) {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO consultation_logs (customer_id, chatwoot_conversation_id, status)
    VALUES (${customerId}, ${chatwootConversationId}, 'requested')
    RETURNING id, customer_id, chatwoot_conversation_id, status, requested_at
  `;
  return rows[0] as {
    id: number;
    customer_id: number;
    chatwoot_conversation_id: number;
    status: string;
    requested_at: string;
  };
}
```

- [ ] **Step 4: 커밋**

```bash
git add scripts/migrate.ts src/lib/db.ts
git commit -m "DB 스키마 마이그레이션 및 쿼리 클라이언트 추가"
```

---

## Task 3: Chatwoot API 클라이언트

**Files:**
- Create: `src/lib/chatwoot-api.ts`

- [ ] **Step 1: Chatwoot API 클라이언트 작성**

`src/lib/chatwoot-api.ts`:

```ts
const getConfig = () => ({
  baseUrl: process.env.CHATWOOT_BASE_URL!,
  apiToken: process.env.CHATWOOT_API_TOKEN!,
  accountId: process.env.CHATWOOT_ACCOUNT_ID!,
});

async function chatwootFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { baseUrl, apiToken, accountId } = getConfig();
  const url = `${baseUrl}/api/v1/accounts/${accountId}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      api_access_token: apiToken,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Chatwoot API ${res.status}: ${body}`);
  }

  return res.json();
}

interface ChatwootContact {
  id: number;
  name: string;
  identifier: string;
}

interface CreateContactResponse {
  payload: {
    contact: ChatwootContact;
  };
}

interface ChatwootConversation {
  id: number;
  inbox_id: number;
  contact_last_seen_at: string;
}

export async function createContact(
  name: string,
  identifier: string
): Promise<ChatwootContact> {
  const data = await chatwootFetch<CreateContactResponse>("/contacts", {
    method: "POST",
    body: JSON.stringify({ name, identifier }),
  });
  return data.payload.contact;
}

export async function createConversation(
  contactId: number,
  inboxId: number
): Promise<ChatwootConversation> {
  return chatwootFetch<ChatwootConversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      contact_id: contactId,
      inbox_id: inboxId,
    }),
  });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/chatwoot-api.ts
git commit -m "Chatwoot REST API 클라이언트 추가 (Contact, Conversation)"
```

---

## Task 4: 상담 시작 API Route

**Files:**
- Create: `src/app/api/consultation/start/route.ts`

- [ ] **Step 1: API Route 핸들러 작성**

`src/app/api/consultation/start/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createContact, createConversation } from "@/lib/chatwoot-api";
import { insertCustomer, insertConsultationLog } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, hospitalName } = body as {
      customerName: string;
      hospitalName: string;
    };

    if (!customerName || !hospitalName) {
      return NextResponse.json(
        { error: "customerName, hospitalName은 필수입니다." },
        { status: 400 }
      );
    }

    // 1. Chatwoot Contact 생성 (identifier: 병원명-타임스탬프)
    const identifier = `${hospitalName}-${Date.now()}`;
    const contact = await createContact(customerName, identifier);

    // 2. Chatwoot Conversation 생성
    const inboxId = parseInt(process.env.CHATWOOT_INBOX_ID!, 10);
    const conversation = await createConversation(contact.id, inboxId);

    // 3. DB에 고객 + 상담 로그 저장
    const customer = await insertCustomer(
      customerName,
      hospitalName,
      contact.id
    );
    await insertConsultationLog(customer.id, conversation.id);

    // 4. 프론트에서 위젯 초기화에 필요한 데이터 반환
    return NextResponse.json({
      conversationId: conversation.id,
      identifier,
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

- [ ] **Step 2: dev 서버 실행 후 API 테스트**

```bash
npm run dev
```

curl 또는 브라우저 콘솔에서 테스트:

```bash
curl -X POST http://localhost:3000/api/consultation/start \
  -H "Content-Type: application/json" \
  -d '{"customerName":"테스트","hospitalName":"테스트병원"}'
```

Expected: `{ "conversationId": <number>, "identifier": "테스트병원-<timestamp>" }`

Chatwoot Cloud 대시보드 (app.chatwoot.com)에서 새 대화가 생성되었는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/consultation/start/route.ts
git commit -m "상담 시작 API Route 추가 (Contact + Conversation + DB 로깅)"
```

---

## Task 5: 프론트엔드 — Chatwoot 위젯 + 테스트 페이지

**Files:**
- Create: `src/components/chatwoot-widget.tsx`
- Create: `src/components/consultation-form.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Chatwoot 위젯 컴포넌트 작성**

`src/components/chatwoot-widget.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    chatwootSettings: Record<string, unknown>;
    chatwootSDK: {
      run: (config: { websiteToken: string; baseUrl: string }) => void;
    };
    $chatwoot: {
      setUser: (identifier: string, user: { name?: string }) => void;
      toggle: (state: "open" | "close") => void;
      reset: () => void;
    };
  }
}

export default function ChatwootWidget() {
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const baseUrl = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL!;
    const websiteToken = process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN!;

    window.chatwootSettings = {
      hideMessageBubble: true,
      position: "right",
      locale: "ko",
    };

    const script = document.createElement("script");
    script.src = `${baseUrl}/packs/js/sdk.js`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.chatwootSDK.run({ websiteToken, baseUrl });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
```

핵심: `hideMessageBubble: true` — 기본 말풍선 숨김. 우리가 직접 열기/닫기를 제어.

- [ ] **Step 2: 상담 폼 컴포넌트 작성**

`src/components/consultation-form.tsx`:

```tsx
"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "connected" | "error";

export default function ConsultationForm() {
  const [customerName, setCustomerName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleConnect() {
    if (!customerName.trim() || !hospitalName.trim()) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/consultation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, hospitalName }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();

      // Chatwoot 위젯이 준비될 때까지 대기
      await waitForChatwoot();

      // identifier로 고객 연결 → 위젯 열기
      window.$chatwoot.setUser(data.identifier, { name: customerName });
      window.$chatwoot.toggle("open");

      setStatus("connected");
    } catch {
      setStatus("error");
    }
  }

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
          disabled={status === "connected"}
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
          disabled={status === "connected"}
        />
      </div>
      <button
        onClick={handleConnect}
        disabled={status === "loading" || status === "connected"}
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

- [ ] **Step 3: 메인 페이지 작성**

`src/app/page.tsx`:

```tsx
import ConsultationForm from "@/components/consultation-form";
import ChatwootWidget from "@/components/chatwoot-widget";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">바로바로 상담 테스트</h1>
        <p className="text-gray-600">
          아래 정보를 입력하고 상담사 연결 버튼을 클릭하세요.
        </p>
      </div>
      <ConsultationForm />
      <ChatwootWidget />
    </main>
  );
}
```

- [ ] **Step 4: layout.tsx 정리**

`src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "바로바로 상담 테스트",
  description: "Chatwoot Cloud 상담 채팅 테스트 환경",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: 브라우저에서 전체 흐름 테스트**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후:

1. 이름, 병원명 입력
2. "상담사 연결" 클릭
3. Chatwoot 위젯이 우측 하단에 열리는지 확인
4. app.chatwoot.com 대시보드에 새 대화가 나타나는지 확인
5. 대시보드에서 메시지 전송 → 위젯에 수신되는지 확인
6. 위젯에서 메시지 전송 → 대시보드에 수신되는지 확인

- [ ] **Step 6: 커밋**

```bash
git add src/components/ src/app/page.tsx src/app/layout.tsx src/app/globals.css
git commit -m "테스트 페이지 + Chatwoot 위젯 연동 UI 추가"
```

---

## Task 6: Vercel 배포

- [ ] **Step 1: Vercel에 프로젝트 연결**

```bash
npx vercel link
```

프로젝트를 Vercel에 연결.

- [ ] **Step 2: 환경 변수 설정**

Vercel 대시보드 → Settings → Environment Variables에서 `.env.local`의 모든 변수를 등록:

- `CHATWOOT_BASE_URL`
- `CHATWOOT_API_TOKEN`
- `CHATWOOT_ACCOUNT_ID`
- `CHATWOOT_INBOX_ID`
- `DATABASE_URL`
- `NEXT_PUBLIC_CHATWOOT_BASE_URL`
- `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN`

- [ ] **Step 3: 배포**

```bash
npx vercel --prod
```

- [ ] **Step 4: 배포된 URL에서 E2E 테스트**

Task 5 Step 5와 동일한 흐름을 배포 URL에서 테스트.

- [ ] **Step 5: 커밋 (배포 설정이 있는 경우)**

```bash
git add -A
git commit -m "Vercel 배포 설정 완료"
```

---

## 사전 준비 (수동 — 코드 작업 전)

Task 1 시작 전에 아래를 완료해야 한다:

1. **Chatwoot Cloud 가입** — https://app.chatwoot.com 에서 계정 생성
2. **Website Inbox 생성** — Settings → Inboxes → Add Inbox → Website → website_token 메모
3. **Identity Validation 비활성화** — Inbox 설정에서 HMAC 인증 OFF (테스트용)
4. **API Access Token 발급** — Settings → Account Settings → Access Token → 메모
5. **Account ID 확인** — 대시보드 URL의 `/app/accounts/<ID>/` 부분에서 확인
6. **Inbox ID 확인** — Inbox 설정 URL의 `/inboxes/<ID>/` 부분에서 확인
7. **테스트 상담사 계정 1~2개 생성** — Settings → Agents
8. **Neon.tech 프로젝트 생성** — https://neon.tech 에서 DB 생성, 연결 문자열 메모
