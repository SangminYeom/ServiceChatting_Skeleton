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
