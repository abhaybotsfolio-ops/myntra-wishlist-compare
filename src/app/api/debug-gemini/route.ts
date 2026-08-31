import { NextResponse } from "next/server";

// TEMPORARY diagnostic route — not part of the shipped feature set. Added
// to answer one question directly (does this deployment's runtime actually
// see GEMINI_API_KEY, and can it reach Gemini with it) without needing
// Vercel dashboard/log access. Never echoes the key itself, only its
// presence/length and Gemini's own response. Delete this file once the
// live-Gemini path is confirmed working — RULES.md F5's "nothing extra
// in the shipped app" applies once diagnosis is done.
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  const info: Record<string, unknown> = {
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    keyPreview: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null,
  };

  if (key) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
          }),
        },
      );
      info.geminiHttpStatus = res.status;
      const text = await res.text();
      info.geminiBodyPreview = text.slice(0, 500);
    } catch (e) {
      info.fetchError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(info);
}
