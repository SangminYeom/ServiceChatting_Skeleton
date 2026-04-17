import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { updateConsultationStatus, saveCSAT } from "@/lib/db";

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env.CHATWOOT_WEBHOOK_SECRET!;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

function csatRatingToNumber(rating: string): number {
  if (rating === "satisfied") return 5;
  if (rating === "neutral") return 3;
  return 1;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-chatwoot-hmac-sha256") ?? "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as Record<string, unknown>;
  const event = payload.event as string;

  try {
    if (event === "conversation_created") {
      const conversationId = payload.id as number;
      await updateConsultationStatus(conversationId, "active");
    } else if (event === "conversation_resolved") {
      const conversationId = payload.id as number;
      await updateConsultationStatus(conversationId, "resolved", new Date());
    } else if (event === "csat_created") {
      const conversation = payload.conversation as { id: number };
      const rating = csatRatingToNumber(payload.rating as string);
      const comment = (payload.feedback_message as string | undefined) ?? null;
      await saveCSAT(conversation.id, rating, comment);
    }
    // message_created: 무처리
  } catch (error) {
    console.error("Webhook 처리 실패:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
