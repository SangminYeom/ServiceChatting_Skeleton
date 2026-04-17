import { neon } from "@neondatabase/serverless";

async function migrate() {
  const sql = neon(process.env.DATABASE_URL!);

  await sql`
    ALTER TABLE consultation_logs
      ADD COLUMN IF NOT EXISTS csat_rating INTEGER,
      ADD COLUMN IF NOT EXISTS csat_comment TEXT
  `;

  console.log("Webhook migration complete");
}

migrate().catch(console.error);
