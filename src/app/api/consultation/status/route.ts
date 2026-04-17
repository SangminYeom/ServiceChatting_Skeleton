import { NextResponse } from "next/server";

function isBusinessHours(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const day = kst.getUTCDay(); // 0=일, 1=월, ..., 5=금, 6=토
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const isWorkingTime = minutes >= 9 * 60 && minutes < 18 * 60;

  return isWeekday && isWorkingTime;
}

export async function GET() {
  return NextResponse.json({ online: isBusinessHours() });
}
