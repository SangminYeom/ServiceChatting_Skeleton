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
