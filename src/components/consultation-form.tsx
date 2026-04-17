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
    const controller = new AbortController();
    fetch("/api/consultation/status", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { online: boolean }) => setOnline(data.online))
      .catch((err) => {
        if (err.name !== "AbortError") setOnline(true);
      });
    return () => controller.abort();
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
        {status === "idle" && online === null && "상태 확인 중..."}
        {status === "idle" && online !== null && "상담사 연결"}
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
