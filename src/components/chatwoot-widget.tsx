"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    chatwootSettings: Record<string, unknown>;
    chatwootSDK: {
      run: (config: { websiteToken: string; baseUrl: string }) => void;
    };
    $chatwoot: {
      setUser: (identifier: string, user: { name?: string; identifier_hash?: string }) => void;
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
