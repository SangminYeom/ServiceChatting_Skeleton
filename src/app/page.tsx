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
