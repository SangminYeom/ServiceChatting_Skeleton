import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
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

    // 4. HMAC hash 생성 (Identity Validation)
    const identifierHash = createHmac("sha256", process.env.CHATWOOT_HMAC_SECRET!)
      .update(identifier)
      .digest("hex");

    // 5. 프론트에서 위젯 초기화에 필요한 데이터 반환
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
