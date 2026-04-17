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

export type ConsultationStatus = "requested" | "active" | "resolved";

export async function updateConsultationStatus(
  chatwootConversationId: number,
  status: ConsultationStatus,
  resolvedAt?: Date
): Promise<void> {
  const sql = getDb();
  let rows;
  if (resolvedAt) {
    rows = await sql`
      UPDATE consultation_logs
      SET status = ${status}, resolved_at = ${resolvedAt.toISOString()}
      WHERE chatwoot_conversation_id = ${chatwootConversationId}
      RETURNING id
    `;
  } else {
    rows = await sql`
      UPDATE consultation_logs
      SET status = ${status}
      WHERE chatwoot_conversation_id = ${chatwootConversationId}
      RETURNING id
    `;
  }
  if (rows.length === 0) {
    console.warn(`updateConsultationStatus: no row for conversationId=${chatwootConversationId}`);
  }
}

export async function saveCSAT(
  chatwootConversationId: number,
  rating: number,
  comment: string | null
): Promise<void> {
  const sql = getDb();
  const rows = await sql`
    UPDATE consultation_logs
    SET csat_rating = ${rating}, csat_comment = ${comment}
    WHERE chatwoot_conversation_id = ${chatwootConversationId}
    RETURNING id
  `;
  if (rows.length === 0) {
    console.warn(`saveCSAT: no row for conversationId=${chatwootConversationId}`);
  }
}
