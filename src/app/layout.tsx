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
