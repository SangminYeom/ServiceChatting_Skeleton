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
