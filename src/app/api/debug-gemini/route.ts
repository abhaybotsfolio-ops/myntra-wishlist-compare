import { NextResponse } from "next/server";

// TEMPORARY, minimal — just checking key presence again. Delete after.
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  return NextResponse.json({ hasKey: !!key, keyLength: key?.length ?? 0 });
}
